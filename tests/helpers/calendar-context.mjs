import vm from 'node:vm';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
export const fixtures = JSON.parse(readFileSync(new URL('../fixtures/official-calendar.json', import.meta.url), 'utf8'));
export function calendarModule(request = async url => ({ok:true, json:async () => fixtures.filter(r => r.fecha.startsWith(new URL(url).searchParams.get('anio').slice(3)))})) {
  const context = vm.createContext({exports:{}, fetch:request, AbortController, setTimeout, clearTimeout, URL});
  const source = readFileSync(new URL('../../lib/official-calendar.ts',import.meta.url),'utf8');
  vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);
  return context.exports;
}
export async function calendarContext() {
  const module = calendarModule();
  await Promise.all([2024,2025,2026].map(y => module.officialCalendar.load(y)));
  return vm.createContext({...module});
}
