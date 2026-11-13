import test from "node:test";
import assert from "node:assert/strict";
import {validateSapExport,compareSapToComputo,sapDate,sapChangeCount} from "../lib/sap-comparison.js";

function fixture(){
  const year=2026, calendario=[];
  for(let day=1;day<=365;day++){
    const d=new Date(Date.UTC(year,0,day));
    calendario.push({Date:"/Date("+d.valueOf()+")/",Phtd:"AGCG"});
  }
  const valoraciones={};
  for(let m=1;m<=12;m++)valoraciones["2026-"+String(m).padStart(2,"0")]=[];
  valoraciones["2026-10"]=[
    {Date:"/Date("+Date.UTC(2026,9,1)+")/",LongText:"Prima Hora Nona",Number:"0.25",Wagetype:"8711"},
    {Date:"/Date("+Date.UTC(2026,9,1)+")/",LongText:"Plus Convenio",Number:"1.00",Wagetype:"8716"}
  ];
  return {origen:"Consultes Bàsiques TMB - SAP",ano:2026,extraido:"2026-11-12T12:51:44.729Z",
    anuales:{actividades:[{Campo1:"01.01.2026"}],calendario,contingentes:[],leyenda:[]},valoraciones};
}
function facts(){
  const days=Array.from({length:31},(_,i)=>({
    date:"2026-10-"+String(i+1).padStart(2,"0"),
    activity:{status:"AGCG",weeklyRest:false},
    metrics:{
      horaNonaHours:{state:"known",value:i===0?0.5:0},
      plusConveniDays:{state:"known",value:i===0?1:0},
      nightPayableHours:{state:"known",value:0},
      ordinaryHours:{state:"known",value:0},
      plusFestiuDays:{state:"known",value:0}
    }
  }));
  return {year:2026,months:{"10":{days}}};
}
test("SAP dates preserve original workday across midnight",()=>{
  assert.equal(sapDate("/Date("+Date.UTC(2026,9,11)+")/"),"2026-10-11");
  assert.equal(sapDate("garbage"),null);
});
test("validates full year before replacing a stored export",()=>{
  assert.equal(validateSapExport(fixture()).anuales.calendario.length,365);
  const incomplete=fixture();incomplete.anuales.calendario.pop();
  assert.throws(()=>validateSapExport(incomplete),/calendario anual no está completo/);
  const missing=fixture();delete missing.valoraciones["2026-07"];
  assert.throws(()=>validateSapExport(missing),/Faltan las valoraciones/);
  const alternate=fixture();alternate.valoraciones["202610"]=alternate.valoraciones["2026-10"];delete alternate.valoraciones["2026-10"];
  assert.ok(Array.isArray(validateSapExport(alternate).valoraciones["2026-10"]));
});
test("compares closed month totals without presuming SAP is correct",()=>{
  const report=compareSapToComputo(validateSapExport(fixture()),facts());
  assert.equal(report.ready,true);
  const a=report.rows.find(x=>x.period==="2026-10"&&x.concept==="Prima Hora Nona");
  assert.equal(a.status,"diff");
  assert.equal(a.sap,0.25);assert.equal(a.computed,0.5);
  assert.equal(a.days[0].date,"2026-10-01");
  const b=report.rows.find(x=>x.period==="2026-10"&&x.concept==="Plus Convenio");
  assert.equal(b.status,"match");
  const future=report.rows.find(x=>x.period==="2026-11"&&x.concept==="Prima Hora Nona");
  assert.equal(future.status,"pending");
});
test("keeps extra SAP concepts separate until interpretation is established",()=>{
  const doc=fixture();
  doc.valoraciones["2026-10"].push({Date:"/Date("+Date.UTC(2026,9,11)+")/",LongText:"Plus Festivo Oficial",Number:"1.00"});
  const report=compareSapToComputo(validateSapExport(doc),facts());
  assert.ok(report.unmapped.some(x=>x.category==="Plus Festivo Oficial"));
  // Son conceptos distintos: el plus por domingo de Còmput no prueba
  // el derecho al plus SAP P. Festivo Trabajado E.
  doc.valoraciones["2026-10"].push({Date:"/Date("+Date.UTC(2026,9,17)+")/",LongText:"P.Festivo Trabajado E",Number:"1.00"});
  const rest=compareSapToComputo(validateSapExport(doc),facts());
  assert.ok(rest.unmapped.some(x=>x.category==="P.Festivo Trabajado E"));
  assert.equal(rest.rows.some(x=>x.concept==="Festivo trabajado, variante E"),false);
});
test("detects retroactive official changes without overwriting previous evidence",()=>{
  const before=fixture(),after=fixture();
  after.valoraciones["2026-10"][0].Number="0.50";
  assert.equal(sapChangeCount(before,after),2);
});

test('night units assigned to the next civil date are temporal, not an invented unpaid claim',()=>{
 const doc=fixture(),f=facts();doc.valoraciones['2026-10']=[{Date:'/Date('+Date.UTC(2026,9,20)+')/',LongText:'Nocturnidad Variable',Number:'1.00'}];f.months[10].days[18].metrics.nightPayableHours.value=1;const r=compareSapToComputo(validateSapExport(doc),f).rows.find(r=>r.period==='2026-10'&&r.concept==='Nocturnidad variable');assert.equal(r.status,'temporal');assert.equal(r.sap,1);assert.equal(r.computed,1);assert.equal(r.difference,0);
});
test('worked-holiday E uses actual entitlement conditions instead of raw Sunday metric',()=>{
 const doc=fixture(),f=facts(),m=f.months[10];m.period='2026-10';m.profile={percent:85.81};for(const d of m.days){d.schedule='—';d.activity={version:1,status:'FEST',working:false,ordinary:false,weeklyRest:true,scheduleResolved:true,vacation:false};d.metrics.plusFestiuDays.value=1;}
 const d=m.days[10];d.schedule='18:00–19:00';d.activity={...d.activity,status:'AGCG',working:true,ordinary:true,weeklyRest:false};doc.valoraciones['2026-10'].push({Date:'/Date('+Date.UTC(2026,9,11)+')/',LongText:'P.Festivo Trabajado E',Number:'1'});let row=compareSapToComputo(validateSapExport(doc),f).rows.find(r=>r.period==='2026-10'&&r.concept==='P.Festivo Trabajado E');assert.equal(row.computed,0);assert.equal(row.status,'diff');d.schedule='18:00–20:00';row=compareSapToComputo(validateSapExport(doc),f).rows.find(r=>r.period==='2026-10'&&r.concept==='P.Festivo Trabajado E');assert.equal(row.computed,1);assert.equal(row.status,'match');
});
