import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { calendarContext, calendarModule, fixtures } from './helpers/calendar-context.mjs';

const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('app/page.tsx', root), 'utf8');
const baseline = execFileSync('git', ['show', 'b345830947778183530abcff5b38975d9eb816e2:app/page.tsx'], {cwd:root,encoding:'utf8'});
function helpers(text, context) {
  const ast = ts.createSourceFile('page.tsx',text.slice(0,text.indexOf('export default function Home')),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const body = ast.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(ast)).join('\n');
  vm.runInContext(ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText + '\nglobalThis.api={calcDay,totalFor,ordinaryHoursFor,nightHoursFor,previousYearCreditMinutes,dominantStatus,annualBlockEvidence,annualCellEvidence,normalizeDays,formatHours,balanceLabel};',context);
  return {api:context.api,ast};
}
const context = await calendarContext();
const {api,ast} = helpers(source,context);
const old = helpers(baseline,vm.createContext({}));
const profile = {turn:'T8',contract:'85.81',fiestaLetter:'M'};
const day = n => ({day:n,status:'AGCG',baseStatus:'AGCG',special:'NINGUNA',extraHours:0,officialHoliday:false,note:''});
const calc = (date, p=profile, extra={}) => { const [y,m,d]=date.split('-').map(Number); return api.calcDay({...day(d),...extra},[day(d)],y,m,p); };

test('all 1096 official fixture dates and all 16 codes are validated; NULL remains NULL', () => {
  const mod = calendarModule();
  assert.equal(Object.keys(mod.CATEGORY_RULES).length,16);
  for(const [year,count] of [[2024,366],[2025,365],[2026,365]]) {
    const result=mod.validateOfficialYear(year,fixtures.filter(r=>r.fecha.startsWith(String(year))));
    assert.equal(result.size,count);
    for(const [date,code] of result) assert.equal(context.officialCategory(...date.split('-').map(Number)),code);
  }
  assert.deepEqual(fixtures.filter(r=>r.categoria_codigo===null).map(r=>r.fecha),['2025-03-31','2025-06-30']);
});

test('explicit treatment of every category with unchanged 85.81% schedules', () => {
  const expected={DISSABTE:510,DISSABTE_CANVI_HORA:510,DIUMENGE:364,DIUMENGE_CANVI_HORA:364,
    DIVENDRES:484,DIVENDRES_NO_LECTIU:484,DIVENDRES_NO_LECTIU_FINS_23H:364,
    DIVENDRES_VIG_FESTIU:484,DIVENDRES_VIG_FESTIU_NO_LECTIU:484,FEINER:364,
    FEINER_NO_LECTIU:364,FEINER_NO_LECTIU_FINS_23H:364,FEINER_FINS_23H:364,
    FESTIU:364,FESTIU_ESPECIAL:484,VIGILIA_NON_STOP:510};
  for(const row of fixtures) {
    if(row.categoria_codigo===null) continue;
    assert.equal(calc(row.fecha).workedMinutes,expected[row.categoria_codigo],row.fecha+' '+row.categoria_codigo);
  }
});

test('known special dates from each original workbook produce explicit expected results', () => {
  for(const [date,shift] of [
    ['2024-03-28','18:46–02:50'],['2024-03-29','18:46–02:50'],['2024-03-30','20:30–05:00'],
    ['2024-08-16','20:30–05:00'],['2024-12-24','18:46–23:50'],
    ['2025-01-05','18:46–02:50'],['2025-01-06','18:46–00:50'],['2025-06-23','20:30–05:00'],['2025-12-24','18:46–23:50'],
    ['2026-01-05','18:46–02:50'],['2026-03-28','20:30–05:00'],['2026-04-03','18:46–02:50'],
    ['2026-06-23','20:30–05:00'],['2026-12-24','18:46–23:50']]) assert.equal(calc(date).shift,shift,date);
});

test('no reconstruction from red digits, fixed Non Stop dates or tomorrow holiday flags', () => {
  for(const row of fixtures) {
    const [y,m,d]=row.fecha.split('-').map(Number);
    const x=day(d), a=api.calcDay(x,[x,day(d+1)],y,m,profile);
    const b=api.calcDay({...x,officialHoliday:true},[x,{...day(d+1),officialHoliday:true}],y,m,profile);
    assert.deepEqual(b,a,row.fecha);
  }
  assert.equal(calc('2024-08-16').workedMinutes,510); // Non Stop outside the old fixed list
});

