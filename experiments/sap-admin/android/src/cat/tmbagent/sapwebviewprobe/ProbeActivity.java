package cat.tmbagent.sapwebviewprobe;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public class ProbeActivity extends Activity {
    private static final String START = "https://launcher.tmb.cat/apps#Shell-home";
    private static final int NAVY = Color.rgb(7,21,27);
    private static final int GOLD = Color.rgb(247,202,110);
    private static boolean webViewConfigured = false;
    private WebView web;
    private JSONObject grant;
    private boolean authorized=false;
    private ChromeReturn returnBridge;
    private boolean returnStarted=false;
    private TextView status, address;
    private Button startButton, retryButton;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String script = "";
    private boolean active = false, started = false, cleaning = false;
    private final Runnable poll = new Runnable() {
        @Override public void run() {
            if (!active) return;
            if (web != null && isPortal(web.getUrl()) && !cleaning) {
                web.evaluateJavascript("(function(){var p=window.__tmbWebviewProbe;return p?JSON.stringify(p.snapshot()):null;})()", value -> showSnapshot(value));
            }
            handler.postDelayed(this, 1000);
        }
    };

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!webViewConfigured) {
            if (Build.VERSION.SDK_INT >= 28) WebView.setDataDirectorySuffix("sap_probe_v1");
            WebView.setWebContentsDebuggingEnabled(false);
            webViewConfigured = true;
        }
        try (InputStream in = getAssets().open("probe.js");
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096]; int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer,0,n);
            script = new String(out.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            status = new TextView(this); status.setText("No se ha podido cargar la prueba.");
            setContentView(status); return;
        }
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(NAVY);
        root.setFitsSystemWindows(true);
        int pad = dp(12); root.setPadding(pad,pad,pad,pad);
        TextView title = text("Còmput · Contrast amb TMB", 19, GOLD);
        root.addView(title);
        TextView intro = text("Inicia sesión en el portal oficial. La consulta autorizada se ejecutará al abrir Consultes Bàsiques.", 13, Color.WHITE);
        intro.setPadding(0,dp(5),0,dp(5)); root.addView(intro);
        LinearLayout actions = new LinearLayout(this);
        startButton = new Button(this); startButton.setText("Iniciar prueba");
        startButton.setTextSize(12);
        retryButton = new Button(this); retryButton.setText("Reintentar consulta");
        retryButton.setTextSize(12); retryButton.setEnabled(false);
        Button erase = new Button(this); erase.setText("Borrar sesión"); erase.setTextSize(12);
        actions.addView(startButton,new LinearLayout.LayoutParams(0,dp(48),1));
        actions.addView(retryButton,new LinearLayout.LayoutParams(0,dp(48),1));
        actions.addView(erase,new LinearLayout.LayoutParams(0,dp(48),1));
        root.addView(actions);
        status = text("Pendiente de iniciar · Referencia anterior: 127 registros.\nLos datos de esta prueba permanecen en el dispositivo.",13,Color.WHITE);
        ScrollView statusScroll = new ScrollView(this);
        statusScroll.addView(status);
        root.addView(statusScroll,new LinearLayout.LayoutParams(-1,dp(102)));
        address = text("Pont privat · v0.3.2",11,GOLD);
        root.addView(address,new LinearLayout.LayoutParams(-1,dp(26)));
        web = new WebView(this);
        root.addView(web,new LinearLayout.LayoutParams(-1,0,1));
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSaveFormData(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,true);
        web.setWebChromeClient(new WebChromeClient());
        web.setDownloadListener((url,userAgent,contentDisposition,mimetype,contentLength) -> status.setText("Esta prueba no descarga archivos."));
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("https".equalsIgnoreCase(u.getScheme())) return false;
                status.setText("El portal ha solicitado un enlace externo (" + u.getScheme() + "). La prueba se ha detenido en este paso.");
                return true;
            }
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap favicon) {
                Uri u = Uri.parse(url);
                address.setText((u.getHost() == null ? "Portal" : u.getHost()) + " · " + webViewVersion());
                retryButton.setEnabled(false);
                if (!isPortal(url)) status.setText("Autenticación corporativa en " + (u.getHost() == null ? "el portal" : u.getHost()) + ".\nIntroduce tus credenciales únicamente en la página oficial.");
            }
            @Override public void onPageFinished(WebView view,String url) {
                if (isPortal(url) && !cleaning) {
                    view.evaluateJavascript("window.__computoSapGrant="+grant.toString()+";"+script, result -> {
                        if (isPortal(web.getUrl())) {
                            retryButton.setEnabled(true);
                            status.setText("Esperando a SAP y Consultes Bàsiques…\nSi no se abre automáticamente, entra desde el portal.");
                        }
                    });
                }
            }
            @Override public void onReceivedSslError(WebView view,SslErrorHandler sslHandler,SslError error) {
                sslHandler.cancel();
                status.setText("Error de certificado TLS. La conexión se ha cancelado.");
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error) {
                if (request.isForMainFrame()) status.setText("No se ha podido abrir el portal (error " + error.getErrorCode() + ").\nComprueba la conexión y vuelve a iniciar la prueba.");
            }
        });
        startButton.setOnClickListener(v -> begin());
        retryButton.setOnClickListener(v -> {
            if(returnBridge!=null){returnBridge.close();returnBridge=null;}returnStarted=false;
            if (isPortal(web.getUrl())) web.evaluateJavascript("window.__tmbWebviewProbe && window.__tmbWebviewProbe.retry()",null);
        });
        verifyLaunch();
        erase.setOnClickListener(v -> new AlertDialog.Builder(this)
            .setMessage("¿Borrar la sesión y los datos de esta prueba?")
            .setPositiveButton("Borrar",(dialog,which) -> clearSession(false))
            .setNegativeButton("Cancelar",null).show());
    }

    private void verifyLaunch(){
        Uri link=getIntent().getData();
        String ticket=link!=null&&"computo-tmb".equals(link.getScheme())&&"sync".equals(link.getHost())?link.getQueryParameter("ticket"):null;
        startButton.setEnabled(false);retryButton.setEnabled(false);
        if(ticket==null||ticket.length()>3500){status.setText("Abre esta función desde Contrastar dades amb TMB en tu cuenta administradora de Còmput.");return;}
        status.setText("Verificando acceso privado…");
        new Thread(()->{
            java.net.HttpURLConnection connection=null;
            try{
                connection=(java.net.HttpURLConnection)new java.net.URL("https://hhenkvendzengggrgook.supabase.co/functions/v1/sap-admin-ticket").openConnection();
                connection.setRequestMethod("POST");connection.setConnectTimeout(10000);connection.setReadTimeout(10000);connection.setInstanceFollowRedirects(false);connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");
                byte[] body=new JSONObject().put("action","verify").put("ticket",ticket).toString().getBytes(StandardCharsets.UTF_8);
                connection.getOutputStream().write(body);
                if(connection.getResponseCode()!=200)throw new Exception();
                String json;try(InputStream in=connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buffer=new byte[2048];int n;while((n=in.read(buffer))!=-1){out.write(buffer,0,n);if(out.size()>6000)throw new Exception();}json=new String(out.toByteArray(),StandardCharsets.UTF_8);}
                JSONObject approved=new JSONObject(json).getJSONObject("grant");
                if(approved.optString("uid", "").isEmpty()||approved.getLong("exp")<=System.currentTimeMillis()||!"https://roberfernandez.github.io/computo-aac/sap-return/".equals(approved.getString("callback")))throw new Exception();
                runOnUiThread(()->{grant=approved;authorized=true;startButton.setEnabled(true);begin();});
            }catch(Exception e){runOnUiThread(()->status.setText("Acceso no autorizado o caducado. Vuelve a iniciar el contraste desde Còmput."));}
            finally{if(connection!=null)connection.disconnect();}
        }).start();
    }
    private void begin() {
        if (web == null || cleaning || !authorized || grant==null || grant.optLong("exp")<=System.currentTimeMillis()) return;
        started = true;
        startButton.setText("Abrir portal");
        status.setText("Abriendo el portal oficial…");
        web.loadUrl(START);
    }
    private void clearSession(boolean loadAfter) {
        cleaning = true;
        web.stopLoading();
        if (isPortal(web.getUrl())) web.evaluateJavascript("window.__tmbWebviewProbe && window.__tmbWebviewProbe.clear()",null);
        web.loadUrl("about:blank");
        WebStorage.getInstance().deleteAllData();
        web.clearCache(true); web.clearHistory();
        CookieManager.getInstance().removeAllCookies(ok -> {
            cleaning = false; started = loadAfter;
            status.setText(loadAfter ? "Abriendo el portal oficial con una sesión nueva…" : "Sesión borrada. No se conserva ninguna extracción.");
            if (loadAfter) { startButton.setText("Abrir portal"); web.loadUrl(START); }
            else { startButton.setText("Iniciar prueba"); retryButton.setEnabled(false); address.setText("Sesión de prueba borrada"); }
        });
    }
    private void showSnapshot(String value) {
        if (value == null || value.equals("null") || cleaning || returnStarted || !isPortal(web.getUrl())) return;
        try {
            Object outer = new JSONTokener(value).nextValue();
            if (!(outer instanceof String)) return;
            JSONObject s = new JSONObject((String) outer);
            String phase = s.optString("phase");
            if (phase.equals("success")) {
                int count = s.getInt("records");
                status.setText("HTTP " + s.getInt("http") + " · "+s.optString("period")+" · " + count + " registros\n"
                    + ("year".equals(grant.optString("scope")) ? "Consulta anual de los doce meses completada." : count == 127 ? "El recuento coincide con los 127 de Chrome." : "El recuento difiere de los 127 anteriores; debe revisarse.")
                    + "\n" + s.optString("firstDate","") + " → " + s.optString("lastDate","")
                    + " · " + s.optInt("pages") + " página(s) · " + (s.optInt("elapsedMs")/1000.0) + " s"
                    + "\nSesión y extracción locales; no se han enviado a Còmput.");
                status.setTextColor(("year".equals(grant.optString("scope")) || count == 127) ? Color.rgb(154,230,180) : GOLD);
                if (authorized && !returnStarted) startReturn();
            } else {
                status.setTextColor(Color.WHITE);
                if (phase.equals("error")) status.setText("Consulta detenida: " + s.optString("error") + "\nHTTP: " + s.optString("http","—") + ". Puedes reintentar.");
                else if (phase.equals("querying")) status.setText("Consultando el período autorizado…\nPáginas: " + s.optInt("pages") + " · Registros recibidos: " + s.optInt("records"));
                else if (phase.equals("identity-ambiguous")) status.setText("El portal ha devuelto más de un empleado. No se inicia la consulta.");
                else if (phase.equals("waiting-data")) status.setText("Consultes Bàsiques abierto. Esperando sus datos para identificar tu sesión…\n" + s.optString("diagnostics", ""));
                else if (phase.equals("identified")) status.setText("Identidad obtenida del portal. Iniciando consulta…");
                else status.setText("Esperando al portal SAP…\nSi hace falta, entra a Consultes Bàsiques desde el menú.");
            }
        } catch (Exception ignored) {}
    }

    private void startReturn() {
        if(returnStarted||web==null||!isPortal(web.getUrl()))return;
        returnStarted=true;
        web.evaluateJavascript("(function(){var p=window.__tmbWebviewProbe;var r=p&&p.exportResult();return r?JSON.stringify(r):null;})()",value->{
            try {
                Object decoded=new JSONTokener(value).nextValue();
                if(!(decoded instanceof String))throw new IllegalArgumentException();
                String payload=(String)decoded;
                String config;
                try(InputStream in=getAssets().open("return-config.json");ByteArrayOutputStream out=new ByteArrayOutputStream()){
                    byte[] b=new byte[1024];int n;while((n=in.read(b))!=-1)out.write(b,0,n);config=new String(out.toByteArray(),StandardCharsets.UTF_8);
                }
                returnBridge=new ChromeReturn(this,new JSONObject(config).getString("origin"),grant.getString("callback"),grant.getString("nonce"),new ChromeReturn.Listener(){
                    public void status(String text){runOnUiThread(()->status.setText(text));}
                    public void complete(int count,String hash){status.setText("RETORNO CONFIRMADO · "+count+" registros guardados en Chrome\nIntegridad "+hash.substring(0,12)+" · Còmput actualizado.");}
                    public void error(String code){status.setText("Retorno pendiente: "+code+"\nLa consulta SAP se ha conservado. La copia anterior de Còmput se conserva.");}
                });
                returnBridge.begin(payload);
            } catch(Exception e){status.setText("No se ha podido preparar el retorno.");}
        });
    }

    private boolean isPortal(String value) {
        if (value == null) return false;
        Uri u = Uri.parse(value);
        return "https".equalsIgnoreCase(u.getScheme()) && "launcher.tmb.cat".equalsIgnoreCase(u.getHost())
            && (u.getPort() == -1 || u.getPort() == 443) && ("/apps".equals(u.getPath()) || "/apps/".equals(u.getPath()));
    }
    private String webViewVersion() {
        PackageInfo p = WebView.getCurrentWebViewPackage();
        return p == null ? "WebView" : "WebView " + p.versionName;
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private TextView text(String value,int size,int color) {
        TextView t = new TextView(this); t.setText(value); t.setTextSize(size); t.setTextColor(color); return t;
    }
    @Override protected void onResume() { super.onResume(); active = true; handler.removeCallbacks(poll); handler.post(poll); }
    @Override protected void onPause() { active = false; handler.removeCallbacks(poll); super.onPause(); }
    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        active = false; handler.removeCallbacks(poll);
        if(returnBridge!=null)returnBridge.close();
        if (web != null) {
            web.stopLoading(); web.loadUrl("about:blank");
            CookieManager.getInstance().flush();
            web.destroy(); web = null;
        }
        super.onDestroy();
    }
}
