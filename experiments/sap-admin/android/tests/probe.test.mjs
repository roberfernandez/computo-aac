import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
const script=await readFile(new URL("../assets/probe.js",import.meta.url),"utf8");
const EMP="00000001";
function rows(n=127){return Array.from({length:n},(_,i)=>({Pernr:EMP,Date:"/Date("+Date.UTC(2026,9,i%31+1)+")/",LongText:"Synthetic test concept",Number:"1.00",Wagetype:"T001"}));}
function setup(options={}){
  const calls=[];
  class XHR {
    constructor(){this.responseType="text";this.status=200;this.responseText="";this.listeners={};}
    open(method,url){this.url=url;}
    addEventListener(name,fn){this.listeners[name]=fn;}
    send(){if(this.listeners.load)this.listeners.load();}
  }
  const responses=options.responses||[{d:{results:rows()}}];
  const loc={origin:"https://launcher.tmb.cat",pathname:"/apps",href:"https://launcher.tmb.cat/apps#Shell-home",hash:"#Shell-home",...options.location};
  const context={document:{body:{innerText:""},querySelectorAll:()=>[]},location:loc,URL,XMLHttpRequest:XHR,WeakMap,Set,AbortController,setTimeout,clearTimeout,
    fetch:async(url,init)=>{
      calls.push({url:new URL(url),init});
      const next=responses[Math.min(calls.length-1,responses.length-1)];
      if(next instanceof Error)throw next;
      return {ok:(options.status||200)===200,status:options.status||200,
        headers:{get:()=>options.contentType||"application/json"},
        json:async()=>next,clone(){return this;},text:async()=>JSON.stringify(next)};
    }};
  context.window=context;
  if(options.grant!==false)context.__computoSapGrant={uid:"1dd672e7-707f-4197-a393-a5f6f3a6d74e",year:2026,scope:options.annual?"year":"october-test",exp:Date.now()+600000};
  if(options.shell!==false)context.sap={ushell:{Container:{getUser:()=>({getId:()=>"synthetic-user"})}}};
  vm.createContext(context);
  const installed=vm.runInContext(script,context);
  function observe(data={d:{results:[{Pernr:EMP}]}}){
    const xhr=new context.XMLHttpRequest();
    xhr.open("POST","/sap/opu/odata/sap/ZHR_CBE_ODATA_SRV/$batch");
    xhr.responseText=JSON.stringify(data);xhr.send();
  }
  return {context,calls,installed,observe,state:()=>context.__tmbWebviewProbe?.snapshot()};
}
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(setImmediate);};
test("installs only in exact HTTPS portal origin and /apps path",()=>{
  for(const location of [{origin:"https://launcher.tmb.cat.evil.invalid"},{origin:"http://launcher.tmb.cat"},{pathname:"/login"}]){
    const p=setup({location});assert.equal(p.installed,"wrong-origin");assert.equal(p.state(),undefined);assert.equal(p.calls.length,0);
  }
});
test("does not invent an employee or query before an official response",async()=>{
  const p=setup();await settle();assert.equal(p.calls.length,0);assert.equal(p.context.location.hash,"EmployeeCalendar-display");
  p.observe({d:{results:[{Other:"no employee"}]}});await settle();assert.equal(p.calls.length,0);
});
test("extracts 127 actual fixture records using the exact October filter and session",async()=>{
  const p=setup();p.observe();await settle();
  assert.equal(p.state().phase,"success");assert.equal(p.state().records,127);
  assert.equal(p.state().matchesReference,true);
  assert.equal(p.calls[0].url.searchParams.get("$filter"),"Aaaamm eq '202610' and Pernr eq '00000001' and Screen eq 'PAN1'");
  assert.equal(p.calls[0].url.searchParams.get("sap-client"),"030");
  assert.equal(p.calls[0].init.credentials,"same-origin");
  assert.equal(p.calls[0].init.redirect,"error");
  assert.equal(JSON.stringify(p.state()).includes(EMP),false);
});
test("reports a different valid count honestly rather than forcing 127",async()=>{
  const p=setup({responses:[{d:{results:rows(126)}}]});p.observe();await settle();
  assert.equal(p.state().phase,"success");assert.equal(p.state().records,126);assert.equal(p.state().matchesReference,false);
});
test("rejects mixed identities before querying",async()=>{
  const p=setup();p.observe({d:{results:[{Pernr:EMP},{Pernr:"00000002"}]}});await settle();
  assert.equal(p.state().phase,"identity-ambiguous");assert.equal(p.calls.length,0);
});
test("rejects data for another employee or month",async()=>{
  for(const patch of [{Pernr:"00000002"},{Date:"/Date("+Date.UTC(2026,10,1)+")/"}]){
    const data=rows(1);Object.assign(data[0],patch);
    const p=setup({responses:[{d:{results:data}}]});p.observe();await settle();
    assert.equal(p.state().phase,"error");assert.ok(["identity-mismatch","wrong-period"].includes(p.state().error));
  }
});
test("follows validated pagination and checks the declared total",async()=>{
  const p=setup({responses:[
    {d:{results:rows(100),__count:"127",__next:"/sap/opu/odata/sap/ZHR_CBE_ODATA_SRV/ValorActividadSet?$skiptoken=test"}},
    {d:{results:rows(27),__count:"127"}}
  ]});p.observe();await settle();
  assert.equal(p.state().phase,"success");assert.equal(p.state().records,127);assert.equal(p.state().pages,2);
});
test("does not follow pagination to another origin, entity, or filter",async()=>{
  for(const next of ["https://evil.invalid/data","/sap/opu/odata/sap/ZHR_CBE_ODATA_SRV/ContingentesSet","/sap/opu/odata/sap/ZHR_CBE_ODATA_SRV/ValorActividadSet?$filter=other"]){
    const p=setup({responses:[{d:{results:rows(1),__next:next}}]});p.observe();await settle();
    assert.equal(p.state().phase,"error");assert.equal(p.calls.length,1);
  }
});
test("handles unauthorized sessions, login HTML and incomplete totals",async()=>{
  const cases=[{status:401},{contentType:"text/html"},{responses:[{d:{results:rows(1),__count:"127"}}]}];
  for(const o of cases){const p=setup(o);p.observe();await settle();assert.equal(p.state().phase,"error");}
});
test("clears volatile results and does not execute a second query automatically",async()=>{
  const p=setup();p.observe();await settle();p.state();p.state();assert.equal(p.calls.length,1);
  p.context.__tmbWebviewProbe.clear();assert.equal(p.state().phase,"cleared");assert.equal(p.state().records,null);
});
test("ignores employee-looking data from unrelated endpoints",async()=>{
  const p=setup();const xhr=new p.context.XMLHttpRequest();
  xhr.open("GET","https://elsewhere.invalid/");xhr.responseText=JSON.stringify({Pernr:EMP});xhr.send();await settle();
  assert.equal(p.calls.length,0);
});

