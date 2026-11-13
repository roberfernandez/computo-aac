import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const panel=readFileSync("app/sap-review-panel.tsx","utf8");
test("Windows setup is directly offered only when Chrome bridge is undetected",()=>{
 assert.match(panel,/bridgePlatform==="desktop"&&!desktopBridge&&/);
 assert.match(panel,/sap-windows-pilot-v0\.1\.0\/computo-pont-sap-chrome-v0\.1\.0\.zip/);
 assert.match(panel,/Carrega sense empaquetar/);
 assert.match(panel,/onClick=\{\(\)=>window\.location\.reload\(\)\}/);
});
test("Android installer is offered in-app and appears on Chrome intent fallback",()=>{
 assert.match(panel,/Descarregar pont TMB · Android 0\.3\.2/);
 assert.match(panel,/sap-bridge-0\.3\.2\/computo-pont-tmb-v0\.3\.2\.apk/);
 assert.match(panel,/S\.browser_fallback_url=/);
 assert.match(panel,/pont=instala-android/);
 assert.match(panel,/setAndroidGuide\(true\)/);
});
test("installer guides never replace local SAP comparison or erase accepted reviews",()=>{
 assert.match(panel,/loadPrivateReviews\(uid,year\)/);
 assert.match(panel,/storePending\(result\.grant\)/);
 assert.match(panel,/compareSapToComputo\(/);
 assert.match(panel,/recordReview\(r,true\)/);
 assert.doesNotMatch(panel,/localStorage\.clear\(/);
});
test("stable Windows release is generated from the exact Chrome extension folder",()=>{
 const workflow=readFileSync(".github/workflows/publish-sap-windows-pilot.yml","utf8");
 assert.match(workflow,/zip -q -r.*sap-windows-extension/);
 assert.match(workflow,/gh release upload/);
 assert.match(workflow,/contents: write/);
});
