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
    "\nglobalThis.api = { periodUnderlyingWorkday };",
  context,
);

test("Los periodos se aplican por el ciclo laboral, no por el color detectado", () => {
  assert.equal(context.api.periodUnderlyingWorkday("AGCG"), true);
  assert.equal(context.api.periodUnderlyingWorkday("DCOM"), false);
  assert.equal(context.api.periodUnderlyingWorkday("FEST"), false);
  assert.match(
    source,
    /underlyingWorkday\s*=\s*periodUnderlyingWorkday\(cycleBase\)/,
  );
});
