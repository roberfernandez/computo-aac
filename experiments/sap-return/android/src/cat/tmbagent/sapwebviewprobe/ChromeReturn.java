package cat.tmbagent.sapwebviewprobe;
import android.app.Activity;
import android.util.Log;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.customtabs.CustomTabsService;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;
import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

final class ChromeReturn {
  interface Listener {void status(String text);void complete(int count,String hash);void error(String code);}
  private final Activity activity;
  private final Listener listener;
  private final Uri origin;
  private final Handler handler=new Handler(Looper.getMainLooper());
  private final List<String> chunks=new ArrayList<>();
  private CustomTabsSession session;
  private CustomTabsServiceConnection connection;
  private boolean validated,navigated,requested,finished,bound;
  private String id,hash,period;
  private int count,length,next=0;
  private final Runnable timeout=()->fail("timeout");
  ChromeReturn(Activity activity,String originString,Listener listener){
    this.activity=activity;this.listener=listener;origin=Uri.parse(originString);
    if(!"https".equals(origin.getScheme())||origin.getHost()==null||origin.getUserInfo()!=null||origin.getQuery()!=null||origin.getFragment()!=null||!("/".equals(origin.getPath())||"".equals(origin.getPath())))throw new IllegalArgumentException("invalid-return-origin");
  }
  void begin(String payload){
    if(connection!=null)return;
    try{
      JSONObject doc=new JSONObject(payload);
      period=doc.getString("period");count=doc.getJSONArray("rows").length();length=payload.length();
      if(length<2||length>6*1024*1024||count>10000)throw new IllegalArgumentException();
      id=UUID.randomUUID().toString().replace("-","");
      byte[] digest=MessageDigest.getInstance("SHA-256").digest(payload.getBytes(StandardCharsets.UTF_8));
      StringBuilder encoded=new StringBuilder();for(byte b:digest)encoded.append(String.format(java.util.Locale.ROOT,"%02x",b&255));hash=encoded.toString();
      for(int offset=0;offset<payload.length();){int end=Math.min(offset+24000,payload.length());if(end<payload.length()&&Character.isHighSurrogate(payload.charAt(end-1)))end--;chunks.add(payload.substring(offset,end));offset=end;}
      String browser=CustomTabsClient.getPackageName(activity,Collections.singletonList("com.android.chrome"));
      if(browser==null){fail("chrome-unavailable");return;}
      connection=new CustomTabsServiceConnection(){
        @Override public void onCustomTabsServiceConnected(ComponentName name,CustomTabsClient client){
          Log.i("TmbReturn","browser-connected");
          client.warmup(0);
          session=client.newSession(callback);
          if(session==null){fail("session-unavailable");return;}
          listener.status("Chrome está verificando el canal de retorno…");
          boolean accepted=session.validateRelationship(CustomTabsService.RELATION_USE_AS_ORIGIN,origin,null);
          Log.i("TmbReturn","validation-request="+accepted);
          if(!accepted){fail("validation-not-supported");return;}
          CustomTabsIntent tab=new CustomTabsIntent.Builder(session).setShareState(CustomTabsIntent.SHARE_STATE_OFF).build();
          tab.intent.setPackage(browser);
          tab.launchUrl(activity,Uri.parse(origin.toString().replaceAll("/$","")+"/#request="+id));
        }
        @Override public void onServiceDisconnected(ComponentName name){if(!finished)fail("chrome-disconnected");}
      };
      bound=CustomTabsClient.bindCustomTabsService(activity,browser,connection);
      if(!bound){fail("chrome-bind-failed");return;}
      handler.postDelayed(timeout,90000);
    }catch(Exception e){fail("invalid-payload");}
  }
  private final CustomTabsCallback callback=new CustomTabsCallback(){
    @Override public void onRelationshipValidationResult(int relation,Uri requestedOrigin,boolean result,Bundle extras){
      Log.i("TmbReturn","validation-result="+result+" origin="+requestedOrigin+" relation="+relation);
      if(!sameOrigin(origin,requestedOrigin)||relation!=CustomTabsService.RELATION_USE_AS_ORIGIN)return;
      validated=result;if(!result){fail("origin-validation-failed");return;}requestChannel();
    }
    @Override public void onNavigationEvent(int event,Bundle extras){
      Log.i("TmbReturn","navigation="+event);
      if(event==CustomTabsCallback.NAVIGATION_FINISHED){navigated=true;requestChannel();}
      else if(event==CustomTabsCallback.NAVIGATION_FAILED)fail("page-load-failed");
    }
    @Override public void onMessageChannelReady(Bundle extras){
      Log.i("TmbReturn","channel-ready");
      try{send(new JSONObject().put("type","hello").put("id",id));}catch(Exception e){fail("handshake-error");}
    }
    @Override public void onPostMessage(String message,Bundle extras){
      if(finished||message==null||message.length()>50000)return;
      try{
        JSONObject m=new JSONObject(message);
        if(!id.equals(m.optString("id")))return;
        String type=m.optString("type");
        Log.i("TmbReturn","received="+type);
        if(type.equals("ready"))send(new JSONObject().put("type","begin").put("id",id).put("length",length).put("count",count).put("period",period).put("sha256",hash));
        else if(type.equals("begin-ack")&&next==0)sendNext();
        else if(type.equals("ack")&&m.optInt("seq",-1)==next-1)sendNext();
        else if(type.equals("complete")){
          if(m.optInt("count",-1)!=count||!hash.equals(m.optString("sha256"))||!period.equals(m.optString("period"))){fail("confirmation-mismatch");return;}
          finished=true;handler.removeCallbacks(timeout);chunks.clear();
          activity.runOnUiThread(()->listener.complete(count,hash));
        }else if(type.equals("error"))fail("receiver-"+m.optString("code","error"));
      }catch(Exception e){fail("invalid-confirmation");}
    }
  };
  private void requestChannel(){
    if(finished||requested||!validated||!navigated||session==null)return;
    requested=true;
    boolean channelAccepted=session.requestPostMessageChannel(origin,origin,new Bundle());
    Log.i("TmbReturn","channel-request="+channelAccepted);
    if(!channelAccepted)fail("channel-rejected");
  }
  private void sendNext(){
    if(finished)return;
    try{
      if(next<chunks.size()){
        int seq=next++;
        send(new JSONObject().put("type","chunk").put("id",id).put("seq",seq).put("data",chunks.get(seq)));
      }else send(new JSONObject().put("type","end").put("id",id));
    }catch(Exception e){fail("send-failed");}
  }
  private void send(JSONObject message){
    if(finished||session==null)return;
    if(session.postMessage(message.toString(),null)!=CustomTabsService.RESULT_SUCCESS)fail("message-rejected");
  }
  private void fail(String code){
    if(finished)return;Log.i("TmbReturn","failed="+code);finished=true;handler.removeCallbacks(timeout);chunks.clear();
    activity.runOnUiThread(()->listener.error(code));
  }
  private boolean sameOrigin(Uri a,Uri b){
    if(b==null)return false;
    int ap=a.getPort()==-1?443:a.getPort(),bp=b.getPort()==-1?443:b.getPort();
    return a.getScheme().equalsIgnoreCase(b.getScheme())&&a.getHost().equalsIgnoreCase(b.getHost())&&ap==bp;
  }
  void close(){handler.removeCallbacks(timeout);if(bound&&connection!=null){try{activity.unbindService(connection);}catch(Exception ignored){}}chunks.clear();}
}