test("identifies the employee from the rendered portal header when requests were already loaded",async()=>{
  const p=setup();p.context.document={body:{innerText:"Nombre de prueba\nNº Empleado: 00000001"},querySelectorAll:()=>[]};
  p.state();await settle();assert.equal(p.state().phase,"success");assert.equal(p.state().identitySource,"portal-header");assert.equal(p.state().records,127);
});
test("does not confuse arbitrary numbers in the portal with an employee header",async()=>{
  const p=setup();p.context.document={body:{innerText:"Número de referencia: 00000001"},querySelectorAll:()=>[]};
  p.state();await settle();assert.equal(p.calls.length,0);
});

test("identifies the logged-in employee from the already-loaded CBE model without a trailing service slash",async()=>{
  const p=setup();
  const model={sServiceUrl:"/sap/opu/odata/sap/ZHR_CBE_ODATA_SRV",oData:{row:{Pernr:EMP}}};
  const control={oModels:{cbe:model},getModel:()=>model};
  p.context.document.querySelectorAll=selector=>selector==="[data-sap-ui]"?[{id:"calendar"}]:[];
  p.context.sap.ui={getCore:()=>({byId:()=>control}),core:{}};
  p.state();await settle();
  assert.equal(p.state().phase,"success");assert.equal(p.state().identitySource,"loaded-cbe-model");
});
test("does not take an employee from unrelated UI5 models",async()=>{
  const p=setup();
  const model={sServiceUrl:"/sap/opu/odata/sap/OTHER_SERVICE",oData:{row:{Pernr:EMP}}};
  const control={oModels:{other:model},getModel:()=>model};
  p.context.document.querySelectorAll=selector=>selector==="[data-sap-ui]"?[{id:"calendar"}]:[];
  p.context.sap.ui={getCore:()=>({byId:()=>control}),core:{}};
  p.state();await settle();assert.equal(p.calls.length,0);
});

test("ignores the zero personnel sentinel on shared legend records",async()=>{
  const p=setup();
  const model={sServiceUrl:"/sap/opu/odata/sap/ZHR_CBE_ODATA_SRV",oData:{own:{Pernr:EMP},legend:{Pernr:"00000000"}}};
  const control={oModels:{cbe:model},getModel:()=>model};
  p.context.document.querySelectorAll=selector=>selector==="[data-sap-ui]"?[{id:"calendar"}]:[];
  p.context.sap.ui={getCore:()=>({byId:()=>control}),core:{}};
  p.state();await settle();assert.equal(p.state().phase,"success");
});

test('requires an authorized operation before installing the extractor',()=>{const p=setup({grant:false});assert.equal(p.installed,'unauthorized');assert.equal(p.calls.length,0);});
test('extracts all twelve periods and validates full calendar before returning annual data',async()=>{
 const cal=Array.from({length:365},(_,i)=>({Pernr:EMP,Date:'/Date('+ (Date.UTC(2026,0,1)+i*86400000)+')/'}));
 const response=[{d:{results:cal}},...Array.from({length:12},(_,i)=>({d:{results:[{...rows(1)[0],Date:'/Date('+Date.UTC(2026,i,1)+')/'}]}}))];
 const p=setup({annual:true,responses:response});p.observe();for(let i=0;i<20;i++)await settle();assert.equal(p.state().phase,'success');assert.equal(p.calls.length,13);const doc=p.context.__tmbWebviewProbe.exportResult();assert.equal(doc.period,'2026');assert.equal(doc.rows.length,12);assert.equal(doc.calendar.length,365);assert.equal(doc.completedPeriods.length,12);
});
