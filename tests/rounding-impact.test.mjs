import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {calendarContext} from './helpers/calendar-context.mjs';
import {roundingDay,roundingPilotAvailable,roundingReport,signedRoundingTime} from '../lib/rounding-impact.js';

const normal={date:'2026-01-05',schedule:'18:46–00:50',confirmed:true,working:true,balanceEligible:true,balanceHours:-0.64,workedMinutes:364,nightEligible:true,nightMinutes:170,nightHours:2.83};
const friday={...normal,date:'2026-01-09',schedule:'18:46–02:50',balanceHours:1.36,workedMinutes:484,nightMinutes:484,nightHours:8.07};
const saturday={...normal,date:'2026-01-10',schedule:'20:30–05:00',balanceHours:1.79,workedMinutes:510,nightMinutes:510,nightHours:8.5};
const mean=1634*0.8581/209;
const input=()=>({year:2026,profile:{turn:'T8',percent:85.81},fullTimeHours:1634,workdays:209,
  examples:[{...normal,label:'Normal'},{...friday,label:'Friday'},{...saturday,label:'Saturday'}],
  days:Array.from({length:31},(_,i)=>{const date=`2026-01-${String(i+1).padStart(2,'0')}`;return [normal,friday,saturday].find(d=>d.date===date)||{...normal,date,working:false};})});
const period={from:'2026-01-01',to:'2026-01-31',asOf:'2026-11-18'};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('85.81% preserves the exact annual proportion and opposite signs in the two concepts',()=>{
 const report=roundingReport(input(),period);
 near(report.annualHours,1402.1354);near(report.meanHours,6.708781818181818);
 const day=roundingDay(normal,mean);near(day.balance.seconds,7.6145454545);near(day.night.seconds,-12);
 near(roundingDay(friday,mean).balance.seconds,7.6145454545);near(roundingDay(friday,mean).night.seconds,12);
 near(roundingDay(saturday,mean).balance.seconds,-4.3854545454);near(roundingDay(saturday,mean).night.seconds,0);
});
test('accumulates exact differences, never rounded display values',()=>{
 const report=roundingReport(input(),period);
 near(report.actual.balance.seconds,10.8436363636);near(report.actual.night.seconds,0);
 assert.equal(report.actual.balance.count,3);assert.equal(report.missing,0);
});
test('current/future and unconfirmed shifts remain forecast only',()=>{
 const data=input();data.days=data.days.map(row=>row.date==='2026-01-05'?{...row,confirmed:false}:row);
 const report=roundingReport(data,{...period,asOf:'2026-01-10'});
 assert.equal(report.forecast.balance.count,3);assert.equal(report.actual.balance.count,1);assert.equal(report.excludedWork,2);
 assert.equal(report.days[0].date,'2026-01-09');
});
test('missing and exceptional days are not silently counted as zero',()=>{
 const data=input();data.days=data.days.filter(row=>row.date!=='2026-01-01');
 data.days=data.days.map(row=>row.date===normal.date?{...row,balanceEligible:false,nightEligible:false}:row);
 const report=roundingReport(data,period);
 assert.equal(report.missing,1);assert.equal(report.actual.balance.excluded,1);assert.equal(report.sapNight[0].status,'unavailable');
 const empty=roundingReport({...data,days:[]},period);assert.equal(empty.actual.balance.seconds,null);assert.equal(empty.actual.night.seconds,null);
});
test('only this contract/year is enabled; malformed ranges and duplicate dates fail closed',()=>{
 for(const profile of [{turn:'T1',percent:100},{turn:'T8',percent:75},{turn:'ESTIU',percent:85.81}])assert.equal(roundingPilotAvailable({...input(),profile}),false);
 assert.equal(roundingPilotAvailable({...input(),year:2027}),false);
 for(const p of [{...period,from:'2026-02-30'},{...period,from:'2026-02-01'},{...period,to:'2027-01-01'}])assert.equal(roundingReport(input(),p).ready,false);
 const data=input();data.days.push(data.days[0]);assert.equal(roundingReport(data,period).ready,false);
});
test('a confirmed complete period without work has zero effect, while missing data remains pending',()=>{
 const data=input();data.days=data.days.map(row=>({...row,working:false}));
 const report=roundingReport(data,period);assert.equal(report.actual.balance.seconds,0);assert.equal(report.actual.night.seconds,0);
 assert.equal(roundingReport({...data,days:[]},period).actual.night.seconds,null);
});
test('monthly SAP corroboration is separate from additional unexplained differences',()=>{
 const doc={ano:2026,extraido:'2026-11-13T18:40:00Z',valoraciones:{'2026-01':[normal,friday,saturday].map(row=>({Date:row.date,LongText:'Nocturnidad Variable',Number:String(row.nightHours)}))}};
 const report=roundingReport(input(),period,doc);assert.equal(report.sapNight[0].status,'match');
 doc.valoraciones['2026-01'][0].Number='2.84';
 const different=roundingReport(input(),period,doc);assert.equal(different.sapNight[0].status,'different');near(different.sapNight[0].residualSeconds,36);
 near(different.actual.night.seconds,report.actual.night.seconds);
 const partial=roundingReport(input(),{...period,from:'2026-01-05'},doc);assert.equal(partial.sapNight.length,0);
});
test('input and SAP snapshots remain unchanged and presentation retains seconds and signs',()=>{
 const data=input(),before=JSON.stringify(data);roundingReport(data,period);assert.equal(JSON.stringify(data),before);
 assert.equal(signedRoundingTime(-112.363636),'−1 min 52,4 s');assert.equal(signedRoundingTime(7.6145),'+7,6 s');
 assert.equal(signedRoundingTime(0),'0 s');assert.equal(signedRoundingTime(null),'Pendent');
});

