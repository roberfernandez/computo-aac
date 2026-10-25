import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";
import { calendarContext } from "./helpers/calendar-context.mjs";

const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const parsed = ts.createSourceFile(
  "page.tsx",
  source.slice(0, source.indexOf("export default function Home")),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const body = parsed.statements
  .filter((node) => !ts.isImportDeclaration(node))
  .map((node) => node.getText(parsed))
  .join("\n");
const context = await calendarContext();
vm.runInContext(
  ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText +
    "\nglobalThis.api = { calcDay, isWorking, normalizeDays, previousYearCreditMinutes };",
  context,
);
const api = context.api;
const profile = { turn: "T8", contract: "85.81", fiestaLetter: "M" };
const day = (day, status = "AGCG") => ({
  day,
  baseStatus: "AGCG",
  status,
  special: "NINGUNA",
  extraHours: 0,
  officialHoliday: false,
  note: "",
});
const calc = (dayOfMonth, status) => {
  const d = day(dayOfMonth, status);
  return api.calcDay(d, [d], 2026, 7, profile);
};

test("Cómputo positivo actual: fiesta y descuento de la jornada concreta, sin trabajo ni pluses", () => {
  // Jueves 23/7: 6:04; viernes 24/7: 8:04; sábado 25/7: 8:30 (T8 85,81 %).
  for (const [date, minutes] of [[23, 364], [24, 484], [25, 510]]) {
    const ordinary = calc(date, "AGCG");
    assert.equal(ordinary.workedMinutes, minutes);
    const result = calc(date, "COMPUTO_POSITIVO_ACTUAL");
    assert.equal(result.value, -Number((minutes / 60).toFixed(2)));
    assert.equal(result.workedMinutes, 0);
    assert.equal(result.ordinaryHours, 0);
    assert.equal(result.nightMinutes, 0);
    assert.equal(result.nightHours, 0);
    assert.equal(result.horaNona, 0);
    assert.equal(result.creditedMinutes, 0);
    assert.equal(api.isWorking("COMPUTO_POSITIVO_ACTUAL"), false);
    assert.match(result.reason, new RegExp(`\\b${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")} h\\b`));
  }
  // Balance decimal de la app: 14,00 − 6,07 = 7,93 h (equivalente aprox. a 7:56).
  assert.equal(Number((14 + calc(23, "COMPUTO_POSITIVO_ACTUAL").value).toFixed(2)), 7.93);
});

test("Cómputo positivo anterior: consume horas del anterior, no las imputa al año del descanso", () => {
  const r = calc(23, "COMPUTO_POSITIVO_ANTERIOR");
  assert.equal(r.value, 0);
  assert.equal(r.creditedMinutes, -364);
  assert.equal(r.workedMinutes, 0);
  assert.equal(r.nightMinutes, 0);
  const plan = { 7: { days: [day(23, "COMPUTO_POSITIVO_ANTERIOR")] } };
  assert.equal(api.previousYearCreditMinutes(plan, 2026, profile), -364);
});

test("Cómputo negativo sigue reconociendo jornada completa en el año seleccionado", () => {
  const current = calc(23, "COMPUTO_ACTUAL");
  assert.equal(current.value, 6.07);
  assert.equal(current.workedMinutes, 364);
  const previous = calc(23, "COMPUTO_ANTERIOR");
  assert.equal(previous.value, 0);
  assert.equal(previous.creditedMinutes, 364);
  assert.equal(api.previousYearCreditMinutes(
    { 7: { days: [day(23, "COMPUTO_ANTERIOR")] } },
    2026, profile,
  ), 364);
});

test("Los descansos positivos históricos se migran sin borrar calendarios", () => {
  const legacy = {
    ...day(23, "VAC_ANTERIOR"),
    priorOrigin: "COMPUTO",
    detectedColour: "BLUE",
    note: "Cómputo positivo año anterior",
  };
  const [normalized] = api.normalizeDays([legacy], 2026, 7);
  assert.equal(normalized.status, "COMPUTO_POSITIVO_ANTERIOR");
  assert.equal(normalized.priorOrigin, undefined);
  assert.equal(normalized.detectedColour, "BLUE");
  assert.equal(calc(23, normalized.status).creditedMinutes, -364);
});
