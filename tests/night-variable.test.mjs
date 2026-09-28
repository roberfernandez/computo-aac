import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {calendarContext} from './helpers/calendar-context.mjs';
const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',source.slice(0,source.indexOf('export default function Home')),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const body=ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(ast)).join('\n');
const context=await calendarContext();
vm.runInContext(ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\nglobalThis.api={nightMinutesForShift,elapsedMinutes,calcDay,nightHoursFor,totalFor,ordinaryHoursFor};',context);
const api=context.api;
// Independently specified I-83 examples: start, end, duration, real overlap, payable.
const cases=[
 ['18:46','00:50',364,170,170],['18:46','02:50',484,290,484],
 ['20:30','05:00',510,420,510],['22:00','02:00',240,240,240],
 ['22:00','02:01',241,241,241],['23:00','05:00',360,360,360],
 ['02:00','05:00',180,180,180],['05:00','07:00',120,60,60],
 ['21:00','07:00',600,480,600],['06:00','14:00',480,0,0],
 ['14:00','22:00',480,0,0],['20:00','00:00',240,120,120],
 ['02:00','06:00',240,240,240],['01:59','06:00',241,241,241],
 ['19:00','02:30',450,270,450],['19:00','01:30',390,210,210],
 ['17:00','02:15',555,255,555],['18:00','02:00',480,240,240],
 ['18:00','02:01',481,241,481],['22:00','06:00',480,480,480],
];
for(const [start,end,total,overlap,payable] of cases) test(`I-83 ${start}-${end}: ${total} min / overlap ${overlap} / payable ${payable}`,()=>{
 assert.equal(api.elapsedMinutes(start,end),total);
 assert.equal(api.nightMinutesForShift(start,end,total),payable);
});

// Evaluate the saved pre-change implementation to guard all non-night results.
const {execFileSync}=await import('node:child_process');
const baselineSource=execFileSync('git',['show','d6723d3b5f00da8152069237d671f8595fa9dfba:app/page.tsx'],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
const oldAst=ts.createSourceFile('page.tsx',baselineSource.slice(0,baselineSource.indexOf('export default function Home')),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const oldContext=await calendarContext();
vm.runInContext(ts.transpileModule(oldAst.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(oldAst)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\nglobalThis.api={calcDay};',oldContext);
vm.runInContext('globalThis.overlap=nightOverlapMinutesForShift;',context);
const profile={turn:'T8',contract:'85.81',fiestaLetter:'M'};
const day=(n,extra={})=>({day:n,status:'AGCG',baseStatus:'AGCG',special:'NINGUNA',extraHours:0,note:'',...extra});
const custom=(start,end)=>({special:'MODIFICACION',modificationPlacement:'PERSONALIZADO',customStart:start,customEnd:end});
test('physical overlap is separate from remuneration, including the strict four-hour boundary',()=>{
 for(const [start,end,,overlap] of cases) assert.equal(context.overlap(start,end),overlap,`${start}-${end}`);
 assert.equal(api.nightMinutesForShift('19:00','02:00',420),240); // Exactly four hours must NOT expand.
});
test('inconsistent duration and malformed/ambiguous intervals remain pending',()=>{
 for(const [s,e,t] of [['18:46','23:50',364],['25:00','06:00',300],['','',NaN],['08:00','08:00',0],['20:00','21:00',1500]]) assert.ok(Number.isNaN(api.nightMinutesForShift(s,e,t)));
});
test('end time limits physical overlap even if a paid duration differs',()=>{
 assert.equal(context.overlap('18:46','23:50'),110);
 assert.equal(context.overlap('05:00','07:00'),60);
 assert.equal(context.overlap('21:00','07:00'),480);
});
test('complete custom schedule works with an unavailable official category',()=>{
 const d=day(31,custom('02:00','05:00')),c=api.calcDay(d,[d],2025,3,profile);
 assert.equal(c.nightOverlapMinutes,180);assert.equal(c.nightPayableMinutes,180);assert.equal(c.nightHours,3);
 assert.ok(Number.isNaN(c.value));
});
test('modifications at start/end keep their existing duration and use the resulting interval',()=>{
 for(const [placement,h,overlap,payable] of [['FINAL',1,230,230],['FINAL',2,290,484],['INICIO',1,170,170]]){
  const d=day(21,{special:'MODIFICACION',modificationPlacement:placement,extraHours:h}),c=api.calcDay(d,[d],2026,9,profile);
  assert.equal(c.nightOverlapMinutes,overlap);assert.equal(c.nightPayableMinutes,payable);
  assert.equal(c.workedMinutes,364+h*60);
 }
});
test('exceptional remuneration remains pending without changing the shift or balance',()=>{
 for(const [y,m,n,extras,reason] of [[2026,12,24,{},'Nochebuena'],[2026,10,24,{},'cambio de hora'],[2026,3,28,{},'cambio de hora'],[2026,9,23,{special:'NON_STOP_EXTRA'},'extraordinario'],[2026,9,25,{status:'FORMACION'},'situación'],[2026,9,25,{status:'REVISION_MEDICA'},'situación']]){
  const d=day(n,extras),c=api.calcDay(d,[d],y,m,profile),old=oldContext.api.calcDay(d,[d],y,m,profile);
  assert.ok(Number.isNaN(c.nightPayableMinutes));assert.ok(Number.isNaN(c.nightHours));assert.match(c.nightReason,new RegExp(reason));
  for(const key of ['shift','value','workedMinutes','ordinaryHours','horaNona','creditedMinutes'])assert.equal(c[key],old[key],key);
 }
 const d=day(24),c=api.calcDay(d,[d],2026,12,profile);assert.equal(c.shift,'18:46–23:50');assert.equal(c.workedMinutes,364);assert.equal(c.nightOverlapMinutes,110);
});
test('current/prior allocation preserves source night measurements without leaking prior credit',()=>{
 for(const status of ['COMPUTO_ANTERIOR','COMPUTO_ACTUAL']){
  const d=day(31,{status,...custom('02:00','05:00')}),c=api.calcDay(d,[d],2025,3,profile);
  assert.equal(c.nightOverlapMinutes,180);assert.equal(c.nightPayableMinutes,180);
  assert.equal(c.nightHours,status==='COMPUTO_ANTERIOR'?0:3);
  assert.equal(c.creditedMinutes,180);
 }
 const d=day(24,{status:'COMPUTO_ANTERIOR'});assert.equal(api.nightHoursFor([d],2026,12,profile),0);
});
test('monthly and annual consumer sums preserve pending instead of a plausible total',()=>{
 const d=day(25,custom('19:00','01:30'));
 assert.equal(api.nightHoursFor([d],2026,9,profile),3.5);
 const ordinary=day(21),exception=day(24);
 assert.equal(api.nightHoursFor([ordinary],2026,12,profile),2.83);
 assert.ok(Number.isNaN(api.nightHoursFor([ordinary,exception],2026,12,profile)));
 const months=[api.nightHoursFor([d],2026,9,profile),api.nightHoursFor([exception],2026,12,profile)];
 assert.ok(Number.isNaN(Number(months.reduce((a,b)=>a+b,0).toFixed(2))));
});
test('all fixture dates/profiles preserve balance, nona, ordinary hours and credit',()=>{
 const profiles=['85.81','85','78.91','78.14'].map(contract=>({...profile,contract}));
 for(let i=1;i<=5;i++)profiles.push({...profile,contract:'75',subturn:`T8.${i}`});
 for(const turn of ['T1','T2','T4','T5'])profiles.push({...profile,turn});
 // Calendar dates are supplied by the local test fixture, not a network call.
 for(const y of [2024,2025,2026])for(let m=1;m<=12;m++)for(let n=1;n<=new Date(y,m,0).getDate();n++)for(const p of profiles){
  const d=day(n),c=api.calcDay(d,[d],y,m,p),old=oldContext.api.calcDay(d,[d],y,m,p);
  for(const key of ['value','workedMinutes','ordinaryHours','horaNona','creditedMinutes','shift','hours','scheduleReview','compensationPending','reason'])assert.equal(c[key],old[key],`${y}-${m}-${n} ${p.turn}/${p.contract}/${p.subturn} ${key}`);
 }
});
test('continuous intervals match an independent minute-by-minute night-window oracle',()=>{
 const clock=n=>`${String(Math.floor(n/60)%24).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
 for(let start=0;start<1440;start+=37)for(let duration=1;duration<1440;duration+=53){
  let expected=0;
  for(let i=0;i<duration;i++){const minute=(start+i)%1440;if(minute<360||minute>=1320)expected++;}
  const s=clock(start),e=clock((start+duration)%1440);
  assert.equal(context.overlap(s,e),expected,`${s}-${e}`);
  assert.equal(api.nightMinutesForShift(s,e,duration),expected>240?duration:expected);
 }
});
test('absences, credits and personal schedule changes preserve non-night results',()=>{
 for(const status of ['REVISAR','DCOM','FEST','VACACIONES','VACACIONES_PENDIENTES','VAC_ANTERIOR','MINI','LAUDO','RJ','FORMACION','REVISION_MEDICA','ENFERMEDAD','PERMISO','HUELGA_LEGAL','COMPUTO_ANTERIOR','COMPUTO_ACTUAL'])for(const extras of [{},custom('05:00','07:00'),{special:'MODIFICACION',extraHours:1,modificationPlacement:'INICIO'},{special:'NON_STOP_EXTRA'}]){
  const d=day(25,{status,...extras}),c=api.calcDay(d,[d],2026,9,profile),old=oldContext.api.calcDay(d,[d],2026,9,profile);
  for(const key of ['value','workedMinutes','ordinaryHours','horaNona','creditedMinutes','shift','hours','reason'])assert.equal(c[key],old[key],`${status}/${key}`);
 }
});
