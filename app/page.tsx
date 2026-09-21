/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element, react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import { CATEGORY_RULES, officialCalendar, officialCategory, officialHolidayFor } from "@/lib/official-calendar";
import {
  UploadCloud,
  TrainFront,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Moon,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  CalendarDays,
  Clock3,
  LockKeyhole,
  PencilLine,
  Trash2,
  UserRound,
  IdCard,
  Camera,
  Images,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BaseStatus = "REVISAR" | "AGCG" | "DCOM" | "FEST";
type Status =
  | BaseStatus
  | "VACACIONES"
  | "VACACIONES_PENDIENTES"
  | "VAC_ANTERIOR"
  | "MINI"
  | "LAUDO"
  | "RJ"
  | "FORMACION"
  | "REVISION_MEDICA"
  | "ENFERMEDAD"
  | "PERMISO"
  | "VISPERA_FESTIVO"
  | "HUELGA_LEGAL"
  | "COMPUTO_ANTERIOR"
  | "COMPUTO_ACTUAL";
type Special =
  | "NINGUNA"
  | "VISPERA_MANUAL"
  | "FESTIVO_ESPECIAL"
  | "NON_STOP_PACTADO"
  | "NON_STOP_EXTRA"
  | "MODIFICACION";
type ModificationPlacement = "FINAL" | "INICIO" | "PERSONALIZADO";
type PriorOrigin = "VACACIONES" | "RJ" | "COMPUTO";
type PeriodKind = "VACACIONES" | "MINI" | "VAC_ANTERIOR";
type PeriodRecord = {
  id: string;
  kind: PeriodKind;
  start: string;
  end: string;
  priorOrigin?: PriorOrigin;
};
type DayData = {
  day: number;
  baseStatus: BaseStatus;
  status: Status;
  officialHoliday: boolean;
  special: Special;
  extraHours: number;
  modificationPlacement?: ModificationPlacement;
  customStart?: string;
  customEnd?: string;
  note: string;
  periodId?: string;
  priorOrigin?: PriorOrigin;
  confidence?: number;
  manualEdited?: boolean;
};
type MonthPlan = { original: DayData[]; days: DayData[]; confirmed: boolean };
type YearPlan = Record<number, MonthPlan>;
type FiestaLetter = "K" | "M" | "L" | "N";
type ContractType = "85.81" | "85" | "78.91" | "78.14" | "75";
type Subturn = "T8.1" | "T8.2" | "T8.3" | "T8.4" | "T8.5";
type Turn = "T1" | "T2" | "T4" | "T5" | "T8";
type UserProfile = {
  turn?: Turn;
  name: string;
  employeeNumber: string;
  fiestaLetter: FiestaLetter;
  contract: ContractType;
  subturn?: Subturn;
};
type ShiftKind =
  "NORMAL" | "FRIDAY_EVE" | "SATURDAY" | "NON_STOP" | "LONG_SATURDAY";
type ShiftDefinition = {
  start: string;
  end: string;
  minutes: number;
  value: number;
};

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const INITIAL_YEAR = new Date().getFullYear();
const DEFAULT_PROFILE: UserProfile = {
  turn: "T8",
  name: "",
  employeeNumber: "",
  fiestaLetter: "M",
  contract: "85.81",
};
const CONTRACT_LABELS: Record<ContractType, string> = {
  "85.81": "85,81 %",
  "85": "85 %",
  "78.91": "78,91 %",
  "78.14": "78,14 %",
  "75": "75 %",
};
const TURNS: Turn[] = ["T1", "T2", "T4", "T5", "T8"];
const FULL_TIME_HOURS: Record<number, number> = { 2020: 1666, 2021: 1666, 2022: 1658, 2023: 1658, 2024: 1650, 2025: 1642, 2026: 1634, 2027: 1618 };
const FULL_TIME_SHIFTS = {
  T1: { start: "04:30", end: "12:19" },
  T2: { start: "11:55", end: "19:44" },
  T4: { start: "06:11", end: "14:00" },
  T5: { start: "13:45", end: "21:34" },
} as const;
function profileTurn(profile: UserProfile): Turn {
  return profile.turn && TURNS.includes(profile.turn) ? profile.turn : "T8";
}
function isFullTime(profile: UserProfile) { return profileTurn(profile) !== "T8"; }
function profileLabel(profile: UserProfile) {
  return isFullTime(profile) ? `${profileTurn(profile)} · 100 %` : `T8 · ${CONTRACT_LABELS[profile.contract]}`;
}
function theoreticalHours(year: number, profile: UserProfile) {
  return isFullTime(profile) ? FULL_TIME_HOURS[year] : ANNUAL_THEORETICAL_HOURS[year]?.[profile.contract];
}
// Keep the existing T8 contract/subturn as inactive preferences when changing turn.
// Legacy profiles without a turn remain T8. No stored calendar is rewritten.
function balanceLabel(profile: UserProfile, value: number) {
  return isFullTime(profile) ? "Pendiente" : signed(value);
}
function nightLabel(profile: UserProfile, value: number) {
  return isFullTime(profile) ? "Pendiente" : formatHours(value);
}
const SUBTURNS: Subturn[] = ["T8.1", "T8.2", "T8.3", "T8.4", "T8.5"];
// Jornadas acordadas con el usuario para 2020–2027. Horas = base al 100 % × porcentaje.
const ANNUAL_THEORETICAL_HOURS: Record<number, Partial<Record<ContractType, number>>> = {
  2020: { "85.81": 1429.59, "85": 1416.10, "78.91": 1314.64, "78.14": 1301.81, "75": 1249.50 },
  2021: { "85.81": 1429.59, "85": 1416.10, "78.91": 1314.64, "78.14": 1301.81, "75": 1249.50 },
  2022: { "85.81": 1422.73, "85": 1409.30, "78.91": 1308.33, "78.14": 1295.56, "75": 1243.50 },
  2023: { "85.81": 1422.73, "85": 1409.30, "78.91": 1308.33, "78.14": 1295.56, "75": 1243.50 },
  2024: { "85.81": 1415.87, "85": 1402.50, "78.91": 1302.02, "78.14": 1289.31, "75": 1237.50 },
  2025: { "85.81": 1409.00, "85": 1395.70, "78.91": 1295.70, "78.14": 1283.06, "75": 1231.50 },
  2026: { "85.81": 1402.14, "85": 1388.90, "78.91": 1289.39, "78.14": 1276.81, "75": 1225.50 },
  2027: { "85.81": 1388.41, "85": 1375.30, "78.91": 1276.76, "78.14": 1264.31, "75": 1213.50 },
};
const ANNUAL_WORKDAYS: Record<number, number> = {
  2020: 213,
  2021: 213,
  2022: 212,
  2023: 212,
  2024: 211,
  2025: 210,
  2026: 209,
  2027: 207,
};
const CONFIRMED_SPECIAL_RETRIBUTIVE_DAYS = [
  { from: 2023, month: 12, day: 25 },
  { from: 2024, month: 1, day: 1 },
  { from: 2024, month: 1, day: 6 },
  { from: 2025, month: 6, day: 24 },
  { from: 2026, month: 9, day: 24 },
] as const;
// Incrementar esta versión cuando cambie la lógica de reconocimiento anual.
// Los años analizados con una versión anterior se conservan, pero la interfaz
// avisa de que conviene volver a leer su imagen.
const ANNUAL_DETECTOR_VERSION = 2;
const statusLabel: Record<Status, string> = {
  REVISAR: "Revisar",
  AGCG: "Trabajo · AGCG",
  DCOM: "Descanso · DCOM",
  FEST: "Fiesta del ciclo · FEST",
  VACACIONES: "Vacaciones año actual",
  VACACIONES_PENDIENTES: "Vacaciones · indicar año",
  VAC_ANTERIOR: "Año/s anterior/es",
  MINI: "Mini",
  LAUDO: "Laudo",
  RJ: "RJ",
  FORMACION: "Formación",
  REVISION_MEDICA: "Revisión médica",
  ENFERMEDAD: "Baja o enfermedad",
  PERMISO: "Permiso",
  VISPERA_FESTIVO: "Víspera de festivo",
  HUELGA_LEGAL: "Huelga legal",
  COMPUTO_ANTERIOR: "Cómputo año anterior",
  COMPUTO_ACTUAL: "Cómputo año actual",
};
const specialLabel: Record<Special, string> = {
  NINGUNA: "Jornada según calendario",
  VISPERA_MANUAL: "Víspera de festivo",
  FESTIVO_ESPECIAL: "Festivo especial operativo",
  NON_STOP_PACTADO: "Non stop pactado",
  NON_STOP_EXTRA: "Non stop extraordinario",
  MODIFICACION: "Modificación de jornada",
};
const priorOriginLabel: Record<PriorOrigin, string> = {
  VACACIONES: "Vacaciones pendientes",
  RJ: "RJ pendiente",
  COMPUTO: "Cómputo horario positivo",
};
const priorSituationLabel: Record<PriorOrigin, string> = {
  VACACIONES: "Vacaciones año anterior",
  RJ: "RJ año anterior",
  COMPUTO: "Cómputo positivo año anterior",
};
const CYCLE_PATTERN: BaseStatus[] = [
  "AGCG",
  "AGCG",
  "AGCG",
  "AGCG",
  "AGCG",
  "AGCG",
  "AGCG",
  "DCOM",
  "FEST",
  "AGCG",
  "AGCG",
  "AGCG",
  "DCOM",
  "FEST",
  "AGCG",
  "AGCG",
  "DCOM",
  "FEST",
  "AGCG",
  "AGCG",
  "AGCG",
  "AGCG",
  "AGCG",
  "AGCG",
  "AGCG",
  "DCOM",
  "DCOM",
  "FEST",
];

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}
function weekdayMon(year: number, month: number, day: number) {
  return (new Date(year, month - 1, day).getDay() + 6) % 7;
}
function isConfirmedSpecialRetributiveDay(
  year: number,
  month: number,
  day: number,
) {
  return CONFIRMED_SPECIAL_RETRIBUTIVE_DAYS.some(
    (date) => year >= date.from && month === date.month && day === date.day,
  );
}
function iso(n: number) {
  if (!Number.isFinite(n)) return "Pendiente";
  return n.toFixed(2).replace("-", "−").replace(".", ",");
}
function signed(n: number) {
  return `${n > 0 ? "+" : ""}${iso(n)}`;
}
function decimalHoursFromMinutes(minutes: number) {
  return Number((minutes / 60).toFixed(2));
}
function formatHours(hours: number) {
  return Number.isFinite(hours) ? `${iso(hours)} h` : "Pendiente";
}
function clockMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
function clockLabel(total: number) {
  const normalized = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}
function elapsedMinutes(start: string, end: string) {
  const a = clockMinutes(start),
    b = clockMinutes(end);
  return b >= a ? b - a : b + 1440 - a;
}
function isWorking(s: Status) {
  return (
    s === "AGCG" ||
    s === "FORMACION" ||
    s === "REVISION_MEDICA" ||
    s === "VISPERA_FESTIVO" ||
    s === "COMPUTO_ANTERIOR" ||
    s === "COMPUTO_ACTUAL"
  );
}
function needsReview(s: Status) {
  return s === "REVISAR" || s === "VACACIONES_PENDIENTES";
}
function situationLabel(d: DayData) {
  const base =
    d.status === "VAC_ANTERIOR" && d.priorOrigin
      ? priorSituationLabel[d.priorOrigin]
      : statusLabel[d.status];
  return d.special !== "NINGUNA"
    ? `${base} · ${specialLabel[d.special]}`
    : base;
}
function compactStatusLabel(d: DayData) {
  return d.status === "REVISAR"
    ? "REVISAR"
    : d.status === "VAC_ANTERIOR"
      ? d.priorOrigin === "RJ"
        ? "RJ ANT."
        : d.priorOrigin === "COMPUTO"
          ? "CÓMP. + ANT."
          : "VAC. ANT."
      : d.status === "VACACIONES_PENDIENTES"
        ? "VAC. ¿AÑO?"
      : d.status === "COMPUTO_ANTERIOR"
        ? "CÓMP. ANT."
        : d.status === "COMPUTO_ACTUAL"
          ? "CÓMP. ACT."
          : d.status;
}
function specialMark(s: Special) {
  return s === "VISPERA_MANUAL"
    ? "VÍS"
    : s === "FESTIVO_ESPECIAL"
      ? "F.ESP"
      : s === "MODIFICACION"
        ? "MOD"
        : s === "NINGUNA"
          ? ""
          : "NS";
}
function baseOf(s: Status): BaseStatus {
  return s === "DCOM" || s === "FEST" || s === "REVISAR" ? s : "AGCG";
}
function makeDays(year: number, month: number, reviewing = true): DayData[] {
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => ({
    day: i + 1,
    baseStatus: reviewing ? "REVISAR" : "AGCG",
    status: reviewing ? "REVISAR" : "AGCG",
    officialHoliday: false,
    special: "NINGUNA",
    extraHours: 0,
    modificationPlacement: "FINAL",
    note: "",
  }));
}
function normalizeDays(raw: DayData[], year: number, month: number) {
  return raw.map((d: any) => {
    const legacyEve = d.status === "VISPERA_FESTIVO",
      legacySpecial = d.special === "AMPLIACION" ? "MODIFICACION" : d.special;
    return {
      ...d,
      status: legacyEve ? "AGCG" : d.status,
      baseStatus: d.baseStatus || baseOf(d.status),
      officialHoliday:
        false, // Legacy red-digit flags are no longer a source of operational truth.
      special: legacyEve ? "VISPERA_MANUAL" : legacySpecial || "NINGUNA",
      extraHours: Number(d.extraHours) || 0,
      modificationPlacement: d.modificationPlacement || "FINAL",
      note: d.note || "",
      priorOrigin:
        d.priorOrigin ||
        (d.status === "VAC_ANTERIOR" ? "VACACIONES" : undefined),
    };
  });
}
function applyCycleValidation(
  input: DayData[],
  year: number,
  month: number,
  phase?: number,
) {
  return input.map((d) => {
    const canUseCycle = Number.isInteger(phase),
      expected = canUseCycle
        ? phaseStatus(year, month, d.day, phase as number)
        : baseOf(d.status);
    if (d.status === "REVISAR")
      return canUseCycle
        ? {
            ...d,
            baseStatus: expected,
            status: expected,
            note: "Jornada completada mediante el ciclo de 28 días",
          }
        : d;
    if (
      d.status === "VACACIONES" ||
      d.status === "VACACIONES_PENDIENTES" ||
      d.status === "VAC_ANTERIOR" ||
      d.status === "MINI" ||
      d.status === "LAUDO" ||
      d.status === "RJ" ||
      d.status === "FORMACION" ||
      d.status === "REVISION_MEDICA" ||
      d.status === "ENFERMEDAD" ||
      d.status === "PERMISO" ||
      d.status === "HUELGA_LEGAL" ||
      d.status === "COMPUTO_ANTERIOR" ||
      d.status === "COMPUTO_ACTUAL"
    )
      return { ...d, baseStatus: expected };
    const detected = baseOf(d.status),
      autoMismatch = d.note.startsWith("Cambio visible respecto al ciclo"),
      hasPhotoEvidence = d.confidence !== undefined,
      strongPhotoEvidence = (d.confidence || 0) >= 0.55;
    if (canUseCycle && detected === "AGCG" && expected !== "AGCG")
      return {
        ...d,
        baseStatus: expected,
        status: expected,
        note: "Fiesta validada por el ciclo de 28 días",
      };
    if (canUseCycle && detected !== expected && hasPhotoEvidence)
      return strongPhotoEvidence
        ? {
            ...d,
            baseStatus: detected,
            status: detected,
            note: `Bloque de color confirmado respecto al ciclo: se esperaba ${expected}`,
          }
        : {
            ...d,
            baseStatus: expected,
            status: expected,
            note: "Jornada corregida mediante el ciclo de 28 días",
          };
    if (canUseCycle && detected !== expected && autoMismatch)
      return {
        ...d,
        baseStatus: expected,
        status: expected,
        note: "Jornada corregida mediante el ciclo de 28 días",
      };
    return {
      ...d,
      baseStatus: detected,
      status: detected,
      note:
        canUseCycle && detected !== expected
          ? `Cambio visible respecto al ciclo: se esperaba ${expected}`
          : "",
    };
  });
}

const FIXED_PROFILES: Record<
  Exclude<ContractType, "75">,
  Record<Exclude<ShiftKind, "LONG_SATURDAY">, ShiftDefinition>
