// Public client configuration. This publishable key has only the table's RLS read access.
export const CALENDAR_URL = "https://jftdmyntpxwsdbokxqfj.supabase.co";
export const CALENDAR_PUBLISHABLE_KEY = "sb_publishable_BoSmpzGfH5oho5B_j8RPrw_hj1rcv7x";

export const CATEGORY_RULES = {
  DISSABTE: { kind: "SATURDAY", weekday: 5 },
  DISSABTE_CANVI_HORA: { kind: "SATURDAY", weekday: 5 },
  DIUMENGE: { kind: "NORMAL", weekday: 6 },
  DIUMENGE_CANVI_HORA: { kind: "NORMAL", weekday: 6 },
  DIVENDRES: { kind: "FRIDAY_EVE", weekday: 4 },
  DIVENDRES_NO_LECTIU: { kind: "FRIDAY_EVE", weekday: 4 },
  DIVENDRES_NO_LECTIU_FINS_23H: { kind: "NORMAL", weekday: 1 },
  DIVENDRES_VIG_FESTIU: { kind: "FRIDAY_EVE", weekday: 4 },
  DIVENDRES_VIG_FESTIU_NO_LECTIU: { kind: "FRIDAY_EVE", weekday: 4 },
  FEINER: { kind: "NORMAL", weekday: 1 },
  FEINER_NO_LECTIU: { kind: "NORMAL", weekday: 1 },
  FEINER_NO_LECTIU_FINS_23H: { kind: "NORMAL", weekday: 1 },
  FEINER_FINS_23H: { kind: "NORMAL", weekday: 1 },
  FESTIU: { kind: "NORMAL", weekday: 6 },
  FESTIU_ESPECIAL: { kind: "FRIDAY_EVE", weekday: 4 },
  VIGILIA_NON_STOP: { kind: "NON_STOP", weekday: 1 },
} as const;
export type OfficialCategory = keyof typeof CATEGORY_RULES;
export type OfficialRow = { fecha: string; categoria_codigo: OfficialCategory | null };
export type OfficialYear = ReadonlyMap<string, OfficialCategory | null>;

export function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function validateOfficialYear(year: number, input: unknown): OfficialYear {
  if (!Number.isInteger(year) || year < 1900 || year > 9999 || !Array.isArray(input))
    throw new Error("Respuesta de calendario oficial no válida.");
  const expected = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
  if (input.length !== expected) throw new Error(`Calendario oficial ${year} incompleto o no disponible.`);
  const result = new Map<string, OfficialCategory | null>();
  for (const row of input) {
    if (!row || typeof row.fecha !== "string" ||
        !(row.categoria_codigo === null || Object.hasOwn(CATEGORY_RULES, row.categoria_codigo)))
      throw new Error("Categoría oficial desconocida. No se calculará por aproximación.");
    if (result.has(row.fecha)) throw new Error("Fechas duplicadas en el calendario oficial.");
    result.set(row.fecha, row.categoria_codigo);
  }
  for (let i = 0; i < expected; i++) {
    const key = new Date(Date.UTC(year, 0, 1) + i * 86400000).toISOString().slice(0, 10);
    if (!result.has(key)) throw new Error(`Falta la fecha oficial ${key}.`);
  }
  return result;
}

