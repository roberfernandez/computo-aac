import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

// Execute the actual calculation helpers without mounting the application.
const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const helpers = source.slice(0, source.indexOf("export default function Home"));
const parsed = ts.createSourceFile("page.tsx", helpers, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const body = parsed.statements.filter((node) => !ts.isImportDeclaration(node)).map((node) => node.getText(parsed)).join("\n");
const js = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
const context = vm.createContext({});
vm.runInContext(js + "\nglobalThis.api = { plusConvenioCount, needsReview, decimalHoursFromMinutes, calcDay, ANNUAL_WORKDAYS, ANNUAL_THEORETICAL_HOURS };", context);
const { plusConvenioCount, needsReview, decimalHoursFromMinutes, calcDay, ANNUAL_WORKDAYS, ANNUAL_THEORETICAL_HOURS } = context.api;

test("Plus Convenio matches the seven supplied monthly references", () => {
  for (const [month, total, fest, expected] of [
    ["2025-01", 31, 4, 27], ["2025-02", 28, 4, 24],
    ["2025-04", 30, 5, 25], ["2025-06", 30, 4, 26],
    ["2025-08", 31, 6, 25], ["2026-01", 31, 6, 25],
    ["2026-05", 31, 6, 25],
  ]) {
    const days = Array.from({ length: total }, (_, i) => ({ status: i < fest ? "FEST" : "AGCG" }));
    assert.equal(plusConvenioCount(days), expected, month);
  }
});

test("June includes DCOM, MINI and LAUDO; vacations also count", () => {
  const days = Object.entries({ AGCG: 7, DCOM: 5, MINI: 13, LAUDO: 1, FEST: 4 })
    .flatMap(([status, count]) => Array.from({ length: count }, () => ({ status })));
  assert.equal(plusConvenioCount(days), 26);
  assert.equal(plusConvenioCount([{ status: "VACACIONES" }, { status: "VAC_ANTERIOR" }]), 2);
  assert.equal(plusConvenioCount([{ status: "FEST" }, { status: "FEST" }]), 0);
  assert.equal(plusConvenioCount([]), 0);
});

test("Unresolved dates count provisionally and need review", () => {
  for (const status of ["REVISAR", "VACACIONES_PENDIENTES"]) {
    assert.equal(needsReview(status), true);
    assert.equal(plusConvenioCount([{ status }]), 1);
  }
  assert.equal(needsReview("AGCG"), false);
});

test("Annual contract hours and common working days cover 2020 through 2027", () => {
  assert.equal(ANNUAL_WORKDAYS[2020], 213);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2020]["85.81"], 1429.59);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2020]["85"], 1416.10);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2020]["78.91"], 1314.64);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2020]["78.14"], 1301.81);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2020]["75"], 1249.50);
  assert.equal(ANNUAL_WORKDAYS[2021], 213);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2021]["85.81"], 1429.59);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2021]["85"], 1416.10);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2021]["78.91"], 1314.64);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2021]["78.14"], 1301.81);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2021]["75"], 1249.50);
  assert.equal(ANNUAL_WORKDAYS[2022], 212);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2022]["85.81"], 1422.73);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2022]["85"], 1409.30);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2022]["78.91"], 1308.33);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2022]["78.14"], 1295.56);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2022]["75"], 1243.50);
  assert.equal(ANNUAL_WORKDAYS[2023], 212);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2023]["85.81"], 1422.73);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2023]["85"], 1409.30);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2023]["78.91"], 1308.33);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2023]["78.14"], 1295.56);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2023]["75"], 1243.50);
  assert.equal(ANNUAL_WORKDAYS[2024], 211);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2024]["85.81"], 1415.87);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2024]["85"], 1402.50);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2024]["78.91"], 1302.02);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2024]["78.14"], 1289.31);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2024]["75"], 1237.50);
  assert.equal(ANNUAL_WORKDAYS[2025], 210);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2025]["85.81"], 1409.00);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2025]["85"], 1395.70);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2025]["78.91"], 1295.70);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2025]["78.14"], 1283.06);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2025]["75"], 1231.50);
  assert.equal(ANNUAL_WORKDAYS[2026], 209);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2026]["85.81"], 1402.14);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2026]["85"], 1388.90);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2026]["78.91"], 1289.39);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2026]["78.14"], 1276.81);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2026]["75"], 1225.50);
  assert.equal(ANNUAL_WORKDAYS[2027], 207);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2027]["85.81"], 1388.41);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2027]["85"], 1375.30);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2027]["78.91"], 1276.76);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2027]["78.14"], 1264.31);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2027]["75"], 1213.50);
  assert.equal(ANNUAL_THEORETICAL_HOURS[2028], undefined);
});

test("Preserve daily ordinary hours rounding and Hora Nona for all contracts", () => {
  for (const contract of ["85.81", "85", "78.91", "78.14", "75"]) {
    for (const [end, minutes, ordinary, nona] of [["14:04", 364, 6.07, 0], ["16:04", 484, 8.07, 0.25], ["16:30", 510, 8.5, 0.5]]) {
      const day = { day: 12, status: "AGCG", special: "MODIFICACION", modificationPlacement: "PERSONALIZADO", customStart: "08:00", customEnd: end };
      const result = calcDay(day, [day], 2026, 1, { contract, fiestaLetter: "M" });
      assert.equal(decimalHoursFromMinutes(minutes), ordinary);
      assert.equal(result.ordinaryHours, ordinary, contract);
      assert.equal(result.horaNona, nona, contract);
    }
  }
});
