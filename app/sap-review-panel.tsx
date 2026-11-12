"use client";

import {useEffect,useState} from "react";
import {authenticatedUserId,readSharedSession} from "./tmb-session";
import {compareSapToComputo,sapChangeCount,validateSapExport} from "@/lib/sap-comparison";

type ValueRow = {Date:string;LongText:string;Number:string;Wagetype?:string};
type ExportDoc = {ano:number;extraido:string;valoraciones:Record<string,ValueRow[]>};
type StoredDoc = {key:string;doc:ExportDoc;history:{extraido:string;cambios:number}[]};
const OWNER_USER_ID="1dd672e7-707f-4197-a393-a5f6f3a6d74e";
const DB_NAME="computo-sap-private-v1",STORE="exports";
const dayFmt=(date:string)=>new Date(date).toLocaleString("es-ES",{dateStyle:"medium",timeStyle:"short"});
function openPrivateDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(DB_NAME,1);
    r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:"key"});};
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
type SapReviewPanelProps={year:number};
export default function SapReviewPanel({year}:SapReviewPanelProps){
  const [auth,setAuth]=useState<"checking"|"owner"|"hidden">("checking");
  const [uid,setUid]=useState("");
  const [saved,setSaved]=useState<StoredDoc|null>(null);
  const [checked,setChecked]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [expanded,setExpanded]=useState(false);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true;
    const s=readSharedSession();
    if(!s){setAuth("hidden");return;}
    void authenticatedUserId(s).then(id=>{
      if(!active)return;
      if(id===OWNER_USER_ID){setUid(id);setAuth("owner");}
      else setAuth("hidden");
    }).catch(()=>{if(active)setAuth("hidden");});
    return()=>{active=false;};
  },[]);
  useEffect(()=>{
    if(auth!=="owner"||!uid)return;
    let active=true;
    setSaved(null);
    void getSaved(uid,year).then(record=>{if(active)setSaved(record);}).catch(e=>{if(active)setNotice(e instanceof Error?e.message:"No se puede leer el historial.");});
    return()=>{active=false;};
  },[uid,auth,year,revision]);
  // No solicitudes a SAP ni subida del fichero: todo permanece en IndexedDB de este dispositivo.
  if(auth!=="owner")return null;
  const comparison=saved?compareSapToComputo(saved.doc,localFacts(year)):null;
  const differences=comparison?.ready?comparison.rows.filter((r:{status:string})=>r.status==="diff"):[];
  const pending=comparison?.ready?comparison.rows.filter((r:{status:string})=>r.status==="pending"):[];
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
          key,rows.map((row:{Date:string;LongText:string;Number:string;Wagetype?:string})=>({
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
  return (
    <section className="panel space-y-3 p-5" aria-label="Comprovació experimental amb TMB">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-[#f7ca6e]">Comprovar amb TMB</h2>
        <span className="rounded border border-amber-400/40 px-2 py-0.5 text-[11px] text-amber-200">Prova privada</span>
      </div>
      <p className="text-xs text-white/60">Importa el JSON que has descarregat de Consultes Bàsiques. No es puja a Supabase ni es comparteix amb altres usuaris.</p>
      <label className="flex items-start gap-2 text-xs text-white/80">
        <input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} className="mt-0.5" />
        <span>Confirmo que el fitxer conté les meves dades laborals. El JSON actual no identifica l&apos;empleat de forma verificable; només es desen dates, conceptes i unitats.</span>
      </label>
      <label className={"block rounded-lg border px-3 py-2 text-center text-sm font-semibold "+(checked&&!busy?"cursor-pointer border-amber-400/60 bg-amber-400/15 text-amber-100":"border-white/10 text-white/50")}>
        {busy?"Verificant i desant…":"Importar dades SAP "+year}
        <input className="sr-only" type="file" accept=".json,application/json" disabled={!checked||busy} onChange={e=>{const f=e.currentTarget.files?.[0];if(f)void importFile(f);e.currentTarget.value="";}} />
      </label>
      {notice&&<p role="status" className="text-xs text-amber-200">{notice}</p>}
      {saved&&<>
        <div className="rounded-lg border border-white/10 bg-[#0b2029] p-3 text-xs">
          <p>Última extracció: <b>{dayFmt(saved.doc.extraido)}</b></p>
          <p className="mt-1">Còpia activa: {year} · {saved.history.length} importacions registrades (màxim 12).</p>
          <p className="mt-1 text-white/60">Les importacions noves vàlides substitueixen la còpia activa. Una extracció incompleta o anterior no la pot substituir.</p>
        </div>
        {!comparison?.ready?<p className="text-sm text-amber-200">{comparison?.reason||"No hi ha dades de Còmput per comparar."}</p>:<>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-[#0b2029] p-2"><b className="block text-lg">{comparison.summary.match}</b><span className="text-[11px] text-white/60">Coincidències</span></div>
            <div className="rounded-lg bg-[#0b2029] p-2"><b className="block text-lg text-amber-200">{comparison.summary.diff}</b><span className="text-[11px] text-white/60">Diferències</span></div>
            <div className="rounded-lg bg-[#0b2029] p-2"><b className="block text-lg">{comparison.summary.pending}</b><span className="text-[11px] text-white/60">Pendents</span></div>
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
          <p className="text-xs text-white/50">{pending.length} comparacions pendents o amb períodes encara oberts. Concepts SAP sense equivalència confirmada: {comparison.unmapped.map((r:{category:string})=>r.category).join(", ")||"cap"}.</p>
        </>}
      </>}
    </section>
  );
}