// One complete request per year/session, shared also by concurrent analyses.
// Never hydrate this cache from a saved personal plan or an inferred holiday list.
export function createOfficialCalendarClient(request: typeof fetch = (...args) => fetch(...args)) {
  const years = new Map<number, OfficialYear>();
  const pending = new Map<number, Promise<OfficialYear>>();
  function load(year: number): Promise<OfficialYear> {
    const cached = years.get(year);
    if (cached) return Promise.resolve(cached);
    const active = pending.get(year);
    if (active) return active;
    const task = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await request(`${CALENDAR_URL}/rest/v1/calendario_oficial_tmb?select=fecha,categoria_codigo&anio=eq.${year}&order=fecha.asc&limit=366`, {
          headers: { apikey: CALENDAR_PUBLISHABLE_KEY },
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Calendario oficial no disponible (${response.status}).`);
        const calendar = validateOfficialYear(year, await response.json());
        years.set(year, calendar);
        return calendar;
      } finally { clearTimeout(timer); }
    })();
    pending.set(year, task);
    void task.finally(() => pending.delete(year)).catch(() => {});
    return task;
  }
  return { load, get: (year: number, month: number, day: number) => years.get(year)?.get(dateKey(year, month, day)) };
}
export const officialCalendar = createOfficialCalendarClient();
export function officialCategory(year: number, month: number, day: number) {
  return officialCalendar.get(year, month, day);
}

export type CalendarCategorySource = "official" | "estimated" | "unavailable";
export function calendarCategory(year: number, month: number, day: number) {
  const official = officialCategory(year, month, day);
  if (official) return { code: official, source: "official" as const };
  if (year > new Date().getFullYear())
    return { code: estimatedCategory(year, month, day), source: "estimated" as const };
  return { code: null, source: "unavailable" as const };
}

function easterSunday(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100,
    d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31),
    day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function weekday(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function estimatedHolidayKeys(year: number) {
  const easter = easterSunday(year), key = (date: Date) => date.toISOString().slice(5, 10),
    offset = (days: number) => new Date(easter.getTime() + days * 86400000),
    fixed = ["01-01", "01-06", "05-01", "06-24", "08-15", "09-11", "09-24", "10-12", "11-01", "12-06", "12-08", "12-25", "12-26"];
  return new Set([...fixed, key(offset(-2)), key(offset(1)), key(offset(50))]);
}

function isLastSunday(year: number, month: number, day: number) {
  const next = new Date(Date.UTC(year, month - 1, day + 7));
  return weekday(year, month, day) === 0 && next.getUTCMonth() !== month - 1;
}

function estimatedCategory(year: number, month: number, day: number): OfficialCategory {
  const dow = weekday(year, month, day), key = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    tomorrow = new Date(Date.UTC(year, month - 1, day + 1)),
    tomorrowKey = tomorrow.toISOString().slice(5, 10),
    holidays = BARCELONA_HOLIDAYS[year] || estimatedHolidayKeys(year);

  if ((month === 6 && day === 23) || (month === 9 && day === 23) || (month === 12 && day === 31))
    return "VIGILIA_NON_STOP";
  if (month === 12 && day === 24)
    return dow === 5 ? "DIVENDRES_NO_LECTIU_FINS_23H" : "FEINER_NO_LECTIU_FINS_23H";
  if (dow === 0 && (month === 3 || month === 10) && isLastSunday(year, month, day))
    return "DIUMENGE_CANVI_HORA";
  if (dow === 6 && (month === 3 || month === 10) && isLastSunday(year, month, day + 1))
    return "DISSABTE_CANVI_HORA";
  if (dow === 0) return holidays.has(key) ? "FESTIU" : "DIUMENGE";
  if (dow === 6) return holidays.has(key) ? "FESTIU" : "DISSABTE";
  if (holidays.has(key)) return "FESTIU";
  if (dow === 5 && holidays.has(tomorrowKey)) return "DIVENDRES_VIG_FESTIU";
  return dow === 5 ? "DIVENDRES" : "FEINER";
}
const BARCELONA_HOLIDAYS: Record<number, Set<string>> = {
  2024: new Set([
    "01-01",
    "01-06",
    "03-29",
    "04-01",
    "05-01",
    "05-20",
    "06-24",
    "08-15",
    "09-11",
    "09-24",
    "10-12",
    "11-01",
    "12-06",
    "12-25",
    "12-26",
  ]),
  2025: new Set([
    "01-01",
    "01-06",
    "04-18",
    "04-21",
    "05-01",
    "06-09",
    "06-24",
    "08-15",
    "09-11",
    "09-24",
    "11-01",
    "12-06",
    "12-08",
    "12-25",
    "12-26",
  ]),
  2026: new Set([
    "01-01",
    "01-06",
    "04-03",
    "04-06",
    "05-01",
    "05-25",
    "06-24",
    "08-15",
    "09-11",
    "09-24",
    "10-12",
    "12-08",
    "12-25",
    "12-26",
  ]),
  2027: new Set([
    "01-01",
    "01-06",
    "03-26",
    "03-29",
    "05-01",
    "05-17",
    "06-24",
    "09-11",
    "09-24",
    "10-12",
    "11-01",
    "12-06",
    "12-08",
    "12-25",
  ]),
};

export function officialHolidayFor(year: number, month: number, day: number) {
  const key = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const holidays = BARCELONA_HOLIDAYS[year] || (year > new Date().getFullYear() ? estimatedHolidayKeys(year) : undefined);
  if (!holidays) return false;
  return holidays.has(key);
}
