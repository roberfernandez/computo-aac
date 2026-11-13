import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const panel=readFileSync("app/sap-review-panel.tsx","utf8");
test("Windows direct install is exposed only when the bridge is absent",()=>{
 assert.match(panel,/bridgePlatform==="desktop"&&!desktopBridge&&/);
 assert.match(panel,/NEXT_PUBLIC_SAP_BRIDGE_CHROME_WEBSTORE_ID/);
 assert.match(panel,/chromewebstore\.google\.com\/detail/);
 assert.match(panel,/Instal·lar Pont SAP a Chrome/);
 assert.match(panel,/onClick=\{\(\)=>window\.location\.reload\(\)\}/);
 assert.match(panel,/SAP_BRIDGE_WINDOWS_EXE/);
 assert.match(panel,/sap-windows-installer-v0\.1\.1\/PontSAP-Windows-Instalador-Prueba-v0\.1\.1\.exe/);
 assert.match(panel,/Descarregar instal·lador Pont SAP · Windows/);
 assert.match(panel,/Carrega sense empaquetar/);
 assert.doesNotMatch(panel,/SAP_BRIDGE_WINDOWS_ZIP|Descomprimeix el ZIP/);
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
test("Chrome Web Store upload has manifest at the archive root, not a public user ZIP",()=>{
 const workflow=readFileSync(".github/workflows/publish-sap-windows-pilot.yml","utf8");
 assert.match(workflow,/zip -q.*manifest\.json/);
 assert.match(workflow,/actions\/upload-artifact@v4/);
 assert.match(workflow,/GOOS=windows GOARCH=amd64/);
 assert.match(workflow,/gh release upload/);
 assert.match(workflow,/sap-windows-installer-v/);
 assert.match(workflow,/contents: write/);
 assert.doesNotMatch(workflow,/gh release upload.*zip/i);
 const pages=readFileSync(".github/workflows/pages.yml","utf8");
 assert.match(pages,/vars\.SAP_BRIDGE_CHROME_WEBSTORE_ID/);
});