const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',source.slice(0,source.indexOf('export default function Home')),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const ctx=await calendarContext();
vm.runInContext(ts.transpileModule(ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(ast)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\nglobalThis.api={roundingFactsFor,calcDay,DEFAULT_PROFILE};',ctx);
test('read-only calendar adapter isolates recoveries, paid extensions, exceptional dates and other contracts',()=>{
 const day=n=>({day:n,status:'AGCG',baseStatus:'AGCG',special:'NINGUNA',extraHours:0});
 const ds=[day(5),{...day(6),status:'COMPUTO_ANTERIOR'},{...day(7),paidExtensionMinutes:60},{...day(8),status:'REVISION_MEDICA'}, {...day(9),modificationAccount:'ANTERIOR',special:'MODIFICACION',extraHours:1}];
 const plan={1:{days:ds,confirmed:true}},profile={...ctx.api.DEFAULT_PROFILE},before=JSON.stringify(plan);
 const result=ctx.api.roundingFactsFor(plan,2026,profile);
 assert.equal(result.days[0].balanceEligible,true);
 for(const row of result.days.slice(1))assert.equal(row.balanceEligible,false);
 assert.equal(result.days[1].nightEligible,true); // Prior-year accounting does not remove the night's remuneration.
 assert.equal(JSON.stringify(plan),before);
 assert.equal(ctx.api.roundingFactsFor(plan,2026,{...profile,contract:'75'}),null);
 assert.equal(ctx.api.roundingFactsFor(plan,2027,profile),null);
 const original=ctx.api.calcDay(ds[0],ds,2026,1,profile);
 assert.equal(result.days[0].balanceHours,original.value);assert.equal(result.days[0].nightHours,original.nightHours);
});
test('feature is mounted only after the existing server-verified administrator gate, without new storage or networking',()=>{
 const panel=readFileSync(new URL('../app/sap-review-panel.tsx',import.meta.url),'utf8');
 assert.ok(panel.indexOf('if(auth!=="owner")return null;')<panel.indexOf('<RoundingImpactPanel'));
 assert.match(panel,/void verifiedOwner\(\)/);
 for(const path of ['../lib/rounding-impact.js','../app/rounding-impact-panel.tsx']){
   const code=readFileSync(new URL(path,import.meta.url),'utf8');
   assert.doesNotMatch(code,/\bfetch\s*\(|localStorage\.(setItem|removeItem)|indexedDB|user_id|employeeNumber|medicalStart|medicalEnd/);
 }
});
