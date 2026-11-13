import {validateDocument,sha256} from "./protocol.mjs";

const APP_ORIGIN="https://roberfernandez.github.io";
const APP_PATH="/computo-aac/";
const APP_URL=APP_ORIGIN+APP_PATH;
const SAP_ORIGIN="https://launcher.tmb.cat";
const SAP_URL=SAP_ORIGIN+"/apps#Shell-home";
const AUTH_ORIGIN="https://hhenkvendzengggrgook.supabase.co";
const VERIFY_URL=AUTH_ORIGIN+"/functions/v1/sap-admin-ticket";
const KEY="active-contrast";
const MAX_TICKET=3500;
const MAX_AGE_MS=15*60*1000;
const busyTabs=new Set();

function siteUrl(value){
 try{const u=new URL(value);return u.origin===APP_ORIGIN&&u.pathname.startsWith(APP_PATH);}catch{return false;}
}
function portalUrl(value){
 try{const u=new URL(value);return u.origin===SAP_ORIGIN&&/^\/apps\/?$/.test(u.pathname);}catch{return false;}
}
function grantValid(g){
 return !!g&&g.v===1&&typeof g.uid==="string"&&g.uid.length>0&&
   Number.isInteger(g.year)&&g.year>=2024&&g.scope==="year"&&
   /^[a-f0-9]{32}$/.test(g.nonce||"")&&
   typeof g.exp==="number"&&g.exp>Date.now()&&g.exp<Date.now()+MAX_AGE_MS&&
   g.callback===APP_URL+"sap-return/";
}
async function getJob(){return (await chrome.storage.session.get(KEY))[KEY]||null;}
async function setJob(job){await chrome.storage.session.set({[KEY]:job});}
async function clearJob(){await chrome.storage.session.remove(KEY);await chrome.action.setBadgeText({text:""});}
async function report(job,message,error=false){
 if(!job?.siteTabId)return;
 try{await chrome.tabs.sendMessage(job.siteTabId,{type:"status",message,error});}catch{}
}
async function verifyTicket(ticket){
 if(typeof ticket!=="string"||ticket.length<100||ticket.length>MAX_TICKET)throw Error("Tiquet invàlid");
 const response=await fetch(VERIFY_URL,{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({action:"verify",ticket}),signal:AbortSignal.timeout(15000),cache:"no-store"});
 if(!response.ok)throw Error("Tiquet caducat o no autoritzat");
 const json=await response.json();
 if(!grantValid(json.grant))throw Error("Autorització anual no vàlida");
 return json.grant;
}
async function verifyBrowserIdentity(tabId,grant){
 const results=await chrome.scripting.executeScript({target:{tabId},world:"ISOLATED",args:[grant],
   func:async g=>{
     if(location.origin!=="https://roberfernandez.github.io"||!location.pathname.startsWith("/computo-aac/"))return false;
     let session;try{session=JSON.parse(localStorage.getItem("sb-hhenkvendzengggrgook-auth-token")||"null");}catch{return false;}
     if(!session?.access_token||session.expires_at*1000<=Date.now())return false;
     const response=await fetch("https://hhenkvendzengggrgook.supabase.co/auth/v1/user",{
       headers:{apikey:"sb_publishable_QSPDTmh3fd0FH-VvAjH5KQ_Rfvzr2x_",Authorization:"Bearer "+session.access_token},
       signal:AbortSignal.timeout(10000),cache:"no-store"});
     if(!response.ok)return false;
     const user=await response.json();
     if(user.id!==g.uid||user.app_metadata?.computo_sap_admin!==true)return false;
     const db=await new Promise((resolve,reject)=>{
       const req=indexedDB.open("computo-sap-private-v1",2);
       req.onupgradeneeded=()=>{for(const name of ["exports","pending","tests"])if(!req.result.objectStoreNames.contains(name))req.result.createObjectStore(name,{keyPath:"key"});};
       req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
     });
     try{return await new Promise((resolve,reject)=>{
       const tx=db.transaction("pending","readonly"),req=tx.objectStore("pending").get(g.nonce);
       req.onsuccess=()=>{const saved=req.result;resolve(!!saved&&saved.uid===g.uid&&saved.nonce===g.nonce&&
         saved.year===g.year&&saved.scope===g.scope&&saved.exp>Date.now()&&saved.callback===g.callback);};
       req.onerror=()=>reject(req.error);
     });}finally{db.close();}
   }
 });
 return results?.[0]?.result===true;
}
async function saveToComputo(job,doc,hash,employeeNumber){
 const result=await chrome.scripting.executeScript({target:{tabId:job.siteTabId},world:"ISOLATED",
   args:[job.grant,doc,hash,employeeNumber],
   func:async (grant,doc,digest,sapEmployeeNumber)=>{
     if(location.origin!=="https://roberfernandez.github.io"||!location.pathname.startsWith("/computo-aac/"))throw Error("wrong-site");
     let session;try{session=JSON.parse(localStorage.getItem("sb-hhenkvendzengggrgook-auth-token")||"null");}catch{}
     if(!session?.access_token||session.expires_at*1000<=Date.now())throw Error("login-required");
     const response=await fetch("https://hhenkvendzengggrgook.supabase.co/auth/v1/user",{
       headers:{apikey:"sb_publishable_QSPDTmh3fd0FH-VvAjH5KQ_Rfvzr2x_",Authorization:"Bearer "+session.access_token},
       signal:AbortSignal.timeout(10000),cache:"no-store"});
     if(!response.ok)throw Error("login-required");
     const user=await response.json();
     if(user.id!==grant.uid||user.app_metadata?.computo_sap_admin!==true)throw Error("account-changed");
     let profile;try{profile=JSON.parse(localStorage.getItem("metro-profile-v2")||localStorage.getItem("metro-profile-v1")||"null");}catch{}
     const expectedEmployee=String(profile?.employeeNumber||"").trim();
     if(!/^[0-9]{1,8}$/.test(expectedEmployee)||!/^[0-9]{8}$/.test(sapEmployeeNumber)||
        expectedEmployee.padStart(8,"0")!==sapEmployeeNumber)
       throw Error("employee-mismatch");
     if(doc.period!==String(grant.year)||!Array.isArray(doc.rows)||doc.completedPeriods.length!==12)throw Error("wrong-period");
     const valoraciones=Object.fromEntries(doc.completedPeriods.map(period=>[
       period,doc.rows.filter(row=>new Date(Number(/^\/Date\((-?\d+)/.exec(row.Date)[1])).toISOString().startsWith(period))
     ]));
     const key=grant.uid+":"+grant.year;
     const db=await new Promise((resolve,reject)=>{
       const req=indexedDB.open("computo-sap-private-v1",2);
       req.onupgradeneeded=()=>{for(const name of ["exports","pending","tests"])if(!req.result.objectStoreNames.contains(name))req.result.createObjectStore(name,{keyPath:"key"});};
       req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
     });
     try{return await new Promise((resolve,reject)=>{
       let failure="save-failed";
       const tx=db.transaction(["pending","exports"],"readwrite"),pending=tx.objectStore("pending"),store=tx.objectStore("exports");
       pending.get(grant.nonce).onsuccess=event=>{
         const p=event.target.result;
         if(!p||p.uid!==grant.uid||p.nonce!==grant.nonce||p.year!==grant.year||p.scope!=="year"||
            p.exp<=Date.now()||p.callback!==grant.callback){failure="invalid-operation";tx.abort();return;}
         store.get(key).onsuccess=event=>{
           const previous=event.target.result;
           if(previous&&Date.parse(previous.doc.extraido)>Date.parse(doc.extractedAt)){
             failure="older-extraction";tx.abort();return;
           }
           store.put({key,doc:{ano:grant.year,extraido:doc.extractedAt,valoraciones},
             sha256:digest,
             history:[...(previous?.history||[]),{extraido:doc.extractedAt,cambios:0,records:doc.rows.length,sha256:digest}].slice(-12)});
           pending.delete(grant.nonce);
         };
       };
       tx.oncomplete=()=>resolve(true);
       tx.onabort=()=>reject(Error(failure));
       tx.onerror=()=>reject(tx.error||Error(failure));
     });}finally{db.close();}
   }
 });
 return result?.[0]?.result===true;
}
async function start(ticket,sender){
 if(!sender?.tab?.id||!siteUrl(sender.url||sender.tab.url))throw Error("La sol·licitud ha de venir de Còmput.");
 const existing=await getJob();
 if(existing&&existing.startedAt>Date.now()-MAX_AGE_MS&&existing.grant?.exp>Date.now())throw Error("Ja hi ha un contrast en marxa.");
 if(existing)await clearJob();
 const grant=await verifyTicket(ticket);
 if(!await verifyBrowserIdentity(sender.tab.id,grant))throw Error("El compte de Còmput no coincideix amb l'autorització.");
 const tab=await chrome.tabs.create({url:SAP_URL,active:true});
 const job={siteTabId:sender.tab.id,portalTabId:tab.id,grant,startedAt:Date.now()};
 await setJob(job);
 await chrome.action.setBadgeText({text:"SAP"});
 await chrome.action.setBadgeBackgroundColor({color:"#c29b38"});
 await report(job,"Portal TMB obert. Identifica't si ho demana i entra a Consultes Bàsiques.");
 return {ok:true};
}
async function poll(sender){
 const job=await getJob();
 if(!job||!sender?.tab||job.portalTabId!==sender.tab.id||!portalUrl(sender.url||sender.tab.url))
   return {status:"idle"};
 if(job.grant.exp<=Date.now()||Date.now()-job.startedAt>MAX_AGE_MS){
   await report(job,"La sessió de contrast ha caducat. Torna a iniciar-la.",true);
   await clearJob();return {status:"expired"};
 }
 if(busyTabs.has(job.portalTabId))return {status:"busy"};
 busyTabs.add(job.portalTabId);
 try{
   await chrome.scripting.executeScript({target:{tabId:job.portalTabId},world:"MAIN",args:[job.grant],
     func:g=>{if(location.origin==="https://launcher.tmb.cat"&&/^\/apps\/?$/.test(location.pathname))window.__computoSapGrant=g;}});
   await chrome.scripting.executeScript({target:{tabId:job.portalTabId},world:"MAIN",files:["probe.js"]});
   const snapshots=await chrome.scripting.executeScript({target:{tabId:job.portalTabId},world:"MAIN",
     func:()=>window.__tmbWebviewProbe?.snapshot()||null});
   const state=snapshots?.[0]?.result;
   if(state?.phase==="error")throw Error("SAP: "+String(state.error||"consulta fallida").slice(0,80));
   if(state?.phase!=="success")return {status:state?.phase||"waiting"};
   const result=await chrome.scripting.executeScript({target:{tabId:job.portalTabId},world:"MAIN",
     func:()=>window.__tmbWebviewProbe?.exportResult()||null});
   const doc=result?.[0]?.result;
   if(!doc)throw Error("No s'han pogut llegir les valoracions completes.");
   // SAP employee number is checked against the private Còmput profile and
   // deliberately removed from the stored valuation document.
   const employeeNumber=doc.employeeNumber;
   if(!/^[0-9]{8}$/.test(employeeNumber||""))throw Error("No s'ha pogut verificar el número d'empleat de SAP.");
   const normalized=validateDocument(doc,doc.rows?.length,String(job.grant.year));
   const hash=await sha256(JSON.stringify(normalized));
   if(!await saveToComputo(job,normalized,hash,employeeNumber))throw Error("No s'han pogut desar les valoracions en Còmput.");
   await clearJob();
   try{await chrome.tabs.remove(job.portalTabId);}catch{}
   await chrome.tabs.update(job.siteTabId,{active:true,url:APP_URL});
   return {status:"complete"};
 }catch(error){
   const detail=String(error?.message||"Error de consulta").slice(0,200);
   await report(job,"Contrast no completat: "+detail,true);
   await clearJob();
   await chrome.action.setBadgeText({text:"!"});
   await chrome.action.setBadgeBackgroundColor({color:"#b44a47"});
   return {status:"failed"};
 }finally{busyTabs.delete(job.portalTabId);}
}

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 if(message?.type==="start"){
   void start(message.ticket,sender).then(sendResponse).catch(err=>sendResponse({ok:false,error:String(err?.message||err).slice(0,200)}));
   return true;
 }
 if(message?.type==="poll"){
   void poll(sender).then(sendResponse).catch(()=>sendResponse({status:"failed"}));
   return true;
 }
 return false;
});
chrome.tabs.onRemoved.addListener(tabId=>{
 void getJob().then(async job=>{
   if(!job)return;
   if(tabId===job.siteTabId||tabId===job.portalTabId){
     if(tabId===job.portalTabId)await report(job,"S'ha tancat el portal abans d'acabar.",true);
     await clearJob();
   }
 }).catch(()=>{});
});
