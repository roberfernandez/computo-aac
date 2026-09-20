import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('page.tsx', source.slice(0, source.indexOf('export default function Home')), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const body = parsed.statements.filter(n => !ts.isImportDeclaration(n)).map(n => n.getText(parsed)).join('\n');
const context = vm.createContext({});
vm.runInContext(ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + '\nglobalThis.api = {profileTurn, profileLabel, theoreticalHours, shiftFor, calcDay, balanceLabel, nightLabel};', context);
const api = context.api;
const profile = turn => ({ turn, contract: '85.81', fiestaLetter: 'M' });
const day = (n, special = 'NINGUNA') => ({ day: n, status: 'AGCG', baseStatus: 'AGCG', special, extraHours: 0, officialHoliday: false });

test('Legacy T8 profiles and all annual full-time bases remain available', () => {
  const legacy = { contract: '75', subturn: 'T8.4', fiestaLetter: 'L' };
  assert.equal(api.profileTurn(legacy), 'T8');
  assert.equal(api.profileTurn({ ...legacy, turn: 'T5-inverso' }), 'T8');
  assert.equal(api.theoreticalHours(2026, legacy), 1225.5);
  for (const turn of ['T1', 'T2', 'T4', 'T5']) {
    for (const [year, hours] of [[2020,1666],[2021,1666],[2022,1658],[2023,1658],[2024,1650],[2025,1642],[2026,1634],[2027,1618]]) {
      assert.equal(api.theoreticalHours(year, profile(turn)), hours);
    }
    assert.equal(api.theoreticalHours(2028, profile(turn)), undefined);
    assert.equal(api.profileLabel(profile(turn)), `${turn} · 100 %`);
  }
  assert.equal(api.theoreticalHours(2026, profile('T8')), 1402.14);
});

test('T4 and normal T5 stay fixed across weekdays, holidays, nonstop and Christmas Eve', () => {
  for (const [turn, start, end] of [['T4','06:11','14:00'],['T5','13:45','21:34']]) {
    for (const kind of ['NORMAL','FRIDAY_EVE','SATURDAY','NON_STOP','LONG_SATURDAY']) {
      for (let wd = 0; wd < 7; wd++) {
        const shift = api.shiftFor(profile(turn), kind, wd);
        assert.equal(shift.start, start);
        assert.equal(shift.end, end);
        assert.equal(shift.minutes, 469);
      }
    }
    const d = day(24);
    const c = api.calcDay(d, [d], 2026, 12, profile(turn));
    assert.equal(c.shift, `${start}–${end}`);
    assert.equal(c.workedMinutes, 469);
    assert.equal(c.compensationPending, true);
    assert.equal(api.balanceLabel(profile(turn), c.value), 'Pendiente');
    assert.equal(api.nightLabel(profile(turn), c.nightHours), 'Pendiente');
  }
});

test('T1/T2 flag historical Saturday and nonstop schedules, including a Saturday before a holiday', () => {
  for (const [turn, normal, saturday] of [['T1','04:30–12:19','04:30–13:00'],['T2','11:55–19:44','12:30–21:00']]) {
    const fri = day(24);
    assert.equal(api.calcDay(fri, [fri], 2026, 7, profile(turn)).shift, normal);
    for (const d of [day(25), day(24, 'NON_STOP_EXTRA')]) {
      const c = api.calcDay(d, [d, {...day(26), officialHoliday:true}], 2026, 7, profile(turn));
      assert.equal(c.shift, saturday);
      assert.equal(c.scheduleReview, true);
      assert.match(c.reason, /histórico por confirmar/);
      assert.equal(c.horaNona, 0);
    }
  }
});

test('Manual full-time hours are retained without inventing compensation or cross-year credits', () => {
  const d = {...day(25, 'MODIFICACION'), modificationPlacement:'PERSONALIZADO', customStart:'12:00', customEnd:'21:00'};
  const c = api.calcDay(d, [d], 2026, 7, profile('T2'));
  assert.equal(c.workedMinutes, 540);
  assert.equal(c.ordinaryHours, 9);
  assert.equal(c.scheduleReview, false);
  assert.equal(c.compensationPending, true);
  for (const status of ['COMPUTO_ANTERIOR','COMPUTO_ACTUAL','FORMACION','REVISION_MEDICA']) {
    const x = {...d, status};
    const result = api.calcDay(x, [x], 2026, 7, profile('T2'));
    assert.equal(result.creditedMinutes, 0);
    assert.match(result.reason, /abono pendiente/);
  }
});

test('Switching full-time and back retains every T8 percentage and subturn schedule', () => {
  for (const contract of ['85.81','85','78.91','78.14','75']) {
    for (const subturn of ['T8.1','T8.2','T8.3','T8.4','T8.5']) {
      const legacy = {contract, subturn, fiestaLetter:'M'};
      for (const kind of ['NORMAL','FRIDAY_EVE','SATURDAY','NON_STOP','LONG_SATURDAY']) {
        for (let wd = 0; wd < 7; wd++) {
          const before = api.shiftFor(legacy,kind,wd);
          const full = {...legacy, turn:'T4'};
          assert.equal(api.shiftFor(full,kind,wd).minutes, 469);
          assert.deepEqual(api.shiftFor({...full,turn:'T8'},kind,wd), before);
        }
      }
    }
  }
  const d = day(24);
  assert.equal(api.calcDay(d,[d],2026,12,profile('T8')).shift, '18:46–23:50');
});
