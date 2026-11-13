import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {sapCloudKey, minimalSapDoc, minimalSapRecord, readSapCloudPayload, decideSapCloudSync, sapCloudByteSize, MAX_SAP_CLOUD_BYTES} from "../lib/sap-cloud-sync.js";

function record(extraido="2026-11-13T10:00:00.000Z", ano=2026) {
  const valoraciones={};
  for(let m=1;m<=12;m++){
    const period=ano+"-"+String(m).padStart(2,"0");
    valoraciones[period]=[];
  }
  valoraciones[ano+"-10"].push({Date:"2026-10-01",LongText:"Plus Convenio",Number:"1.00",Wagetype:"8716",EmployeeNumber:"PRIVATE"});
  return {key:"user-private:"+ano,doc:{ano,extraido,valoraciones,origen:"DO NOT UPLOAD",employeeId:"PRIVATE",anuales:{calendario:["PRIVATE"]}},history:[{extraido,cambios:0,employeeId:"PRIVATE"}],access_token:"PRIVATE"};
}

test("cloud annual snapshot contains strictly valuation allowlisted fields",()=>{
  const input=record(),payload=minimalSapRecord(input,2026);
  assert.equal(sapCloudKey(2026),"metro-sap-valoracions-v1-2026");
  assert.equal(payload.version,1);
  assert.equal(Object.keys(payload.doc.valoraciones).length,12);
  assert.equal(payload.doc.valoraciones["2026-10"].length,1);
  assert.equal(payload.doc.valoraciones["2026-10"][0].Number,"1.00");
  const json=JSON.stringify(payload);
  assert.ok(!json.includes("PRIVATE"));
  assert.ok(!json.includes("calendario"));
  assert.ok(!json.includes("access_token"));
  assert.ok(!json.includes("employeeId"));
  assert.ok(!json.includes("anuales"));
  assert.ok(sapCloudByteSize(payload)<MAX_SAP_CLOUD_BYTES);
  assert.deepEqual(readSapCloudPayload(payload,2026),payload);
});

test("cloud data must match its year and contain all twelve months",()=>{
  const item=record();
  assert.throws(()=>minimalSapRecord(item,2027),/vàlid/);
  delete item.doc.valoraciones["2026-08"];
  assert.throws(()=>minimalSapRecord(item,2026),/dotze mesos/);
});

test("malformed SAP date and blank values never enter private cloud",()=>{
  const badDate=record();
  badDate.doc.valoraciones["2026-10"][0].Date="2026-09-01";
  assert.throws(()=>minimalSapRecord(badDate,2026),/fila no vàlida/);
  const badValue=record();
  badValue.doc.valoraciones["2026-10"][0].Number="";
  assert.throws(()=>minimalSapRecord(badValue,2026),/fila no vàlida/);
  const future=record("2099-11-13T10:00:00.000Z");
  assert.throws(()=>minimalSapRecord(future,2026),/vàlid/);
});

test("newer extraction is always preferred; equal-date conflicts require intervention",()=>{
  const old=minimalSapRecord(record("2026-11-12T10:00:00.000Z"),2026);
  const latest=minimalSapRecord(record("2026-11-13T10:00:00.000Z"),2026);
  assert.equal(decideSapCloudSync(null,null),"empty");
  assert.equal(decideSapCloudSync(null,latest),"download");
  assert.equal(decideSapCloudSync({doc:latest.doc},null),"upload");
  assert.equal(decideSapCloudSync({doc:latest.doc},old),"upload");
  assert.equal(decideSapCloudSync({doc:old.doc},latest),"download");
  assert.equal(decideSapCloudSync({doc:latest.doc},latest),"same");
  const changed=structuredClone(latest);
  changed.doc.valoraciones["2026-10"][0].Number="2.00";
  assert.equal(decideSapCloudSync({doc:latest.doc},changed),"conflict");
  assert.equal(decideSapCloudSync({doc:changed.doc},latest),"conflict");
});

test("cloud snapshot rejects unknown formats without erasing previous copies",()=>{
  assert.throws(()=>readSapCloudPayload({version:2,doc:record().doc},2026),/desconegut/);
  assert.throws(()=>readSapCloudPayload({},2026),/desconegut/);
});

test("web panel reconciles cloud and local copies after Android return or Windows login",()=>{
  const panel=readFileSync("app/sap-review-panel.tsx","utf8");
  assert.match(panel,/synchronizePrivateSap\(uid,year\)/);
  assert.match(panel,/window\.addEventListener\("pageshow",focus\)/);
  assert.match(panel,/window\.addEventListener\("online",focus\)/);
  assert.match(panel,/await getSaved\(uid,year\)/);
  assert.match(panel,/setSaved\(latest\)/);
  assert.match(panel,/setSapSyncState\(latest\?"synced":"empty"\)/);
  assert.match(panel,/cloud-backup:/);
  assert.match(panel,/readSapCloudPayload/);
  assert.match(panel,/verifiedOwner\(\)/);
  assert.match(panel,/computo_sync\?on_conflict=user_id,storage_key/);
  assert.doesNotMatch(panel,/localStorage\.clear\(/);
});
