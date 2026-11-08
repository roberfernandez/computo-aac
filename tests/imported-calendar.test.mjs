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
const day = (date, changes = {}) => ({ day: date, baseStatus: 'AGCG', status: 'AGCG', special: 'NINGUNA', extraHours: 0, officialHoliday: false, note: '', ...changes });
test('uploaded statuses override any letter, including grey and unresolved blue cells', () => {
  const input=[day(3),day(4,{status:'DCOM',baseStatus:'DCOM',confidence:.2}),day(5,{status:'REVISAR',baseStatus:'REVISAR',detectedColour:'BLUE'})];
  for(let phase=0;phase<28;phase++) {
    const result=c.applyCycleValidation(input,2026,1,phase);
    assert.deepEqual(Array.from(result,d=>d.status),input.map(d=>d.status));
    assert.equal(result[2].detectedColour,'BLUE');
  }
});

test('saving and reloading a calendar with a letter change keeps all imported days', () => {
  const input = Array.from({length:31}, (_,i) => day(i+1, {status:i < 15 ? 'DCOM' : 'AGCG',baseStatus:i < 15 ? 'DCOM' : 'AGCG'}));
  for(const fiestaLetter of ['K','L','M','N']) {
    const result=c.repairStoredPlan(JSON.parse(JSON.stringify({1:{original:input,days:input,confirmed:true}})),2026,{turn:'T8',contract:'85.81',fiestaLetter});
    assert.deepEqual(Array.from(result[1].days,d=>d.status),input.map(d=>d.status));
    assert.equal(result[1].confirmed,true);
  }
});

// Supply personal images locally; never commit portal calendars to the repository.
test('annual reference with a mid-January letter change retains the photographed dates', {skip: !process.env.AAC_LETTER_CHANGE_RGBA}, async () => {
  const {canvasFor} = await import('./helpers/annual-canvas.mjs');
  const fixture = JSON.parse(readFileSync(process.env.AAC_LETTER_CHANGE_RGBA,'utf8'));
  fixture.data = new Uint8ClampedArray(Buffer.from(fixture.rgba,'base64'));
  c.document = {createElement:()=>canvasFor()};
  c.createImageBitmap = async()=>({...fixture,close(){}});
  const result = await c.classifyAnnual({},2026);
  const rest = [3,7,10,14,23,24], holiday = [4,8,11,15,25];
  assert.equal(Object.values(result.plan).reduce((n,m)=>n+m.days.length,0),365);
  assert.deepEqual(Array.from(result.plan[1].days,d=>d.status),Array.from({length:31},(_,i)=>rest.includes(i+1)?'DCOM':holiday.includes(i+1)?'FEST':'AGCG'));
});
