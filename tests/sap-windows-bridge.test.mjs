import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validateDocument} from "../experiments/sap-windows-extension/protocol.mjs";

const base="experiments/sap-windows-extension/";
const read=name=>readFileSync(base+name,"utf8");
test("Windows extension is a narrow-scoped MV3 extension",()=>{
  const m=JSON.parse(read("manifest.json"));
  assert.equal(m.manifest_version,3);
  assert.deepEqual(m.permissions,["scripting","tabs","storage"]);
  assert.equal(m.background.type,"module");
  assert.ok(m.host_permissions.every(value=>value.startsWith("https://")));
  assert.equal(m.content_scripts.length,2);
  assert.equal(m.externally_connectable,undefined);
  assert.ok(!m.permissions.includes("cookies")&&!m.permissions.includes("webRequest"));
});
test("Windows and Android reuse the identical SAP extractor and validation protocol",()=>{
  assert.equal(read("probe.js"),readFileSync("experiments/sap-admin/android/assets/probe.js","utf8"));
  assert.equal(read("protocol.mjs"),readFileSync("public/sap-return/protocol.mjs","utf8"));
});
test("extension does not hardcode personal employee IDs or private credentials",()=>{
  for(const file of ["manifest.json","background.mjs","computo-bridge.js","portal-monitor.js"]){
    const source=read(file);
    assert.doesNotMatch(source,/service_role|JSESSIONID|password\s*:/i);
    assert.doesNotMatch(source,/\bPernr\s*[:=]\s*["']\d{8}["']/);
  }
  assert.match(read("background.mjs"),/verifyTicket\(ticket\)/);
  assert.match(read("background.mjs"),/verifyBrowserIdentity/);
  assert.match(read("background.mjs"),/transaction\(\["pending","exports"\],"readwrite"\)/);
});
test("annual document schema accepts only legitimate units without employee identifier",()=>{
  const date=x=>"/Date("+Date.UTC(2026,0,x)+")/";
  const doc={schema:"tmb-computo-bridge-v1",period:"2026",extractedAt:"2026-11-13T18:00:00Z",
    rows:[{Date:date(1),LongText:"Nocturnidad Variable",Number:"1.00",Wagetype:"8754"}],
    calendar:Array.from({length:365},(_,i)=>({Date:date(i+1)})),
    completedPeriods:Array.from({length:12},(_,i)=>"2026-"+String(i+1).padStart(2,"0"))};
  assert.equal(validateDocument(doc,1,"2026").rows.length,1);
  assert.throws(()=>validateDocument({...doc,rows:[{...doc.rows[0],Pernr:"00000001"}]},1,"2026"),/unexpected-field/);
});
