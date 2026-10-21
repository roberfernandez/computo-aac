import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {calendarContext} from './helpers/calendar-context.mjs';
const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',source.slice(0,source.indexOf('export default function Home')),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const context=await calendarContext();
vm.runInContext(ts.transpileModule(ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(ast)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\nglobalThis.api={calcDay,nightHoursFor,totalFor,ordinaryHoursFor};',context);
const {calcDay,nightHoursFor,totalFor}=context.api;
const base={turn:'T8',contract:'75',fiestaLetter:'M'};
const day=(extra={})=>({day:24,status:'AGCG',baseStatus:'AGCG',special:'NINGUNA',extraHours:0,...extra});
const calc=(p=base,d=day(),m=10,y=2026)=>calcDay(d,[d],y,m,p);
test('TMB repeated 02:40 labels have explicit distinct durations; AT82 earns exactly one hour',()=>{
 for(const [subturn,shift,minutes,value,overlap] of [
  ['T8.1','21:10–02:40',390,0,340],
  ['T8.2','23:30–05:00',390,1,390],
  ['T8.3','21:10–02:40',330,0,280]]){
  const p={...base,subturn},c=calc(p);
  assert.equal(c.shift,shift);assert.equal(c.workedMinutes,minutes);
  assert.equal(c.ordinaryHours,minutes/60);assert.equal(c.value,value);
  assert.equal(c.nightOverlapMinutes,overlap);assert.equal(c.nightPayableMinutes,minutes);
  assert.equal(c.nightReason,'');assert.equal(c.horaNona,0);
  assert.equal(totalFor([day()],2026,10,p),value);
  assert.equal(nightHoursFor([day()],2026,10,p),minutes/60);
 }
});
test('T8 keeps published official endpoints and counts the repeated hour only once',()=>{
 for(const p of [
  ...['85.81','85','78.91','78.14'].map(contract=>({...base,contract})),
  ...['T8.4','T8.5'].map(subturn=>({...base,subturn}))]){
  const c=calc(p);assert.equal(c.shift,'21:10–05:00');assert.equal(c.workedMinutes,530);
  assert.equal(c.ordinaryHours,8.83);assert.equal(c.nightHours,8.83);assert.equal(c.nightOverlapMinutes,480);
  assert.equal(c.horaNona,1);assert.equal(c.scheduleReview,false);
 }
});
test('confirmed T1/T2 schedules no longer require historical schedule review; T4/T5 unchanged',()=>{
 for(const [turn,shift,minutes] of [['T1','04:30–13:20',530],['T2','12:50–21:40',530],['T4','06:11–14:00',469],['T5','13:45–21:34',469]]){
  const c=calc({...base,turn});assert.equal(c.shift,shift);assert.equal(c.workedMinutes,minutes);
  assert.equal(c.scheduleReview,false);assert.equal(c.compensationPending,true);
 }
});
test('summer AT86/AT87 use the same confirmed service, but missing assignments stay pending',()=>{
 for(const shift of ['AT86','AT87']){
  const p={...base,turn:'ESTIU',summer:{2026:{percentage:'75',assignments:[{month:10,fiestaLetter:'M',shift}]}}};
  const c=calc(p);assert.equal(c.shift,'21:10–05:00');assert.equal(c.workedMinutes,530);assert.equal(c.nightHours,8.83);
 }
 assert.ok(Number.isNaN(calc({...base,turn:'ESTIU'}).workedMinutes));
});
test('Sunday evening no longer stays pending for a clock change that happened before its shift',()=>{
 const p={...base,contract:'85.81'},d=day({day:25});
 const c=calc(p,d);assert.equal(c.shift,'18:46–00:50');assert.equal(c.nightHours,2.83);
 assert.ok(Number.isFinite(nightHoursFor([day(),d],2026,10,p)));
});
test('ordinary Saturdays, spring and unsupported years keep their rules',()=>{
 const p={...base,subturn:'T8.1'};
 assert.equal(calc(p,day({day:31})).shift,'20:30–03:00');
 assert.equal(calc(p,day({day:28}),3).shift,'20:30–03:00');
 assert.equal(calc(p,day({day:25}),10,2025).shift,'21:10–04:00');
});
test('rest, reduced-day absence and explicit personal overrides are preserved',()=>{
 for(const status of ['DCOM','VACACIONES','RJ','ENFERMEDAD']){
  const c=calc(base,day({status}));assert.equal(c.workedMinutes,0);assert.equal(c.value,0);
 }
 const c=calc(base,day({special:'MODIFICACION',modificationPlacement:'PERSONALIZADO',customStart:'22:00',customEnd:'02:40'}));
 assert.equal(c.shift,'22:00–02:40');assert.equal(c.workedMinutes,280);assert.ok(Number.isNaN(c.nightHours));
 assert.match(c.nightReason,/cambio de hora/);
 const modified=calc({...base,subturn:'T8.2'},day({special:'MODIFICACION',modificationPlacement:'FINAL',extraHours:1}));
 assert.equal(modified.shift,'23:30–06:00');assert.equal(modified.workedMinutes,450);assert.equal(modified.value,2);assert.equal(modified.nightHours,7.5);
});
test('credit allocation retains source journey without doubling AT82 compensation',()=>{
 for(const [status,value,worked] of [['COMPUTO_ANTERIOR',0,0],['COMPUTO_ACTUAL',6.5,390]]){
  const c=calc({...base,subturn:'T8.2'},day({status}));
  assert.equal(c.creditedMinutes,390);assert.equal(c.value,value);assert.equal(c.workedMinutes,worked);assert.equal(c.nightHours,6.5);
 }
});
test('all other official dates and profiles preserve existing journey, balance and payroll results',async()=>{
 const {execFileSync}=await import('node:child_process');
 const original=execFileSync('git',['show','a2908543a9d841374a903a43f8b206cbc26ddd85:app/page.tsx'],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
 const ast=ts.createSourceFile('page.tsx',original.slice(0,original.indexOf('export default function Home')),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const old=await calendarContext();
 vm.runInContext(ts.transpileModule(ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(ast)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\nglobalThis.api={calcDay};',old);
 const {fixtures}=await import('./helpers/calendar-context.mjs');
 const profiles=[...['85.81','85','78.91','78.14'].map(contract=>({...base,contract})),...['T8.1','T8.2','T8.3','T8.4','T8.5'].map(subturn=>({...base,subturn})),...['T1','T2','T4','T5'].map(turn=>({...base,turn}))];
 for(const row of fixtures){
  const [y,m,n]=row.fecha.split('-').map(Number);
  if(row.fecha==='2026-10-24')continue;
  for(const p of profiles){
   const d=day({day:n}),before=old.api.calcDay(d,[d],y,m,p),after=calcDay(d,[d],y,m,p);
   for(const key of Object.keys(before)){
    if(m===10&&row.categoria_codigo==='DIUMENGE_CANVI_HORA'&&key.startsWith('night'))continue;
    assert.equal(after[key],before[key],`${row.fecha}/${p.turn}/${p.contract}/${p.subturn}/${key}`);
   }
  }
 }
});
