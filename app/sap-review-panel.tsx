"use client";

import {useEffect,useState} from "react";
import {storePending,verifiedOwner} from "../public/sap-return/storage.mjs";
import {readSharedSession,SUPABASE_PUBLIC_KEY,SUPABASE_URL} from "./tmb-session";
import {comparisonReviewKey,comparisonFingerprint,isAcceptedReview,pendingGroup} from "@/lib/sap-difference-reviews";
import {compareSapToComputo,sapChangeCount,validateSapExport} from "@/lib/sap-comparison";
import {decideSapCloudSync,minimalSapRecord,readSapCloudPayload,sapCloudByteSize,sapCloudKey,MAX_SAP_CLOUD_BYTES} from "@/lib/sap-cloud-sync";

type ValueRow = {Date:string;LongText:string;Number:string;Wagetype?:string};
type ExportDoc = {ano:number;extraido:string;valoraciones:Record<string,ValueRow[]>};
type StoredDoc = {key:string;doc:ExportDoc;history:{extraido:string;cambios:number}[]};
type Difference = {period:string;id:string;concept:string;unit:string;sap:number;computed:number|null;difference:number|null;days:{date:string;sap:number;computed:number;difference:number}[];note:string;status:string;reason:string};
type Reviewed = {fingerprint:string;note:string;reviewedAt:string};
type ReviewMap = Record<string,Reviewed>;
const DB_NAME="computo-sap-private-v1",STORE="exports";
const SAP_BRIDGE_ANDROID_APK="https://raw.githubusercontent.com/roberfernandez/computo-aac/5cd483fba1d0ab1c8aa1928bf44d64bd3fa7430f/releases/sap-bridge-0.3.2/computo-pont-tmb-v0.3.2.apk";
// Chrome only allows normal Windows users to install an extension through Chrome Web Store.
// The ID is set only after Google approves the private pilot; never link a manual ZIP as the default.
const SAP_BRIDGE_WINDOWS_EXE="https://github.com/roberfernandez/computo-aac/releases/download/sap-windows-installer-v0.1.1/PontSAP-Windows-Instalador-Prueba-v0.1.1.exe";
const SAP_BRIDGE_CHROME_WEBSTORE_ID=process.env.NEXT_PUBLIC_SAP_BRIDGE_CHROME_WEBSTORE_ID||"";
const SAP_BRIDGE_CHROME_WEBSTORE_URL=/^[a-p]{32}$/.test(SAP_BRIDGE_CHROME_WEBSTORE_ID)
  ?"https://chromewebstore.google.com/detail/"+SAP_BRIDGE_CHROME_WEBSTORE_ID:null;
const dayFmt=(date:string)=>new Date(date).toLocaleString("es-ES",{dateStyle:"medium",timeStyle:"short"});
function openPrivateDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB_NAME,2);
    r.onupgradeneeded=()=>{for(const name of [STORE,"pending","tests"])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:"key"});};
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(r.error||Error("No hay acceso al almacenamiento local."));
  });
}
async function getSaved(uid:string,year:number):Promise<StoredDoc|null>{
  const db=await openPrivateDb();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readonly"),req=tx.objectStore(STORE).get(uid+":"+year);
    req.onsuccess=()=>resolve(req.result||null);
    req.onerror=()=>reject(req.error);
  });}finally{db.close();}
}
async function replaceSaved(uid:string,doc:ExportDoc):Promise<{record:StoredDoc;cambios:number}>{
  const db=await openPrivateDb();
  try {
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite"),store=tx.objectStore(STORE);
      const req=store.get(uid+":"+doc.ano);
      let result:{record:StoredDoc;cambios:number}|null=null;
      let stopped=false;
      req.onsuccess=()=>{
        const old=(req.result||null) as StoredDoc|null;
        if(old && Date.parse(doc.extraido)<Date.parse(old.doc.extraido)){
          stopped=true;tx.abort();return;
        }
        const cambios=old?sapChangeCount(old.doc,doc):0;
        const record:StoredDoc={
          key:uid+":"+doc.ano,doc,
          history:[...(old?.history||[]),{extraido:doc.extraido,cambios}].slice(-12)
        };
        store.put(record);result={record,cambios};
      };
      tx.oncomplete=()=>result?resolve(result):reject(Error("No se ha guardado el archivo."));
      tx.onabort=()=>reject(Error(stopped?"La extracción es anterior a la guardada. Se conserva la versión más reciente.":"No se ha podido guardar la extracción."));
      tx.onerror=()=>reject(tx.error||Error("Error de almacenamiento local."));
    });
  }finally{db.close();}
}

