import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import * as roundingModule from '../lib/rounding-impact.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {calendarContext} from './helpers/calendar-context.mjs';
import {dateInMadrid,roundingPeriodEnd,roundingDay,roundingAvailable,roundingReport,signedRoundingTime} from '../lib/rounding-impact.js';

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
test('includes today and unconfirmed past shifts, while future shifts remain forecast only',()=>{
 const data=input();data.days=data.days.map(row=>row.date==='2026-01-05'?{...row,confirmed:false}:row);
 const report=roundingReport(data,{...period,asOf:'2026-01-10'});
 assert.equal(report.forecast.balance.count,3);assert.equal(report.actual.balance.count,3);assert.equal(report.excludedWork,0);
 assert.equal(report.provisionalWork,1);assert.equal(report.days[0].date,'2026-01-05');
 const earlier=roundingReport(data,{...period,asOf:'2026-01-09'});
 assert.equal(earlier.actual.balance.count,2);assert.equal(earlier.forecast.balance.count,3);assert.equal(earlier.excludedWork,1);
});
test('missing and exceptional days are not silently counted as zero',()=>{
 const data=input();data.days=data.days.filter(row=>row.date!=='2026-01-01');
 data.days=data.days.map(row=>row.date===normal.date?{...row,balanceEligible:false,nightEligible:false}:row);
 const report=roundingReport(data,period);
 assert.equal(report.missing,1);assert.equal(report.actual.balance.excluded,1);assert.equal(report.missingActual,1);
 const empty=roundingReport({...data,days:[]},period);assert.equal(empty.actual.balance.seconds,null);assert.equal(empty.actual.night.seconds,null);
});
test('unsupported contracts/years, malformed ranges and duplicate dates fail closed',()=>{
 for(const profile of [{turn:'T1',percent:100},{turn:'T8',percent:77},{turn:'ESTIU',percent:85.81},{turn:'ESTIU',percent:100}])assert.equal(roundingAvailable({...input(),profile}),false);
 assert.equal(roundingAvailable({...input(),year:2028}),false);
 for(const year of [2020,2021,2022,2023,2024,2025,2026,2027])for(const percent of [75,78.14,78.91,85,85.81])assert.equal(roundingAvailable({...input(),year,profile:{turn:'T8',percent}}),true);
 for(const p of [{...period,from:'2026-02-30'},{...period,from:'2026-02-01'},{...period,to:'2027-01-01'}])assert.equal(roundingReport(input(),p).ready,false);
 const data=input();data.days.push(data.days[0]);assert.equal(roundingReport(data,period).ready,false);
});
test('a confirmed complete period without work has zero effect, while missing data remains pending',()=>{
 const data=input();data.days=data.days.map(row=>({...row,working:false}));
 const report=roundingReport(data,period);assert.equal(report.actual.balance.seconds,0);assert.equal(report.actual.night.seconds,0);
 assert.equal(roundingReport({...data,days:[]},period).actual.night.seconds,null);
});
test('Madrid day advances over midnight and default end follows today within the selected year',()=>{
 assert.equal(dateInMadrid(new Date('2026-11-17T23:01:00Z')),'2026-11-18');
 assert.equal(roundingPeriodEnd(2026,'2026-11-18'),'2026-11-18');
 assert.equal(roundingPeriodEnd(2026,'2026-11-19'),'2026-11-19');
 assert.equal(roundingPeriodEnd(2026,'2027-01-01'),'2026-12-31');
 assert.equal(roundingPeriodEnd(2026,'2025-12-31'),'2026-01-01');
});
test('full-year forecast includes future work and changes when future calendar work changes',()=>{
 const data=input();data.days.push({...friday,date:'2026-12-18',confirmed:false});
 const annual={from:'2026-01-01',to:'2026-12-31',asOf:'2026-01-10'};
 const before=roundingReport(data,annual);assert.equal(before.forecast.balance.count,4);assert.equal(before.actual.balance.count,3);
 data.days[data.days.length-1]={...saturday,date:'2026-12-18',confirmed:false};
 const after=roundingReport(data,annual);near(after.forecast.balance.seconds-before.forecast.balance.seconds,-12);
 near(after.actual.balance.seconds,before.actual.balance.seconds);
});
test('a future-only custom period has no elapsed-day gaps or invented actual totals',()=>{
 const report=roundingReport(input(),{from:'2026-01-09',to:'2026-01-31',asOf:'2026-01-01'});
 assert.equal(report.missingActual,0);assert.equal(report.actual.balance.seconds,null);assert.equal(report.forecast.balance.count,2);
});
test('input remains unchanged and presentation retains seconds and signs',()=>{
 const data=input(),before=JSON.stringify(data);roundingReport(data,period);assert.equal(JSON.stringify(data),before);
 assert.equal(signedRoundingTime(-112.363636),'−1 min 52,4 s');assert.equal(signedRoundingTime(7.6145),'+7,6 s');
 assert.equal(signedRoundingTime(0),'0 s');assert.equal(signedRoundingTime(null),'Pendent');
});

