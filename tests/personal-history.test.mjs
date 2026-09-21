import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {calendarContext} from './helpers/calendar-context.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/roberto-personal-2026.json',import.meta.url)));
const text=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',text.slice(0,text.indexOf('export default function Home')),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const c=await calendarContext();
vm.runInContext(ts.transpileModule(ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(ast)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c);
const base=Object.fromEntries(Object.entries(fixture.months).map(([m,statuses])=>[m,statuses.map((status,i)=>({...c.makeDays(2026,+m)[i],status,baseStatus:c.baseOf(status)}))]));
const final=Object.fromEntries(Object.entries(base).map(([m,days])=>[m,days.map(d=>({...d,...fixture.overrides.find(o=>o.month===+m&&o.day===d.day)}))]));
const value=(plan,m,d)=>c.calcDay(plan[m][d-1],plan[m],2026,m,fixture.profile).value;
test('July 20: review zero becomes normal -0.64 plus one personal hour, +0.36',()=>{
 assert.equal(value(base,7,20),0);
 const original=base[7][19];
 assert.equal(c.calcDay({...original,status:'AGCG'},base[7],2026,7,fixture.profile).value,-.64);
 assert.equal(value(final,7,20),.36);
 assert.equal(c.totalFor(base[7],2026,7,fixture.profile),-.58);
 assert.equal(c.totalFor(final[7],2026,7,fixture.profile),-.22);
 // Merely attaching an hour to REVISAR is not a working-day confirmation.
 assert.equal(c.calcDay({...original,special:'MODIFICACION',extraHours:1},base[7],2026,7,fixture.profile).value,0);
});
test('March 2 permission is the only change in the current-year March balance',()=>{
 assert.equal(value(base,3,2),-.64);assert.equal(value(final,3,2),0);
 for(const day of [8,16,17,18,23,24]){assert.equal(value(base,3,day),0);assert.equal(value(final,3,day),0);}
 assert.equal(c.totalFor(base[3],2026,3,fixture.profile),-1.30);
 assert.equal(c.totalFor(final[3],2026,3,fixture.profile),-.66);
});
test('historical absences remain personal overrides, unresolved blue dates remain unresolved',()=>{
 assert.equal(final[3][7].status,'HUELGA_LEGAL');
 for(const d of [16,17,18]){assert.equal(final[3][d-1].status,'VAC_ANTERIOR');assert.equal(final[3][d-1].priorOrigin,'VACACIONES');}
 for(const {month,day} of fixture.unresolved)assert.equal(final[month][day-1].status,'REVISAR');
 assert.equal(base[3][1].status,'AGCG');assert.equal(base[7][19].status,'REVISAR');
});
test('all seven confirmed balances recovered using only sourced personal exceptions',()=>{
 for(let m=1;m<=7;m++)assert.equal(c.totalFor(final[m],2026,m,fixture.profile),fixture.expected[m-1],`month ${m}`);
});
