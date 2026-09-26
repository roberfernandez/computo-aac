import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {resolve, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {calendarContext} from './helpers/calendar-context.mjs';
import {canvasFor} from './helpers/annual-canvas.mjs';
const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',source.slice(0,source.indexOf('export default function Home')),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const c=await calendarContext();
vm.runInContext(ts.transpileModule(ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(ast)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c);
c.document={createElement:()=>canvasFor()};
const flatten=r=>Object.values(r.plan).flatMap(m=>m.days.map(d=>d.status));
async function recognize(image){c.createImageBitmap=async()=>({...image,close(){}});return c.classifyAnnual({},2026)}
// Personal reference images are supplied locally, never stored in the repo.
if(!process.env.AAC_ANNUAL_REFERENCE_DIR)throw new Error('Set AAC_ANNUAL_REFERENCE_DIR to the local reference image directory');
const folder=pathToFileURL(resolve(process.env.AAC_ANNUAL_REFERENCE_DIR)+sep);
const fixtures=JSON.parse(readFileSync(new URL('images.json',folder))).map(m=>({...m,data:gunzipSync(readFileSync(new URL(m.file,folder)))}));
let reference;
test('digital 4x3 keeps its 365 statuses and ten ambiguous blue dates',async()=>{
 const r=await recognize(fixtures[1]);reference=flatten(r);assert.equal(reference.length,365);assert.equal(r.uncertain,10);assert.equal(r.cycleDifferences,12);
 assert.deepEqual(Array.from(r.uncertainDaysByMonth),['Mar: 23, 24','Jun: 16, 19, 20, 21, 22, 23, 24','Jul: 20']);
});
test('old 6x2 remains a known safe rejection, not a fabricated year',async()=>{await assert.rejects(()=>recognize(fixtures[0]),/12 cuadrículas/)});
test('blank images and a full rectangular matrix cannot impersonate a calendar',()=>{
 const image={width:1280,height:800,data:new Uint8ClampedArray(1280*800*4).fill(255)};
 assert.equal(c.detectPhotographedAnnual(canvasFor(image),2026),null);
 for(let row=0;row<3;row++)for(let month=0;month<4;month++)for(let week=0;week<6;week++)for(let day=0;day<7;day++){
  const left=20+month*300+day*40,top=80+row*200+week*20;
  for(let y=top;y<top+16;y++)for(let x=left;x<left+36;x++)for(let k=0;k<3;k++)image.data[(y*1280+x)*4+k]=170;
 }
 assert.equal(c.detectPhotographedAnnual(canvasFor(image),2026),null);
});
test('detector and calculation helpers remain unchanged from v19 except approved orchestration and special-day counter',()=>{
 const base=execFileSync('git',['show','cc64617fccff43aaf9e4569ad28c3a98984c5f36:app/page.tsx'],{encoding:'utf8'});
 const previous=ts.createSourceFile('page.tsx',base.slice(0,base.indexOf('export default function Home')),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 for(const fn of previous.statements.filter(ts.isFunctionDeclaration))if(!['classifyAnnual','specialRetributiveDaysCount'].includes(fn.name.text)){
  const actual=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text===fn.name.text);assert.equal(actual.getText(ast),fn.getText(previous),fn.name.text);
 }
});
// Real camera files stay local: the optional manifest points to decoded RGBA
// fixtures, preventing personal portal images from entering the public repo.
const manifest=process.env.AAC_ANNUAL_FIXTURES;
const extra=manifest?JSON.parse(readFileSync(manifest,'utf8')):[];
for(const m of extra)test('real/local regression: '+m.name,async()=>{
 const image={...m,data:gunzipSync(readFileSync(m.file))};
 if(m.reject){await assert.rejects(()=>recognize(image),/12 cuadrículas/);return}
 const r=await recognize(image);assert.equal(flatten(r).length,365);assert.equal(r.uncertain,m.uncertain);assert.equal(r.cycleDifferences,m.cycle);
 if(m.sameAsReference)assert.deepEqual(flatten(r),reference);
});
test('external photo corpus supplied when requested',{skip:!manifest},()=>assert.ok(extra.length>0));
