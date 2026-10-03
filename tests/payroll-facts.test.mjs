import { calendarContext } from './helpers/calendar-context.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const parsed=ts.createSourceFile('page.tsx',source.slice(0,source.indexOf('export default function Home')),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const body=parsed.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(parsed)).join('\n');
const context=await calendarContext(); context.process={env:{}};
vm.runInContext(ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText+'\nglobalThis.api={payrollFactsFor,calcDay,DEFAULT_PROFILE};',context);
const {payrollFactsFor,calcDay,DEFAULT_PROFILE}=context.api;
const day={day:2,status:'AGCG',special:'NINGUNA',extraHours:0};
test('export preserves resolved units and strips personal fields',()=>{
 const profile={...DEFAULT_PROFILE,name:'PRIVATE',employeeNumber:'PRIVATE'};
 const d={...day,notes:'PRIVATE'};
 const out=payrollFactsFor({1:{days:[d]}},2026,profile),m=out.months[1],c=calcDay(d,[d],2026,1,profile);
 assert.equal(m.days[0].metrics.horaNonaHours.value,c.horaNona);
 assert.equal(m.days[0].metrics.ordinaryHours.value,c.ordinaryHours);
 assert.equal(m.days[0].metrics.nightPayableMinutes.value,c.nightPayableMinutes);
 assert.equal(m.totals.ordinaryHours.missing,30);
 assert.ok(!JSON.stringify(out).includes('PRIVATE'));
});
test('every contract exports its effective percentage, including ESTIU',()=>{
 for(const contract of ['85.81','85','78.91','78.14','75'])assert.equal(payrollFactsFor({},2026,{...DEFAULT_PROFILE,contract}).profile.percent,Number(contract));
 assert.equal(payrollFactsFor({},2026,{...DEFAULT_PROFILE,turn:'T4'}).profile.percent,100);
 for(const percentage of ['75','100'])assert.equal(payrollFactsFor({},2026,{...DEFAULT_PROFILE,turn:'ESTIU',summer:{2026:{percentage,assignments:[]}}}).profile.percent,Number(percentage));
});
test('unknown situations never export calculated zero and empty plans have no months',()=>{
 const out=payrollFactsFor({1:{days:[{...day,status:'REVISAR'}]}},2026,DEFAULT_PROFILE);
 assert.equal(out.months[1].days[0].metrics.ordinaryHours.value,null);
 assert.equal(Object.keys(payrollFactsFor({},2026,DEFAULT_PROFILE).months).length,0);
});
test('export prefix belongs to sync and annual reset invalidates it',()=>{
 const sync=readFileSync(new URL('../app/computo-sync.ts',import.meta.url),'utf8');
 assert.match(sync,/const PREFIXES = \["metro-payroll-facts-v1-"/);
 assert.match(source,/const keysToDelete = \[[\s\S]*?`metro-payroll-facts-v1-\$\{year\}`/);
});

test('calendar correction, personal schedule and contract regenerate resolved facts',()=>{
 const p={...DEFAULT_PROFILE}, plan={1:{days:[{...day}]}};
 const first=payrollFactsFor(plan,2026,p);
 const fixed={...day,special:'MODIFICACION',modificationPlacement:'PERSONALIZADO',customStart:'12:00',customEnd:'21:00'};
 const edited=payrollFactsFor({1:{days:[fixed]}},2026,p);
 assert.equal(edited.months[1].days[0].metrics.ordinaryHours.value,9);
 assert.equal(edited.months[1].days[0].metrics.horaNonaHours.value,1);
 assert.notEqual(JSON.stringify(first),JSON.stringify(edited));
 const rest=payrollFactsFor({1:{days:[{...day,status:'DCOM'}]}},2026,p);
 assert.equal(rest.months[1].days[0].metrics.ordinaryHours.value,0);
 assert.equal(payrollFactsFor(plan,2026,{...p,contract:'75'}).profile.percent,75);
 assert.match(source,/function persist\(next: YearPlan\)[\s\S]*?refreshPayrollExports\(\)/);
 assert.match(source,/localStorage.setItem\("metro-profile-v2", JSON.stringify\(next\)\);\s*refreshPayrollExports\(next\)/);
 assert.match(source,/\[profileLoaded, profile, plan, periods, year, officialRevision\]/);
});
test('unconfirmed schedules remain pending without hiding independent day counts',()=>{
 const out=payrollFactsFor({1:{days:[{...day,day:3}]}},2026,{...DEFAULT_PROFILE,turn:'T1'});
 const d=out.months[1].days[0];
 assert.equal(d.metrics.ordinaryHours.value,null);
 assert.equal(d.metrics.horaNonaHours.value,null);
 assert.equal(d.metrics.specialRetributiveDays.value,0);
});