type CloudSapRecord={version:1;doc:ExportDoc;history:StoredDoc["history"]};
// The existing approved-account RLS on computo_sync isolates annual SAP snapshots.
// Only the reduced valuations (not the TMB calendar or SAP credentials) are sent.
async function loadPrivateSap(uid:string,year:number):Promise<CloudSapRecord|null>{
  const session=await reviewSession(uid);
  const response=await fetch(SUPABASE_URL+"/rest/v1/computo_sync?user_id=eq."+encodeURIComponent(uid)+"&storage_key=eq."+encodeURIComponent(sapCloudKey(year))+"&select=payload",{
    headers:reviewHeaders(session.access_token),cache:"no-store",signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)throw Error("No s'ha pogut consultar la còpia SAP del núvol ("+response.status+").");
  const rows=await response.json();
  if(!Array.isArray(rows))throw Error("Resposta SAP del núvol desconeguda.");
  return rows[0]?.payload?readSapCloudPayload(rows[0].payload,year) as CloudSapRecord:null;
}
async function uploadPrivateSap(uid:string,year:number,local:StoredDoc):Promise<boolean>{
  const payload=minimalSapRecord(local,year) as CloudSapRecord;
  if(sapCloudByteSize(payload)>MAX_SAP_CLOUD_BYTES)throw Error("Les valoracions SAP superen la mida màxima de sincronització.");
  // Re-read immediately before writing so an older extraction cannot normally replace
  // a newer one saved by another device. Equal-date divergences remain local.
  const latest=await loadPrivateSap(uid,year);
  if(latest){
    const decision=decideSapCloudSync({doc:payload.doc},latest);
    if(decision==="download"||decision==="same")return false;
    if(decision==="conflict")throw Error("Hi ha dues còpies SAP diferents amb la mateixa data. No s'ha sobreescrit cap dada.");
  }
  const session=await reviewSession(uid);
  const response=await fetch(SUPABASE_URL+"/rest/v1/computo_sync?on_conflict=user_id,storage_key",{
    method:"POST",headers:{...reviewHeaders(session.access_token),Prefer:"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify({user_id:uid,storage_key:sapCloudKey(year),payload,updated_at:new Date().toISOString()}),
    signal:AbortSignal.timeout(20000)
  });
  if(!response.ok)throw Error("No s'ha pogut desar la còpia SAP privada ("+response.status+").");
  return true;
}
async function adoptPrivateSap(uid:string,year:number,cloud:CloudSapRecord):Promise<StoredDoc>{
  const db=await openPrivateDb();
  try {
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite"),store=tx.objectStore(STORE);
      const key=uid+":"+year,request=store.get(key);
      let result:StoredDoc|null=null;
      request.onsuccess=()=>{
        const current=(request.result||null) as StoredDoc|null;
        const decision=decideSapCloudSync(current,cloud);
        if(decision==="upload"||decision==="same"){
          result=current;return;
        }
        if(decision==="conflict"){tx.abort();return;}
        if(current){
          // Preserve the previous complete local copy, even when the cloud is newer.
          store.put({...current,key:key+":cloud-backup:"+Date.now()});
        }
        const record:StoredDoc={key,doc:cloud.doc,history:cloud.history.slice(-12)};
        store.put(record);result=record;
      };
      tx.oncomplete=()=>result?resolve(result):reject(Error("No s'ha pogut carregar la còpia SAP del núvol."));
      tx.onabort=()=>reject(Error("Conflicte de còpies SAP. Es conserva la còpia local."));
      tx.onerror=()=>reject(tx.error||Error("No s'ha pogut guardar la còpia SAP recuperada."));
    });
  }finally{db.close();}
}
async function synchronizePrivateSap(uid:string,year:number):Promise<StoredDoc|null>{
  // Never delete an existing local snapshot on a network/authentication failure.
  const local=await getSaved(uid,year);
  const remote=await loadPrivateSap(uid,year);
  const safeLocal=local?{...local,...minimalSapRecord(local,year)}:null;
  const decision=decideSapCloudSync(safeLocal,remote);
  if(decision==="empty"||decision==="same")return local;
  if(decision==="conflict")throw Error("Dues còpies SAP diferents amb la mateixa extracció. Es conserven sense substituir.");
  if(decision==="download"){
    if(!remote)throw Error("Falta la còpia SAP remota.");
    return adoptPrivateSap(uid,year,remote);
  }
  if(!local)throw Error("Falta la còpia SAP local.");
  await uploadPrivateSap(uid,year,local);
  // A newer cloud snapshot can appear between the initial read and the upload guard.
  const newer=await loadPrivateSap(uid,year);
  if(newer&&decideSapCloudSync(safeLocal,newer)==="download")return adoptPrivateSap(uid,year,newer);
  return local;
}

