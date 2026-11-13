"use client";

import {useEffect,useState} from "react";
import {storePending,verifiedOwner} from "../public/sap-return/storage.mjs";
import {readSharedSession,SUPABASE_PUBLIC_KEY,SUPABASE_URL} from "./tmb-session";
import {comparisonReviewKey,comparisonFingerprint,isAcceptedReview,pendingGroup} from "@/lib/sap-difference-reviews";
import {compareSapToComputo,sapChangeCount,validateSapExport} from "@/lib/sap-comparison";

type ValueRow = {Date:string;LongText:string;Number:string;Wagetype?:string};
type ExportDoc = {ano:number;extraido:string;valoraciones:Record<string,ValueRow[]>};
type StoredDoc = {key:string;doc:ExportDoc;history:{extraido:string;cambios:number}[]};
type Difference = {period:string;id:string;concept:string;unit:string;sap:number;computed:number|null;difference:number|null;days:{date:string;sap:number;computed:number;difference:number}[];note:string;status:string;reason:string};
type Reviewed = {fingerprint:string;note:string;reviewedAt:string};
type ReviewMap = Record<string,Reviewed>;
const DB_NAME="computo-sap-private-v1",STORE="exports";
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
  const [testProof,setTestProof]=useState("");
  const [saved,setSaved]=useState<StoredDoc|null>(null);
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
    let active=true;
    queueMicrotask(()=>{if(active)setSaved(null);});
    void openPrivateDb().then(db=>{const tx=db.transaction("tests","readonly"),r=tx.objectStore("tests").get(uid+":2026-10");r.onsuccess=()=>{if(active&&r.result){const n=r.result.doc.valoraciones["2026-10"]?.length||0;setTestProof("Última prova de retorn: "+n+" registres d’octubre · "+dayFmt(r.result.doc.extraido));}};tx.oncomplete=()=>db.close();});
    void getSaved(uid,year).then(record=>{if(active)setSaved(record);}).catch(e=>{if(active)setNotice(e instanceof Error?e.message:"No se puede leer el historial.");});
    return()=>{active=false;};
  },[uid,auth,year,revision]);
  useEffect(()=>{
    if(auth!=="owner"||!uid)return;
    let active=true;
    queueMicrotask(()=>{if(active){setReviews({});setReviewState("loading");}});
    void loadPrivateReviews(uid,year).then(value=>{if(active){setReviews(value);setReviewState("ready");}})
      .catch(error=>{if(active){setReviewState("error");setNotice(error instanceof Error?error.message:"No s'han pogut carregar les revisions.");}});
    return()=>{active=false;};
  },[auth,uid,year]);
  // SAP resta local; només les decisions explícites de revisió es desen
  // al registre privat del compte, amb les polítiques RLS existents.
  if(auth!=="owner")return null;
  const comparison=saved?compareSapToComputo(saved.doc,facts??localFacts(year)):null;
  const differences:Difference[]=comparison?.ready?comparison.rows.filter((r:Difference)=>r.status==="diff"||r.status==="temporal"):[];
  const pending:Difference[]=comparison?.ready?comparison.rows.filter((r:Difference)=>r.status==="pending"):[];
  const accepted=differences.filter(r=>isAcceptedReview(r,reviews[comparisonReviewKey(r)]));
  const toReview=differences.filter(r=>!isAcceptedReview(r,reviews[comparisonReviewKey(r)]));
  const completed=(comparison?.summary?.match||0)+(comparison?.summary?.diff||0)+(comparison?.summary?.temporal||0);
  const categories=Object.entries(toReview.reduce((acc:Record<string,number>,r)=>{acc[r.concept]=(acc[r.concept]||0)+1;return acc;},{}));
  const pendingGroups=Object.entries(pending.reduce((acc:Record<string,number>,r)=>{const group=pendingGroup(r.reason);acc[group]=(acc[group]||0)+1;return acc;},{}));
  async function launchSap(scope:"year"|"october-test"){
    setBusy(true);setNotice("");
    try{
      const session=readSharedSession();
      if(!session||await verifiedOwner()!==uid)throw Error("Cal iniciar sessió amb el compte administrador.");
      const response=await fetch("https://hhenkvendzengggrgook.supabase.co/functions/v1/sap-admin-ticket",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({action:"issue",year,scope}),signal:AbortSignal.timeout(15000)});
      const result=await response.json();if(!response.ok)throw Error(result.error||"No s’ha autoritzat el contrast.");
      await storePending(result.grant);
      const ticket=encodeURIComponent(result.ticket);
      window.location.href="intent://sync?ticket="+ticket+"#Intent;scheme=computo-tmb;package=cat.tmbagent.sapwebviewprobe;end";
      setNotice("Obrint el pont TMB. Si Android no l’obre, instal·la la versió 0.3.1 del pont privat.");
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
        ?"SAP "+year+" actualizado. "+result.cambios+" registros de valoración añadidos, retirados o modificados."
        :"Datos SAP "+year+" importados y guardados en este dispositivo.");
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
    <section className="panel space-y-3 p-5" aria-label="Contrast experimental amb TMB">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-[#f7ca6e]">Contrastar dades amb TMB</h2>
        <span className="rounded border border-amber-400/40 px-2 py-0.5 text-[11px] text-amber-200">Prova privada</span>
      </div>
      <p className="text-xs text-white/60">Contrasta les dades de Còmput amb les valoracions laborals que TMB ha registrat. Cap diferència implica per si sola un error de TMB ni de Còmput.</p>
      <div className="space-y-2 rounded-lg border border-white/15 bg-[#0b2029] p-3">
        <button type="button" disabled={busy} onClick={()=>void launchSap("year")} className="w-full rounded-lg border border-[#f7ca6e]/60 bg-[#f7ca6e]/10 px-3 py-3 font-semibold text-[#f7ca6e]">{busy?"Verificant accés…":"Contrastar dades amb TMB · "+year}</button>
        <p className="text-xs text-white/65">Android · S’obre el portal oficial. Autentica’t si TMB ho demana; les valoracions tornen directament a Còmput, sense fitxers ni contrasenyes compartides.</p>
        {year===2026&&<button type="button" disabled={busy} onClick={()=>void launchSap("october-test")} className="w-full rounded border border-white/20 px-3 py-2 text-xs">Comprovar retorn · Octubre 2026</button>}
      </div>
      <details><summary className="cursor-pointer text-xs text-white/60">Importació manual existent</summary>
      <p className="text-sm font-semibold text-[#f7ca6e]">2 · Importar i contrastar les dades</p>
      <p className="text-xs text-white/60">Torna aquí i selecciona el JSON de Descàrregues. Només es guarden dates, conceptes i unitats en aquest dispositiu; el fitxer no s&apos;envia a Supabase.</p>
      <label className="flex items-start gap-2 text-xs text-white/80">
        <input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} className="mt-0.5" />
        <span>Confirmo que el fitxer conté les meves dades laborals. El JSON actual no identifica l&apos;empleat de forma verificable; només es desen dates, conceptes i unitats.</span>
      </label>
      <label className={"block rounded-lg border px-3 py-2 text-center text-sm font-semibold "+(checked&&!busy?"cursor-pointer border-amber-400/60 bg-amber-400/15 text-amber-100":"border-white/10 text-white/50")}>
        {busy?"Verificant i desant…":"Importar dades SAP "+year}
        <input className="sr-only" type="file" accept=".json,application/json" disabled={!checked||busy} onChange={e=>{const f=e.currentTarget.files?.[0];if(f)void importFile(f);e.currentTarget.value="";}} />
      </label>
      </details>
      {testProof&&<p className="text-xs text-emerald-200">{testProof}</p>}
      {notice&&<p role="status" className="text-xs text-amber-200">{notice}</p>}
      {saved&&<>
        <div className="rounded-lg border border-white/10 bg-[#0b2029] p-3 text-xs">
          <p>Última extracció: <b>{dayFmt(saved.doc.extraido)}</b></p>
          <p className="mt-1">Còpia activa: {year} · {Object.keys(saved.doc.valoraciones).length} mesos · {Object.values(saved.doc.valoraciones).reduce((sum,rows)=>sum+rows.length,0)} registres · {saved.history.length} importacions registrades (màxim 12).</p>
          <p className="mt-1 text-white/60">Les importacions noves vàlides substitueixen la còpia activa. Una extracció incompleta o anterior no la pot substituir.</p>
        </div>
        {!comparison?.ready?<p className="text-sm text-amber-200">{comparison?.reason||"No hi ha dades de Còmput per comparar."}</p>:<>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-[#0b2029] p-2"><b className="block text-lg">{comparison.summary?.match}</b><span className="text-[11px] text-white/60">Coincidències</span></div>
            <div className="rounded-lg bg-[#0b2029] p-2"><b className="block text-lg text-amber-200">{comparison.summary?.diff}</b><span className="text-[11px] text-white/60">Diferències</span></div>
            <div className="rounded-lg bg-[#0b2029] p-2"><b className="block text-lg">{comparison.summary?.pending}</b><span className="text-[11px] text-white/60">Pendents</span></div>
            <div className="rounded-lg bg-[#0b2029] p-2"><b className="block text-lg text-sky-200">{comparison.summary?.temporal||0}</b><span className="text-[11px] text-white/60">Imputació temporal</span></div>
          </div>
          <p className="text-xs text-white/60">Les diferències són indicis a investigar, no errors atribuïts automàticament a TMB o a Còmput. El mes en curs no es compara com a tancat.</p>
          <button type="button" className="w-full rounded border border-white/20 px-3 py-2 text-sm" onClick={()=>setExpanded(v=>!v)}>
            {expanded?"Amagar detall":"Veure discrepàncies"} ({differences.length})
          </button>
          {expanded&&<div className="max-h-[28rem] space-y-2 overflow-y-auto">
            {differences.length===0?<p className="text-xs">No hi ha diferències en els conceptes que podem comparar.</p>:differences.map((r:{period:string;concept:string;unit:string;sap:number;computed:number|null;difference:number|null;days:{date:string;sap:number;computed:number;difference:number}[];note:string},i:number)=>(
              <details key={r.period+"-"+r.concept+i} className="rounded-lg border border-amber-400/25 bg-[#0b2029] p-2">
                <summary className="cursor-pointer text-xs">
                  <b>{r.period} · {r.concept}</b><br/>
                  SAP {showNum(r.sap)} / Còmput {showNum(r.computed)} {r.unit} · diferència {showNum(r.difference)}
                </summary>
                {r.note&&<p className="mt-2 text-[11px] text-white/60">{r.note}</p>}
                <ul className="mt-2 space-y-1">
                  {r.days.slice(0,35).map(d=><li key={d.date} className="text-xs">{d.date.slice(8,10)}: SAP {showNum(d.sap)}, Còmput {showNum(d.computed)}, Δ {showNum(d.difference)}</li>)}
                </ul>
              </details>
            ))}
          </div>}
          {expanded&&pending.length>0&&<details className="rounded border border-white/15 p-2 text-xs"><summary>Per què hi ha comparacions pendents?</summary><ul className="mt-2 space-y-2">{pending.map((r:{period:string;concept:string;reason:string},i:number)=><li key={r.period+r.concept+i}><b>{r.period} · {r.concept}</b>: {r.reason}</li>)}</ul></details>}
          <p className="text-xs text-white/50">{pending.length} comparacions pendents o amb períodes encara oberts. Concepts SAP no equivalents o pendents de validació: {comparison.unmapped.map((r:{category:string})=>r.category).join(", ")||"cap"}.</p>
        </>}
      </>}
    </section>
  );
}
