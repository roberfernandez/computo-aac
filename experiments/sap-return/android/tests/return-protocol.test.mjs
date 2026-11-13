import test from "node:test";import assert from "node:assert/strict";import {webcrypto}from"node:crypto";import {Receiver,sha256,validateDocument}from"../return-web/protocol.mjs";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const id="a".repeat(32);
const doc=()=>({schema:"tmb-probe-month-v1",period:"2026-10",extractedAt:"2026-11-13T12:00:00Z",rows:Array.from({length:127},(_,i)=>({Date:"/Date("+Date.UTC(2026,9,i%31+1)+")/",LongText:"Concepte de prova",Number:"1.00",Wagetype:"T001"}))});
async function begin(receiver,payload,extra={}){return receiver.accept({type:"begin",id,length:payload.length,count:127,period:"2026-10",sha256:await sha256(payload),...extra});}
test("receives all 127 records, validates the digest, and confirms only after storage",async()=>{
 const payload=JSON.stringify(doc());let stored=null,commit,notifyStore;const pending=new Promise(r=>commit=r);const storing=new Promise(r=>notifyStore=r);
 const r=new Receiver(id,async value=>{stored=value;notifyStore();await pending;});
 await begin(r,payload);
 let seq=0;for(let n=0;n<payload.length;n+=4000)assert.equal((await r.accept({type:"chunk",id,seq:seq++,data:payload.slice(n,n+4000)})).type,"ack");
 let completed=false;const finish=r.accept({type:"end",id}).then(x=>{completed=true;return x;});
 await storing;assert.equal(completed,false);assert.equal(stored.doc.rows.length,127);
 commit();const ack=await finish;assert.equal(ack.type,"complete");assert.equal(ack.count,127);assert.equal(ack.sha256,await sha256(payload));
});
test("rejects another operation and expired challenges",async()=>{
 const r=new Receiver(id,async()=>{});await assert.rejects(r.accept({type:"begin",id:"b".repeat(32)}),/wrong-operation/);
 let now=0;const expired=new Receiver(id,async()=>{},{now:()=>now});now=300001;await assert.rejects(expired.accept({type:"begin",id}),/expired/);
});
test("rejects oversized input and out-of-order fragments",async()=>{
 const payload=JSON.stringify(doc()),r=new Receiver(id,async()=>{});
 await assert.rejects(begin(r,payload,{length:7*1024*1024}),/invalid-begin/);
 await begin(r,payload);await assert.rejects(r.accept({type:"chunk",id,seq:1,data:"x"}),/invalid-chunk/);
});
test("refuses incomplete data and a modified digest before saving",async()=>{
 const payload=JSON.stringify(doc());let saves=0;const r=new Receiver(id,async()=>saves++);
 await begin(r,payload);await assert.rejects(r.accept({type:"end",id}),/incomplete/);
 await r.accept({type:"chunk",id,seq:0,data:payload.replace("Concepte","XXXXXXXX")});
 await assert.rejects(r.accept({type:"end",id}),/digest-mismatch/);assert.equal(saves,0);
});
test("checks period, record count and prohibited fields",()=>{
 const p=doc();p.rows[0].Date="/Date("+Date.UTC(2026,10,1)+")/";assert.throws(()=>validateDocument(p,127,"2026-10"),/wrong-period/);
 assert.throws(()=>validateDocument(doc(),126,"2026-10"),/invalid-count/);
 const extra=doc();extra.rows[0].Pernr="00000001";assert.throws(()=>validateDocument(extra,127,"2026-10"),/unexpected-field/);
});
test("does not confirm delivery when storage fails",async()=>{
 const payload=JSON.stringify(doc()),r=new Receiver(id,async()=>{throw Error("storage-failed");});
 await begin(r,payload);await r.accept({type:"chunk",id,seq:0,data:payload});
 await assert.rejects(r.accept({type:"end",id}),/storage-failed/);assert.notEqual(r.phase,"complete");
});