> = {
  "85.81": {
    NORMAL: { start: "18:46", end: "00:50", minutes: 364, value: -0.64 },
    FRIDAY_EVE: { start: "18:46", end: "02:50", minutes: 484, value: 1.36 },
    SATURDAY: { start: "20:30", end: "05:00", minutes: 510, value: 1.79 },
    NON_STOP: { start: "20:30", end: "05:00", minutes: 510, value: 1.79 },
  },
  "85": {
    NORMAL: { start: "18:51", end: "00:50", minutes: 359, value: -0.67 },
    FRIDAY_EVE: { start: "18:51", end: "02:50", minutes: 479, value: 1.33 },
    SATURDAY: { start: "20:30", end: "05:00", minutes: 510, value: 1.85 },
    NON_STOP: { start: "20:30", end: "05:00", minutes: 510, value: 1.85 },
  },
  "78.91": {
    NORMAL: { start: "18:46", end: "00:50", minutes: 364, value: -0.67 },
    FRIDAY_EVE: { start: "18:46", end: "02:50", minutes: 484, value: 1.33 },
    SATURDAY: { start: "19:56", end: "05:00", minutes: 544, value: 2.33 },
    NON_STOP: { start: "19:56", end: "05:00", minutes: 544, value: 2.33 },
  },
  "78.14": {
    NORMAL: { start: "19:20", end: "00:50", minutes: 330, value: -0.61 },
    FRIDAY_EVE: { start: "19:20", end: "02:50", minutes: 450, value: 1.39 },
    SATURDAY: { start: "20:30", end: "04:40", minutes: 490, value: 2.06 },
    NON_STOP: { start: "20:30", end: "04:40", minutes: 490, value: 2.06 },
  },
};
const SUBTURN_SHIFTS: Record<
  Subturn,
  Record<ShiftKind, { start: string; end: string }>
> = {
  "T8.1": {
    NORMAL: { start: "19:20", end: "00:50" },
    FRIDAY_EVE: { start: "19:20", end: "02:50" },
    SATURDAY: { start: "20:30", end: "03:00" },
    NON_STOP: { start: "20:30", end: "03:00" },
    LONG_SATURDAY: { start: "21:10", end: "04:00" },
  },
  "T8.2": {
    NORMAL: { start: "19:20", end: "00:50" },
    FRIDAY_EVE: { start: "19:20", end: "02:50" },
    SATURDAY: { start: "23:30", end: "05:00" },
    NON_STOP: { start: "23:30", end: "05:00" },
    LONG_SATURDAY: { start: "23:30", end: "05:20" },
  },
  "T8.3": {
    NORMAL: { start: "19:20", end: "00:50" },
    FRIDAY_EVE: { start: "19:20", end: "02:50" },
    SATURDAY: { start: "20:30", end: "02:00" },
    NON_STOP: { start: "20:30", end: "02:00" },
    LONG_SATURDAY: { start: "21:10", end: "03:00" },
  },
  "T8.4": {
    NORMAL: { start: "19:20", end: "00:18" },
    FRIDAY_EVE: { start: "19:20", end: "02:50" },
    SATURDAY: { start: "20:30", end: "05:00" },
    NON_STOP: { start: "20:30", end: "05:00" },
    LONG_SATURDAY: { start: "21:10", end: "06:00" },
  },
  "T8.5": {
    NORMAL: { start: "19:52", end: "00:50" },
    FRIDAY_EVE: { start: "19:20", end: "02:50" },
    SATURDAY: { start: "20:30", end: "05:00" },
    NON_STOP: { start: "20:30", end: "05:00" },
    LONG_SATURDAY: { start: "21:10", end: "06:00" },
  },
};
function shiftFor(
  profile: UserProfile,
  kind: ShiftKind,
  weekday: number,
): ShiftDefinition {
  if (isFullTime(profile)) {
    const turn = profileTurn(profile) as keyof typeof FULL_TIME_SHIFTS;
    let shift: { start: string; end: string } = FULL_TIME_SHIFTS[turn];
    if ((turn === "T1" || turn === "T2") && (weekday === 5 || kind === "NON_STOP")) {
      // Historical reference only; calcDay and the UI identify it for review.
      shift = turn === "T1" ? { start: "04:30", end: "13:00" } : { start: "12:30", end: "21:00" };
    }
    return { ...shift, minutes: elapsedMinutes(shift.start, shift.end), value: 0 };
  }
  if (profile.contract !== "75")
    return FIXED_PROFILES[profile.contract][
      kind === "LONG_SATURDAY" ? "SATURDAY" : kind
    ];
  const subturn = profile.subturn || "T8.1",
    row = SUBTURN_SHIFTS[subturn][kind],
    minutes = elapsedMinutes(row.start, row.end),
    theoretical = 5.87;
  // T8.4 y T8.5 tienen jornada corta D-J, pero el domingo conservan 19:20-00:50.
  if (
    kind === "NORMAL" &&
    weekday === 6 &&
    (subturn === "T8.4" || subturn === "T8.5")
  ) {
    const start = "19:20",
      end = "00:50",
      m = 330;
    return {
      start,
      end,
      minutes: m,
      value: Number((m / 60 - theoretical).toFixed(2)),
    };
  }
  return {
    ...row,
    minutes,
    value: Number((minutes / 60 - theoretical).toFixed(2)),
  };
}
function nightMinutesForShift(start: string, end: string, total: number) {
  const a = clockMinutes(start),
    endAbs = a + total,
    nightStart = a < 1320 ? 1320 : a;
  let night = Math.max(0, endAbs - nightStart);
  if (night > total / 2) night = total;
  return Math.min(total, night);
}