function localFacts(year:number):unknown{
  try{return JSON.parse(localStorage.getItem("metro-payroll-facts-v1-"+year)||"null");}
  catch{return null;}
}
const showNum=(n:number|null)=>n===null?"—":n.toLocaleString("es-ES",{minimumFractionDigits:0,maximumFractionDigits:2});
function reviewStorageKey(year:number){return "metro-sap-reviewed-v1-"+year;}
function reviewHeaders(token:string){return {apikey:SUPABASE_PUBLIC_KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"};}
async function reviewSession(uid:string){
 const session=readSharedSession();
 if(!session||await verifiedOwner()!==uid)throw Error("Cal iniciar sessió amb el compte administrador.");
 return session;
}
async function loadPrivateReviews(uid:string,year:number):Promise<ReviewMap>{
 const session=await reviewSession(uid),key=encodeURIComponent(reviewStorageKey(year));
 const response=await fetch(SUPABASE_URL+"/rest/v1/computo_sync?user_id=eq."+encodeURIComponent(uid)+"&storage_key=eq."+key+"&select=payload",{
  headers:reviewHeaders(session.access_token),cache:"no-store"
 });
 if(!response.ok)throw Error("No s'han pogut carregar les revisions privades ("+response.status+").");
 const rows=await response.json(),payload=rows[0]?.payload;
 return payload?.version===1&&payload.reviews&&typeof payload.reviews==="object"&&!Array.isArray(payload.reviews)?payload.reviews:{};
}
async function savePrivateReviews(uid:string,year:number,reviews:ReviewMap){
 const session=await reviewSession(uid);
 const response=await fetch(SUPABASE_URL+"/rest/v1/computo_sync?on_conflict=user_id,storage_key",{
  method:"POST",headers:{...reviewHeaders(session.access_token),Prefer:"resolution=merge-duplicates,return=minimal"},
  body:JSON.stringify({user_id:uid,storage_key:reviewStorageKey(year),payload:{version:1,reviews},updated_at:new Date().toISOString()})
 });
 if(!response.ok)throw Error("No s'ha pogut desar la revisió privada ("+response.status+").");
}
type SapReviewPanelProps={year:number;facts?:unknown};
export default function SapReviewPanel({year,facts}:SapReviewPanelProps){
  const [auth,setAuth]=useState<"checking"|"owner"|"hidden">("checking");
  const [uid,setUid]=useState("");
  const [desktopBridge,setDesktopBridge]=useState(false);
  const [bridgePlatform,setBridgePlatform]=useState<"checking"|"android"|"desktop"|"unsupported">("checking");
  const [androidGuide,setAndroidGuide]=useState(false);
  const [saved,setSaved]=useState<StoredDoc|null>(null);
  const [sapSyncState,setSapSyncState]=useState<"checking"|"empty"|"synced"|"offline"|"error">("checking");
  const [sapSyncError,setSapSyncError]=useState("");
  const [sapSyncRetry,setSapSyncRetry]=useState(0);
  const [checked,setChecked]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [expanded,setExpanded]=useState(false);
  const [revision,setRevision]=useState(0);
  const [reviews,setReviews]=useState<ReviewMap>({});
  const [reviewState,setReviewState]=useState<"loading"|"ready"|"error">("loading");
  const [reviewSaving,setReviewSaving]=useState("");
  const [reviewDrafts,setReviewDrafts]=useState<Record<string,string>>({});
  useEffect(()=>{
    let active=true;
    const ua=navigator.userAgent;
    queueMicrotask(()=>{
      if(!active)return;
      setBridgePlatform(/Android/i.test(ua)?"android":/Windows|Macintosh|Linux/i.test(ua)?"desktop":"unsupported");
      if(new URLSearchParams(window.location.search).get("pont")==="instala-android"){
        setAndroidGuide(true);
        setNotice("No s'ha pogut obrir el pont Android. Segueix les instruccions d'instal·lació i torna a provar-ho.");
      }
    });
    const onDesktopBridge=(event:MessageEvent)=>{
      if(event.source!==window||event.origin!==window.location.origin||
        event.data?.source!=="computo-sap-chrome-v1")return;
      if(event.data.type==="ready")setDesktopBridge(true);
      else if(["started","status","error"].includes(event.data.type)&&typeof event.data.message==="string")
        setNotice(event.data.message.slice(0,240));
    };
    window.addEventListener("message",onDesktopBridge);
    window.postMessage({source:"computo-sap-web-v1",type:"ping"},window.location.origin);
    return()=>{active=false;window.removeEventListener("message",onDesktopBridge);};
  },[]);
  useEffect(()=>{
    let active=true;
    const s=readSharedSession();
    if(!s){queueMicrotask(()=>{if(active)setAuth("hidden");});return()=>{active=false;};}
    void verifiedOwner().then(id=>{
      if(!active)return;
      if(id){setUid(id);setAuth("owner");}
      else setAuth("hidden");
    }).catch(()=>{if(active)setAuth("hidden");});
    return()=>{active=false;};
  },[]);
  useEffect(()=>{
    if(auth!=="owner"||!uid)return;
    let active=true,running=false;
    queueMicrotask(()=>{if(active){setSaved(null);setSapSyncState("checking");setSapSyncError("");}});
    async function syncNow(){
      if(running||!active)return;
      running=true;
      try{
        const local=await getSaved(uid,year);
        if(active)setSaved(local);
        const latest=await synchronizePrivateSap(uid,year);
        if(active){setSaved(latest);setSapSyncState(latest?"synced":"empty");setSapSyncError("");}
      }catch(e){
        if(active){
          const message=e instanceof Error?e.message:"No s'han pogut sincronitzar les valoracions SAP.";
          setSapSyncError(message);
          setSapSyncState(typeof navigator!=="undefined"&&!navigator.onLine?"offline":"error");
        }
      }finally{running=false;}
    }
    const focus=()=>{void syncNow();};
    const visibility=()=>{if(!document.hidden)void syncNow();};
    window.addEventListener("focus",focus);
    window.addEventListener("online",focus);
    window.addEventListener("pageshow",focus);
    document.addEventListener("visibilitychange",visibility);
    void syncNow();
    return()=>{active=false;window.removeEventListener("focus",focus);window.removeEventListener("online",focus);window.removeEventListener("pageshow",focus);document.removeEventListener("visibilitychange",visibility);};
  },[uid,auth,year,revision,sapSyncRetry]);
  useEffect(()=>{
    if(auth!=="owner"||!uid)return;
    let active=true;
    queueMicrotask(()=>{if(active){setReviews({});setReviewState("loading");}});
    void loadPrivateReviews(uid,year).then(value=>{if(active){setReviews(value);setReviewState("ready");}})
      .catch(error=>{if(active){setReviewState("error");setNotice(error instanceof Error?error.message:"No s'han pogut carregar les revisions.");}});
    return()=>{active=false;};
  },[auth,uid,year]);
  // Les valoracions mínimes SAP i les revisions es desen a l'espai privat amb RLS.
  // Les credencials TMB, el calendari complet i els tiquets segueixen fora del núvol.
  if(auth!=="owner")return null;
  const comparison=saved?compareSapToComputo(saved.doc,facts??localFacts(year)):null;
  const differences:Difference[]=comparison?.ready?comparison.rows.filter((r:Difference)=>r.status==="diff"||r.status==="temporal"):[];
  // Un període obert/futur no és una discrepància ni una comprovació
  // que l'usuari hagi de resoldre: només presentem manca de dades ja tancades.
  const extractedMonth=saved?.doc.extraido?.slice(0,7)||"";
  const pending:Difference[]=comparison?.ready?comparison.rows.filter(
    (r:Difference)=>r.status==="pending"&&r.period<extractedMonth
  ):[];
  const accepted=differences.filter(r=>isAcceptedReview(r,reviews[comparisonReviewKey(r)]));
  const toReview=differences.filter(r=>!isAcceptedReview(r,reviews[comparisonReviewKey(r)]));
  const completed=(comparison?.summary?.match||0)+(comparison?.summary?.diff||0)+(comparison?.summary?.temporal||0);
  const categories=Object.entries(toReview.reduce((acc:Record<string,number>,r)=>{acc[r.concept]=(acc[r.concept]||0)+1;return acc;},{}));
  const pendingGroups=Object.entries(pending.reduce((acc:Record<string,number>,r)=>{const group=pendingGroup(r.reason);acc[group]=(acc[group]||0)+1;return acc;},{}));
  async function launchSap(){
    // En ordinador cal el pont de Chrome; no generem tiquets inútils.
    if(bridgePlatform==="desktop"&&!desktopBridge){
      setNotice("Per fer el contrast des d'aquest ordinador, segueix la guia d'instal·lació del pont de Chrome que tens just a sota.");
      return;
    }
    if(bridgePlatform!=="android"&&!desktopBridge){
      setNotice("El pont actual funciona amb Chrome d'ordinador o amb l'auxiliar Android.");
      return;
    }
    setBusy(true);setNotice("");
    try{
      const session=readSharedSession();
      if(!session||await verifiedOwner()!==uid)throw Error("Cal iniciar sessió amb el compte administrador.");
      const response=await fetch("https://hhenkvendzengggrgook.supabase.co/functions/v1/sap-admin-ticket",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({action:"issue",year,scope:"year"}),signal:AbortSignal.timeout(15000)});
      const result=await response.json();if(!response.ok)throw Error(result.error||"No s’ha autoritzat el contrast.");
      await storePending(result.grant);
      if(desktopBridge){
        // Només viatja el tiquet HMAC, mai credencials ni registres SAP.
        window.postMessage({source:"computo-sap-web-v1",type:"start",ticket:result.ticket},window.location.origin);
        setNotice("Enviant la sol·licitud al pont de Chrome…");
      }else{
        const ticket=encodeURIComponent(result.ticket);
        const fallback=encodeURIComponent("https://roberfernandez.github.io/computo-aac/?pont=instala-android");
        window.location.href="intent://sync?ticket="+ticket+
          "#Intent;scheme=computo-tmb;package=cat.tmbagent.sapwebviewprobe;S.browser_fallback_url="+fallback+";end";
        setNotice("Obrint el pont TMB per Android… Si no s'obre, tens la guia d'instal·lació a Còmput.");
      }
    }catch(e){setNotice(e instanceof Error?e.message:"No s’ha pogut obrir SAP.");}finally{setBusy(false);}
  }
  async function importFile(file:File){
    if(!checked){setNotice("Confirma primero que el archivo SAP corresponde a tus propios datos.");return;}
    if(file.size<100||file.size>6*1024*1024){setNotice("El archivo no tiene un tamaño válido (máximo 6 MB).");return;}
    setBusy(true);setNotice("");
    try{
      const json=JSON.parse(await file.text());
      const verified=validateSapExport(json);
      if(verified.ano!==year)throw Error("Este archivo corresponde a "+verified.ano+". Selecciona ese año en Còmput antes de importarlo.");
      // Almacenamos sólo las unidades necesarias para comparar, nunca el calendario
      // completo de actividades, contingentes ni campos SAP ajenos al cálculo.
      const doc:ExportDoc={ano:verified.ano,extraido:verified.extraido,
        valoraciones:Object.fromEntries(Object.entries(verified.valoraciones).map(([key,rows])=>[
          key,(rows as ValueRow[]).map((row:{Date:string;LongText:string;Number:string;Wagetype?:string})=>({
            Date:row.Date,LongText:row.LongText,Number:row.Number,Wagetype:row.Wagetype
          }))
        ]))};
      const result=await replaceSaved(uid,doc);
      setSaved(result.record);
      setRevision(v=>v+1);
      setExpanded(true);
      setNotice(result.record.history.length>1
        ?"SAP "+year+" actualizado. "+result.cambios+" registros de valoración añadidos, retirados o modificados. Sincronització privada iniciada."
        :"Dades SAP "+year+" importades. Sincronització privada iniciada.");
    }catch(error){setNotice(error instanceof Error?error.message:"El JSON no se ha podido leer.");}
    finally{setBusy(false);}
  }
  async function recordReview(row:Difference,accept:boolean){
    const key=comparisonReviewKey(row);
    if(reviewSaving||reviewState!=="ready")return;
    setReviewSaving(key);setNotice("");
    try{
      // Relectura privada abans de cada canvi: evita sobreescriure una
      // acceptació més recent guardada en un altre dispositiu.
      const current=await loadPrivateReviews(uid,year),next={...current};
      if(accept)next[key]={fingerprint:comparisonFingerprint(row),note:(reviewDrafts[key]??current[key]?.note??"").trim().slice(0,500),reviewedAt:new Date().toISOString()};
      else delete next[key];
      await savePrivateReviews(uid,year,next);
      setReviews(next);
      setNotice(accept?"Diferència marcada com a revisada i desada al teu compte.":"Diferència reoberta per revisar.");
    }catch(error){setNotice(error instanceof Error?error.message:"No s'ha pogut desar la revisió.");}
    finally{setReviewSaving("");}
  }
  return (
    <section className="panel !p-0 overflow-hidden" aria-label="Contrast experimental amb TMB">
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
          <span className="text-sm font-semibold text-[#f7ca6e]">Contrastar dades amb TMB</span>
          <span className="flex shrink-0 items-center gap-2">
            {saved&&<span className="text-[11px] text-emerald-200">SAP {year}</span>}
            <span aria-hidden="true" className="text-sm text-white/60 transition-transform group-open:rotate-180">⌄</span>
          </span>
        </summary>
        <div className="space-y-3 border-t border-white/15 p-3 sm:p-4">
          <p className="text-xs text-white/60">Contrasta les dades de Còmput amb les valoracions laborals que TMB ha registrat. Cap diferència implica per si sola un error de TMB ni de Còmput. <span className="text-amber-200">Prova privada.</span></p>
      <div className="space-y-3 rounded-lg border border-white/15 bg-[#0b2029] p-3">
        <button type="button" disabled={busy||bridgePlatform==="checking"||(bridgePlatform==="desktop"&&!desktopBridge)||bridgePlatform==="unsupported"}
          onClick={()=>void launchSap()}
          className="w-full rounded-lg border border-[#f7ca6e]/60 bg-[#f7ca6e]/10 px-3 py-3 font-semibold text-[#f7ca6e] disabled:cursor-not-allowed disabled:opacity-50">
          {busy?"Verificant accés…":"Contrastar dades amb TMB · "+year}
        </button>
        {bridgePlatform==="desktop"&&desktopBridge&&
          <p className="text-xs text-emerald-200">Pont de Chrome detectat. Ja pots contrastar les dades amb TMB des d&apos;aquest ordinador.</p>}
        {bridgePlatform==="desktop"&&!desktopBridge&&
          <div className="space-y-3 rounded-lg border border-amber-400/35 bg-[#091b23] p-3">
            <p className="text-sm font-semibold text-amber-200">{saved?"Pots consultar el contrast SAP en aquest ordinador":"Encara no hi ha dades SAP per consultar"}</p>
            <p className="text-xs text-white/70">{saved?"Les valoracions s&apos;han recuperat del teu compte privat. No necessites instal·lar cap extensió per consultar-les.":"Pots importar els registres des de l&apos;Android i es recuperaran automàticament aquí amb el mateix compte de Còmput."}</p>
            <details className="rounded border border-white/20 p-2">
              <summary className="cursor-pointer text-xs text-white/70">Opció avançada: extreure dades noves des de Windows (prova)</summary>
              <div className="mt-3 space-y-3">
                <p className="text-xs text-white/70">La instal·lació provisional del pont de Chrome requereix passos manuals. No és necessària per consultar les dades sincronitzades.</p>
            {SAP_BRIDGE_CHROME_WEBSTORE_URL?<>
              <a href={SAP_BRIDGE_CHROME_WEBSTORE_URL} target="_blank" rel="noopener noreferrer"
                className="block rounded-lg bg-[#f7ca6e] px-3 py-2.5 text-center text-sm font-semibold text-[#10212a]">
                Instal·lar Pont SAP a Chrome
              </a>
              <p className="text-xs text-white/80">Chrome obrirà la fitxa de l&apos;extensió a Chrome Web Store. Prem «Afegeix a Chrome», confirma els permisos i torna aquí. No cal descarregar cap ZIP ni buscar carpetes.</p>
            </>:<>
              <a href={SAP_BRIDGE_WINDOWS_EXE} target="_blank" rel="noopener noreferrer"
                className="block rounded-lg bg-[#f7ca6e] px-3 py-2.5 text-center text-sm font-semibold text-[#10212a]">
                Descarregar instal·lador Pont SAP · Windows
              </a>
              <p className="text-xs text-white/80">Descàrrega directa de l&apos;instal·lador provisional (EXE) de la versió 0.1.1. No cal descarregar ni descomprimir cap ZIP.</p>
              <ol className="list-decimal space-y-1.5 pl-5 text-xs text-white/80">
                <li>Obre el fitxer EXE que acaba de descarregar Chrome. És una versió de prova sense signatura digital.</li>
                <li>L&apos;instal·lador prepararà els fitxers, copiarà la ruta de la carpeta i obrirà Chrome a extensions.</li>
                <li>A Chrome, activa <b>Mode de desenvolupador</b>, prem <b>Carrega sense empaquetar</b> i enganxa la carpeta copiada.</li>
                <li>Torna a Còmput i recarrega aquesta pàgina per detectar el pont.</li>
              </ol>
              <p className="text-[11px] text-amber-200">Instal·lació de prova només per a comptes autoritzats. Google encara ha de revisar la instal·lació directa des de Chrome Web Store. No desactivis la protecció de Windows ni modificis polítiques de Chrome.</p>
            </>}
            <button type="button" className="w-full rounded border border-white/30 px-3 py-2 text-xs font-medium"
              onClick={()=>window.location.reload()}>Comprovar instal·lació · Recarregar Còmput</button>
            <p className="text-[11px] text-white/55">Pilot limitat a comptes autoritzats. Utilitza només el teu perfil de Chrome i la teva sessió corporativa.</p>
              </div>
            </details>
          </div>}
        {bridgePlatform==="android"&&
          <div className="space-y-2">
            <p className="text-xs text-white/70">Android · El pont TMB s&apos;obrirà en la seva aplicació. Inicia sessió al portal oficial quan ho demani.</p>
            <button type="button" aria-expanded={androidGuide} onClick={()=>setAndroidGuide(v=>!v)}
              className="w-full rounded border border-white/25 px-3 py-2 text-xs font-medium text-white/85">
              {androidGuide?"Amagar guia d'instal·lació":"No tens el pont Android? Descarrega'l i instal·la'l"}
            </button>
            {androidGuide&&<div className="space-y-2 rounded border border-white/15 p-3">
              <a href={SAP_BRIDGE_ANDROID_APK} className="block rounded-lg bg-[#f7ca6e] px-3 py-2.5 text-center text-sm font-semibold text-[#10212a]">
                Descarregar pont TMB · Android 0.3.2
              </a>
              <ol className="list-decimal space-y-1.5 pl-5 text-xs text-white/80">
                <li>Descarrega l&apos;APK des de l&apos;enllaç anterior.</li>
                <li>Obre el fitxer descarregat i confirma la instal·lació. Si Android ho demana, autoritza aquesta font només per a aquest instal·lador.</li>
                <li>Torna a Còmput i prem <b>Contrastar dades amb TMB</b>.</li>
              </ol>
              <p className="text-[11px] text-white/55">El navegador no pot confirmar sempre si l&apos;APK ja està instal·lada. Si el pont s&apos;obre bé, no cal tornar-la a instal·lar.</p>
            </div>}
          </div>}
        {bridgePlatform==="unsupported"&&
          <p className="text-xs text-amber-200">Actualment el contrast automàtic requereix Chrome d&apos;ordinador amb extensió o l&apos;auxiliar Android.</p>}
        {bridgePlatform==="desktop"&&desktopBridge&&
          <p className="text-xs text-white/60">Les dades SAP es guarden localment al teu Chrome, sense compartir-les amb altres usuaris.</p>}
      </div>
      <details><summary className="cursor-pointer text-xs text-white/60">Importació manual existent</summary>
      <p className="text-sm font-semibold text-[#f7ca6e]">2 · Importar i contrastar les dades</p>
      <p className="text-xs text-white/60">Torna aquí i selecciona el JSON de Descàrregues. Només sincronitzem dates, conceptes i unitats SAP al teu compte privat de Supabase; no hi enviem l&apos;arxiu original ni les credencials corporatives.</p>
      <label className="flex items-start gap-2 text-xs text-white/80">
        <input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} className="mt-0.5" />
        <span>Confirmo que el fitxer conté les meves dades laborals. El JSON actual no identifica l&apos;empleat de forma verificable; només es desen dates, conceptes i unitats.</span>
      </label>
      <label className={"block rounded-lg border px-3 py-2 text-center text-sm font-semibold "+(checked&&!busy?"cursor-pointer border-amber-400/60 bg-amber-400/15 text-amber-100":"border-white/10 text-white/50")}>
        {busy?"Verificant i desant…":"Importar dades SAP "+year}
        <input className="sr-only" type="file" accept=".json,application/json" disabled={!checked||busy} onChange={e=>{const f=e.currentTarget.files?.[0];if(f)void importFile(f);e.currentTarget.value="";}} />
      </label>
      </details>
      <div className="rounded-lg border border-white/15 bg-[#0b2029] p-3 text-xs" role="status">
        <p className="font-medium text-white/85">Valoracions SAP entre dispositius · {sapSyncState==="synced"?"Sincronitzades":sapSyncState==="checking"?"Comprovant…":sapSyncState==="empty"?"Sense importacions SAP":sapSyncState==="offline"?"Sense connexió":"Sincronització pendent"}</p>
        <p className="mt-1 text-white/65">Les dates, els conceptes i les unitats de valoració SAP es desen al teu compte privat de Còmput a Supabase, sense contrasenyes ni calendari SAP complet. Pots consultar-les des d&apos;Android, Windows o iPhone amb el mateix compte.</p>
        {sapSyncError&&<p className="mt-1 text-amber-200">{sapSyncError} La còpia d&apos;aquest dispositiu es conserva.</p>}
        {sapSyncState!=="synced"&&sapSyncState!=="empty"&&<button type="button" className="mt-2 rounded border border-white/30 px-3 py-1.5" onClick={()=>setSapSyncRetry(v=>v+1)}>Tornar a sincronitzar</button>}
      </div>
      {notice&&<p role="status" className="text-xs text-amber-200">{notice}</p>}
      {saved&&<>
        <div className="rounded-lg border border-white/10 bg-[#0b2029] p-3 text-xs">
          <p>Última extracció: <b>{dayFmt(saved.doc.extraido)}</b></p>
          <p className="mt-1">Còpia activa: {year} · {Object.keys(saved.doc.valoraciones).length} mesos · {Object.values(saved.doc.valoraciones).reduce((sum,rows)=>sum+rows.length,0)} registres · {saved.history.length} importacions registrades (màxim 12).</p>
          <p className="mt-1 text-white/60">Les importacions noves vàlides substitueixen la còpia activa. Una extracció incompleta o anterior no la pot substituir.</p>
        </div>
        {!comparison?.ready?<p className="text-sm text-amber-200">{comparison?.reason||"No hi ha dades de Còmput per comparar."}</p>:<>
          <div className="rounded-lg border border-emerald-400/20 bg-[#0b2029] p-3">
            <p className="font-semibold text-emerald-200">La majoria de les dades coincideixen</p>
            <p className="mt-1 text-xs text-white/70">
              {comparison.summary.match} de {completed} comprovacions completades coincideixen.
              Cada comprovació correspon a un concepte laboral en un mes, no a un dia ni a una nòmina.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-amber-400/25 bg-[#0b2029] p-3">
              <b className="block text-2xl text-amber-200">{toReview.length}</b>
              <span className="text-xs">Diferències per revisar</span>
            </div>
            <div className="rounded-lg border border-white/15 bg-[#0b2029] p-3">
              <b className="block text-2xl text-emerald-200">{accepted.length}</b>
              <span className="text-xs">Revisades i acceptades</span>
            </div>
          </div>
          {toReview.length===0?
            <p className="text-sm text-emerald-200">No tens diferències pendents de revisar.</p>:
            <div className="rounded-lg border border-amber-400/20 bg-[#0b2029] p-3">
              <p className="text-sm font-semibold text-amber-200">Què cal revisar?</p>
              <ul className="mt-2 space-y-1 text-sm">
                {categories.map(([concept,count])=><li key={concept} className="flex justify-between gap-3"><span>{concept}</span><b>{count}</b></li>)}
              </ul>
            </div>
          }
          {reviewState==="error"&&<p role="alert" className="text-xs text-amber-200">No s&apos;han pogut carregar les revisions privades. No es poden desar acceptacions fins a recuperar la connexió.</p>}
          <p className="text-xs text-white/60">
            Una diferència no implica necessàriament una reclamació. Pots marcar-la com a revisada sense alterar els càlculs;
            si les dades de SAP o de Còmput canvien, reapareixerà automàticament.
          </p>
          {toReview.length>0&&<button type="button" className="w-full rounded border border-white/20 px-3 py-2 text-sm" onClick={()=>setExpanded(v=>!v)}>
            {expanded?"Amagar diferències":"Veure detall de les diferències"} ({toReview.length})
          </button>}
          {expanded&&toReview.length>0&&<div className="max-h-[30rem] space-y-2 overflow-y-auto">
            {toReview.map(r=>{
              const key=comparisonReviewKey(r);
              return <details key={key} className="rounded-lg border border-amber-400/25 bg-[#0b2029] p-3">
                <summary className="cursor-pointer text-xs">
                  <b>{r.period} · {r.concept}</b>
                  <span className="mt-1 block">TMB {showNum(r.sap)} / Còmput {showNum(r.computed)} {r.unit} · diferència {showNum(r.difference)}</span>
                </summary>
                {r.note&&<p className="mt-2 text-xs text-white/70">{r.note}</p>}
                <ul className="mt-2 space-y-1">{r.days.slice(0,35).map(d=><li key={d.date} className="text-xs">
                  {d.date}: TMB {showNum(d.sap)}, Còmput {showNum(d.computed)}
                </li>)}</ul>
                <label className="mt-3 block text-xs text-white/80" htmlFor={"sap-review-"+key}>Observació opcional</label>
                <textarea id={"sap-review-"+key} rows={2} maxLength={500}
                  className="mt-1 w-full rounded border border-white/25 bg-[#091820] p-2 text-sm text-white"
                  placeholder="Explica per què la consideres revisada"
                  value={reviewDrafts[key]??reviews[key]?.note??""}
                  onChange={e=>setReviewDrafts(prev=>({...prev,[key]:e.target.value}))}/>
                <button type="button" disabled={reviewState!=="ready"||!!reviewSaving}
                  className="mt-2 rounded border border-emerald-400/40 px-3 py-2 text-xs font-semibold text-emerald-200 disabled:opacity-50"
                  onClick={()=>void recordReview(r,true)}>
                    {reviewSaving===key?"Desant…":"Marcar com a revisada"}
                </button>
              </details>;
            })}
          </div>}
          {accepted.length>0&&<details className="rounded border border-emerald-400/25 p-3 text-xs">
            <summary className="cursor-pointer font-medium">Veure les {accepted.length} diferències revisades i acceptades</summary>
            <div className="mt-2 space-y-2">
              {accepted.map(r=>{
                const key=comparisonReviewKey(r),review=reviews[key];
                return <div key={key} className="rounded border border-white/10 p-2">
                  <b>{r.period} · {r.concept}</b>
                  <p className="mt-1">TMB {showNum(r.sap)} / Còmput {showNum(r.computed)} {r.unit}</p>
                  {review.note&&<p className="mt-1 text-white/70">Observació: {review.note}</p>}
                  <button type="button" disabled={reviewState!=="ready"||!!reviewSaving}
                    className="mt-2 rounded border border-white/25 px-3 py-1.5 disabled:opacity-50"
                    onClick={()=>void recordReview(r,false)}>
                      {reviewSaving===key?"Desant…":"Tornar a revisar"}
                  </button>
                </div>;
              })}
            </div>
          </details>}
          {pending.length>0&&<details className="rounded border border-white/15 p-3 text-xs">
            <summary className="cursor-pointer">{pending.length} comprovacions que encara no es poden completar</summary>
            <ul className="mt-2 space-y-1">
              {pendingGroups.map(([reason,count])=><li key={reason} className="flex justify-between gap-3"><span>{reason}</span><b>{count}</b></li>)}
            </ul>
            <details className="mt-3 border-t border-white/10 pt-2">
              <summary>Veure els mesos i motius</summary>
              <ul className="mt-2 space-y-2">
                {pending.map(r=><li key={r.period+":"+r.id}><b>{r.period} · {r.concept}</b>: {r.reason}</li>)}
              </ul>
            </details>
          </details>}
          {(comparison.summary?.temporal||0)>0&&<p className="text-xs text-sky-200">{comparison.summary.temporal} diferències atribuïbles a la data d&apos;imputació, amb les mateixes unitats totals.</p>}
          {comparison.unmapped.length>0&&<details className="rounded border border-white/10 p-2 text-xs text-white/60">
            <summary className="cursor-pointer">Altres conceptes SAP sense equivalència validada</summary>
            <p className="mt-2">{comparison.unmapped.map((r:{category:string})=>r.category).join(", ")}.</p>
          </details>}
        </>}
      </>}
        </div>
      </details>
    </section>
  );
}
