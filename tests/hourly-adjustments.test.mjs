import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { calendarContext } from './helpers/calendar-context.mjs';
const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('page.tsx', source.slice(0, source.indexOf('export default function Home')), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const c = await calendarContext();
vm.runInContext(ts.transpileModule(ast.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(ast)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, c);
const profile = { turn: 'T8', contract: '85.81', fiestaLetter: 'M' };
const day = (date = 23, changes = {}) => ({ day: date, baseStatus: 'AGCG', status: 'AGCG', special: 'NINGUNA', extraHours: 0, officialHoliday: false, note: '', ...changes });
const calc = d => c.calcDay(d, [d], 2026, 7, profile);
test('recover or enjoy one hour, either endpoint, either year: only the difference is transferred', () => {
  for (const date of [23, 24, 25]) for (const minutes of [-60, 60]) for (const placement of ['INICIO', 'FINAL']) for (const account of ['ACTUAL', 'ANTERIOR']) {
    const base = calc(day(date));
    const d = day(date, { special: 'MODIFICACION', modificationAccount: account, modificationPlacement: placement, extraHours: minutes / 60 });
    const result = calc(d);
    assert.equal(result.workedMinutes, base.workedMinutes + minutes);
    assert.equal(result.ordinaryHours, Number(((base.workedMinutes + minutes) / 60).toFixed(2)));
    assert.equal(result.value, Number((base.value + (account === 'ACTUAL' ? minutes / 60 : 0)).toFixed(2)));
    assert.equal(result.creditedMinutes, account === 'ANTERIOR' ? minutes : 0);
    assert.equal(c.previousYearCreditMinutes({7:{days:[d]}},2026,profile),account === 'ANTERIOR' ? minutes : 0);
    assert.equal(c.modificationError(d,[d],2026,7,profile),'');
  }
});
test('both endpoints, midnight, custom hours, and no double full-day credit', () => {
  const d = day(23, { status: 'COMPUTO_ANTERIOR', special:'MODIFICACION', modificationAccount:'ANTERIOR', modificationPlacement:'AMBOS', startExtraMinutes:30, endExtraMinutes:30 });
  const result = calc(d);
  assert.equal(result.shift,'18:16–01:20'); assert.equal(result.workedMinutes,424); assert.equal(result.creditedMinutes,60); assert.equal(result.value,-.64);
  const shorter = calc({...d,status:'COMPUTO_POSITIVO_ANTERIOR',startExtraMinutes:-30,endExtraMinutes:-30});
  assert.equal(shorter.shift,'19:16–00:20'); assert.equal(shorter.workedMinutes,304); assert.equal(shorter.creditedMinutes,-60);
  const custom = calc({...d, modificationPlacement:'PERSONALIZADO',customStart:'17:46',customEnd:'00:50'});
  assert.equal(custom.creditedMinutes,60);assert.equal(custom.workedMinutes,424);
  const swap = calc({...d,startExtraMinutes:30,endExtraMinutes:-30});assert.equal(swap.creditedMinutes,0);assert.equal(swap.workedMinutes,364);
});
test('reject invalid and excessive adjustments before saving any day in a batch', () => {
  for(const patch of [{extraHours:-7},{extraHours:24},{extraHours:NaN},{modificationPlacement:'PERSONALIZADO',customStart:'',customEnd:'00:50'},{modificationPlacement:'PERSONALIZADO',customStart:'12:00',customEnd:'12:00'}]) {
    const d=day(23,{special:'MODIFICACION',modificationAccount:'ACTUAL',...patch});
    assert.ok(c.modificationError(d,[d],2026,7,profile));
  }
});
test('batch shares adjustment fields, keeps individual dates and schedules, round-trips saved plans', () => {
  const adjustment=day(1,{special:'MODIFICACION',modificationAccount:'ANTERIOR',modificationPlacement:'INICIO',extraHours:1});
  const days=[23,24,25].map(date=>({...day(date),...c.modificationFields(adjustment),special:'MODIFICACION',manualEdited:true}));
  assert.deepEqual(days.map(d=>calc(d).shift),['17:46–00:50','17:46–02:50','19:30–05:00']);
  const plan={7:{days,original:days.map(d=>day(d.day)),confirmed:false}};
  const restored=c.repairStoredPlan(JSON.parse(JSON.stringify(plan)),2026,profile);
  assert.equal(c.previousYearCreditMinutes(restored,2026,profile),180);
  assert.deepEqual(Array.from(restored[7].days,d=>calc(d).shift),days.map(d=>calc(d).shift));
});
test('uploaded statuses override any letter, including grey and unresolved blue cells', () => {
  const input=[day(3),day(4,{status:'DCOM',baseStatus:'DCOM',confidence:.2}),day(5,{status:'REVISAR',baseStatus:'REVISAR',detectedColour:'BLUE'})];
  for(let phase=0;phase<28;phase++) {
    const result=c.applyCycleValidation(input,2026,1,phase);
    assert.deepEqual(Array.from(result,d=>d.status),input.map(d=>d.status));
    assert.equal(result[2].detectedColour,'BLUE');
  }
});

test('switch from a complete compensatory day to hours keeps its year and resets old adjustments', () => {
  for (const status of ['COMPUTO_ANTERIOR','COMPUTO_ACTUAL','COMPUTO_POSITIVO_ANTERIOR','COMPUTO_POSITIVO_ACTUAL']) {
    const original=day(23,{status,modificationAccount:'ANTERIOR',extraHours:5,customStart:'12:00',periodId:'old'});
    const result=c.hourlyAdjustment(original);
    assert.equal(result.status,'AGCG');
    assert.equal(result.special,'MODIFICACION');
    assert.equal(result.modificationAccount,status.endsWith('ANTERIOR')?'ANTERIOR':'ACTUAL');
    assert.equal(result.extraHours,0);
    assert.equal(result.customStart,undefined);
    assert.equal(result.periodId,undefined);
    assert.equal(original.extraHours,5);
  }
});

test('the real bulk action applies hourly adjustments atomically and restores the original days', () => {
  const fullAst=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const home=fullAst.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='Home');
  const functions=home.body.statements.filter(n=>ts.isFunctionDeclaration(n)&&['applyBulkSituation','bulkSituationLabel'].includes(n.name?.text));
  vm.runInContext(ts.transpileModule(functions.map(n=>n.getText(fullAst)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c);
  let saved=null, message='';
  Object.assign(c,{days:[day(23),day(24),day(25)],year:2026,month:7,profile,multiSelectedDays:[23,24],bulkSituation:'special:MODIFICACION',bulkModification:day(1,{modificationAccount:'ANTERIOR',modificationPlacement:'INICIO',extraHours:1}),commitMonth:days=>saved=days,cancelMultiSelection:()=>{},setMessage:value=>message=value});
  c.applyBulkSituation();
  assert.deepEqual(Array.from(saved,d=>calc(d).shift),['17:46–00:50','17:46–02:50','20:30–05:00']);
  assert.equal(c.previousYearCreditMinutes({7:{days:saved}},2026,profile),120);
  assert.match(message,/2 días/);
  saved=null;c.bulkModification.extraHours=-24;c.applyBulkSituation();
  assert.equal(saved,null);assert.match(message,/Día 23/);
  c.bulkSituation='restore';c.plan={7:{original:[day(23),day(24),day(25)]}};c.applyBulkSituation();
  assert.ok(saved.every(d=>d.special==='NINGUNA'));
});