test('NULL and unavailable years propagate pending instead of zero into hours and balances', () => {
  for(const [y,m,d] of [[2025,3,31],[2025,6,30],[2027,1,2]]) {
    const x=day(d), c=api.calcDay(x,[x],y,m,profile);
    for(const field of ['value','workedMinutes','ordinaryHours','nightHours','horaNona','creditedMinutes']) assert.ok(Number.isNaN(c[field]),field);
    assert.match(c.reason,/no disponible/);
    assert.ok(Number.isNaN(api.totalFor([x],y,m,profile)));
    assert.ok(Number.isNaN(api.ordinaryHoursFor([x],y,m,profile)));
    assert.ok(Number.isNaN(api.nightHoursFor([x],y,m,profile)));
    assert.equal(api.formatHours(c.ordinaryHours),'Pendiente');
    assert.equal(api.balanceLabel(profile,c.value),'Pendiente');
    assert.ok(Number.isNaN(api.calcDay({...x,special:'VISPERA_MANUAL'},[x],y,m,profile).value));
    assert.equal(api.calcDay({...x,status:'DCOM'},[x],y,m,profile).workedMinutes,0);
  }
  assert.doesNotMatch(source,/\?\.c\.value\s*\|\|\s*0/); // weekly totals must not swallow NaN
});

test('use official autumn change dates with the existing long-Saturday shifts', () => {
  for(const date of ['2024-10-26','2025-10-25','2026-10-24']) {
    const [y,m,d]=date.split('-').map(Number);
    for(const subturn of ['T8.1','T8.2','T8.3','T8.4','T8.5']) {
      const p={...profile,contract:'75',subturn};
      const expected={'T8.1':'21:10–04:00','T8.2':'23:30–05:20','T8.3':'21:10–03:00','T8.4':'21:10–06:00','T8.5':'21:10–06:00'};
      assert.equal(calc(date,p).shift,expected[subturn],date);
      if(y!==2026) assert.equal(calc(date,p).shift,old.api.calcDay(day(d),[day(d)],y,m,p).shift);
      else assert.notEqual(calc(date,p).shift,old.api.calcDay(day(d),[day(d)],y,m,p).shift);
    }
  }
});

test('personal colour recognition and cycle helpers are unchanged byte for byte', () => {
  const names=['dominantStatus','annualBlockEvidence','annualCellEvidence','classifyMonthly','loadAnnualCanvas','rectifyAnnual','detectStraightAnnualPanels','inferCyclePhase','auditCycle','applyCycleValidation'];
  for(const name of names) {
    const get=a=>a.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text===name).getText(a);
    assert.equal(get(ast),get(old.ast),name);
  }
  for(const rgb of [[255,255,255],[60,180,180],[230,140,100],[230,160,40],[200,140,190],[80,190,80],[120,150,110],[120,90,50],[40,50,160]]) {
    const pixels=new Uint8ClampedArray(Array.from({length:100},()=>[...rgb,255]).flat());
    assert.equal(api.dominantStatus(pixels),old.api.dominantStatus(pixels));
    assert.equal(JSON.stringify(api.annualBlockEvidence(pixels)),JSON.stringify(old.api.annualBlockEvidence(pixels)));
    const ctx={getImageData:()=>({data:pixels})};
    assert.equal(JSON.stringify(api.annualCellEvidence(ctx,100,100,25,25,{width:200,height:200})),JSON.stringify(old.api.annualCellEvidence(ctx,100,100,25,25,{width:200,height:200})));
  }
  assert.doesNotMatch(source,/containsRedDigit|redDigits|BASE_FIXED_GENERAL_HOLIDAYS|FIXED_NON_STOP/);
});

test('one yearly request is shared in flight and cached; publishable key only', async () => {
  const mod=calendarModule(); let calls=0, release;
  const gate=new Promise(r=>{release=r});
  const client=mod.createOfficialCalendarClient(async (url,opts)=>{
    calls++; assert.match(url,/anio=eq\.2024/); assert.equal(opts.headers.apikey,mod.CALENDAR_PUBLISHABLE_KEY);
    assert.match(opts.headers.apikey,/^sb_publishable_/); assert.equal(opts.headers.Authorization,undefined);
    await gate; return {ok:true,json:async()=>fixtures.filter(r=>r.fecha.startsWith('2024'))};
  });
  const a=client.load(2024),b=client.load(2024); assert.equal(a,b);release();await Promise.all([a,b]);await client.load(2024);
  assert.equal(calls,1); assert.equal(client.get(2024,8,16),'VIGILIA_NON_STOP');
});

test('network errors and malformed responses never populate cache and can be retried', async () => {
  const mod=calendarModule(),year=fixtures.filter(r=>r.fecha.startsWith('2024'));let fail=true,calls=0;
  const client=mod.createOfficialCalendarClient(async()=>{calls++;if(fail)throw new Error('offline');return{ok:true,json:async()=>year}});
  await assert.rejects(client.load(2024),/offline/);assert.equal(client.get(2024,1,1),undefined);
  fail=false;await client.load(2024);assert.equal(calls,2);
  for(const input of [[],year.slice(1),[...year.slice(1),year[1]],year.map((r,i)=>i===0?{...r,categoria_codigo:'INVENTADO'}:r),year.map((r,i)=>i===0?{...r,fecha:'2024-02-30'}:r)]) assert.throws(()=>mod.validateOfficialYear(2024,input));
  const denied=mod.createOfficialCalendarClient(async()=>({ok:false,status:403}));await assert.rejects(denied.load(2024),/403/);
});
