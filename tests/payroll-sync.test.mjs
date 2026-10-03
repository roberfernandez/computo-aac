import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const key='metro-payroll-facts-v1-2026';
function setup(request){
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const context=vm.createContext({exports:{},localStorage:storage,navigator:{onLine:true},readSharedSession:()=>({access_token:'synthetic'}),authenticatedUserId:async()=> 'synthetic-user',SUPABASE_URL:'https://example.invalid',SUPABASE_PUBLIC_KEY:'synthetic',fetch:request});
 const source=readFileSync(new URL('../app/computo-sync.ts',import.meta.url),'utf8').replace(/^import .*?;\s*/,'');
 vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);
 return {values,api:context.exports};
}
test('payroll edits made during a pending write reach cloud in the right order',async()=>{
 let release,start;const started=new Promise(r=>start=r),bodies=[];
 const {values,api}=setup(async(url,options)=>{bodies.push(JSON.parse(options.body));if(bodies.length===1){start();await new Promise(r=>release=r);}return {ok:true};});
 values.set(key,JSON.stringify({revision:1}));const a=api.pushStorageKey(key);await started;
 values.set(key,JSON.stringify({revision:2}));const b=api.pushStorageKey(key);release();await Promise.all([a,b]);
 assert.deepEqual(bodies.map(b=>b.payload.revision),[1,2]);
});
test('failed payroll sync retains the export in the retry queue',async()=>{
 const {values,api}=setup(async()=>({ok:false,status:503}));values.set(key,'{}');
 await assert.rejects(api.pushStorageKey(key));
 assert.ok(JSON.parse(values.get('computo-sync-pending-v1')).includes(key));
});
test('annual deletion cannot be overwritten by an older in-flight export',async()=>{
 let release,start;const started=new Promise(r=>start=r),bodies=[];
 const {values,api}=setup(async(url,options)=>{bodies.push(JSON.parse(options.body));if(bodies.length===1){start();await new Promise(r=>release=r);}return {ok:true};});
 values.set(key,'{}');const a=api.pushStorageKey(key);await started;
 const b=api.deleteStorageKeys([key]);release();await Promise.all([a,b]);
 assert.equal(bodies.at(-1).payload.__deleted,true);assert.equal(values.has(key),false);
});
