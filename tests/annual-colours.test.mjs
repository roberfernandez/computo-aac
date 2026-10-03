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
  ts.transpileModule(body, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText +
    "\nglobalThis.api = { annualFeatureEvidence, annualBlockEvidence };",
  context,
);

const feature = (red, green, blue) => {
  const sum = Math.max(1, red + green + blue);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  return {
    red: red / sum,
    green: green / sum,
    blue: blue / sum,
    saturation: (max - min) / 255,
    luma: (red * 0.299 + green * 0.587 + blue * 0.114) / 255,
    rawRed: red,
    rawGreen: green,
    rawBlue: blue,
  };
};

const pixels = (red, green, blue, count = 64) => {
  const data = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    data[i * 4] = red;
    data[i * 4 + 1] = green;
    data[i * 4 + 2] = blue;
    data[i * 4 + 3] = 255;
  }
  return data;
};

test("v36 reconoce marrón de vacaciones aunque la foto esté aclarada", () => {
  for (const rgb of [
    [145, 112, 55],
    [160, 120, 65],
    [175, 136, 70],
  ]) {
    assert.equal(
      context.api.annualFeatureEvidence(feature(...rgb))?.status,
      "VACACIONES_PENDIENTES",
      `RGB ${rgb.join(",")} debe ser vacaciones`,
    );
  }
});

test("v36 mantiene separado el FEST salmón", () => {
  for (const rgb of [
    [150, 100, 80],
    [190, 120, 95],
    [121, 71, 57],
  ]) {
    assert.equal(
      context.api.annualFeatureEvidence(feature(...rgb))?.status,
      "FEST",
      `RGB ${rgb.join(",")} debe ser FEST`,
    );
  }
});

test("v36 conserva Laudo como familia naranja independiente", () => {
  assert.equal(
    context.api.annualFeatureEvidence(feature(210, 135, 45))?.status,
    "LAUDO",
  );
});

test("la lectura por bloques usa la misma separación de hue", () => {
  assert.equal(
    context.api.annualBlockEvidence(pixels(175, 136, 70)).status,
    "VACACIONES_PENDIENTES",
  );
  assert.equal(
    context.api.annualBlockEvidence(pixels(190, 120, 95)).status,
    "FEST",
  );
  assert.equal(
    context.api.annualBlockEvidence(pixels(210, 135, 45)).status,
    "LAUDO",
  );
});
