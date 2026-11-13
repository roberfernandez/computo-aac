import test from "node:test";import assert from "node:assert/strict";import vm from "node:vm";import {readFile} from "node:fs/promises";
let code;for(const url of [new URL("../../web/bridge-boot-v021.js",import.meta.url),new URL("../return-web/bridge-boot-v021.js",import.meta.url)]){try{code=await readFile(url,"utf8");break;}catch{}}
if(!code)throw Error("Missing bootstrap");
function context(){let listener;const c={location:{host:"tmb-sap-return-probe.onrender.com"},addEventListener:(_,fn)=>listener=fn};c.window=c;vm.runInNewContext(code,c);return {c,send:e=>listener(e)};}
test("retains Chrome's initial native port before the receiver module is ready",()=>{const {c,send}=context();const port={};send({origin:"android-app://tmb-sap-return-probe.onrender.com",ports:[port],data:""});assert.equal(c.__returnBootQueue.length,1);assert.equal(c.__returnBootQueue[0].ports[0],port);});
test("rejects a native port from a different host",()=>{const {c,send}=context();send({origin:"android-app://other.invalid",ports:[{}],data:""});assert.equal(c.__returnBootQueue.length,0);});
test("does not confuse an ordinary same-site web message with Chrome's native port",()=>{const {c,send}=context();send({origin:"https://tmb-sap-return-probe.onrender.com",ports:[{}],data:""});assert.equal(c.__returnBootQueue.length,0);});
