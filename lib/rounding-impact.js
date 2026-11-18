// Read-only pilot. This module never changes calendar, balances or SAP records.
// Company-minus-exact: positive adds time; negative subtracts time.
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clean = value => Math.abs(value) < 1e-9 ? 0 : value;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const validDate = value => typeof value === 'string' && datePattern.test(value) &&
  Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;

export function roundingPilotAvailable(input) {
  return input?.year === 2026 && input?.profile?.turn === 'T8' && input.profile.percent === 85.81 &&
    finite(input.fullTimeHours) && input.fullTimeHours > 0 && Number.isInteger(input.workdays) && input.workdays > 0;
}

export function roundingDay(row, meanHours) {
  const balance = row.balanceEligible === true && finite(row.balanceHours) && finite(row.workedMinutes)
    ? {exact: row.workedMinutes / 60 - meanHours, company: row.balanceHours} : null;
  const night = row.nightEligible === true && finite(row.nightMinutes) && finite(row.nightHours)
    ? {exact: row.nightMinutes / 60, company: row.nightHours} : null;
  for (const metric of [balance, night]) if (metric) metric.seconds = clean((metric.company - metric.exact) * 3600);
  return {date: row.date, schedule: row.schedule, balance, night,
    balanceReason: row.balanceReason || '', nightReason: row.nightReason || ''};
}

function sumMetric(rows, key, knownEmpty = false) {
  const known = rows.map(row => row[key]).filter(Boolean);
  return {count: known.length, excluded: rows.length - known.length,
    exact: known.length || knownEmpty ? clean(known.reduce((sum, metric) => sum + metric.exact, 0)) : null,
    company: known.length || knownEmpty ? clean(known.reduce((sum, metric) => sum + metric.company, 0)) : null,
    seconds: known.length || knownEmpty ? clean(known.reduce((sum, metric) => sum + metric.seconds, 0)) : null};
}

export function dateInMadrid(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(now);
  const part = type => parts.find(value => value.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function roundingPeriodEnd(year, today) {
  return today < `${year}-01-01` ? `${year}-01-01` : today > `${year}-12-31` ? `${year}-12-31` : today;
}

export function roundingReport(input, {from, to, asOf}) {
  if (!roundingPilotAvailable(input)) return {ready: false, reason: 'Aquest pilot només està validat per al T8 del 85,81 % de 2026.'};
  if (![from, to, asOf].every(validDate) || from > to || !from.startsWith(input.year + '-') || !to.startsWith(input.year + '-'))
    return {ready: false, reason: 'Selecciona un període vàlid dins de l’any.'};
  const annualHours = input.fullTimeHours * input.profile.percent / 100;
  const meanHours = annualHours / input.workdays;
  const source = input.days.filter(row => validDate(row.date) && row.date >= from && row.date <= to);
  if (new Set(source.map(row => row.date)).size !== source.length) return {ready: false, reason: 'Hi ha dates duplicades; cal revisar el calendari.'};
  // days must include all calendar dates, including known non-working dates.
  const expectedDates = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const forecastSource = source.filter(row => row.working === true);
  // Include today and past calendar dates without waiting for the entire month
  // to be confirmed. Mark those provisional dates rather than freezing progress.
  const actualSource = forecastSource.filter(row => row.date <= asOf);
  const forecast = forecastSource.map(row => roundingDay(row, meanHours));
  const actual = actualSource.map(row => roundingDay(row, meanHours));
  const examples = input.examples.map(row => ({...row, ...roundingDay(row, meanHours)}));
  const missing = expectedDates - source.length;
  const excludedWork = forecastSource.length - actualSource.length;
  const noWork = missing === 0 && source.every(row => row.working === false);
  const actualThrough = to < asOf ? to : asOf;
  const elapsedDates = Math.max(0, Math.round((Date.parse(actualThrough) - Date.parse(from)) / 86400000) + 1);
  const past = source.filter(row => row.date <= asOf);
  const missingActual = elapsedDates - past.length;
  const unknownActual = past.filter(row => row.working === null).length;
  const noPastWork = past.length > 0 && missingActual === 0 && past.every(row => row.working === false);
  return {ready: true, annualHours, meanHours, workdays: input.workdays, examples, missing, excludedWork,
    forecast: {balance: sumMetric(forecast, 'balance', noWork), night: sumMetric(forecast, 'night', noWork)},
    actual: {balance: sumMetric(actual, 'balance', noPastWork), night: sumMetric(actual, 'night', noPastWork)}, days: actual,
    unknownDays: source.filter(row => row.working === null).length,
    missingActual, unknownActual, provisionalWork: actualSource.filter(row => row.confirmed !== true).length};
}

export function signedRoundingTime(seconds) {
  if (!finite(seconds)) return 'Pendent';
  const rounded = Math.round(Math.abs(seconds) * 10) / 10;
  if (!rounded) return '0 s';
  const minutes = Math.floor(rounded / 60), rest = Math.round((rounded - minutes * 60) * 10) / 10;
  const label = rest.toLocaleString('ca-ES', {maximumFractionDigits: 1});
  return (seconds > 0 ? '+' : '−') + (minutes ? `${minutes} min${rest ? ` ${label} s` : ''}` : `${label} s`);
}
