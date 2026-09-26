import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const before=source.indexOf('export default function Home');
const selected=ast.statements.filter(n=>!ts.isImportDeclaration(n)&&(n.end<before||(ts.isFunctionDeclaration(n)&&['AnnualView','AnnualStat'].includes(n.name.text))));
const stub=({children})=>React.createElement('span',null,children);
const c=vm.createContext({React,Badge:stub,Checkbox:stub,CheckCircle2:stub,PencilLine:stub,Moon:stub,CalendarDays:stub});
vm.runInContext(ts.transpileModule(selected.map(n=>n.getText(ast)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText,c);
test('recognition, calculation and storage helpers remain byte-for-byte unchanged',()=>{
 const old=execFileSync('git',['show','babce34cc41512c5b33cdac58a8531f3e4843d8b:app/page.tsx'],{encoding:'utf8',cwd:new URL('../',import.meta.url)});
 const a=ts.createSourceFile('page.tsx',old,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 for(const n of a.statements.filter(n=>n.end<old.indexOf('export default function Home')&&ts.isFunctionDeclaration(n)&&n.name.text!=='specialRetributiveDaysCount')){
  assert.equal(ast.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name.text===n.name.text).getText(ast),n.getText(a),n.name.text);
 }
});
test('existing colour families are distinct; ambiguous states stay neutral',()=>{
 const expected={AGCG:'grey',DCOM:'turquoise',FEST:'salmon',LAUDO:'orange',VACACIONES:'brown',VACACIONES_PENDIENTES:'brown',FORMACION:'pink',ENFERMEDAD:'green',REVISION_MEDICA:'sage',RJ:'blue',REVISAR:'neutral',MINI:'neutral',PERMISO:'neutral',HUELGA_LEGAL:'neutral',COMPUTO_ANTERIOR:'neutral',COMPUTO_ACTUAL:'neutral',VISPERA_FESTIVO:'neutral'};
 for(const [status,tone] of Object.entries(expected))assert.equal(c.dayColourClass({status}),'tmb-'+tone);
 assert.equal(c.dayColourClass({status:'VAC_ANTERIOR',priorOrigin:'RJ'}),'tmb-blue');
 assert.equal(c.dayColourClass({status:'VAC_ANTERIOR',priorOrigin:'VACACIONES'}),'tmb-brown');
 assert.equal(c.dayColourClass({status:'VAC_ANTERIOR',priorOrigin:'COMPUTO'}),'tmb-neutral');
});
test('numeric zero is hidden, negative and tiny nonzero values remain visible',()=>{
 for(const n of [0,-0,NaN,Infinity,undefined])assert.equal(c.showMonthlyConcept(n),false);
 for(const n of [1,-1,0.001])assert.equal(c.showMonthlyConcept(n),true);
});
test('rendered month cards retain balance, omit Plus Festiu, use existing special-day count',()=>{
 const props={year:2026,profile:{turn:'T8',contract:'85.81',fiestaLetter:'M'},plan:{},monthTotals:{},monthNightHours:{},monthPlusFestiu:{},annualOrdinaryHours:0,annualNightHours:0,annualPlusFestiu:0,onOpen(){},onConfirm(){}};
 for(let m=1;m<=12;m++){props.plan[m]={confirmed:false,days:Array.from({length:c.daysInMonth(2026,m)},(_,i)=>({day:i+1,status:"AGCG"}))};props.monthTotals[m]=0;props.monthNightHours[m]=m===2?1.5:0;props.monthPlusFestiu[m]=4;}
 const html=renderToStaticMarkup(React.createElement(c.AnnualView,props));
 const cards=[...html.matchAll(/<article.*?<\/article>/g)].map(m=>m[0]);assert.equal(cards.length,12);
 cards.forEach((card,i)=>{assert.match(card,/<strong>/);assert.equal(card.includes('Nocturnidad variable'),i===1);assert.equal(card.includes('Días especiales:'),[0,5,8,11].includes(i));assert.equal(card.includes('Plus Festiu'),false);});
 assert.equal(c.specialRetributiveDaysCount(props.plan[1].days,2026,1),2);assert.equal(c.specialRetributiveDaysCount(props.plan[2].days,2026,2),0);
});
test('all coloured backgrounds provide at least 4.5:1 white text contrast',()=>{
 const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
 for(const [,tone,hex] of css.matchAll(/\.day\.tmb-([a-z]+)\{--day-fill:#([0-9a-f]{6})\}/g)){
  const rgb=hex.match(/../g).map(h=>parseInt(h,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  assert.ok(1.05/(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722+.05)>=4.5,tone);
 }
});


test('special days count final worked states only: zero, one and two in January',()=>{
 for(const [statuses,expected] of [[['DCOM','VACACIONES'],0],[['AGCG','RJ'],1],[['AGCG','AGCG'],2]]){
  const days=statuses.map((status,i)=>({day:i===0?1:6,status,baseStatus:'AGCG'}));
  assert.equal(c.specialRetributiveDaysCount(days,2026,1),expected);
  const props={year:2026,profile:{turn:'T8',contract:'85.81'},plan:{1:{days,confirmed:false}},monthTotals:{1:0},monthNightHours:{1:0},annualOrdinaryHours:0,annualNightHours:0,annualPlusFestiu:99,onOpen(){},onConfirm(){}};
  const card=renderToStaticMarkup(React.createElement(c.AnnualView,props)).match(/<article.*?<\/article>/)[0];
  assert.equal(card.includes('Días especiales:'),expected>0);
  if(expected)assert.match(card,new RegExp('<b>'+expected+'</b>'));
 }
 assert.equal(c.specialRetributiveDaysCount([],2026,1),0);
});
test('all existing worked/absence states and personal modifications use final status',()=>{
 const excluded=['REVISAR','DCOM','FEST','VACACIONES','VACACIONES_PENDIENTES','VAC_ANTERIOR','MINI','LAUDO','RJ','ENFERMEDAD','PERMISO','HUELGA_LEGAL'];
 const included=['AGCG','FORMACION','REVISION_MEDICA','VISPERA_FESTIVO','COMPUTO_ANTERIOR','COMPUTO_ACTUAL'];
 for(const status of [...excluded,...included]){
  const day={day:24,status,baseStatus:'AGCG',special:'MODIFICACION',extraHours:1};
  assert.equal(c.specialRetributiveDaysCount([day],2026,9),included.includes(status)?1:0,status);
 }
 assert.equal(c.specialRetributiveDaysCount([{day:24,status:'AGCG',baseStatus:'DCOM'}],2026,9),1);
 assert.equal(c.specialRetributiveDaysCount([{day:23,status:'AGCG'},{day:25,status:'AGCG'}],2026,9),0);
});
test('monthly detail and annual cards both call the worked-day counter and hide zero',()=>{
 assert.match(source,/currentMonthSpecialRetributiveDays = specialRetributiveDaysCount\(\s*days,\s*year,\s*month/);
 assert.match(source,/monthSpecialRetributiveDays > 0 &&/);
 assert.match(source,/specialRetributiveDaysCount\(p.days, year, m\) > 0/);
});
