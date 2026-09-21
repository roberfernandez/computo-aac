import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {calendarContext} from './helpers/calendar-context.mjs';
const folder=new URL('./fixtures/personal-colours/',import.meta.url);
const samples=JSON.parse(readFileSync(new URL('samples.json',folder)));
const images=JSON.parse(readFileSync(new URL('images.json',folder))).map(m=>({...m,data:gunzipSync(readFileSync(new URL(m.file,folder)))}));
const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('page.tsx',source.slice(0,source.indexOf('export default function Home')),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const c=await calendarContext();
vm.runInContext(ts.transpileModule(ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(ast)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c);
// Original decoded JPEG pixels. No image library or remote service is required.
function canvasFor(image) {return {width:image.width,height:image.height,getContext:()=>({
 drawImage(bitmap){assert.equal(bitmap.width,image.width);},
 getImageData(x,y,w,h){x=Math.trunc(x);y=Math.trunc(y);w=Math.trunc(w);h=Math.trunc(h);const data=new Uint8ClampedArray(w*h*4);
  for(let row=0;row<h;row++)for(let col=0;col<w;col++)for(let k=0;k<4;k++)data[(row*w+col)*4+k]=image.data[((y+row)*image.width+x+col)*4+k]||0;
  return {data};}
 })};}
async function recognize(image) {c.createImageBitmap=async()=>({...image,close(){}});c.document={createElement:()=>canvasFor(image)};return c.classifyAnnual({},2026);}
const recognized=[];
for(const image of images) recognized.push(await recognize(image));
test('real JPEG samples: all eight colours present in both captures',()=>{
 for(const s of samples) assert.equal(c.annualBlockEvidence(new Uint8ClampedArray(s.pixels)).status,s.expected,`${s.image} ${s.month}/${s.day}`);
});
test('neutral greys cannot be training; saturated green retains existing illness mapping',()=>{
 for(const [rgb,status] of [[[192,192,192],'AGCG'],[[200,200,200],'AGCG'],[[80,190,80],'ENFERMEDAD']]) {
 const pixels=new Uint8ClampedArray(Array.from({length:100},()=>[...rgb,255]).flat());
 assert.equal(c.annualBlockEvidence(pixels).status,status);assert.equal(c.dominantStatus(pixels),status);
 }
});
test('automatic layout recognition separates six-by-two from four-by-three',()=>{
 assert.equal(c.detectModernAnnualPanels(canvasFor(images[0]),2026),null);
 assert.equal(c.detectStraightAnnualPanels(canvasFor(images[0]),2026).length,12);
 assert.equal(c.detectModernAnnualPanels(canvasFor(images[1]),2026).length,12);
 assert.equal(c.detectStraightAnnualPanels(canvasFor(images[1]),2026),null);
});
test('365 matching personal statuses despite changed layout and holiday digit colours',()=>{
 const flatten=r=>Object.values(r.plan).flatMap(m=>m.days.map(d=>d.status));
 assert.equal(flatten(recognized[0]).length,365);assert.deepEqual(flatten(recognized[0]),flatten(recognized[1]));
 const counts={};for(const status of flatten(recognized[1]))counts[status]=(counts[status]||0)+1;
 assert.deepEqual(counts,{AGCG:202,DCOM:66,FEST:58,REVISION_MEDICA:1,VACACIONES_PENDIENTES:24,REVISAR:10,FORMACION:3,LAUDO:1});
 for(const r of recognized){assert.equal(r.plan[1].days[2].status,'DCOM');assert.equal(r.plan[1].days[3].status,'FEST');assert.equal(r.mismatches,22);}
});
test('central black or red numbers do not affect interior side-strip evidence',()=>{
 const image=images[1],panels=c.detectModernAnnualPanels(canvasFor(image),2026);
 for(const [month,day] of [[1,1],[1,3],[1,4],[2,19],[3,16],[3,23],[5,6],[6,15]]){
  const panel=panels[month-1],index=c.weekdayMon(2026,month,1)+day-1,w=panel.length/7,h=panel.cellH;
  const x=panel.x+w*(index%7+.5),y=panel.gridTop+h*(Math.floor(index/7)+.5);
  const expected=c.annualCellEvidence(canvasFor(image).getContext(),x,y,w,h,image).status;
  for(const rgb of [[0,0,0],[255,0,0]]){const data=Buffer.from(image.data);
   for(let yy=Math.ceil(y-h*.2);yy<y+h*.2;yy++)for(let xx=Math.ceil(x-w*.15);xx<x+w*.15;xx++)for(let k=0;k<3;k++)data[(yy*image.width+xx)*4+k]=rgb[k];
   assert.equal(c.annualCellEvidence(canvasFor({...image,data}).getContext(),x,y,w,h,image).status,expected);
  }
 }
});
test('known monthly balances stay transparent: March and July remain unresolved historical differences',()=>{
 const expected=[3.34,-1.30,-1.30,1.42,1.34,-1.89,-.58];
 for(const r of recognized)for(let m=1;m<=7;m++)assert.equal(c.totalFor(r.plan[m].days,2026,m,{turn:'T8',contract:'85.81',fiestaLetter:'M'}),expected[m-1]);
});
test('all pre-existing nonvisual helper functions remain byte-identical to integrated main',()=>{
 const base=execFileSync('git',['show','cd8d1b045e5e69ad3886d8af299c7d1dbf85a4a2:app/page.tsx'],{encoding:'utf8'});
 const before=ts.createSourceFile('page.tsx',base.slice(0,base.indexOf('export default function Home')),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const changed=new Set(['dominantStatus','annualBlockEvidence','annualCellEvidence','detectStraightAnnualPanels','classifyAnnual']);
 for(const fn of before.statements.filter(ts.isFunctionDeclaration))if(!changed.has(fn.name.text)){
  const actual=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text===fn.name.text);
  assert.equal(actual.getText(ast),fn.getText(before),fn.name.text);
 }
});