function calcDay(
  d: DayData,
  all: DayData[],
  year: number,
  month: number,
  profile: UserProfile,
) {
  const toPreviousYear = d.status === "COMPUTO_ANTERIOR",
    toCurrentYear = d.status === "COMPUTO_ACTUAL";
  if (!isWorking(d.status))
    return {
      scheduleReview: false,
      compensationPending: isFullTime(profile),
      value: 0,
      shift: "—",
      hours: "0",
      night: "0",
      workedMinutes: 0,
      nightMinutes: 0,
      nightHours: 0,
      ordinaryHours: 0,
      horaNona: 0,
      creditedMinutes: 0,
      reason: statusLabel[d.status],
    };
  const code = officialCategory(year, month, d.day);
  if (!code) {
    // Unknown official category is not an unknown personal situation. Preserve
    // every result independent of that category, including cross-year zeros.
    const fullTime = isFullTime(profile);
    const fixed = fullTime && ["T4", "T5"].includes(profileTurn(profile));
    const custom = d.special === "MODIFICACION" &&
      d.modificationPlacement === "PERSONALIZADO" && d.customStart && d.customEnd;
    let start = "", end = "", minutes = NaN;
    if (fixed) {
      const shift = shiftFor(profile, "NORMAL", 1);
      start = shift.start; end = shift.end; minutes = shift.minutes;
      if (d.special === "MODIFICACION" && !custom) {
        minutes = Math.max(0, minutes + Math.round(d.extraHours * 60));
        if (d.modificationPlacement === "INICIO") start = clockLabel(clockMinutes(start) - Math.round(d.extraHours * 60));
        else end = clockLabel(clockMinutes(end) + Math.round(d.extraHours * 60));
      }
    }
    if (custom) {
      start = d.customStart!; end = d.customEnd!;
      minutes = elapsedMinutes(start, end);
    }
    const night = fullTime ? 0 : Number.isFinite(minutes) ? nightMinutesForShift(start, end, minutes) : NaN;
    return {
      scheduleReview: !Number.isFinite(minutes), compensationPending: fullTime,
      value: fullTime || toPreviousYear ? 0 : toCurrentYear ? decimalHoursFromMinutes(minutes) : NaN,
      shift: Number.isFinite(minutes) ? `${start}–${end}` : "Pendiente",
      hours: Number.isFinite(minutes) ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}` : "Pendiente",
      night: toPreviousYear ? "—" : iso(decimalHoursFromMinutes(night)),
      workedMinutes: toPreviousYear ? 0 : minutes,
      nightMinutes: toPreviousYear ? 0 : night,
      nightHours: toPreviousYear ? 0 : decimalHoursFromMinutes(night),
      ordinaryHours: decimalHoursFromMinutes(minutes),
      horaNona: fullTime ? 0 : Number.isFinite(minutes) ? Math.max(0, Math.ceil((minutes - 480) / 15) * 0.25) : NaN,
      creditedMinutes: fullTime || (!toPreviousYear && !toCurrentYear) ? 0 : minutes,
      reason: "Categoría oficial no disponible · solo los cálculos dependientes quedan pendientes",
    };
  }
  const rule = CATEGORY_RULES[code], wd = rule.weekday;
  let kind: ShiftKind = rule.kind, reason: string = code.replaceAll("_", " ");
  // The event is the current date's official code. October only selects the
  // existing autumn tariff; spring keeps its previous schedule. No event date
  // is reconstructed from tomorrow or a last-Saturday formula.
  if (code === "DISSABTE_CANVI_HORA" && profile.contract === "75" && month === 10) {
    kind = "LONG_SATURDAY";
    reason = "Sábado largo · cambio de hora";
  }
  // Explicit personal overrides remain visible and are not inferred from colours.
  if (d.special === "NON_STOP_PACTADO" || d.special === "NON_STOP_EXTRA") {
    kind = "NON_STOP"; reason = specialLabel[d.special] + " · manual";
  } else if (d.special === "FESTIVO_ESPECIAL" || d.special === "VISPERA_MANUAL" || d.status === "VISPERA_FESTIVO") {
    kind = "FRIDAY_EVE"; reason = "Jornada especial · manual";
  }
  let definition = shiftFor(profile, kind, wd),
    start = definition.start,
    end = definition.end,
    workedMinutes = definition.minutes,
    value = definition.value;
  if (!isFullTime(profile) && code.endsWith("_FINS_23H")) {
    const normal = shiftFor(profile, "NORMAL", wd);
    definition = normal;
    start = normal.start;
    end = "23:50";
    workedMinutes = normal.minutes;
    value = normal.value;
    reason = "Nochebuena · jornada normal abonada";
  }
  if (d.special === "MODIFICACION") {
    if (
      d.modificationPlacement === "PERSONALIZADO" &&
      d.customStart &&
      d.customEnd
    ) {
      start = d.customStart;
      end = d.customEnd;
      const customMinutes = elapsedMinutes(start, end);
      value += (customMinutes - workedMinutes) / 60;
      workedMinutes = customMinutes;
    } else {
      const delta = Math.round(d.extraHours * 60);
      workedMinutes = Math.max(0, workedMinutes + delta);
      if ((d.modificationPlacement || "FINAL") === "INICIO")
        start = clockLabel(clockMinutes(start) - delta);
      else end = clockLabel(clockMinutes(end) + delta);
      value += d.extraHours;
    }
    reason = "Modificación de jornada";
  }
  const actualWorkedMinutes = workedMinutes,
    actualNightMinutes = isFullTime(profile) ? 0 : nightMinutesForShift(start, end, actualWorkedMinutes),
    actualNightHours = decimalHoursFromMinutes(actualNightMinutes),
    actualOrdinaryHours = decimalHoursFromMinutes(actualWorkedMinutes),
    actualHoraNona =
      !isFullTime(profile) && actualWorkedMinutes > 480
        ? Math.ceil((actualWorkedMinutes - 480) / 15) * 0.25
        : 0,
    hours = `${Math.floor(actualWorkedMinutes / 60)}:${String(actualWorkedMinutes % 60).padStart(2, "0")}`;
  if (toPreviousYear) {
    value = 0;
    reason = `Cómputo aplicado a ${year - 1}`;
  } else if (toCurrentYear) {
    value = actualWorkedMinutes / 60;
    reason = `Cómputo aplicado a ${year}`;
  }
  const fullTime = isFullTime(profile);
  const scheduleReview = fullTime && ["T1", "T2"].includes(profileTurn(profile)) && (wd === 5 || kind === "NON_STOP") && d.special !== "MODIFICACION";
  const absenceReview = fullTime && ["FORMACION", "REVISION_MEDICA", "COMPUTO_ANTERIOR", "COMPUTO_ACTUAL"].includes(d.status);
  if (fullTime) reason = `${profileTurn(profile)} · ${scheduleReview ? "horario histórico por confirmar" : reason}${absenceReview ? " · abono pendiente" : ""} · cómputo pendiente`;
  return {
    scheduleReview,
    compensationPending: fullTime,
    value: fullTime ? 0 : Number(value.toFixed(2)),
    shift: `${start}–${end}`,
    hours,
    night: toPreviousYear
      ? "—"
      : iso(actualNightHours),
    workedMinutes: toPreviousYear ? 0 : actualWorkedMinutes,
    nightMinutes: toPreviousYear ? 0 : actualNightMinutes,
    nightHours: toPreviousYear ? 0 : actualNightHours,
    ordinaryHours: actualOrdinaryHours,
    horaNona: actualHoraNona,
    creditedMinutes: !fullTime && (toPreviousYear || toCurrentYear) ? actualWorkedMinutes : 0,
    reason,
  };
}
function totalFor(
  days: DayData[],
  year: number,
  month: number,
  profile: UserProfile,
) {
  return Number(
    days
      .reduce((sum, d) => sum + calcDay(d, days, year, month, profile).value, 0)
      .toFixed(2),
  );
}
function ordinaryHoursFor(
  days: DayData[],
  year: number,
  month: number,
  profile: UserProfile,
) {
  return Number(
    days
      .reduce(
        (sum, d) => sum + calcDay(d, days, year, month, profile).ordinaryHours,
        0,
      )
      .toFixed(2),
  );
}
function primaHoraNonaFor(
  days: DayData[],
  year: number,
  month: number,
  profile: UserProfile,
) {
  return Number(
    days
      .reduce(
        (sum, d) => sum + calcDay(d, days, year, month, profile).horaNona,
        0,
      )
      .toFixed(2),
  );
}
function nightHoursFor(
  days: DayData[],
  year: number,
  month: number,
  profile: UserProfile,
) {
  return Number(
    days
      .reduce(
        (sum, d) => sum + calcDay(d, days, year, month, profile).nightHours,
        0,
      )
      .toFixed(2),
  );
}
function plusFestiuCount(days: DayData[], year: number, month: number) {
  return days.filter(
    (d) => isWorking(d.status) && weekdayMon(year, month, d.day) === 6,
  ).length;
}
function plusConvenioCount(days: DayData[]) {
  return days.filter((d) => d.status !== "FEST").length;
}
function specialRetributiveDaysCount(year: number, month: number) {
  return Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).filter(
    (day) => isConfirmedSpecialRetributiveDay(year, month, day),
  ).length;
}

function copyRecognizedDays(input: DayData[]) {
  return input.map((d) => ({ ...d }));
}
function dominantStatus(data: Uint8ClampedArray): Status {
  const bins = new Map<string, number>();
  for (let p = 0; p < data.length; p += 4) {
    const r = data[p],
      g = data[p + 1],
      b = data[p + 2];
    if (r + g + b < 150) continue;
    const key = `${Math.round(r / 16) * 16},${Math.round(g / 16) * 16},${Math.round(b / 16) * 16}`;
    bins.set(key, (bins.get(key) || 0) + 1);
  }
  const top = [...bins.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!top) return "REVISAR";
  const [r, g, b] = top.split(",").map(Number);
  if (r < 130 && g > 130 && b > 130) return "DCOM";
  if (g > r + 50 && g > b + 50 && g > 135 && r < 135 && b < 135)
    return "ENFERMEDAD";
  if (g > r + 18 && g > b + 18 && r > 85 && b > 85)
    return "REVISION_MEDICA";
  if (r > 185 && b > 145 && g < 195 && r - g > 30 && b - g > 30) return "FORMACION";
  if (r > 170 && g > 105 && b < 85 && g - b > 55 && r - g > 25)
    return "LAUDO";
  if (r > 170 && g > 75 && g < 205 && b > 45 && b < 175 && r - g > 22)
    return "FEST";
  if (r > 95 && g > 60 && b < 100 && r > g && g > b)
    return "VACACIONES_PENDIENTES";
  if (b > r + 35 && b > g + 20) return "REVISAR";
  if (r > 190 && g > 180 && b > 145) return "AGCG";
  return "REVISAR";
}
function annualBlockEvidence(data: Uint8ClampedArray) {
  let eligible = 0,
    cyan = 0,
    orange = 0,
    pink = 0,
    disease = 0,
    medical = 0,
    laudo = 0,
    brown = 0,
    blue = 0;
  for (let p = 0; p < data.length; p += 4) {
    const r = data[p],
      g = data[p + 1],
      b = data[p + 2],
      isBlue = b > r + 35 && b > g + 20 && b > 95;
    if (r + g + b < 180 && !isBlue) continue;
    eligible++;
    if (isBlue) blue++;
    else if (g > r + 50 && g > b + 50 && g > 135 && r < 135 && b < 135)
      disease++;
    else if (g > r + 14 && g > b + 14 && r > 75 && b > 75) medical++;
    else if (r < 150 && g > 125 && b > 125 && g - r > 15) cyan++;
    else if (r > 180 && b > 135 && g < 205 && r - g > 30 && b - g > 30) pink++;
    else if (r > 170 && g > 105 && b < 85 && g - b > 55 && r - g > 25)
      laudo++;
    else if (r > 165 && g > 70 && g < 210 && b > 40 && b < 180 && r - g > 18)
      orange++;
    else if (r > 95 && g > 60 && b < 100 && r > g && g > b) brown++;
  }
  const ratio = (n: number) => (eligible ? n / eligible : 0),
    best = Math.max(cyan, orange, pink, disease, medical, laudo, brown, blue),
    confidence = ratio(best);
  if (confidence < 0.25)
    return { status: "AGCG" as Status, confidence: 1 - confidence };
  if (best === cyan) return { status: "DCOM" as Status, confidence };
  if (best === orange) return { status: "FEST" as Status, confidence };
  if (best === pink) return { status: "FORMACION" as Status, confidence };
  if (best === disease) return { status: "ENFERMEDAD" as Status, confidence };
  if (best === medical)
    return { status: "REVISION_MEDICA" as Status, confidence };
  if (best === laudo) return { status: "LAUDO" as Status, confidence };
  if (best === brown)
    return { status: "VACACIONES_PENDIENTES" as Status, confidence };
  return { status: "REVISAR" as Status, confidence };
}
function annualCellEvidence(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellW: number,
  cellH: number,
  canvas: HTMLCanvasElement,
) {
  // Two interior side strips avoid the central day number and the cell border.
  const offsets = [[-0.30, 0], [0.30, 0]],
    votes = new Map<Status, number>();
  let total = 0;
  for (const [dx, dy] of offsets) {
    const sw = Math.max(2, Math.round(cellW * 0.18)),
      sh = Math.max(3, Math.round(cellH * 0.50)),
      sx = Math.max(0, Math.round(cx + cellW * dx - sw / 2)),
      sy = Math.max(0, Math.round(cy + cellH * dy - sh / 2)),
      evidence = annualBlockEvidence(
        ctx.getImageData(
          sx,
          sy,
          Math.min(sw, canvas.width - sx),
          Math.min(sh, canvas.height - sy),
        ).data,
      ),
      weight = 0.3 + evidence.confidence;
    votes.set(evidence.status, (votes.get(evidence.status) || 0) + weight);
    total += weight;
  }
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]),
    status = ranked[0]?.[0] || "REVISAR",
    best = ranked[0]?.[1] || 0,
    second = ranked[1]?.[1] || 0,
    share = total ? best / total : 0,
    margin = total ? (best - second) / total : 0,
    required = status === "AGCG" ? 0.49 : 0.53;
  if (share < required || margin < 0.1)
    return {
      status: "REVISAR" as Status,
      confidence: Math.max(0, Math.min(1, share)),
    };
  return {
    status,
    confidence: Math.max(0, Math.min(1, share + margin * 0.35)),
  };
}
async function classifyMonthly(file: File, year: number, month: number) {
  const bitmap = await createImageBitmap(file),
    canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const full = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let border: { y: number; x: number; length: number } | null = null;
  for (
    let y = Math.floor(canvas.height * 0.18);
    y < Math.floor(canvas.height * 0.85) && !border;
    y++
  ) {
    let start = 0,
      run = 0,
      bestStart = 0,
      bestLength = 0;
    for (let x = 0; x < Math.floor(canvas.width * 0.54); x++) {
      const p = (y * canvas.width + x) * 4,
        dark = full[p] + full[p + 1] + full[p + 2] < 180;
      if (dark) {
        if (!run) start = x;
        run++;
        if (run > bestLength) {
          bestLength = run;
          bestStart = start;
        }
      } else run = 0;
    }
    if (bestLength > canvas.width * 0.3)
      border = { y, x: bestStart, length: bestLength };
  }
  if (!border) return null;
  const scale = border.length / 384,
    cellW = border.length / 7,
    cellH = 38 * scale,
    y0 = border.y + 68 * scale,
    result = new Map<number, Status>();
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const index = weekdayMon(year, month, 1) + day - 1,
      col = index % 7,
      row = Math.floor(index / 7),
      cx = border.x + cellW * (col + 0.5),
      cy = y0 + row * cellH,
      sx = Math.max(0, Math.round(cx - cellW * 0.42)),
      sy = Math.max(0, Math.round(cy - cellH * 0.34)),
      sw = Math.max(4, Math.round(cellW * 0.84)),
      sh = Math.max(4, Math.round(cellH * 0.68));
    result.set(
      day,
      dominantStatus(
        ctx.getImageData(
          sx,
          sy,
          Math.min(sw, canvas.width - sx),
          Math.min(sh, canvas.height - sy),
        ).data,
      ),
    );
  }
  return result;
}

type Point = { x: number; y: number };
function fitLine(points: Point[], axis: "x" | "y") {
  if (points.length < 8) return null;
  let sumA = 0,
    sumB = 0,
    sumAA = 0,
    sumAB = 0;
  for (const p of points) {
    const a = axis === "x" ? p.x : p.y,
      b = axis === "x" ? p.y : p.x;
    sumA += a;
    sumB += b;
    sumAA += a * a;
    sumAB += a * b;
  }
  const n = points.length,
    den = n * sumAA - sumA * sumA;
  if (Math.abs(den) < 1e-6) return null;
  const slope = (n * sumAB - sumA * sumB) / den;
  return { slope, intercept: (sumB - slope * sumA) / n };
}
function lineIntersection(
  yLine: { slope: number; intercept: number },
  xLine: { slope: number; intercept: number },
): Point {
  const y =
    (yLine.slope * xLine.intercept + yLine.intercept) /
    (1 - yLine.slope * xLine.slope);
  return { x: xLine.slope * y + xLine.intercept, y };
}
function averageLuma(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  radius = 2,
) {
  let total = 0,
    count = 0;
  for (
    let xx = Math.max(0, x - radius);
    xx <= Math.min(width - 1, x + radius);
    xx++
  ) {
    const p = (y * width + xx) * 4;
    total += (data[p] + data[p + 1] + data[p + 2]) / 3;
    count++;
  }
  return total / count;
}
function longestDarkRun(data: Uint8ClampedArray, width: number, y: number) {
  let start = 0,
    run = 0,
    bestStart = 0,
    bestLength = 0;
  for (let x = 0; x < width; x++) {
    const p = (y * width + x) * 4,
      dark = data[p] + data[p + 1] + data[p + 2] < 240;
    if (dark) {
      if (!run) start = x;
      run++;
      if (run > bestLength) {
        bestStart = start;
        bestLength = run;
      }
    } else run = 0;
  }
  return { start: bestStart, length: bestLength };
}
function verticalBorderScore(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
) {
  const data = ctx.getImageData(x, y, 1, height).data;
  let dark = 0;
  for (let p = 0; p < data.length; p += 4)
    if (data[p] + data[p + 1] + data[p + 2] < 300) dark++;
  return dark / (data.length / 4);
}
function horizontalBorderScore(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
) {
  const data = ctx.getImageData(x, y, width, 1).data;
  let dark = 0;
  for (let p = 0; p < data.length; p += 4)
    if (data[p] + data[p + 1] + data[p + 2] < 300) dark++;
  return dark / (data.length / 4);
}
function findVerticalBorder(
  ctx: CanvasRenderingContext2D,
  nominal: number,
  y: number,
  height: number,
  radius: number,
  canvas: HTMLCanvasElement,
) {
  let bestX = Math.round(nominal),
    bestScore = 0;
  for (
    let x = Math.max(0, Math.round(nominal - radius));
    x <= Math.min(canvas.width - 1, Math.round(nominal + radius));
    x++
  ) {
    const score = verticalBorderScore(
      ctx,
      x,
      Math.max(0, Math.round(y)),
      Math.max(
        1,
        Math.min(
          Math.round(height),
          canvas.height - Math.max(0, Math.round(y)),
        ),
      ),
    );
    if (score > bestScore) {
      bestX = x;
      bestScore = score;
    }
  }
  return bestScore > 0.35 ? bestX : nominal;
}
function findPanelEdges(
  ctx: CanvasRenderingContext2D,
  nominalLeft: number,
  nominalLength: number,
  y: number,
  height: number,
  canvas: HTMLCanvasElement,
) {
  const nominalRight = nominalLeft + nominalLength,
    cell = nominalLength / 7,
    radius = cell * 0.82,
    candidates = (nominal: number) => {
      const values: { x: number; score: number }[] = [];
      for (
        let x = Math.max(0, Math.round(nominal - radius));
        x <= Math.min(canvas.width - 1, Math.round(nominal + radius));
        x++
      ) {
        const score = verticalBorderScore(
          ctx,
          x,
          Math.max(0, Math.round(y)),
          Math.max(
            1,
            Math.min(
              Math.round(height),
              canvas.height - Math.max(0, Math.round(y)),
            ),
          ),
        );
        if (score > 0.24) values.push({ x, score });
      }
      return values.sort((a, b) => b.score - a.score).slice(0, 10);
    },
    lefts = candidates(nominalLeft),
    rights = candidates(nominalRight);
  let best = { left: nominalLeft, right: nominalRight, score: -Infinity };
  for (const left of lefts)
    for (const right of rights) {
      const length = right.x - left.x;
      if (length < nominalLength * 0.88 || length > nominalLength * 1.12)
        continue;
      const displacement =
          (Math.abs(left.x - nominalLeft) + Math.abs(right.x - nominalRight)) /
          cell,
        widthError = Math.abs(length - nominalLength) / cell,
        score =
          left.score + right.score - displacement * 0.38 - widthError * 0.9;
      if (score > best.score) best = { left: left.x, right: right.x, score };
    }
  return best.score > -Infinity
    ? best
    : { left: nominalLeft, right: nominalRight, score: 0 };
}
function findHorizontalBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  nominal: number,
  width: number,
  radius: number,
  canvas: HTMLCanvasElement,
) {
  let bestY = Math.round(nominal),
    bestScore = 0;
  for (
    let y = Math.max(0, Math.round(nominal - radius));
    y <= Math.min(canvas.height - 1, Math.round(nominal + radius));
    y++
  ) {
    const score = horizontalBorderScore(
      ctx,
      Math.max(0, Math.round(x)),
      y,
      Math.max(
        1,
        Math.min(Math.round(width), canvas.width - Math.max(0, Math.round(x))),
      ),
    );
    if (score > bestScore) {
      bestY = y;
      bestScore = score;
    }
  }
  return bestScore > 0.35 ? bestY : nominal;
}
function findPanelBottom(
  ctx: CanvasRenderingContext2D,
  x: number,
  expected: number,
  width: number,
  radius: number,
  canvas: HTMLCanvasElement,
) {
  let bestY = Math.round(expected),
    bestDistance = Infinity,
    bestScore = 0;
  for (
    let y = Math.max(0, Math.round(expected - radius));
    y <= Math.min(canvas.height - 1, Math.round(expected + radius));
    y++
  ) {
    const score = horizontalBorderScore(
        ctx,
        Math.max(0, Math.round(x)),
        y,
        Math.max(
          1,
          Math.min(
            Math.round(width),
            canvas.width - Math.max(0, Math.round(x)),
          ),
        ),
      ),
      distance = Math.abs(y - expected);
    if (
      score >= 0.62 &&
      (distance < bestDistance ||
        (distance === bestDistance && score > bestScore))
    ) {
      bestY = y;
      bestDistance = distance;
      bestScore = score;
    } else if (bestDistance === Infinity && score > bestScore) {
      bestY = y;
      bestScore = score;
    }
  }
  return bestScore > 0.35 ? bestY : expected;
}
type AnnualPanel = {
  x: number;
  length: number;
  gridTop: number;
  cellH: number;
};
function isHeaderColor(r: number, g: number, b: number) {
  return r > 175 && g > 95 && g < 235 && b < 195 && r > g + 12 && g > b + 8;
}
async function loadAnnualCanvas(file: File) {
  const bitmap = await createImageBitmap(file),
    ratio = Math.min(1, 2800 / bitmap.width, 1800 / bitmap.height),
    canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}
function detectModernAnnualPanels(canvas: HTMLCanvasElement, year: number): AnnualPanel[] | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  // The modern grid has separated, filled rectangles. Ignore white gutters and
  // dark lettering; neither day-number colour nor calendar categories are used.
  for (let i = 0; i < mask.length; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    mask[i] = Math.max(r, g, b) > 100 && ((r + g + b < 645 && Math.min(r, g, b) < 225) || (r - g > 40 && b - g > 40)) ? 1 : 0;
  }
  const originalMask = mask.slice();
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    mask[i] = originalMask[i] && originalMask[i - 1] && originalMask[i + 1] && originalMask[i - width] && originalMask[i + width] ? 1 : 0;
  }
  const stack = new Int32Array(mask.length);
  const cells: { x: number; y: number; w: number; h: number }[] = [];
  for (let seed = 0; seed < mask.length; seed++) {
    if (!mask[seed]) continue;
    let size = 1, count = 0, left = width, right = 0, top = height, bottom = 0;
    stack[0] = seed; mask[seed] = 0;
    while (size) {
      const i = stack[--size], x = i % width, y = Math.floor(i / width);
      count++; left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (const next of [x > 0 ? i - 1 : -1, x + 1 < width ? i + 1 : -1, i - width, i + width]) {
        if (next >= 0 && next < mask.length && mask[next]) { mask[next] = 0; stack[size++] = next; }
      }
    }
    const w = right - left + 1, h = bottom - top + 1;
    if (w > width * .025 && w < width * .04 && h > w * .3 && h < w * .6 && count / (w * h) > .65)
      cells.push({ x: (left + right) / 2, y: (top + bottom) / 2, w, h });
  }
  const middle = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
  if (cells.length < 350) return null;
  const cellWidth = middle(cells.map(c => c.w)), cellHeight = middle(cells.map(c => c.h));
  const cluster = (values: number[], tolerance: number) => {
    const groups: number[][] = [];
    for (const value of values.sort((a, b) => a - b)) {
      const last = groups[groups.length - 1];
      if (last && value - last[0] < tolerance) last.push(value); else groups.push([value]);
    }
    return groups.map(middle);
  };
  const xs = cluster(cells.map(c => c.x), cellWidth * .2);
  const ys = cluster(cells.map(c => c.y), cellHeight * .2);
  if (xs.length !== 28) return null;
  const rowGroups: number[][] = [];
  for (const y of ys) {
    const last = rowGroups[rowGroups.length - 1];
    if (last && y - last[last.length - 1] < cellHeight * 1.8) last.push(y); else rowGroups.push([y]);
  }
  if (rowGroups.length !== 3) return null;
  const panels: AnnualPanel[] = [];
  for (let month = 1; month <= 12; month++) {
    const column = (month - 1) % 4, rows = rowGroups[Math.floor((month - 1) / 4)];
    const centers = xs.slice(column * 7, column * 7 + 7);
    const cellW = (centers[6] - centers[0]) / 6;
    const cellH = middle(rows.slice(1).map((y, i) => y - rows[i]));
    const panel = { x: centers[0] - cellW / 2, length: cellW * 7, gridTop: rows[0] - cellH / 2, cellH };
    // Every actual date must have a rectangle at its expected grid position.
    // Reject incomplete/misaligned layouts instead of accepting a count alone.
    for (let day = 1; day <= daysInMonth(year, month); day++) {
      const index = weekdayMon(year, month, 1) + day - 1;
      if (!cells.some(c => Math.abs(c.x - centers[index % 7]) < cellW * .15 &&
        Math.abs(c.y - (rows[0] + Math.floor(index / 7) * cellH)) < cellH * .15)) return null;
    }
    panels.push(panel);
  }
  return panels;
}

function detectStraightAnnualPanels(
  canvas: HTMLCanvasElement,
  year: number,
): AnnualPanel[] | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { width, height } = canvas,
    data = ctx.getImageData(0, 0, width, height).data,
    maxGap = Math.max(3, Math.round(width * 0.004));
  function runsAt(y: number) {
    const runs: { start: number; end: number; density: number }[] = [];
    let start = -1,
      last = -1,
      count = 0,
      gap = 0;
    const close = () => {
      if (start < 0) return;
      const length = last - start + 1,
        density = length > 0 ? count / length : 0;
      if (length > width * 0.1 && length < width * 0.19 && density > 0.42)
        runs.push({ start, end: last, density });
      start = -1;
      last = -1;
      count = 0;
      gap = 0;
    };
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      if (isHeaderColor(data[p], data[p + 1], data[p + 2])) {
        if (start < 0) start = x;
        last = x;
        count++;
        gap = 0;
      } else if (start >= 0 && ++gap > maxGap) close();
    }
    close();
    return runs;
  }
  const rows: { y: number; runs: ReturnType<typeof runsAt> }[] = [];
  for (let y = Math.floor(height * 0.02); y < Math.floor(height * 0.9); y++) {
    const runs = runsAt(y);
    if (runs.length === 6) rows.push({ y, runs });
  }
  if (!rows.length) return null;
  const top = rows[0],
    bottom = rows.find((row) => row.y - top.y > height * 0.32);
  if (!bottom) return null;
  const aligned = top.runs.every(
    (run, i) => Math.abs(run.start - bottom.runs[i].start) < width * 0.025,
  );
  if (!aligned) return null;
  const makeRow = (anchor: typeof top, monthOffset: number) => {
      const pad = Math.max(1, Math.round(width * 0.002));
      return anchor.runs.map((run, index) => {
        const x = Math.max(0, run.start - pad),
          length = Math.min(width - x, run.end - run.start + 1 + pad * 2),
          cellW = length / 7;
        let lastHeader = anchor.y;
        for (
          let y = anchor.y;
          y < Math.min(height, anchor.y + cellW * 2.8);
          y++
        ) {
          let header = 0,
            total = 0;
          for (let xx = Math.round(x); xx < Math.round(x + length); xx += 2) {
            const p = (y * width + Math.min(width - 1, xx)) * 4;
            if (isHeaderColor(data[p], data[p + 1], data[p + 2])) header++;
            total++;
          }
          if (total && header / total > 0.46) lastHeader = y;
        }
        const month = monthOffset + index + 1;
        const weeks = Math.ceil((weekdayMon(year, month, 1) + daysInMonth(year, month)) / 7);
        const gridTop = lastHeader + 1;
        const bottom = findPanelBottom(ctx, x, gridTop + cellW * weeks, length, cellW * .8, canvas);
        return { x, length, gridTop, cellH: (bottom - gridTop) / weeks };
      });
    },
    panels = [...makeRow(top, 0), ...makeRow(bottom, 6)];
  return panels.length === 12 ? panels : null;
}
async function rectifyAnnual(file: File) {
  const bitmap = await createImageBitmap(file),
    ratio = Math.min(1, 2800 / bitmap.width, 1800 / bitmap.height),
    width = Math.max(1, Math.round(bitmap.width * ratio)),
    height = Math.max(1, Math.round(bitmap.height * ratio)),
    source = document.createElement("canvas");
  source.width = width;
  source.height = height;
  const ctx = source.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const pixels = ctx.getImageData(0, 0, width, height).data,
    topPoints: Point[] = [],
    bottomPoints: Point[] = [],
    leftPoints: Point[] = [],
    rightPoints: Point[] = [];
  const horizontalBorders: { y: number; start: number; length: number }[] = [];
  for (let y = 0; y < height; y++) {
    const run = longestDarkRun(pixels, width, y);
    if (run.length >= width * 0.65) horizontalBorders.push({ y, ...run });
  }
  if (horizontalBorders.length >= 2) {
    const topBorder = horizontalBorders[0],
      bottomBorder = horizontalBorders[horizontalBorders.length - 1],
      left = Math.round((topBorder.start + bottomBorder.start) / 2),
      right = Math.round(
        (topBorder.start +
          topBorder.length -
          1 +
          (bottomBorder.start + bottomBorder.length - 1)) /
          2,
      );
    if (
      bottomBorder.y - topBorder.y > height * 0.28 &&
      right - left > width * 0.65
    ) {
      const output = document.createElement("canvas"),
        outputWidth = Math.max(
          807,
          Math.min(2421, Math.round((right - left + 1) * 1.05)),
        );
      output.width = outputWidth;
      output.height = Math.round((outputWidth * 367) / 807);
      const out = output.getContext("2d", { willReadFrequently: true });
      if (!out) return null;
      out.drawImage(
        source,
        left,
        topBorder.y,
        right - left + 1,
        bottomBorder.y - topBorder.y + 1,
        0,
        0,
        output.width,
        output.height,
      );
      return output;
    }
  }
  for (let x = Math.floor(width * 0.04); x < Math.ceil(width * 0.96); x += 4) {
    let bestTop = -Infinity,
      topY = 0,
      bestBottom = -Infinity,
      bottomY = height - 1;
    for (let y = 6; y < Math.max(7, Math.floor(height * 0.11)); y++) {
      const before =
          (averageLuma(pixels, width, x, y - 5) +
            averageLuma(pixels, width, x, y - 4) +
            averageLuma(pixels, width, x, y - 3)) /
          3,
        center =
          (averageLuma(pixels, width, x, y) +
            averageLuma(pixels, width, x, y + 1)) /
          2,
        after =
          (averageLuma(pixels, width, x, y + 3) +
            averageLuma(pixels, width, x, y + 4) +
            averageLuma(pixels, width, x, y + 5)) /
          3,
        score = (before + after) / 2 - center;
      if (score > bestTop) {
        bestTop = score;
        topY = y;
      }
    }
    for (let y = Math.floor(height * 0.84); y < height - 6; y++) {
      const before =
          (averageLuma(pixels, width, x, y - 5) +
            averageLuma(pixels, width, x, y - 4) +
            averageLuma(pixels, width, x, y - 3)) /
          3,
        after =
          (averageLuma(pixels, width, x, y + 3) +
            averageLuma(pixels, width, x, y + 4) +
            averageLuma(pixels, width, x, y + 5)) /
          3,
        score = before - after;
      if (score > bestBottom) {
        bestBottom = score;
        bottomY = y;
      }
    }
    if (bestTop > 45) topPoints.push({ x, y: topY });
    if (bestBottom > 45) bottomPoints.push({ x, y: bottomY });
  }
  for (let y = 0; y < height; y++) {
    let left = -1,
      right = -1,
      run = 0;
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4,
        bright = pixels[p] + pixels[p + 1] + pixels[p + 2] > 330;
      if (bright) {
        run++;
        if (run === 5 && left < 0) left = x - 4;
      } else run = 0;
    }
    run = 0;
    for (let x = width - 1; x >= 0; x--) {
      const p = (y * width + x) * 4,
        bright = pixels[p] + pixels[p + 1] + pixels[p + 2] > 330;
      if (bright) {
        run++;
        if (run === 5) {
          right = x + 4;
          break;
        }
      } else run = 0;
    }
    if (left >= 0 && right - left > width * 0.72) {
      leftPoints.push({ x: left, y });
      rightPoints.push({ x: right, y });
    }
  }
  const top = fitLine(topPoints, "x"),
    bottom = fitLine(bottomPoints, "x"),
    left = fitLine(leftPoints, "y"),
    right = fitLine(rightPoints, "y");
  let tl: Point = { x: 0, y: 0 },
    tr: Point = { x: width - 1, y: 0 },
    bl: Point = { x: 0, y: height - 1 },
    br: Point = { x: width - 1, y: height - 1 };
  if (top && bottom && left && right) {
    const candidate = [
      lineIntersection(top, left),
      lineIntersection(top, right),
      lineIntersection(bottom, left),
      lineIntersection(bottom, right),
    ];
    if (
      candidate.every(
        (p) =>
          Number.isFinite(p.x) &&
          Number.isFinite(p.y) &&
          p.x >= -width * 0.08 &&
          p.x <= width * 1.08 &&
          p.y >= -height * 0.08 &&
          p.y <= height * 1.08,
      )
    )
      [tl, tr, bl, br] = candidate;
  }
  const output = document.createElement("canvas"),
    outputWidth = Math.max(807, Math.min(2421, Math.round(width * 0.98)));
  output.width = outputWidth;
  output.height = Math.round((outputWidth * 367) / 807);
  const out = output.getContext("2d", { willReadFrequently: true });
  if (!out) return null;
  const sourceData = ctx.getImageData(0, 0, width, height),
    dest = out.createImageData(output.width, output.height);
  for (let y = 0; y < output.height; y++) {
    const v = y / (output.height - 1);
    for (let x = 0; x < output.width; x++) {
      const u = x / (output.width - 1),
        sx =
          (1 - v) * ((1 - u) * tl.x + u * tr.x) +
          v * ((1 - u) * bl.x + u * br.x),
        sy =
          (1 - v) * ((1 - u) * tl.y + u * tr.y) +
          v * ((1 - u) * bl.y + u * br.y),
        ix = Math.max(0, Math.min(width - 1, Math.round(sx))),
        iy = Math.max(0, Math.min(height - 1, Math.round(sy))),
        sp = (iy * width + ix) * 4,
        dp = (y * output.width + x) * 4;
      dest.data[dp] = sourceData.data[sp];
      dest.data[dp + 1] = sourceData.data[sp + 1];
      dest.data[dp + 2] = sourceData.data[sp + 2];
      dest.data[dp + 3] = 255;
    }
  }
  out.putImageData(dest, 0, 0);
  return output;
}

function phaseStatus(year: number, month: number, day: number, phase: number) {
  const first = Date.UTC(year, 0, 1),
    current = Date.UTC(year, month - 1, day),
    elapsed = Math.round((current - first) / 86400000);
  return CYCLE_PATTERN[(((elapsed + phase) % 28) + 28) % 28];
}
function inferCyclePhase(year: number, source: Record<number, DayData[]>) {
  let bestPhase = 0,
    bestScore = -Infinity;
  for (let phase = 0; phase < 28; phase++) {
    let score = 0;
    for (let month = 1; month <= 12; month++)
      for (const d of source[month] || []) {
        const detected = baseOf(d.status),
          expected = phaseStatus(year, month, d.day, phase),
          confidence = d.confidence || 0,
          weight =
            (0.2 + confidence * confidence) * (detected === "AGCG" ? 0.7 : 1.6);
        if (detected === "REVISAR") continue;
        score += detected === expected ? weight : -weight;
      }
    if (score > bestScore) {
      bestScore = score;
      bestPhase = phase;
    }
  }
  return bestPhase;
}
function auditCycle(
  source: DayData[],
  year: number,
  month: number,
  phase: number,
) {
  return source.map((d) => {
    const detected = baseOf(d.status),
      expected = phaseStatus(year, month, d.day, phase);
    if (d.status === "REVISAR")
      return {
        ...d,
        baseStatus: expected,
        note: `Lectura indeterminada; el ciclo de 28 días sugiere ${expected}`,
      };
    if (detected === expected) return { ...d, note: "" };
    return {
      ...d,
      note: `Cambio visible respecto al ciclo de 28 días: se esperaba ${expected}`,
    };
  });
}

async function classifyAnnual(file: File, year: number) {
  let canvas = await loadAnnualCanvas(file);
  if (!canvas) return null;
  let panels = detectModernAnnualPanels(canvas, year) || detectStraightAnnualPanels(canvas, year);
  if (!panels) {
    canvas = await rectifyAnnual(file);
    if (!canvas) return null;
    panels = detectStraightAnnualPanels(canvas, year);
  }
  // Never silently apply a six-column coordinate template to an unknown layout.
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !panels) return null;
  const raw: Record<number, DayData[]> = {};
  for (let month = 1; month <= 12; month++) {
    const panel = panels[month - 1],
      cellW = panel.length / 7,
      cellH = panel.cellH,
      y0 = panel.gridTop + cellH * .5,
      statuses: { status: Status; confidence: number }[] = [];
    for (let day = 1; day <= daysInMonth(year, month); day++) {
      const index = weekdayMon(year, month, 1) + day - 1,
        col = index % 7,
        week = Math.floor(index / 7),
        cx = panel.x + cellW * (col + 0.5),
        cy = y0 + week * cellH,
        evidence = annualCellEvidence(ctx, cx, cy, cellW, cellH, canvas);
      statuses.push(evidence);
    }
    raw[month] = makeDays(year, month).map((d, i) => ({
      ...d,
      status: statuses[i].status,
      baseStatus: baseOf(statuses[i].status),
      confidence: statuses[i].confidence,
    }));
  }
  const phase = inferCyclePhase(year, raw),
    result: YearPlan = {};
  let mismatches = 0;
  for (let month = 1; month <= 12; month++) {
    const audited = auditCycle(raw[month], year, month, phase);
    mismatches += audited.filter((d) => d.note).length;
    const recognized = copyRecognizedDays(audited);
    result[month] = {
      original: recognized.map((d) => ({ ...d })),
      days: recognized.map((d) => ({ ...d })),
      confirmed: false,
    };
  }
  return { plan: result, phase, mismatches };
}

function repairStoredPlan(
  source: YearPlan,
  year: number,
  profile: UserProfile,
) {
  const repaired: YearPlan = {};
  for (let month = 1; month <= 12; month++) {
    const saved = source[month];
    if (!saved) continue;
    const correctedOriginal = copyRecognizedDays(
        normalizeDays(saved.original, year, month),
      ),
      current = normalizeDays(saved.days, year, month).map((d) => {
        const corrected = correctedOriginal.find((o) => o.day === d.day);
        if (!corrected) return d;
        const untouched =
          d.status === d.baseStatus &&
          !d.periodId &&
          d.special === "NINGUNA" &&
          !d.extraHours &&
          !d.manualEdited;
        return untouched
          ? { ...corrected }
          : {
              ...d,
              baseStatus: corrected.baseStatus,
              officialHoliday: false,
            };
      });
    repaired[month] = { ...saved, original: correctedOriginal, days: current };
  }
  return repaired;
}

function previousYearCreditMinutes(
  plan: YearPlan,
  sourceYear: number,
  profile: UserProfile,
) {
  let total = 0;
  for (let month = 1; month <= 12; month++) {
    const days = plan[month]?.days || [];
    for (const d of days)
      if (d.status === "COMPUTO_ANTERIOR")
        total += calcDay(d, days, sourceYear, month, profile).creditedMinutes;
  }
  return total;
}
function storedPreviousYearCreditMinutes(
  sourceYear: number,
  profile: UserProfile,
) {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(`metro-year-${sourceYear}`);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as YearPlan,
      normalized: YearPlan = {};
    for (let month = 1; month <= 12; month++) {
      const saved = parsed[month];
      if (saved)
        normalized[month] = {
          ...saved,
          original: normalizeDays(saved.original || [], sourceYear, month),
          days: normalizeDays(saved.days || [], sourceYear, month),
        };
    }
    return previousYearCreditMinutes(normalized, sourceYear, profile);
  } catch {
    return 0;
  }
}

function storedFollowingYearVacationUse(sourceYear: number) {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(`metro-year-${sourceYear + 1}`);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as YearPlan;
    return Object.values(parsed).reduce(
      (total, saved) =>
        total +
        (saved?.days || []).filter(
          (d) =>
            d.status === "VAC_ANTERIOR" &&
            (d.priorOrigin || "VACACIONES") === "VACACIONES",
        ).length,
      0,
    );
  } catch {
    return 0;
  }
}

export default function Home() {
  const [year, setYear] = useState(INITIAL_YEAR),
    [month, setMonth] = useState(1),
    [plan, setPlan] = useState<YearPlan>({}),
    [days, setDays] = useState<DayData[]>(() => makeDays(INITIAL_YEAR, 1));
  const [officialRevision, setOfficialRevision] = useState(0);
  const [calendarStatus, setCalendarStatus] = useState("Cargando calendario oficial…");
  const [calendarRetry, setCalendarRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setCalendarStatus(`Cargando calendario oficial ${year}…`);
    const sourceYears = [year];
    // Only load an adjacent year if saved credited work actually needs its rules.
    try {
      const following = JSON.parse(localStorage.getItem(`metro-year-${year + 1}`) || "{}");
      if (Object.values(following).some((p: any) => p.days?.some((d: DayData) => d.status === "COMPUTO_ANTERIOR"))) sourceYears.push(year + 1);
    } catch { /* Invalid personal storage is handled by the existing plan loader. */ }
    Promise.all(sourceYears.map(y => officialCalendar.load(y))).then(calendars => {
      if (cancelled) return;
      const missing = calendars.flatMap(c => [...c].filter(([, code]) => code === null).map(([date]) => date));
      setCalendarStatus(missing.length
        ? `Calendario oficial cargado. Categoría no disponible: ${missing.join(", ")}. Solo quedan pendientes los cálculos que necesiten esas categorías.`
        : `Calendario oficial ${year} cargado y disponible en esta sesión.`);
      setOfficialRevision(v => v + 1);
    }).catch(() => {
      if (cancelled) return;
      setOfficialRevision(v => v + 1);
      setCalendarStatus("No se ha podido cargar el calendario oficial. El reconocimiento de colores sigue disponible; las jornadas sin categoría y sus totales quedan pendientes. Reintenta la carga.");
    });
    return () => { cancelled = true; };
  }, [year, calendarRetry]);
  const [screen, setScreen] = useState<"year" | "month">("year"),
    [uploadMode, setUploadMode] = useState<"annual" | "monthly">("annual");
  const [annualFile, setAnnualFile] = useState<File | null>(null),
    [annualPreview, setAnnualPreview] = useState(""),
    [monthlyFile, setMonthlyFile] = useState<File | null>(null),
    [monthlyPreview, setMonthlyPreview] = useState("");
  const [progress, setProgress] = useState(0),
    [busy, setBusy] = useState(false),
    [detectorVersion, setDetectorVersion] = useState(0),
    [message, setMessage] = useState(
      "Sube el calendario anual para crear la previsión completa.",
    );
  const [selected, setSelected] = useState<DayData | null>(null),
    [periodKind, setPeriodKind] = useState<PeriodKind>("VACACIONES"),
    [periodStart, setPeriodStart] = useState(""),
    [periodEnd, setPeriodEnd] = useState(""),
    [priorOrigin, setPriorOrigin] = useState<PriorOrigin>("VACACIONES");
  const [periods, setPeriods] = useState<PeriodRecord[]>([]),
    [priorEntitlement, setPriorEntitlement] = useState(0),
    [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE),
    [profileDraft, setProfileDraft] = useState<UserProfile>(DEFAULT_PROFILE),
    [profileOpen, setProfileOpen] = useState(true),
    [profileLoaded, setProfileLoaded] = useState(false);
  function loadYear(y: number) {
    setYear(y);
    setEditingPeriodId(null);
    setPeriodStart("");
    setPeriodEnd("");
    try {
      setPeriods(
        JSON.parse(localStorage.getItem(`metro-periods-${y}`) || "[]"),
      );
      setPriorEntitlement(
        Math.max(0, Number(localStorage.getItem(`metro-prior-${y}`) || 0)),
      );
    } catch {
      setPeriods([]);
      setPriorEntitlement(0);
    }
    const raw = localStorage.getItem(`metro-year-${y}`);
    if (raw)
      try {
        const savedDetectorVersion = Math.max(
            0,
            Number(localStorage.getItem(`metro-detector-version-${y}`) || 0),
          ),
          detectorIsCurrent =
            savedDetectorVersion === ANNUAL_DETECTOR_VERSION,
          parsed = JSON.parse(raw) as YearPlan,
          storedProfile = JSON.parse(
            localStorage.getItem("metro-profile-v2") ||
              localStorage.getItem("metro-profile-v1") ||
              "null",
          ) as UserProfile | null,
          activeProfile =
            storedProfile && storedProfile.contract in CONTRACT_LABELS
              ? { ...DEFAULT_PROFILE, ...storedProfile }
              : profile,
          normalized = repairStoredPlan(parsed, y, activeProfile);
        localStorage.setItem(`metro-year-${y}`, JSON.stringify(normalized));
        setDetectorVersion(savedDetectorVersion);
        setPlan(normalized);
        setDays(normalized[month]?.days || makeDays(y, month));
        setMessage(
          Object.keys(normalized).length
            ? detectorIsCurrent
              ? `Previsión anual recuperada · detector v${ANNUAL_DETECTOR_VERSION}.`
              : "Este año se analizó con un detector anterior. Vuelve a subir el calendario anual y pulsa Crear previsión."
            : "Sube el calendario anual para crear la previsión completa.",
        );
        return;
      } catch {}
    setDetectorVersion(0);
    setPlan({});
    setDays(makeDays(y, month));
    setMessage("Sube el calendario anual para crear la previsión completa.");
  }
  // La carga inicial se ejecuta una sola vez; después se usa el selector de año.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadYear(INITIAL_YEAR);
    try {
      const stored = localStorage.getItem("metro-profile-v2"),
        previous = localStorage.getItem("metro-profile-v1");
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<UserProfile>,
          valid = !!parsed.contract && parsed.contract in CONTRACT_LABELS,
          next = {
            ...DEFAULT_PROFILE,
            ...parsed,
            contract: valid ? parsed.contract : DEFAULT_PROFILE.contract,
          } as UserProfile;
        setProfile(next);
        setProfileDraft(next);
        setProfileOpen(!valid);
      } else if (previous) {
        const parsed = JSON.parse(previous) as Partial<UserProfile>,
          valid = !!parsed.contract && parsed.contract in CONTRACT_LABELS,
          next = {
            ...DEFAULT_PROFILE,
            ...parsed,
            contract: valid ? parsed.contract : DEFAULT_PROFILE.contract,
          } as UserProfile;
        setProfile(next);
        setProfileDraft(next);
        setProfileOpen(true);
      }
    } catch {
    } finally {
      setProfileLoaded(true);
    }
  }, []);
  useEffect(
    () => () => {
      if (annualPreview) URL.revokeObjectURL(annualPreview);
    },
    [annualPreview],
  );
  useEffect(
    () => () => {
      if (monthlyPreview) URL.revokeObjectURL(monthlyPreview);
    },
    [monthlyPreview],
  );
  function persist(next: YearPlan) {
    setPlan(next);
    localStorage.setItem(`metro-year-${year}`, JSON.stringify(next));
  }
  function persistPeriods(next: PeriodRecord[]) {
    setPeriods(next);
    localStorage.setItem(`metro-periods-${year}`, JSON.stringify(next));
  }
  function savePriorEntitlement(value: number) {
    const next = Math.max(0, Math.floor(value || 0));
    setPriorEntitlement(next);
    localStorage.setItem(`metro-prior-${year}`, String(next));
  }
  function saveProfile() {
    const name = profileDraft.name.trim(),
      employeeNumber = profileDraft.employeeNumber.trim();
    if (!name || !employeeNumber) return;
    const next: UserProfile = {
      ...profileDraft,
      name,
      employeeNumber,
      ...(profileDraft.contract === "75"
        ? { subturn: profileDraft.subturn || "T8.1" }
        : { subturn: undefined }),
    };
    setProfile(next);
    setProfileDraft(next);
    localStorage.setItem("metro-profile-v1", JSON.stringify(next));
    localStorage.setItem("metro-profile-v2", JSON.stringify(next));
    setProfileOpen(false);
  }
  function editProfile() {
    setProfileDraft(profile);
    setProfileOpen(true);
  }
  function withoutPeriod(source: YearPlan, id: string) {
    const next: YearPlan = { ...source };
    for (let m = 1; m <= 12; m++) {
      if (!next[m]) continue;
      next[m] = {
        ...next[m],
        days: next[m].days.map((d) => {
          if (d.periodId !== id) return d;
          const original = next[m].original.find((o) => o.day === d.day);
          return original ? { ...original } : d;
        }),
      };
    }
    return next;
  }
  function chooseAnnual(f: File) {
    if (annualPreview) URL.revokeObjectURL(annualPreview);
    setAnnualFile(f);
    setAnnualPreview(URL.createObjectURL(f));
    setMessage("Calendario anual preparado. Pulsa Crear previsión.");
  }
  function chooseMonthly(f: File) {
    if (monthlyPreview) URL.revokeObjectURL(monthlyPreview);
    setMonthlyFile(f);
    setMonthlyPreview(URL.createObjectURL(f));
    setMessage("Captura mensual preparada. Pulsa Analizar mes.");
  }
  function openMonth(m: number) {
    setMonth(m);
    setDays(plan[m]?.days || makeDays(year, m));
    setScreen("month");
  }
  function commitMonth(nextDays: DayData[]) {
    const existing = plan[month] || {
        original: nextDays.map((d) => ({ ...d })),
        days: nextDays,
        confirmed: false,
      },
      next = { ...plan, [month]: { ...existing, days: nextDays } };
    persist(next);
    setDays(nextDays);
  }
  async function analyzeYear() {
    if (!annualFile) {
      setMessage("Primero selecciona el calendario anual.");
      return;
    }
    setBusy(true);
    setProgress(12);
    setMessage("Leyendo los doce meses…");
    try {
      // The annual request is shared with the screen loader, never per cell.
      await officialCalendar.load(year).catch(() => undefined);
      const found = await classifyAnnual(annualFile, year);
      if (!found) throw new Error();
      setCalendarRetry(v => v + 1);
      setProgress(100);
      persist(found.plan);
      persistPeriods([]);
      localStorage.setItem(
        `metro-detector-version-${year}`,
        String(ANNUAL_DETECTOR_VERSION),
      );
      setDetectorVersion(ANNUAL_DETECTOR_VERSION);
      localStorage.setItem(
        `metro-cycle-phase-${year}-${profile.fiestaLetter}`,
        String(found.phase),
      );
      setDays(found.plan[1].days);
      setMonth(1);
      const total = Object.values(found.plan).reduce(
        (n, m) => n + m.days.length,
        0,
      );
      setMessage(
        found.mismatches
          ? `Detector v${ANNUAL_DETECTOR_VERSION} · Previsión de ${year} creada: ${total} días reconocidos y ${found.mismatches} diferencias visibles respecto al ciclo de 28 días.`
          : `Detector v${ANNUAL_DETECTOR_VERSION} · Previsión de ${year} creada: ${total} días reconocidos y ciclo de 28 días verificado sin diferencias.`,
      );
    } catch {
      setMessage(
        "No he podido localizar con seguridad los doce calendarios. Comprueba que sea la captura anual completa de TMB.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function analyzeMonth() {
    if (!monthlyFile) {
      setMessage("Primero selecciona una captura mensual.");
      return;
    }
    setBusy(true);
    setProgress(15);
    setMessage("Comprobando el mes…");
    try {
      await officialCalendar.load(year).catch(() => undefined);
      const found = await classifyMonthly(monthlyFile, year, month);
      if (!found) throw new Error();
      const read = makeDays(year, month).map((d) => {
          const status = found.get(d.day) || "REVISAR";
          return { ...d, status, baseStatus: baseOf(status) };
        }),
        storedPhase = Number(
          localStorage.getItem(
            `metro-cycle-phase-${year}-${profile.fiestaLetter}`,
          ) ?? localStorage.getItem(`metro-cycle-phase-${year}`),
        ),
        phase =
          Number.isInteger(storedPhase) && storedPhase >= 0 && storedPhase < 28
            ? storedPhase
            : undefined,
        cycled = applyCycleValidation(read, year, month, phase),
        next = copyRecognizedDays(cycled),
        existing = plan[month];
      persist({
        ...plan,
        [month]: {
          original: existing?.original || next.map((d) => ({ ...d })),
          days: next,
          confirmed: existing?.confirmed || false,
        },
      });
      setDays(next);
      setCalendarRetry(v => v + 1);
      setProgress(100);
      setMessage(
        `${next.length} días reconocidos. ${next.filter((d) => needsReview(d.status)).length} pendientes.`,
      );
    } catch {
      setMessage("No he podido analizar la captura mensual.");
    } finally {
      setBusy(false);
    }
  }
  function applyPeriod() {
    const start = new Date(`${periodStart}T12:00:00`),
      end = new Date(`${periodEnd}T12:00:00`);
    if (
      !periodStart ||
      !periodEnd ||
      start > end ||
      start.getFullYear() !== year ||
      end.getFullYear() !== year
    ) {
      setMessage(`Indica un intervalo válido dentro de ${year}.`);
      return;
    }
    let applied = 0,
      miniLaudoAssigned = false;
    const storedPhase = Number(
        localStorage.getItem(
          `metro-cycle-phase-${year}-${profile.fiestaLetter}`,
        ) ?? localStorage.getItem(`metro-cycle-phase-${year}`),
      ),
      cyclePhase =
        Number.isInteger(storedPhase) && storedPhase >= 0 && storedPhase < 28
          ? storedPhase
          : undefined;
    const id = editingPeriodId || `period-${Date.now()}`,
      next: YearPlan = editingPeriodId
        ? withoutPeriod(plan, editingPeriodId)
        : { ...plan };
    for (let m = 1; m <= 12; m++) {
      if (!next[m]) continue;
      const changed = next[m].days.map((d) => {
        const date = new Date(year, m - 1, d.day, 12),
          cycleBase =
            cyclePhase !== undefined
              ? phaseStatus(year, m, d.day, cyclePhase)
              : d.baseStatus,
          underlyingWorkday =
            d.baseStatus === "AGCG" ||
            (d.status === "REVISAR" && cycleBase === "AGCG"),
          sameDetectedPeriod =
            periodKind === "VACACIONES"
              ? d.status === "VACACIONES" ||
                d.status === "VACACIONES_PENDIENTES"
              : periodKind === "MINI"
                ? d.status === "MINI" || d.status === "LAUDO"
                : d.status === "VAC_ANTERIOR" ||
                  d.status === "VACACIONES_PENDIENTES",
          available =
            d.status === "AGCG" || d.status === "REVISAR" || sameDetectedPeriod;
        if (
          date >= start &&
          date <= end &&
          underlyingWorkday &&
          !d.periodId &&
          available
        ) {
          applied++;
          let status: Status = periodKind;
          if (periodKind === "MINI") {
            status =
              d.status === "LAUDO" || !miniLaudoAssigned ? "LAUDO" : "MINI";
            if (status === "LAUDO") miniLaudoAssigned = true;
          }
          const note =
            periodKind === "MINI"
              ? status === "LAUDO"
                ? "Laudo ligado al miniperiodo"
                : "Miniperiodo"
              : periodKind === "VAC_ANTERIOR"
                ? priorOriginLabel[priorOrigin]
                : "Vacaciones";
          return {
            ...d,
            baseStatus: "AGCG",
            status,
            note,
            periodId: id,
            priorOrigin:
              periodKind === "VAC_ANTERIOR" ? priorOrigin : undefined,
            special: "NINGUNA" as Special,
            extraHours: 0,
          };
        }
        return d;
      });
      next[m] = { ...next[m], days: changed };
    }
    if (!applied) {
      setMessage(
        "El periodo no contiene días laborables disponibles para asignar.",
      );
      return;
    }
    const record: PeriodRecord = {
      id,
      kind: periodKind,
      start: periodStart,
      end: periodEnd,
      ...(periodKind === "VAC_ANTERIOR" ? { priorOrigin } : {}),
    };
    persist(next);
    persistPeriods(
      editingPeriodId
        ? periods.map((p) => (p.id === editingPeriodId ? record : p))
        : [...periods, record],
    );
    if (next[month]) setDays(next[month].days);
    setPeriodStart("");
    setPeriodEnd("");
    setEditingPeriodId(null);
    setMessage(
      `${statusLabel[periodKind]} registrado en ${applied} días laborables. Los DCOM y FEST originales se conservan.`,
    );
  }
  function editPeriod(record: PeriodRecord) {
    setEditingPeriodId(record.id);
    setPeriodKind(record.kind);
    setPeriodStart(record.start);
    setPeriodEnd(record.end);
    if (record.priorOrigin) setPriorOrigin(record.priorOrigin);
    setMessage(
      "Periodo cargado para editar. Ajusta los datos y pulsa Actualizar periodo.",
    );
  }
  function removePeriod(id: string) {
    const next = withoutPeriod(plan, id);
    persist(next);
    persistPeriods(periods.filter((p) => p.id !== id));
    if (next[month]) setDays(next[month].days);
    if (editingPeriodId === id) {
      setEditingPeriodId(null);
      setPeriodStart("");
      setPeriodEnd("");
    }
    setMessage(
      "Periodo eliminado y sus días restaurados a la planificación original.",
    );
  }
  function updateSelected() {
    if (!selected) return;
    commitMonth(
      days.map((d) =>
        d.day === selected.day
          ? { ...selected, periodId: undefined, manualEdited: true }
          : d,
      ),
    );
    setSelected(null);
    setMessage(
      "Corrección aplicada. La previsión mensual y anual se ha actualizado.",
    );
  }
  function restoreSelected() {
    if (!selected || !plan[month]) return;
    const original = plan[month].original.find((d) => d.day === selected.day);
    if (original) {
      commitMonth(
        days.map((d) =>
          d.day === selected.day ? { ...original, manualEdited: false } : d,
        ),
      );
      setSelected(null);
      setMessage("Día restaurado a la planificación anual original.");
    }
  }
  function toggleConfirmed(m: number) {
    if (!plan[m]) return;
    const next = {
      ...plan,
      [m]: { ...plan[m], confirmed: !plan[m].confirmed },
    };
    persist(next);
    if (m === month) setDays(next[m].days);
  }
  function resetYear() {
    setPlan({});
    setPeriods([]);
    setPriorEntitlement(0);
    setEditingPeriodId(null);
    setPeriodStart("");
    setPeriodEnd("");
    setDays(makeDays(year, month));
    localStorage.removeItem(`metro-year-${year}`);
    localStorage.removeItem(`metro-periods-${year}`);
    localStorage.removeItem(`metro-prior-${year}`);
    localStorage.removeItem(`metro-detector-version-${year}`);
    localStorage.removeItem(`metro-cycle-phase-${year}`);
    localStorage.removeItem(
      `metro-cycle-phase-${year}-${profile.fiestaLetter}`,
    );
    setDetectorVersion(0);
    setMessage(
      "Previsión anual vaciada. Puedes volver a importar el calendario.",
    );
  }

  const calculations = useMemo(
      () => days.map((d) => ({ d, c: calcDay(d, days, year, month, profile) })),
      [days, year, month, profile, officialRevision],
    ),
    monthTotal = totalFor(days, year, month, profile),
    currentMonthOrdinaryHours = ordinaryHoursFor(
      days,
      year,
      month,
      profile,
    ),
    currentMonthNightHours = nightHoursFor(days, year, month, profile),
    currentMonthHoraNona = primaHoraNonaFor(days, year, month, profile),
    currentMonthSpecialRetributiveDays = specialRetributiveDaysCount(
      year,
      month,
    ),
    currentMonthPlusFestiu = plusFestiuCount(days, year, month),
    currentMonthPlusConvenio = plusConvenioCount(days),
    first = weekdayMon(year, month, 1),
    review = days.filter((d) => needsReview(d.status) || (isWorking(d.status) && !officialCategory(year, month, d.day))).length,
    worked = days.filter((d) => isWorking(d.status)).length;
  const monthTotals = useMemo(
    () =>
      Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => {
          const m = i + 1;
          return [m, plan[m] ? totalFor(plan[m].days, year, m, profile) : 0];
        }),
      ),
    [plan, year, profile, officialRevision],
  );
  const monthOrdinaryHoursByMonth = useMemo(
      () =>
        Object.fromEntries(
          Array.from({ length: 12 }, (_, i) => {
            const m = i + 1,
              p = plan[m];
            return [
              m,
              p ? ordinaryHoursFor(p.days, year, m, profile) : 0,
            ];
          }),
        ),
      [plan, year, profile, officialRevision],
    ),
    monthNightHoursByMonth = useMemo(
      () =>
        Object.fromEntries(
          Array.from({ length: 12 }, (_, i) => {
            const m = i + 1,
              p = plan[m];
            return [
              m,
              p ? nightHoursFor(p.days, year, m, profile) : 0,
            ];
          }),
        ),
      [plan, year, profile, officialRevision],
    ),
    monthPlusFestiuByMonth = useMemo(
      () =>
        Object.fromEntries(
          Array.from({ length: 12 }, (_, i) => {
            const m = i + 1,
              p = plan[m];
            return [m, p ? plusFestiuCount(p.days, year, m) : 0];
          }),
        ),
      [plan, year],
    );
  const allCurrentDays = Object.values(plan).flatMap((p) => p.days),
    allDayEntries = Object.entries(plan).flatMap(([m, p]) =>
      p.days.map((d) => ({
        month: +m,
        day: d,
        original: p.original.find((o) => o.day === d.day),
      })),
    );
  const vacationDays = allDayEntries.filter(
      (e) => e.day.status === "VACACIONES",
    ).length,
    followingYearVacationUse = storedFollowingYearVacationUse(year),
    vacationSatisfiedDays = Math.min(
      22,
      vacationDays + followingYearVacationUse,
    ),
    vacationOwed = vacationSatisfiedDays
      ? Math.max(0, 22 - vacationSatisfiedDays)
      : 0;
  const annualBase = Number(
      Object.values(monthTotals)
        .reduce((a: number, b: any) => a + Number(b), 0)
        .toFixed(2),
    ),
    outgoingPreviousCreditMinutes = previousYearCreditMinutes(
      plan,
      year,
      profile,
    ),
    incomingPreviousCreditMinutes = useMemo(
      () => storedPreviousYearCreditMinutes(year + 1, profile),
      [year, plan, profile, officialRevision],
    ),
    incomingPreviousCredit = Number(
      (incomingPreviousCreditMinutes / 60).toFixed(2),
    ),
    annual = Number((annualBase + incomingPreviousCredit).toFixed(2)),
    annualOrdinaryHours = Number(
      Object.values(monthOrdinaryHoursByMonth)
        .reduce((a: number, b: any) => a + Number(b), 0)
        .toFixed(2),
    ),
    annualNightHours = Number(
      Object.values(monthNightHoursByMonth)
        .reduce((a: number, b: any) => a + Number(b), 0)
        .toFixed(2),
    ),
    annualPlusFestiu = Object.values(monthPlusFestiuByMonth).reduce(
      (a: number, b: any) => a + Number(b),
      0,
    ),
    annualWorkdays = ANNUAL_WORKDAYS[year],
    annualTheoreticalHours = theoreticalHours(year, profile),
    priorUsed = allCurrentDays.filter(
      (d) => d.status === "VAC_ANTERIOR",
    ).length,
    priorRemaining = Math.max(0, priorEntitlement - priorUsed),
    confirmed = Object.values(plan).filter((p) => p.confirmed).length,
    planReady = Object.keys(plan).length === 12,
    detectorIsCurrent =
      planReady && detectorVersion === ANNUAL_DETECTOR_VERSION;
  const weeks = useMemo(() => {
    const out: { label: string; total: number }[] = [];
    for (let start = 1 - first; start <= days.length; start += 7) {
      const nums = Array.from({ length: 7 }, (_, i) => start + i).filter(
        (n) => n >= 1 && n <= days.length,
      );
      out.push({
        label: `${Math.min(...nums)}–${Math.max(...nums)} ${MONTHS[month - 1].slice(0, 3).toLowerCase()}.`,
        total: nums.reduce(
          (a, n) => a + (calculations.find((x) => x.d.day === n)?.c.value ?? 0),
          0,
        ),
      });
    }
    return out;
  }, [calculations, days.length, first, month]);

  if (!profileLoaded) return <main className="min-h-screen bg-[#07151b]" />;
  return (
    <main className="min-h-screen bg-[#07151b] text-[#eaf6f5]">
      <div className="rail-line" />
      <header className="border-b border-white/10 bg-[#0a1d25]/92 px-4 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="logo-mark shrink-0">
              <TrainFront size={23} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#71d7cc]">
                Ciclo {profile.fiestaLetter} · {" "}
                {profileLabel(profile)}
                {!isFullTime(profile) && profile.contract === "75" && profile.subturn
                  ? ` · ${profile.subturn}`
                  : ""}
              </p>
              <h1 className="text-base font-bold tracking-tight sm:text-lg lg:text-xl">
                Cómputo AAC{" "}
                <span className="text-[#eeb64b]">
                  {profile.name} - {profile.employeeNumber}
                </span>
              </h1>
            </div>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="profile-button"
              aria-label="Perfil"
              onClick={editProfile}
            >
              <UserRound size={15} />
              <span className="hidden sm:inline">Perfil</span>
            </Button>
            <Badge className="border border-[#71d7cc]/35 bg-[#71d7cc]/10 px-3 py-1.5 text-[#8ee9df]">
              <LockKeyhole size={13} /> Privado
            </Badge>
            <Badge className="border border-white/15 bg-white/5 px-3 py-1.5 text-white/70">
              {annualWorkdays
                ? `${annualWorkdays} días · ${year}`
                : `Días por definir · ${year}`}
            </Badge>
            <div className="annual-hours" aria-label={`Horas anuales de ${year}`}>
              <span>
                Teóricas · {profileLabel(profile)}: <b>{annualTheoreticalHours === undefined ? "por confirmar" : formatHours(annualTheoreticalHours)}</b>
              </span>
              <span title="Suma de Horas ordinarias de los meses cargados, incluidos los futuros.">
                Horas previstas · calendario {year}: <b>{Object.keys(plan).length ? formatHours(annualOrdinaryHours) : "sin calendario"}</b>
                {Object.keys(plan).length > 0 && (!planReady || allCurrentDays.some((d) => needsReview(d.status))) && " · provisional"}
              </span>
            </div>
          </div>
        </div>
      </header>
      <div role="status" className="mx-auto max-w-[1500px] px-4 pt-4 text-sm text-amber-200 md:px-8">
        {calendarStatus}
        <Button variant="ghost" onClick={() => setCalendarRetry(v => v + 1)}>Reintentar calendario oficial</Button>
      </div>
      {isFullTime(profile) && <p className="mx-auto max-w-[1500px] px-4 pt-4 text-sm text-amber-200 md:px-8">Tiempo completo · previsión de horarios. Cómputo y conceptos retributivos pendientes de validar.{["T1", "T2"].includes(profileTurn(profile)) && " Sábados y non stop: horario histórico por confirmar."}</p>}
      <div className="mx-auto max-w-[1500px] px-4 pt-5 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-xl border border-white/10 bg-[#0b2029] p-1">
            <Button
              size="sm"
              variant={screen === "year" ? "default" : "ghost"}
              onClick={() => setScreen("year")}
            >
              <CalendarRange size={16} />
              Previsión anual
            </Button>
            <Button
              size="sm"
              variant={screen === "month" ? "default" : "ghost"}
              onClick={() => setScreen("month")}
            >
              <CalendarDays size={16} />
              Detalle mensual
            </Button>
          </div>
          <div className="year-selector" aria-label="Seleccionar año">
            <span>Año</span>
            <Button
              size="icon"
              variant="ghost"
              disabled={year <= 2000}
              onClick={() => loadYear(year - 1)}
              aria-label="Año anterior"
            >
              <ChevronLeft size={24} strokeWidth={3.5} />
            </Button>
            <b>{year}</b>
            <Button
              size="icon"
              variant="ghost"
              disabled={year >= 2035}
              onClick={() => loadYear(year + 1)}
              aria-label="Año siguiente"
            >
              <ChevronRight size={24} strokeWidth={3.5} />
            </Button>
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:grid-cols-[280px_minmax(0,1fr)] md:grid-cols-[320px_minmax(0,1fr)] md:px-8 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="panel p-5">
            <Tabs
              value={uploadMode}
              onValueChange={(v) => setUploadMode(v as "annual" | "monthly")}
            >
              <TabsList className="mb-4 w-full bg-[#0b2029]">
                <TabsTrigger className="flex-1" value="annual">
                  Calendario anual
                </TabsTrigger>
                <TabsTrigger className="flex-1" value="monthly">
                  Comprobar mes
                </TabsTrigger>
              </TabsList>
              <TabsContent value="annual">
                <UploadBox
                  preview={annualPreview}
                  title="Sube el calendario anual"
                  onFile={chooseAnnual}
                />
                {busy && <Progress value={progress} className="mt-4" />}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    onClick={analyzeYear}
                    disabled={busy}
                    className="bg-[#eeb64b] font-bold text-[#112128] hover:bg-[#ffd173]"
                  >
                    {busy ? "Analizando…" : "Crear previsión"}
                  </Button>
                  <Button variant="outline" onClick={resetYear}>
                    <RotateCcw size={16} />
                    Vaciar año
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="monthly">
                <UploadBox
                  preview={monthlyPreview}
                  title={`Captura de ${MONTHS[month - 1]}`}
                  onFile={chooseMonthly}
                />
                <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                  <Select
                    value={String(month)}
                    onValueChange={(v) => openMonth(+v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={m} value={String(i + 1)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={analyzeMonth}
                    disabled={busy}
                    className="bg-[#eeb64b] font-bold text-[#112128] hover:bg-[#ffd173]"
                  >
                    Analizar mes
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
            <div
              className={`status-note ${detectorIsCurrent ? "ok" : "warning"}`}
            >
              {detectorIsCurrent ? (
                <CheckCircle2 size={17} />
              ) : (
                <AlertTriangle size={17} />
              )}
              <span>{message}</span>
            </div>
          </section>
          <section className="panel p-5">
            <div className="mb-4 flex items-center gap-2">
              <CalendarRange className="text-[#71d7cc]" size={19} />
              <div>
                <h2 className="font-semibold">
                  {editingPeriodId ? "Editar periodo" : "Añadir periodo"}
                </h2>
                <p className="text-xs text-white/40">
                  Vacaciones, mini o días pendientes
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <Label>Tipo</Label>
                <Select
                  value={periodKind}
                  onValueChange={(v) => setPeriodKind(v as PeriodKind)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VACACIONES">Vacaciones</SelectItem>
                    <SelectItem value="MINI">Mini</SelectItem>
                    <SelectItem value="VAC_ANTERIOR">
                      Año/s anterior/es
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {periodKind === "VAC_ANTERIOR" && (
                <div>
                  <Label>Origen del día pendiente</Label>
                  <Select
                    value={priorOrigin}
                    onValueChange={(v) => setPriorOrigin(v as PriorOrigin)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorOriginLabel).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Desde</Label>
                  <Input
                    type="date"
                    min={`${year}-01-01`}
                    max={`${year}-12-31`}
                    value={periodStart}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPeriodStart(value);
                      if (!periodEnd || periodEnd < value) setPeriodEnd(value);
                    }}
                  />
                </div>
                <div>
                  <Label>Hasta</Label>
                  <Input
                    type="date"
                    min={periodStart || `${year}-01-01`}
                    max={`${year}-12-31`}
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>
              <Button
                className="w-full bg-[#28a99c] hover:bg-[#39beb0]"
                onClick={applyPeriod}
                disabled={!planReady}
              >
                {editingPeriodId
                  ? "Actualizar periodo"
                  : "Aplicar a días laborables"}
              </Button>
              {editingPeriodId && (
                <Button
                  variant="ghost"
                  className="w-full text-white/50"
                  onClick={() => {
                    setEditingPeriodId(null);
                    setPeriodStart("");
                    setPeriodEnd("");
                  }}
                >
                  Cancelar edición
                </Button>
              )}
              <p className="text-xs leading-5 text-white/35">
                Los descansos y fiestas originales permanecen intactos dentro
                del periodo.
              </p>
            </div>
            {periods.length > 0 && (
              <div className="mt-5 border-t border-white/8 pt-4">
                <p className="eyebrow mb-2">Periodos añadidos</p>
                <div className="space-y-2">
                  {periods.map((p) => {
                    const applied = allCurrentDays.filter(
                      (d) => d.periodId === p.id,
                    ).length;
                    return (
                      <div
                        className={`rounded-xl border bg-white/4 p-3 ${editingPeriodId === p.id ? "border-[#eeb64b]/45" : "border-white/8"}`}
                        key={p.id}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <b className="text-sm">{statusLabel[p.kind]}</b>
                            <p className="mt-1 text-xs text-white/45">
                              {p.start.split("-").reverse().join("/")} –{" "}
                              {p.end.split("-").reverse().join("/")}
                            </p>
                            {p.priorOrigin && (
                              <p className="mt-1 text-xs text-[#eeb64b]">
                                {priorOriginLabel[p.priorOrigin]}
                              </p>
                            )}
                          </div>
                          <div className="flex">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-white/40 hover:text-[#ffd173]"
                              onClick={() => editPeriod(p)}
                              aria-label={`Editar periodo ${statusLabel[p.kind]}`}
                            >
                              <PencilLine size={15} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-white/40 hover:text-[#ff8d7c]"
                              onClick={() => removePeriod(p.id)}
                              aria-label={`Eliminar periodo ${statusLabel[p.kind]}`}
                            >
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-[#8ee9df]">
                          {applied} días laborables asignados
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
          <section className="panel overflow-hidden">
            <div className="border-b border-white/8 p-5">
              <p className="eyebrow">Previsión cómputo anual</p>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <p className="text-4xl font-black tabular-nums">
                    {planReady ? balanceLabel(profile, annual) : "—"}
                  </p>
                  <p className="text-sm text-white/50">Total anual {year}</p>
                  {incomingPreviousCreditMinutes > 0 && (
                    <p className="mt-2 text-xs text-[#8ee9df]">
                      Incluye {balanceLabel(profile, incomingPreviousCredit)} compensado en{" "}
                      {year + 1}
                    </p>
                  )}
                  {outgoingPreviousCreditMinutes > 0 && (
                    <p className="mt-2 text-xs text-[#eeb64b]">
                      {balanceLabel(profile, 
                        Number((outgoingPreviousCreditMinutes / 60).toFixed(2)),
                      )}{" "}
                      aplicado a {year - 1}
                    </p>
                  )}
                </div>
                <div
                  className={`score-ring ${annual >= 0 ? "positive" : "negative"}`}
                >
                  {planReady && !isFullTime(profile) ? "✓" : "?"}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px bg-white/8">
              <Stat label="Meses confirmados" value={`${confirmed}/12`} />
              <Stat
                label="Vacaciones del año"
                value={
                  vacationSatisfiedDays
                    ? `${vacationSatisfiedDays}/22 · ${vacationOwed ? `Se te debe ${vacationOwed}` : "Completo"}${followingYearVacationUse ? ` · ${followingYearVacationUse} usados en ${year + 1}` : ""}`
                    : "Sin asignar"
                }
              />
              <Stat
                label="Años anteriores usados"
                value={`${priorUsed} días`}
              />
              <div className="bg-[#0c2028] p-4">
                <Label
                  htmlFor="prior-entitlement"
                  className="text-xs text-white/40"
                >
                  Pendientes al empezar
                </Label>
                <Input
                  id="prior-entitlement"
                  className="mt-2 h-8"
                  type="number"
                  min="0"
                  step="1"
                  value={priorEntitlement}
                  onChange={(e) => savePriorEntitlement(+e.target.value)}
                />
                <p className="mt-2 text-xs text-[#eeb64b]">
                  {priorEntitlement
                    ? `Quedan ${priorRemaining}`
                    : "Indica el saldo inicial"}
                </p>
              </div>
            </div>
          </section>
        </aside>
        <section className="panel min-w-0 overflow-hidden">
          {screen === "year" ? (
            <AnnualView
              year={year}
              profile={profile}
              plan={plan}
              monthTotals={monthTotals}
              monthNightHours={monthNightHoursByMonth}
              monthPlusFestiu={monthPlusFestiuByMonth}
              annualOrdinaryHours={annualOrdinaryHours}
              annualNightHours={annualNightHours}
              annualPlusFestiu={annualPlusFestiu}
              onOpen={openMonth}
              onConfirm={toggleConfirmed}
            />
          ) : (
            <MonthView
              year={year}
              month={month}
              profile={profile}
              days={days}
              calculations={calculations}
              first={first}
              weeks={weeks}
              monthTotal={monthTotal}
              monthOrdinaryHours={currentMonthOrdinaryHours}
              monthNightHours={currentMonthNightHours}
              monthHoraNona={currentMonthHoraNona}
              monthSpecialRetributiveDays={
                currentMonthSpecialRetributiveDays
              }
              monthPlusFestiu={currentMonthPlusFestiu}
              monthPlusConvenio={currentMonthPlusConvenio}
              review={review}
              worked={worked}
              onMonthChange={openMonth}
              onSelect={(d) => setSelected({ ...d })}
            />
          )}
        </section>
      </div>
      <Dialog
        open={profileOpen}
        onOpenChange={(open) => {
          if (!open && localStorage.getItem("metro-profile-v2"))
            setProfileOpen(false);
        }}
      >
        <DialogContent
          className="profile-dialog max-h-[92vh] overflow-y-auto border-white/10 bg-[#0d222b] text-white sm:max-w-2xl"
          onEscapeKeyDown={(e) => {
            if (!localStorage.getItem("metro-profile-v2")) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (!localStorage.getItem("metro-profile-v2")) e.preventDefault();
          }}
        >
          <DialogHeader>
            <div className="profile-dialog-icon">
              <TrainFront size={28} />
            </div>
            <DialogTitle className="text-2xl">
              Configura tu perfil AAC
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Estos datos personalizan tus previsiones y se guardan únicamente
              en este dispositivo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Turno de trabajo</Label>
              <div className="contract-options" role="group" aria-label="Turno de trabajo">
                {TURNS.map((turn) => <button type="button" key={turn} aria-pressed={profileTurn(profileDraft) === turn}
                  className={profileTurn(profileDraft) === turn ? "selected" : ""}
                  onClick={() => setProfileDraft({ ...profileDraft, turn })}>
                  <span>{turn}</span><small>{turn === "T8" ? "Tiempo parcial" : "Tiempo completo"}</small>
                </button>)}
              </div>
              {isFullTime(profileDraft) && <p className="mt-2 text-sm text-[#eeb64b]">
                100 % · {theoreticalHours(year, profileDraft) === undefined ? "Horas por confirmar" : formatHours(theoreticalHours(year, profileDraft)!)} en {year}.
                {profileTurn(profileDraft) === "T5" ? " Solo T5 normal; inversos no incluidos." : ""}
                {" "}Horario ordinario {FULL_TIME_SHIFTS[profileTurn(profileDraft) as keyof typeof FULL_TIME_SHIFTS].start}–{FULL_TIME_SHIFTS[profileTurn(profileDraft) as keyof typeof FULL_TIME_SHIFTS].end}.
                {" "}Cómputo y compensaciones pendientes de validar.
              </p>}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="profile-name">Nombre y apellidos</Label>
              <div className="profile-input">
                <UserRound size={17} />
                <Input
                  id="profile-name"
                  autoFocus
                  value={profileDraft.name}
                  onChange={(e) =>
                    setProfileDraft({ ...profileDraft, name: e.target.value })
                  }
                  placeholder="Nombre y apellidos"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="profile-employee">Número de empleado</Label>
              <div className="profile-input">
                <IdCard size={17} />
                <Input
                  id="profile-employee"
                  inputMode="numeric"
                  value={profileDraft.employeeNumber}
                  onChange={(e) =>
                    setProfileDraft({
                      ...profileDraft,
                      employeeNumber: e.target.value,
                    })
                  }
                  placeholder="Ej. 6099"
                />
              </div>
            </div>
            <div>
              <Label>Letra de fiesta</Label>
              <Select
                value={profileDraft.fiestaLetter}
                onValueChange={(value) =>
                  setProfileDraft({
                    ...profileDraft,
                    fiestaLetter: value as FiestaLetter,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["K", "M", "L", "N"] as FiestaLetter[]).map((letter) => (
                    <SelectItem key={letter} value={letter}>
                      Letra {letter}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isFullTime(profileDraft) && <div className="sm:col-span-2">
              <Label>Tipo de contrato T8</Label>
              <div className="contract-options">
                {(Object.keys(CONTRACT_LABELS) as ContractType[]).map(
                  (contract) => (
                    <button
                      type="button"
                      key={contract}
                      className={
                        profileDraft.contract === contract ? "selected" : ""
                      }
                      onClick={() =>
                        setProfileDraft({
                          ...profileDraft,
                          contract,
                          subturn:
                            contract === "75"
                              ? profileDraft.subturn || "T8.1"
                              : undefined,
                        })
                      }
                    >
                      <span>{CONTRACT_LABELS[contract]}</span>
                      <small>{ANNUAL_THEORETICAL_HOURS[year]?.[contract] === undefined ? "Horas anuales por confirmar" : `${formatHours(ANNUAL_THEORETICAL_HOURS[year][contract]!)} en ${year}`}</small>
                    </button>
                  ),
                )}
              </div>
              <p className="mt-2 text-xs leading-5 text-white/35">
                Los cómputos se calculan con el horario oficial correspondiente
                al contrato.
              </p>
            </div>}
            {!isFullTime(profileDraft) && profileDraft.contract === "75" && (
              <div className="sm:col-span-2">
                <Label>Subturno del 75 %</Label>
                <div className="subturn-options">
                  {SUBTURNS.map((subturn) => (
                    <button
                      type="button"
                      key={subturn}
                      className={
                        (profileDraft.subturn || "T8.1") === subturn
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        setProfileDraft({ ...profileDraft, subturn })
                      }
                    >
                      {subturn}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-[#eeb64b]">
                  El subturno determina la hora de entrada, salida, cómputo y
                  nocturnidad.
                </p>
              </div>
            )}
          </div>
          <Button
            className="w-full bg-[#eeb64b] font-bold text-[#112128] hover:bg-[#ffd173]"
            disabled={
              !profileDraft.name.trim() || !profileDraft.employeeNumber.trim()
            }
            onClick={saveProfile}
          >
            Guardar y continuar
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="border-white/10 bg-[#0d222b] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Editar {selected?.day} de {MONTHS[month - 1]}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              La planificación anual original se conserva y podrás restaurarla.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/8 bg-white/4 p-3 text-sm">
                <span className="text-white/45">Planificación original: </span>
                <b>{statusLabel[selected.baseStatus]}</b>
              </div>
              <div>
                <Label>Situación actual</Label>
                <Select
                  value={
                    selected.special !== "NINGUNA"
                      ? `special:${selected.special}`
                      : selected.status === "VISPERA_FESTIVO"
                        ? "special:VISPERA_MANUAL"
                        : selected.status === "VAC_ANTERIOR"
                          ? `prior:${selected.priorOrigin || "VACACIONES"}`
                        : `status:${selected.status}`
                  }
                  onValueChange={(value) => {
                    if (value.startsWith("prior:")) {
                      const priorOrigin = value.slice(6) as PriorOrigin;
                      setSelected({
                        ...selected,
                        status: "VAC_ANTERIOR",
                        special: "NINGUNA",
                        extraHours: 0,
                        priorOrigin,
                        note: priorSituationLabel[priorOrigin],
                      });
                    } else if (value.startsWith("special:")) {
                      const special = value.slice(8) as Special,
                        status = isWorking(selected.status)
                          ? selected.status
                          : "AGCG";
                      setSelected({
                        ...selected,
                        status,
                        special,
                        extraHours:
                          special === "MODIFICACION" ? selected.extraHours : 0,
                        modificationPlacement:
                          selected.modificationPlacement || "FINAL",
                      });
                    } else {
                      const status = value.slice(7) as Status,
                        working = isWorking(status),
                        isPrior = status === "VAC_ANTERIOR";
                      setSelected({
                        ...selected,
                        status,
                        special: working ? selected.special : "NINGUNA",
                        extraHours: working ? selected.extraHours : 0,
                        priorOrigin: isPrior
                          ? selected.priorOrigin || "VACACIONES"
                          : undefined,
                        note:
                          isPrior && !selected.note
                            ? priorOriginLabel[
                                selected.priorOrigin || "VACACIONES"
                              ]
                            : selected.note,
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabel)
                      .filter(
                        ([value]) =>
                          value !== "VISPERA_FESTIVO" &&
                          value !== "VACACIONES" &&
                          value !== "VACACIONES_PENDIENTES" &&
                          value !== "VAC_ANTERIOR",
                      )
                      .map(([value, label]) => (
                        <SelectItem value={`status:${value}`} key={value}>
                          {label}
                        </SelectItem>
                      ))}
                    <SelectItem value="status:VACACIONES">
                      Vacaciones año actual
                    </SelectItem>
                    <SelectItem value="prior:VACACIONES">
                      Vacaciones año anterior
                    </SelectItem>
                    {Object.entries(priorSituationLabel).map(
                      ([value, label]) =>
                        value !== "VACACIONES" ? (
                          <SelectItem value={`prior:${value}`} key={value}>
                            {label}
                          </SelectItem>
                        ) : null,
                    )}
                    {Object.entries(specialLabel).map(([value, label]) => (
                      <SelectItem value={`special:${value}`} key={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selected.special !== "NINGUNA" && (
                  <div className="mt-2 rounded-lg border border-[#eeb64b]/20 bg-[#eeb64b]/7 px-3 py-2 text-xs">
                    <span className="text-white/45">
                      Combinación aplicada:{" "}
                    </span>
                    <b className="text-[#ffd173]">
                      {statusLabel[selected.status]} ·{" "}
                      {specialLabel[selected.special]}
                    </b>
                  </div>
                )}
                <p className="mt-2 rounded-xl border border-[#eeb64b]/25 p-3 text-sm">
                  Categoría oficial TMB: {officialCategory(year, month, selected.day)?.replaceAll("_", " ") || "No disponible · cómputo pendiente"}.
                  Se consulta por fecha y no se modifica desde el calendario personal.
                </p>
              </div>
              {selected.status === "COMPUTO_ANTERIOR" && (
                <div className="rounded-xl border border-[#eeb64b]/25 bg-[#eeb64b]/8 p-3 text-xs leading-5 text-white/65">
                  <b className="text-[#ffd173]">Se aplicará a {year - 1}.</b> La
                  jornada quedará a 0,00 en el cómputo de {year} y compensará el
                  saldo anual anterior.
                </div>
              )}
              {selected.status === "COMPUTO_ACTUAL" && (
                <div className="rounded-xl border border-[#71d7cc]/25 bg-[#71d7cc]/8 p-3 text-xs leading-5 text-white/65">
                  <b className="text-[#8ee9df]">Se aplicará a {year}.</b> La
                  jornada completa se añadirá al cómputo anual actual.
                </div>
              )}
              {selected.special === "MODIFICACION" && (
                <div className="space-y-3 rounded-xl border border-white/8 bg-white/3 p-3">
                  <div>
                    <Label>Cómo se modifica</Label>
                    <Select
                      value={selected.modificationPlacement || "FINAL"}
                      onValueChange={(value) =>
                        setSelected({
                          ...selected,
                          modificationPlacement: value as ModificationPlacement,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FINAL">
                          Cambiar la hora de salida
                        </SelectItem>
                        <SelectItem value="INICIO">
                          Cambiar la hora de entrada
                        </SelectItem>
                        <SelectItem value="PERSONALIZADO">
                          Horario personalizado
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {selected.modificationPlacement === "PERSONALIZADO" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Entrada</Label>
                        <Input
                          type="time"
                          value={selected.customStart || "18:46"}
                          onChange={(e) =>
                            setSelected({
                              ...selected,
                              customStart: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>Salida</Label>
                        <Input
                          type="time"
                          value={selected.customEnd || "00:50"}
                          onChange={(e) =>
                            setSelected({
                              ...selected,
                              customEnd: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label>Variación de horas</Label>
                      <Input
                        className="compute-edit"
                        type="number"
                        step="0.25"
                        value={selected.extraHours}
                        onChange={(e) =>
                          setSelected({
                            ...selected,
                            extraHours: +e.target.value,
                          })
                        }
                      />
                      <p className="mt-1 text-xs text-white/40">
                        Positivo: trabajas más · negativo: trabajas menos.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div>
                <Label>Nota</Label>
                <Input
                  value={selected.note}
                  onChange={(e) =>
                    setSelected({ ...selected, note: e.target.value })
                  }
                  placeholder="Permiso, incidencia, motivo…"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={restoreSelected}>
                  <RotateCcw size={15} />
                  Restaurar original
                </Button>
                <Button
                  className="bg-[#eeb64b] font-bold text-[#112128] hover:bg-[#ffd173]"
                  onClick={updateSelected}
                >
                  Aplicar cambio
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function UploadBox({
  preview,
  title,
  onFile,
}: {
  preview: string;
  title: string;
  onFile: (f: File) => void;
}) {
  const choose = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  };
  return (
    <div>
      <div
        className="upload-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
      >
        {preview ? (
          <img src={preview} alt="Vista previa del calendario" />
        ) : (
          <>
            <UploadCloud size={30} />
            <strong>{title}</strong>
            <span>JPG, PNG o captura de pantalla</span>
          </>
        )}
      </div>
      <div className="upload-actions">
        <label className="native-file-button">
          <Camera size={17} />
          <span>Hacer foto</span>
          <input
            className="native-file-input"
            aria-label="Hacer foto"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={choose}
          />
        </label>
        <label className="native-file-button">
          <Images size={17} />
          <span>Galería</span>
          <input
            className="native-file-input"
            aria-label="Elegir de la galería"
            type="file"
            accept="image/*"
            onChange={choose}
          />
        </label>
      </div>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#0c2028] p-4">
      <p className="text-xs text-white/40">{label}</p>
      <strong className="mt-1 block text-xl tabular-nums">{value}</strong>
    </div>
  );
}
function AnnualView({
  year,
  profile,
  plan,
  monthTotals,
  monthNightHours,
  monthPlusFestiu,
  annualOrdinaryHours,
  annualNightHours,
  annualPlusFestiu,
  onOpen,
  onConfirm,
}: {
  year: number;
  profile: UserProfile;
  plan: YearPlan;
  monthTotals: Record<number, number>;
  monthNightHours: Record<number, number>;
  monthPlusFestiu: Record<number, number>;
  annualOrdinaryHours: number;
  annualNightHours: number;
  annualPlusFestiu: number;
  onOpen: (m: number) => void;
  onConfirm: (m: number) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4 md:px-6">
        <div>
          <p className="eyebrow">Mapa del año</p>
          <h2 className="mt-1 text-xl font-bold">
            Previsión mensual de {year}
          </h2>
        </div>
        <Badge variant="outline" className="border-[#eeb64b]/30 text-[#ffd173]">
          Previsión actualizada
        </Badge>
      </div>
      {Object.keys(plan).length ? (
        <>
          <div className="annual-cards">
            {MONTHS.map((name, i) => {
              const m = i + 1,
                p = plan[m];
              return (
                <article
                  className={`annual-card ${p?.confirmed ? "confirmed" : ""}`}
                  key={name}
                >
                  <button onClick={() => onOpen(m)} disabled={!p}>
                    <div className="flex items-start justify-between">
                      <div>
                        <span>{String(m).padStart(2, "0")}</span>
                        <h3>{name}</h3>
                      </div>
                      {p?.confirmed ? (
                        <CheckCircle2 size={19} />
                      ) : (
                        <PencilLine size={17} />
                      )}
                    </div>
                    <strong>{p ? balanceLabel(profile, monthTotals[m]) : "—"}</strong>
                    <div className="annual-night">
                      <span>
                        <Moon size={12} />
                        Nocturnidad variable
                      </span>
                      <b>{p ? nightLabel(profile, monthNightHours[m]) : "—"}</b>
                    </div>
                    {!!p && monthPlusFestiu[m] > 0 && (
                      <div className="annual-night">
                        <span>
                          <CalendarDays size={12} />
                          Plus Festiu
                        </span>
                        <b>{`${monthPlusFestiu[m]} dom.`}</b>
                      </div>
                    )}
                  </button>
                  {p && (
                    <label>
                      <Checkbox
                        checked={p.confirmed}
                        onCheckedChange={() => onConfirm(m)}
                      />
                      <span>{p.confirmed ? "Confirmado" : "Previsto"}</span>
                    </label>
                  )}
                </article>
              );
            })}
          </div>
          <div className="annual-summary">
            <AnnualStat
              label="Horas totales anuales"
              value={formatHours(annualOrdinaryHours)}
            />
            <AnnualStat
              label="Porcentaje de contratación"
              value={`${profileLabel(profile)}${!isFullTime(profile) && profile.contract === "75" && profile.subturn ? ` · ${profile.subturn}` : ""}`}
            />
            <AnnualStat
              label="Nocturnidad variable anual"
              value={nightLabel(profile, annualNightHours)}
            />
            {annualPlusFestiu > 0 && (
              <AnnualStat
                label="Plus Festiu informativo"
                value={`${annualPlusFestiu} domingos`}
              />
            )}
            <AnnualStat label="Letra de fiesta" value={profile.fiestaLetter} />
          </div>
        </>
      ) : (
        <div className="empty-year">
          <CalendarRange size={48} />
          <h3>Aún no hay una previsión anual</h3>
          <p>
            Sube el calendario completo de TMB y la aplicación calculará los
            doce meses de una vez.
          </p>
        </div>
      )}
    </div>
  );
}
function AnnualStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function MonthView({
  year,
  month,
  profile,
  days,
  calculations,
  first,
  weeks,
  monthTotal,
  monthOrdinaryHours,
  monthNightHours,
  monthHoraNona,
  monthSpecialRetributiveDays,
  monthPlusFestiu,
  review,
  monthPlusConvenio,
  worked,
  onMonthChange,
  onSelect,
}: {
  year: number;
  month: number;
  profile: UserProfile;
  days: DayData[];
  calculations: { d: DayData; c: ReturnType<typeof calcDay> }[];
  first: number;
  weeks: { label: string; total: number }[];
  monthTotal: number;
  monthOrdinaryHours: number;
  monthNightHours: number;
  monthHoraNona: number;
  monthSpecialRetributiveDays: number;
  monthPlusFestiu: number;
  review: number;
  monthPlusConvenio: number;
  worked: number;
  onMonthChange: (m: number) => void;
  onSelect: (d: DayData) => void;
}) {
  return (
    <>
      <div className="month-view-header">
        <div className="month-heading">
          <p className="eyebrow">Previsión editable</p>
          <div className="month-navigation">
            <Button
              size="icon"
              variant="ghost"
              className="month-arrow"
              disabled={month === 1}
              onClick={() => onMonthChange(month - 1)}
              aria-label="Mes anterior"
            >
              <ChevronLeft size={27} strokeWidth={3} />
            </Button>
            <h2>
              {MONTHS[month - 1]} de {year} ·{" "}
              <span className="text-[#eeb64b]">{balanceLabel(profile, monthTotal)}</span>
            </h2>
            <Button
              size="icon"
              variant="ghost"
              className="month-arrow"
              disabled={month === 12}
              onClick={() => onMonthChange(month + 1)}
              aria-label="Mes siguiente"
            >
              <ChevronRight size={27} strokeWidth={3} />
            </Button>
          </div>
        </div>
        <div className="month-kpis">
          <div className="month-kpi">
            <span>Horas ordinarias</span>
            <strong>{formatHours(monthOrdinaryHours)}</strong>
          </div>
          <div className="month-kpi night">
            <span>
              <Moon size={13} />
              Nocturnidad variable
            </span>
            <strong>{nightLabel(profile, monthNightHours)}</strong>
          </div>
          {(isFullTime(profile) || !Number.isFinite(monthHoraNona) || monthHoraNona > 0) && (
            <div className="month-kpi payroll">
              <span>
                <Clock3 size={13} />
                Prima Hora Nona
              </span>
              <strong>{isFullTime(profile) ? "Pendiente" : iso(monthHoraNona)}</strong>
            </div>
          )}
          {monthSpecialRetributiveDays > 0 && (
            <div className="month-kpi special">
              <span>
                <CalendarDays size={13} />
                Días especiales
              </span>
              <strong>
                {monthSpecialRetributiveDays}{" "}
                {monthSpecialRetributiveDays === 1 ? "día" : "días"}
              </strong>
            </div>
          )}
          {monthPlusFestiu > 0 && (
            <div className="month-kpi festive">
              <span>
                <CalendarDays size={13} />
                Plus Festiu
              </span>
              <strong>
                {monthPlusFestiu}{" "}
                {monthPlusFestiu === 1 ? "domingo" : "domingos"}
              </strong>
            </div>
          )}
          <div className="month-kpi payroll">
            <span><CalendarDays size={13} /> Plus Convenio{isFullTime(profile) ? " · provisional" : ""}</span>
            <strong>{monthPlusConvenio} {monthPlusConvenio === 1 ? "día" : "días"}</strong>
            {review > 0 && <span>Provisional · hay días por revisar</span>}
          </div>
          <Badge variant="outline" className="whitespace-normal border-white/15 text-white/60">
            {worked} trabajados · {review} pendientes de revisión
            {isFullTime(profile) && ` · ${calculations.filter(({ c }) => c.scheduleReview).length} horarios por confirmar`}
          </Badge>
        </div>
      </div>
      {isFullTime(profile) && <p className="mx-4 mt-4 rounded-lg border border-amber-400/30 p-3 text-sm text-amber-200" role="status">
        {profileLabel(profile)} · Las horas son una previsión de horario. El saldo, la nocturnidad abonable, la Hora Nona y los abonos por ausencias están pendientes de validar.
        {["T1", "T2"].includes(profileTurn(profile)) && " Los sábados y non stop usan un horario histórico por confirmar; puedes corregir la jornada en cada día."}
      </p>}
      <Tabs defaultValue="calendar" className="p-4 md:p-6">
        <TabsList className="mb-5 bg-[#0b2029]">
          <TabsTrigger value="calendar">Calendario</TabsTrigger>
          <TabsTrigger value="table">Detalle diario</TabsTrigger>
          <TabsTrigger value="weeks">Semanas</TabsTrigger>
          <TabsTrigger value="rules">Reglas</TabsTrigger>
        </TabsList>
        <TabsContent value="calendar">
          <div className="calendar-grid mb-2">
            {WEEKDAYS.map((w) => (
              <div key={w} className="weekday">
                {w}
              </div>
            ))}
          </div>
          <div className="calendar-grid">
            {Array.from({ length: first }, (_, i) => (
              <div key={`e${i}`} className="day empty" />
            ))}
            {calculations.map(({ d, c }) => (
              <button
                key={d.day}
                className={`day ${d.status.toLowerCase()} ${officialHolidayFor(year, month, d.day) ? "official" : ""} ${d.status !== d.baseStatus ? "modified" : ""}`}
                onClick={() => onSelect(d)}
              >
                <div className="day-top">
                  <b>{d.day}</b>
                  <span
                    className={`compute ${c.value > 0 ? "pos" : c.value < 0 ? "neg" : "zero"}`}
                  >
                    {d.status === "REVISAR" ? "?" : balanceLabel(profile, c.value)}
                  </span>
                </div>
                <strong>{compactStatusLabel(d)}</strong>
                <small>
                  {d.status !== d.baseStatus
                    ? `Original: ${d.baseStatus}`
                    : c.reason}
                </small>
                <div className="day-marks">
                  {d.special !== "NINGUNA" ? (
                    <i>{specialMark(d.special)}</i>
                  ) : (officialCategory(year, month, d.day) === "VIGILIA_NON_STOP") && isWorking(d.status) ? (
                    <i>NS</i>
                  ) : null}
                  {isConfirmedSpecialRetributiveDay(year, month, d.day) && (
                    <i className="convention-mark">D.ESP</i>
                  )}
                </div>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-white/38">
            La marca de festivo y NS proceden del calendario oficial TMB.
            Los colores personales siguen identificando trabajo, descanso y ausencias. El punto dorado
            identifica días modificados. D.ESP marca un día especial
            retributivo confirmado; es informativo y no altera el cómputo.
          </p>
        </TabsContent>
        <TabsContent value="table" className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Original</TableHead>
                <TableHead>Situación actual</TableHead>
                <TableHead>Jornada</TableHead>
                <TableHead>Noct. variable</TableHead>
                <TableHead className="text-right">Cómputo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculations.map(({ d, c }) => (
                <TableRow
                  key={d.day}
                  className="cursor-pointer"
                  onClick={() => onSelect(d)}
                >
                  <TableCell className="font-semibold">
                    {String(d.day).padStart(2, "0")}/
                    {String(month).padStart(2, "0")}
                  </TableCell>
                  <TableCell>{d.baseStatus}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{situationLabel(d)}</Badge>
                    {(officialCategory(year, month, d.day) === "VIGILIA_NON_STOP") && isWorking(d.status) && (
                      <small className="ml-2 text-[#eeb64b]">
                        Non stop pactado
                      </small>
                    )}
                    {isConfirmedSpecialRetributiveDay(year, month, d.day) && (
                      <small className="ml-2 text-[#ffd173]">
                        Día especial retributivo
                      </small>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.shift}
                    <small className="block text-white/35">{c.hours}</small>
                    {c.scheduleReview && <small className="block text-amber-300">Horario por confirmar</small>}
                  </TableCell>
                  <TableCell>{isFullTime(profile) && isWorking(d.status) ? "Pendiente" : c.night}</TableCell>
                  <TableCell
                    className={`text-right font-bold ${c.value > 0 ? "text-[#71d7cc]" : c.value < 0 ? "text-[#ff8d7c]" : "text-white/45"}`}
                  >
                    {d.status === "REVISAR" ? "—" : balanceLabel(profile, c.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="weeks">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {weeks.map((w, i) => (
              <div className="week-card" key={w.label}>
                <span>Semana {i + 1}</span>
                <strong>{w.label}</strong>
                <b
                  className={w.total >= 0 ? "text-[#71d7cc]" : "text-[#ff8d7c]"}
                >
                  {balanceLabel(profile, w.total)}
                </b>
              </div>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="rules">
          <Rules profile={profile} />
        </TabsContent>
      </Tabs>
    </>
  );
}
function Rules({ profile }: { profile: UserProfile }) {
  if (isFullTime(profile)) return <div className="grid gap-3 md:grid-cols-2">
    <Rule n="01" title="Jornada completa" text="Las horas anuales corresponden al 100 % del año seleccionado. Las RJ ya están incluidas en esa base anual." />
    <Rule n="02" title="Horarios" text={profileTurn(profile) === "T4" || profileTurn(profile) === "T5" ? "Horario fijo todos los días. T5 inverso no incluido." : "Horario ordinario incorporado. Sábados y non stop: referencia histórica pendiente de confirmación; revisa las horas de entrada y salida."} />
    <Rule n="03" title="Compensaciones pendientes" text="Saldo, nocturnidad abonable, Hora Nona, abonos de formación y revisión médica y traspasos de cómputo pendientes de validar. No se aplican las reglas de T8." />
    <Rule n="04" title="Horas previstas" text="Suma de las jornadas del calendario, incluidas las previstas. No acredita horas efectivamente realizadas ni sustituye el cómputo anual. Los contadores retributivos son informativos, pendientes de validar para tiempo completo." />
  </div>;

  const normal = shiftFor(profile, "NORMAL", 0),
    eve = shiftFor(profile, "FRIDAY_EVE", 4),
    saturday = shiftFor(profile, "SATURDAY", 5);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Rule
        n="01"
        title="Lectura del calendario"
        text="El fondo de cada casilla determina trabajo o fiesta; el ciclo de 28 días valida la lectura."
      />
      <Rule
        n="02"
        title="Festivos oficiales"
        text="La categoría operativa procede del calendario oficial TMB. Sin categoría disponible, el cómputo queda pendiente; no se deduce del número rojo ni del día siguiente."
      />
      <Rule
        n="03"
        title="Nochebuena"
        text={`Se abona como jornada normal: ${balanceLabel(profile, normal.value)}.`}
      />
      <Rule
        n="04"
        title="Non stop"
        text={`23/6, 23/9 y 31/12 se aplican automáticamente con el horario oficial de ${profile.contract === "75" ? profile.subturn || "T8.1" : CONTRACT_LABELS[profile.contract]}; los otros dos se añaden manualmente.`}
      />
      <Rule
        n="05"
        title="Víspera"
        text={`${eve.start}–${eve.end} · ${balanceLabel(profile, eve.value)}. Tiene prioridad sobre el día de la semana.`}
      />
      <Rule
        n="06"
        title="Fin de semana"
        text={`Viernes ${balanceLabel(profile, eve.value)} · sábado ${balanceLabel(profile, saturday.value)}.`}
      />
      <Rule
        n="07"
        title="Jornada normal"
        text={`Domingo a jueves · ${normal.start}–${normal.end} · ${balanceLabel(profile, normal.value)}.`}
      />
      <Rule
        n="08"
        title="Formación y revisión"
        text="Computan como la jornada ordinaria que corresponda."
      />
      <Rule
        n="09"
        title="Cómputo entre años"
        text="Cómputo año anterior compensa el saldo previo; cómputo año actual incorpora la jornada completa al año seleccionado."
      />
      <Rule
        n="10"
        title="Nocturnidad variable"
        text="Se calcula cada jornada, se redondea diariamente a dos decimales y después se suman los totales mensual y anual."
      />
      <Rule
        n="11"
        title="Información retributiva"
        text="Plus Festiu cuenta domingos efectivamente trabajados. D.ESP señala días especiales confirmados; ninguno de los dos modifica el cómputo ni calcula importes."
      />
      <Rule
        n="12"
        title="Horas ordinarias"
        text="Cada jornada se convierte individualmente a horas decimales, se redondea a dos decimales y después se suman los totales mensual y anual. Este redondeo no modifica el cómputo."
      />
      <Rule
        n="13"
        title="Prima Hora Nona"
        text="El tiempo de cada jornada que exceda de ocho horas se cuenta por cuartos de hora iniciados y después se suma en el mes."
      />
      <Rule
        n="14"
        title="Plus Convenio"
        text="Cuenta todos los días del mes excepto los de tipo FEST, incluidos descansos DCOM, MINI, LAUDO y vacaciones. El resultado es provisional mientras queden días pendientes de revisión."
      />
    </div>
  );
}
function Rule({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="rule">
      <span>{n}</span>
      <div>
        <b>{title}</b>
        <p>{text}</p>
      </div>
      <ChevronRight size={17} />
    </div>
  );
}