const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',source.slice(0,source.indexOf('export default function Home')),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const ctx=await calendarContext();
vm.runInContext(ts.transpileModule(ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(ast)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\nglobalThis.api={roundingFactsFor,calcDay,DEFAULT_PROFILE};',ctx);
test('read-only adapter isolates recoveries, paid extensions, exceptional dates and full-time contracts',()=>{
 const day=n=>({day:n,status:'AGCG',baseStatus:'AGCG',special:'NINGUNA',extraHours:0});
 const ds=[day(5),{...day(6),status:'COMPUTO_ANTERIOR'},{...day(7),paidExtensionMinutes:60},{...day(8),status:'REVISION_MEDICA'}, {...day(9),modificationAccount:'ANTERIOR',special:'MODIFICACION',extraHours:1}];
 const plan={1:{days:ds,confirmed:true}},profile={...ctx.api.DEFAULT_PROFILE},before=JSON.stringify(plan);
 const result=ctx.api.roundingFactsFor(plan,2026,profile);
 assert.equal(result.days[0].balanceEligible,true);
 for(const row of result.days.slice(1))assert.equal(row.balanceEligible,false);
 assert.equal(result.days[1].nightEligible,true); // Prior-year accounting does not remove the night's remuneration.
 assert.equal(JSON.stringify(plan),before);
 assert.equal(ctx.api.roundingFactsFor(plan,2026,{...profile,turn:'T1'}),null);
 assert.equal(ctx.api.roundingFactsFor(plan,2028,profile),null);
 const original=ctx.api.calcDay(ds[0],ds,2026,1,profile);
 assert.equal(result.days[0].balanceHours,original.value);assert.equal(result.days[0].nightHours,original.nightHours);
});
test('rounding information is independent of SAP authorization, without new storage or networking',()=>{
 const panel=readFileSync(new URL('../app/sap-review-panel.tsx',import.meta.url),'utf8');
 assert.match(panel,/if\(auth!=="owner"\)return null;/);
 assert.match(panel,/void verifiedOwner\(\)/);
 assert.doesNotMatch(panel,/RoundingImpactPanel|RoundingInput/);
 assert.match(source,/<RoundingImpactPanel/);
 const view=readFileSync(new URL('../app/rounding-impact-panel.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(view,/Contrast amb SAP|sapDoc|sapNight/);
 assert.match(view,/setInterval\(refresh,60000\)/);assert.match(view,/visibilitychange/);
 assert.doesNotMatch(view,/Fins avui · automàtic|Només administrador|verifiedOwner/);assert.match(view,/Previsió de tot l/);
 for(const path of ['../lib/rounding-impact.js','../app/rounding-impact-panel.tsx']){
   const code=readFileSync(new URL(path,import.meta.url),'utf8');
   assert.doesNotMatch(code,/\bfetch\s*\(|localStorage\.(setItem|removeItem)|indexedDB|user_id|employeeNumber|medicalStart|medicalEnd/);
 }
});


// Render the real component with controlled hook state to exercise each result
// scope. Calendar/SAP records and the authorization wrapper are not mocked open.
const componentSource=readFileSync(new URL('../app/rounding-impact-panel.tsx',import.meta.url),'utf8');
const componentJs=ts.transpileModule(componentSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const componentRequire=createRequire(import.meta.url);
const componentReact=componentRequire('react');
const {renderToStaticMarkup}=componentRequire('react-dom/server');
function renderRoundingRange(from,to,data=input()){
 let cursor=0;
 const state=['2026-01-10',from,to];
 const mockReact={...componentReact,useState:()=>[state[cursor++],()=>{}],useEffect:()=>{}};
 const out={};
 new Function('require','exports',componentJs)(name=>name==='react'?mockReact:name==='@/lib/rounding-impact'?roundingModule:componentRequire(name),out);
 return renderToStaticMarkup(out.default({input:data}));
}
function resultSection(html,label){
 const start=html.indexOf('aria-label="'+label+'"');
 assert.ok(start>=0,'Missing result group: '+label);
 return html.slice(start,html.indexOf('</section>',start));
}
test('selected period results stay grouped; automatic and annual totals remain independent',()=>{
 const january=renderRoundingRange('2026-01-05','2026-01-05');
 const friday=renderRoundingRange('2026-01-09','2026-01-09');
 const first=resultSection(january,'Càlcul del període escollit'),second=resultSection(friday,'Càlcul del període escollit');
 assert.match(first,/3 · Consultar un període/);assert.match(first,/Arrodoniment des de/);
 assert.match(first,/Còmput horari del període/);assert.match(first,/Nocturnitat variable del període/);
 assert.match(first,/Detall del període per dies/);assert.match(first,/−12 s/);assert.match(second,/\+12 s/);
 assert.equal(resultSection(january,'Acumulat fins avui'),resultSection(friday,'Acumulat fins avui'));
 assert.equal(resultSection(january,'Previsió anual de l’arrodoniment'),resultSection(friday,'Previsió anual de l’arrodoniment'));
});
test('invalid or future custom periods do not hide or change independent accumulated/year results',()=>{
 const baseline=renderRoundingRange('2026-01-05','2026-01-05');
 const invalid=renderRoundingRange('2026-01-31','2026-01-01');
 assert.match(resultSection(invalid,'Càlcul del període escollit'),/Selecciona un període vàlid/);
 assert.equal(resultSection(invalid,'Acumulat fins avui'),resultSection(baseline,'Acumulat fins avui'));
 assert.equal(resultSection(invalid,'Previsió anual de l’arrodoniment'),resultSection(baseline,'Previsió anual de l’arrodoniment'));
 const data=input();data.days.push({...friday,date:'2026-12-18',confirmed:false});
 const future=renderRoundingRange('2026-12-18','2026-12-18',data);
 assert.match(resultSection(future,'Càlcul del període escollit'),/\+12 s/);
 assert.match(resultSection(future,'Càlcul del període escollit'),/1 jornades analitzades/);
 const report=roundingReport(data,{from:'2026-12-18',to:'2026-12-18',asOf:'2026-01-10'});
 assert.equal(report.forecastDays[0].date,'2026-12-18');assert.equal(report.days.length,0);
});

test('period is initially collapsed with blank dates and no duplicate results',()=>{
 const html=renderRoundingRange('','');
 const periodHtml=resultSection(html,'Càlcul del període escollit');
 assert.match(periodHtml,/<details>/);assert.doesNotMatch(periodHtml,/<details open|Resultat del|Còmput horari del període|Nocturnitat variable del període/);
 assert.equal((periodHtml.match(/value=""/g)||[]).length,2);
 assert.match(resultSection(html,'Acumulat fins avui'),/2 · Acumulat fins avui/);
 assert.equal((html.match(/<h4 /g)||[]).length,4);
 const half=renderRoundingRange('2026-01-05','');assert.doesNotMatch(resultSection(half,'Càlcul del període escollit'),/Resultat del/);
 assert.equal(renderRoundingRange('','',{...input(),profile:{turn:'T1',percent:100}}),'');
 assert.equal(renderRoundingRange('','',{...input(),profile:{turn:'ESTIU',percent:100},balanceMode:'recognized-hours'}),'');
});

// Independently specified ordinary schedule/value fixtures for every T8 variant.
const contracts=[
 ['85.81',null,364,-0.64,484,1.36,510,1.79,170,484,510,6.71],
 ['85',null,359,-0.67,479,1.33,510,1.85,170,479,510,6.65],
 ['78.91',null,330,-0.67,450,1.33,510,2.33,170,450,510,6.17],
 ['78.14',null,330,-0.61,450,1.39,490,2.06,170,450,490,6.11],
 ['75','T8.1',330,-0.37,450,1.63,390,0.63,170,450,390,5.87],
 ['75','T8.2',330,-0.37,450,1.63,330,-0.37,170,450,330,5.87],
 ['75','T8.3',330,-0.37,450,1.63,330,-0.37,170,450,240,5.87],
 ['75','T8.4',298,-0.90,450,1.63,510,2.63,138,450,510,5.87],
 ['75','T8.5',298,-0.90,450,1.63,510,2.63,170,450,510,5.87]
];
const workingDay=n=>({day:n,status:'AGCG',baseStatus:'AGCG',special:'NINGUNA',extraHours:0});
for(const [contract,subturn,normalMinutes,normalBalance,fridayMinutes,fridayBalance,saturdayMinutes,saturdayBalance,normalNight,fridayNight,saturdayNight,basis] of contracts){
 test(`T8 ${contract} ${subturn||''}: independent durations, balances, night rights and profile isolation`,()=>{
  const profile={...ctx.api.DEFAULT_PROFILE,turn:'T8',contract,subturn};
  const ds=[workingDay(12),workingDay(16),workingDay(17)];
  const plan={1:{days:ds,confirmed:true}},before=JSON.stringify(plan);
  const data=ctx.api.roundingFactsFor(plan,2026,profile);assert.ok(roundingAvailable(data));
  near(data.companyBasisHours,basis);assert.equal(data.profile.percent,Number(contract));
  const expected=[[normalMinutes,normalBalance,normalNight],[fridayMinutes,fridayBalance,fridayNight],[saturdayMinutes,saturdayBalance,saturdayNight]];
  for(let i=0;i<3;i++){
   const row=data.days[i], [minutes,balance,night]=expected[i];
   assert.equal(row.workedMinutes,minutes);assert.equal(row.balanceHours,balance);assert.equal(row.nightMinutes,night);
   const computed=roundingDay(row,1634*Number(contract)/100/209);
   near(computed.balance.seconds,(balance-minutes/60+1634*Number(contract)/100/209)*3600);
   near(computed.night.seconds,(Number((night/60).toFixed(2))-night/60)*3600);
  }
  assert.equal(JSON.stringify(plan),before);
  const html=renderRoundingRange('','',data);assert.match(html,new RegExp(Number(contract).toLocaleString('ca-ES')+' %'));
  if(subturn==='T8.4'||subturn==='T8.5'){
   const sunday=data.examples.find(row=>row.label==='Diumenge ordinari');assert.equal(sunday.workedMinutes,330);assert.equal(sunday.balanceHours,-0.37);
  }
 });
}
for(const shift of ['AT86','AT87'])test(`Estiu 75 ${shift}: recognized hours without an annual T8 balance deduction`,()=>{
 const profile={...ctx.api.DEFAULT_PROFILE,turn:'ESTIU',summer:{2026:{percentage:'75',assignments:[{month:7,shift,fiestaLetter:'M'}]}}};
 const ds=[workingDay(13),workingDay(17),workingDay(18)],data=ctx.api.roundingFactsFor({7:{days:ds,confirmed:true}},2026,profile);
 assert.ok(roundingAvailable(data));assert.equal(data.balanceMode,'recognized-hours');assert.equal(data.companyBasisHours,undefined);
 const report=roundingReport(data,{from:'2026-07-01',to:'2026-07-31',asOf:'2026-11-18'});
 assert.equal(report.meanHours,0);near(report.forecast.balance.seconds,12);
 assert.equal(data.days[0].nightMinutes,shift==='AT86'?138:170);
 assert.equal(ctx.api.roundingFactsFor({},2026,{...profile,summer:{2026:{percentage:'100',assignments:[]}}}),null);
 const html=renderRoundingRange('','',data);assert.match(html,/Estiu · 75 %/);assert.match(html,/hores reconegudes/);
});
test('summer without a monthly assignment stays pending instead of inventing work or a daily average',()=>{
 const profile={...ctx.api.DEFAULT_PROFILE,turn:'ESTIU',summer:{2026:{percentage:'75',assignments:[]}}};
 const data=ctx.api.roundingFactsFor({7:{days:[workingDay(13)],confirmed:false}},2026,profile);
 const report=roundingReport(data,{from:'2026-07-01',to:'2026-07-31',asOf:'2026-11-18'});
 assert.equal(data.examples.length,0);assert.equal(report.forecast.balance.seconds,null);assert.equal(report.forecast.night.seconds,null);assert.equal(report.unknownDays,1);
});
test('years with defined bases use each annual proportion without intermediate rounding',()=>{
 for(const [year,full,days] of [[2020,1666,213],[2021,1666,213],[2022,1658,212],[2023,1658,212],[2024,1650,211],[2025,1642,210],[2026,1634,209],[2027,1618,207]])for(const [contract] of contracts){
  const data=ctx.api.roundingFactsFor({},year,{...ctx.api.DEFAULT_PROFILE,contract});
  const report=roundingReport(data,{from:`${year}-01-01`,to:`${year}-12-31`,asOf:'2026-11-18'});
  assert.equal(report.ready,true);near(report.meanHours,full*Number(contract)/100/days);
 }
});

