export const WEB='https://roberfernandez.github.io';
const enc=new TextEncoder();
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const un64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export function ticketHandler({secret,authenticate,now=Date.now}){
  const signing=crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  return async req=>{
    const origin=req.headers.get('Origin');
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':WEB,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
    const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
    if(origin&&origin!==WEB)return reply(403,{error:'origin-denied'});
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(req.method!=='POST')return reply(405,{error:'method-denied'});
    try{
      const text=await req.text();if(text.length>4096)return reply(413,{error:'too-large'});
      const body=JSON.parse(text),key=await signing;
      if(body.action==='issue'){
        const auth=req.headers.get('Authorization')||'';
        if(!/^Bearer [^\s]+$/.test(auth))return reply(401,{error:'authentication-required'});
        const user=await authenticate(auth);
        if(!user)return reply(401,{error:'invalid-session'});
        if(user.app_metadata?.computo_sap_admin!==true)return reply(403,{error:'admin-only'});
        if(!Number.isInteger(body.year)||body.year<2024||body.year>new Date(now()).getUTCFullYear()||!['year','october-test'].includes(body.scope)||body.scope==='october-test'&&body.year!==2026)return reply(400,{error:'invalid-period'});
        const grant={v:1,uid:user.id,year:body.year,scope:body.scope,nonce:crypto.randomUUID().replace(/-/g,''),exp:now()+15*60*1000,callback:WEB+'/computo-aac/sap-return/'};
        const payload=b64(enc.encode(JSON.stringify(grant)));
        const sig=b64(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode('computo-sap-ticket-v1.'+payload))));
        return reply(200,{ticket:payload+'.'+sig,grant});
      }
      if(body.action==='verify'){
        if(typeof body.ticket!=='string'||!/^[-\w]+\.[-\w]+$/.test(body.ticket))return reply(403,{error:'invalid-ticket'});
        const [payload,sig]=body.ticket.split('.');
        if(!await crypto.subtle.verify('HMAC',key,un64(sig),enc.encode('computo-sap-ticket-v1.'+payload)))return reply(403,{error:'invalid-ticket'});
        const grant=JSON.parse(new TextDecoder().decode(un64(payload)));
        if(grant.v!==1||typeof grant.uid!=='string'||!grant.uid||grant.exp<=now()||grant.exp>now()+15*60*1000||grant.callback!==WEB+'/computo-aac/sap-return/')return reply(403,{error:'expired-ticket'});
        return reply(200,{grant});
      }
      return reply(400,{error:'invalid-action'});
    }catch{return reply(400,{error:'invalid-request'});}
  };
}
