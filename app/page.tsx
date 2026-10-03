/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element, react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_RULES, officialCalendar, officialCategory, officialHolidayFor } from "@/lib/official-calendar";
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Moon,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  CalendarDays,
  Clock3,
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
import { deleteStorageKeys, markStorageKeyPending, pushStorageKey, syncComputoStorage, type SyncState } from "./computo-sync";
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
  | "PATERNIDAD"
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
type PeriodKind = "VACACIONES" | "MINI" | "RJ" | "PATERNIDAD" | "VAC_ANTERIOR";
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
  detectedColour?: "BLUE";
};
type MonthPlan = { original: DayData[]; days: DayData[]; confirmed: boolean };
type YearPlan = Record<number, MonthPlan>;
type FiestaLetter = "K" | "M" | "L" | "N";
type SummerPercentage = "75" | "100";
type SummerShift = "AT86" | "AT87";
type SummerMonthAssignment = {
  month: number;
  fiestaLetter: FiestaLetter;
  shift: SummerShift;
};
type SummerContract = {
  percentage: SummerPercentage;
  assignments: SummerMonthAssignment[];
};
type ContractType = "85.81" | "85" | "78.91" | "78.14" | "75";
type Subturn = "T8.1" | "T8.2" | "T8.3" | "T8.4" | "T8.5";
type Turn = "T1" | "T2" | "T4" | "T5" | "T8" | "ESTIU";
type UserProfile = {
  turn?: Turn;
  name: string;
  employeeNumber: string;
  fiestaLetter: FiestaLetter;
  contract: ContractType;
  subturn?: Subturn;
  summer?: Record<string, SummerContract>;
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
const APP_BUILD = (process.env.NEXT_PUBLIC_GIT_SHA || "local").slice(0, 7);
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
const TURNS: Turn[] = ["T1", "T2", "T4", "T5", "T8", "ESTIU"];
const DEFAULT_SUMMER_CONTRACT: SummerContract = {
  percentage: "75",
  assignments: [],
};
const SUMMER_SERVICE_MONTHS = [7, 8, 9, 10] as const;
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
function isSummer(profile: UserProfile) { return profileTurn(profile) === "ESTIU"; }
function isFullTime(profile: UserProfile) {
  const turn = profileTurn(profile);
  return turn !== "T8" && turn !== "ESTIU";
}
function summerContractFor(profile: UserProfile, year: number): SummerContract {
  const stored = profile.summer?.[String(year)];
  return stored
    ? {
        percentage: stored.percentage === "100" ? "100" : "75",
        assignments: Array.isArray(stored.assignments) ? stored.assignments : [],
      }
    : DEFAULT_SUMMER_CONTRACT;
}
function summerAssignmentFor(profile: UserProfile, year: number, month: number) {
  return summerContractFor(profile, year).assignments.find(
    (assignment) => assignment.month === month,
  );
}
function fiestaLetterForMonth(profile: UserProfile, year: number, month: number) {
  return isSummer(profile)
    ? summerAssignmentFor(profile, year, month)?.fiestaLetter || profile.fiestaLetter
    : profile.fiestaLetter;
}
function profileLabel(profile: UserProfile, year?: number) {
  if (isSummer(profile))
    return year === undefined
      ? "Estiu"
      : `Estiu · ${summerContractFor(profile, year).percentage} %`;
  return isFullTime(profile) ? `${profileTurn(profile)} · 100 %` : `T8 · ${CONTRACT_LABELS[profile.contract]}`;
}
function theoreticalHours(year: number, profile: UserProfile) {
  if (isSummer(profile)) return undefined;
  return isFullTime(profile) ? FULL_TIME_HOURS[year] : ANNUAL_THEORETICAL_HOURS[year]?.[profile.contract];
}
// Keep the existing T8 contract/subturn as inactive preferences when changing turn.
// Legacy profiles without a turn remain T8. No stored calendar is rewritten.
function balanceLabel(profile: UserProfile, value: number) {
  if (isSummer(profile)) return formatHours(value);
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
const ANNUAL_DETECTOR_VERSION = 35;
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
  PATERNIDAD: "Paternidad",
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
// Presentation only: preserve the colour families recognized by the detector.
// Ambiguous/manual states have no proven original colour and stay neutral.
function dayColourClass(d: DayData) {
  // A blue block is deliberately left as REVISAR when its exact TMB concept
  // cannot be inferred from colour alone. Preserve that observed colour in
  // the UI without changing the interpretation of the day.
  if (
    d.detectedColour === "BLUE" &&
    (d.status === "REVISAR" ||
      d.status === "RJ" ||
      d.status === "MINI" ||
      d.status === "PATERNIDAD" ||
      d.status === "COMPUTO_ANTERIOR" ||
      d.status === "COMPUTO_ACTUAL" ||
      (d.status === "VAC_ANTERIOR" &&
        (d.priorOrigin === "RJ" || d.priorOrigin === "COMPUTO")))
  )
    return "tmb-blue";
  if (d.status === "VAC_ANTERIOR") {
    return d.priorOrigin === "RJ" ? "tmb-blue" : d.priorOrigin === "COMPUTO" ? "tmb-neutral" : "tmb-brown";
  }
  const colours: Partial<Record<Status, string>> = {
    AGCG: "tmb-grey", DCOM: "tmb-turquoise", FEST: "tmb-salmon",
    LAUDO: "tmb-orange", VACACIONES: "tmb-brown", VACACIONES_PENDIENTES: "tmb-brown",
    FORMACION: "tmb-pink", ENFERMEDAD: "tmb-green", REVISION_MEDICA: "tmb-sage",
    RJ: "tmb-blue", MINI: "tmb-blue", PATERNIDAD: "tmb-blue",
  };
  return colours[d.status] || "tmb-neutral";
}
function showMonthlyConcept(value: number) {
  return Number.isFinite(value) && value !== 0;
}
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
function daysInYear(year: number) {
  return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
}
function summerAssignmentMonths(plan: YearPlan) {
  const detected = SUMMER_SERVICE_MONTHS.filter(
    (month) => (plan[month]?.days?.length || 0) > 0,
  );
  return detected.length ? [...detected] : [...SUMMER_SERVICE_MONTHS];
}
function summerDetectedSpan(plan: YearPlan, year: number) {
  const dates = Object.entries(plan).flatMap(([monthKey, monthPlan]) => {
    const month = Number(monthKey);
    return (monthPlan?.days || [])
      .filter((day) => day.day >= 1 && day.day <= daysInMonth(year, month))
      .map((day) => new Date(year, month - 1, day.day, 12));
  });
  if (!dates.length) return null;
  dates.sort((a, b) => a.getTime() - b.getTime());
  const start = dates[0],
    end = dates[dates.length - 1],
    naturalDays =
      Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return {
    start,
    end,
    naturalDays,
    label: `${String(start.getDate()).padStart(2, "0")}/${String(start.getMonth() + 1).padStart(2, "0")}–${String(end.getDate()).padStart(2, "0")}/${String(end.getMonth() + 1).padStart(2, "0")}`,
  };
}
function summerContractHours(
  plan: YearPlan,
  year: number,
  profile: UserProfile,
) {
  const span = summerDetectedSpan(plan, year),
    annualReference = FULL_TIME_HOURS[year];
  if (!span || annualReference === undefined) return undefined;
  const percentage =
    summerContractFor(profile, year).percentage === "100" ? 1 : 0.75;
  return Number(
    (
      (annualReference * percentage * span.naturalDays) /
      daysInYear(year)
    ).toFixed(2),
  );
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
      d.status === "PATERNIDAD" ||
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
const SUMMER_SHIFTS: Record<
  SummerShift,
  Record<Exclude<ShiftKind, "LONG_SATURDAY">, { start: string; end: string }>
> = {
  AT86: {
    NORMAL: { start: "19:20", end: "00:18" },
    FRIDAY_EVE: { start: "19:20", end: "02:50" },
    SATURDAY: { start: "20:30", end: "05:00" },
    NON_STOP: { start: "20:30", end: "05:00" },
  },
  AT87: {
    NORMAL: { start: "19:52", end: "00:50" },
    FRIDAY_EVE: { start: "19:20", end: "02:50" },
    SATURDAY: { start: "20:30", end: "05:00" },
    NON_STOP: { start: "20:30", end: "05:00" },
  },
};
function shiftFor(
  profile: UserProfile,
  kind: ShiftKind,
  weekday: number,
  year?: number,
  month?: number,
): ShiftDefinition {
  if (isSummer(profile)) {
    if (year === undefined || month === undefined)
      return { start: "", end: "", minutes: NaN, value: NaN };
    const summer = summerContractFor(profile, year);
    if (summer.percentage !== "75")
      return { start: "", end: "", minutes: NaN, value: NaN };
    const assignment = summerAssignmentFor(profile, year, month);
    if (!assignment)
      return { start: "", end: "", minutes: NaN, value: NaN };
    const effectiveKind =
        kind === "LONG_SATURDAY" ? "SATURDAY" : kind,
      base = SUMMER_SHIFTS[assignment.shift][effectiveKind],
      row =
        effectiveKind === "NORMAL" && weekday === 6
          ? { start: "19:20", end: "00:50" }
          : base;
    return {
      ...row,
      minutes: elapsedMinutes(row.start, row.end),
      value: 0,
    };
  }
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
// Continuous wall-clock interval only. Equal endpoints cannot distinguish a
// zero-length shift from 24 hours; neither is a supported working shift here.
function nightOverlapMinutesForShift(start: string, end: string) {
  const validClock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!validClock.test(start) || !validClock.test(end) || start === end) return NaN;
  const a = clockMinutes(start), b = a + elapsedMinutes(start, end);
  let overlap = 0;
  for (let day = -1; day <= 1; day++) {
    const nightStart = day * 1440 + 1320;
    overlap += Math.max(0, Math.min(b, nightStart + 480) - Math.max(a, nightStart));
  }
  return overlap;
}
function nightMinutesForShift(start: string, end: string, total: number) {
  const overlap = nightOverlapMinutesForShift(start, end);
  if (!Number.isFinite(overlap) || !Number.isFinite(total) ||
      total <= 0 || total !== elapsedMinutes(start, end)) return NaN;
  // FMB I-83: strictly more than four nocturnal hours pays the whole shift.
  return overlap > 240 ? total : overlap;
}
function nightForDay(d: DayData, profile: UserProfile, code: string | null | undefined,
  start: string, end: string, total: number, year: number, month: number) {
  const overlap = nightOverlapMinutesForShift(start, end);
  let reason = "";
  if (isFullTime(profile)) reason = "Nocturnidad de tiempo completo pendiente de validar";
  else if (code?.includes("CANVI_HORA") && overlap > 0 && month === 10) reason = "Pendiente: duración nocturna en cambio de hora";
  else if (d.special === "NON_STOP_EXTRA") reason = "Pendiente: tratamiento de Non Stop extraordinario";
  let payable = reason ? NaN : nightMinutesForShift(start, end, total);
  if (!reason && code?.endsWith("_FINS_23H")) {
    // Nochebuena: la reducción de presencia no reduce la nocturnidad abonada.
    // Nómina 12/2025 confirma que T8 cobra la nocturnidad de la jornada normal.
    const normal = shiftFor(profile, "NORMAL", 1, year, month);
    payable = nightMinutesForShift(normal.start, normal.end, normal.minutes);
  }
  if (!reason && !Number.isFinite(payable)) reason = "Pendiente: horario incompleto o duración distinta del intervalo";
  return { overlap, payable, reason };
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
      nightOverlapMinutes: 0,
      nightPayableMinutes: 0,
      nightReason: "",
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
      const shift = shiftFor(profile, "NORMAL", 1, year, month);
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
    const nightResult = nightForDay(d, profile, code, start, end, minutes, year, month);
    const night = fullTime ? 0 : nightResult.payable;
    return {
      scheduleReview: !Number.isFinite(minutes), compensationPending: fullTime,
      value: fullTime || toPreviousYear ? 0 : toCurrentYear ? decimalHoursFromMinutes(minutes) : NaN,
      shift: Number.isFinite(minutes) ? `${start}–${end}` : "Pendiente",
      hours: Number.isFinite(minutes) ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}` : "Pendiente",
      night: iso(decimalHoursFromMinutes(night)),
      workedMinutes: toPreviousYear ? 0 : minutes,
      nightMinutes: night,
      nightHours: decimalHoursFromMinutes(night),
      nightOverlapMinutes: nightResult.overlap,
      nightPayableMinutes: nightResult.payable,
      nightReason: nightResult.reason,
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
  if (code === "DISSABTE_CANVI_HORA" && !isSummer(profile) && profile.contract === "75" && month === 10) {
    kind = "LONG_SATURDAY";
    reason = "Sábado largo · cambio de hora";
  }
  // Explicit personal overrides remain visible and are not inferred from colours.
  if (d.special === "NON_STOP_PACTADO" || d.special === "NON_STOP_EXTRA") {
    kind = "NON_STOP"; reason = specialLabel[d.special] + " · manual";
  } else if (d.special === "FESTIVO_ESPECIAL" || d.special === "VISPERA_MANUAL" || d.status === "VISPERA_FESTIVO") {
    kind = "FRIDAY_EVE"; reason = "Jornada especial · manual";
  }
  let definition = shiftFor(profile, kind, wd, year, month),
    start = definition.start,
    end = definition.end,
    workedMinutes = definition.minutes,
    value = definition.value;
  if (!isFullTime(profile) && code.endsWith("_FINS_23H")) {
    const normal = shiftFor(profile, "NORMAL", wd, year, month);
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
    nightResult = nightForDay(d, profile, code, start, end, actualWorkedMinutes, year, month),
    actualNightMinutes = isFullTime(profile)
      ? 0
      : Number.isFinite(actualWorkedMinutes)
        ? nightResult.payable
        : NaN,
    actualNightHours = Number.isFinite(actualNightMinutes)
      ? decimalHoursFromMinutes(actualNightMinutes)
      : NaN,
    actualOrdinaryHours = Number.isFinite(actualWorkedMinutes)
      ? decimalHoursFromMinutes(actualWorkedMinutes)
      : NaN,
    actualHoraNona =
      !isFullTime(profile) && Number.isFinite(actualWorkedMinutes) && actualWorkedMinutes > 480
        ? Math.ceil((actualWorkedMinutes - 480) / 15) * 0.25
        : Number.isFinite(actualWorkedMinutes) ? 0 : NaN,
    hours = Number.isFinite(actualWorkedMinutes)
      ? `${Math.floor(actualWorkedMinutes / 60)}:${String(actualWorkedMinutes % 60).padStart(2, "0")}`
      : "Pendiente";
  if (toPreviousYear) {
    value = 0;
    reason = `Cómputo aplicado a ${year - 1}`;
  } else if (toCurrentYear) {
    value = actualWorkedMinutes / 60;
    reason = `Cómputo aplicado a ${year}`;
  }
  const fullTime = isFullTime(profile),
    summer = isSummer(profile),
    summerAssignment = summer ? summerAssignmentFor(profile, year, month) : undefined;
  const scheduleReview =
    (fullTime && ["T1", "T2"].includes(profileTurn(profile)) && (wd === 5 || kind === "NON_STOP") && d.special !== "MODIFICACION") ||
    (summer && !Number.isFinite(actualWorkedMinutes));
  const absenceReview = fullTime && ["FORMACION", "REVISION_MEDICA", "COMPUTO_ANTERIOR", "COMPUTO_ACTUAL"].includes(d.status);
  if (fullTime) reason = `${profileTurn(profile)} · ${scheduleReview ? "horario histórico por confirmar" : reason}${absenceReview ? " · abono pendiente" : ""} · cómputo pendiente`;
  if (summer) {
    const summerContract = summerContractFor(profile, year);
    reason =
      summerContract.percentage === "75"
        ? `Estiu 75 % · ${summerAssignment ? `${summerAssignment.fiestaLetter} · ${summerAssignment.shift}` : "letra/AT pendiente"} · ${reason}`
        : "Estiu 100 % · horario operativo pendiente de asignación";
  }
  return {
    scheduleReview,
    compensationPending: fullTime,
    value: summer
      ? toPreviousYear
        ? 0
        : actualOrdinaryHours
      : fullTime
        ? 0
        : Number(value.toFixed(2)),
    shift: Number.isFinite(actualWorkedMinutes) ? `${start}–${end}` : "Pendiente",
    hours,
    night: iso(actualNightHours),
    workedMinutes: toPreviousYear ? 0 : actualWorkedMinutes,
    nightMinutes: actualNightMinutes,
    nightHours: actualNightHours,
    nightOverlapMinutes: nightResult.overlap,
    nightPayableMinutes: nightResult.payable,
    nightReason: nightResult.reason,
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
function specialRetributiveDaysCount(days: DayData[], year: number, month: number) {
  return days.filter(
    (d) => isWorking(d.status) && isConfirmedSpecialRetributiveDay(year, month, d.day),
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
function annualBlockEvidence(data: Uint8ClampedArray): { status: Status; confidence: number; detectedColour?: "BLUE" } {
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
    // Revisión médica uses a pale/desaturated green: its red and blue
    // components stay high. Enfermedad is the saturated green with much
    // lower red/blue. Test the pale green first so compression/rescaling
    // cannot turn a medical cell into disease merely by increasing G.
    else if (g > r + 14 && g > b + 14 && r >= 115 && b >= 115) medical++;
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
  return { status: "REVISAR" as Status, confidence, detectedColour: best === blue ? "BLUE" as const : undefined };
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
  let total = 0,
    blueWeight = 0;
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
    if (evidence.detectedColour === "BLUE") blueWeight += weight;
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
      detectedColour: blueWeight / Math.max(total, 0.0001) >= 0.5 ? "BLUE" as const : undefined,
    };
  return {
    status,
    confidence: Math.max(0, Math.min(1, share + margin * 0.35)),
    detectedColour: status === "REVISAR" && blueWeight / Math.max(total, 0.0001) >= 0.5 ? "BLUE" as const : undefined,
  };
}
function retryUncertainAnnualCell(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellW: number,
  cellH: number,
  canvas: HTMLCanvasElement,
) {
  // v26: segunda lectura SOLO para celdas no azules que la primera pasada
  // dejó en REVISAR. El azul marino se conserva como dato visual ambiguo:
  // por color no se puede distinguir RJ, Mini y Paternidad.
  const broadFallback = () => {
      const broadRegions = [
          [0, 0, 0.58, 0.54],
          [-0.24, 0, 0.26, 0.56],
          [0.24, 0, 0.26, 0.56],
        ],
        broadVotes = new Map<Status, number>();
      for (const [dx, dy, rw, rh] of broadRegions) {
        const sw = Math.max(3, Math.round(cellW * rw)),
          sh = Math.max(3, Math.round(cellH * rh)),
          sx = Math.max(0, Math.round(cx + cellW * dx - sw / 2)),
          sy = Math.max(0, Math.round(cy + cellH * dy - sh / 2)),
          status = dominantStatus(
            ctx.getImageData(
              sx,
              sy,
              Math.min(sw, canvas.width - sx),
              Math.min(sh, canvas.height - sy),
            ).data,
          );
        if (status !== "REVISAR")
          broadVotes.set(status, (broadVotes.get(status) || 0) + 1);
      }
      const broad = [...broadVotes.entries()].sort((a, b) => b[1] - a[1]),
        winner = broad[0],
        runnerUp = broad[1];
      if (!winner || winner[1] < 2 || (runnerUp && winner[1] <= runnerUp[1]))
        return null;
      return { status: winner[0], confidence: 0.48 };
    },
    regions = [
      [-0.34, -0.27, 0.12, 0.16], [0.34, -0.27, 0.12, 0.16],
      [-0.34,  0.27, 0.12, 0.16], [0.34,  0.27, 0.12, 0.16],
      [-0.38,  0.00, 0.10, 0.22], [0.38,  0.00, 0.10, 0.22],
      [-0.23, -0.30, 0.16, 0.13], [0.23, -0.30, 0.16, 0.13],
      [-0.23,  0.30, 0.16, 0.13], [0.23,  0.30, 0.16, 0.13],
      [-0.29,  0.00, 0.14, 0.42], [0.29,  0.00, 0.14, 0.42],
    ],
    votes = new Map<Status, { count: number; weight: number; strong: number }>();

  for (const [dx, dy, rw, rh] of regions) {
    const sw = Math.max(2, Math.round(cellW * rw)),
      sh = Math.max(2, Math.round(cellH * rh)),
      sx = Math.max(0, Math.round(cx + cellW * dx - sw / 2)),
      sy = Math.max(0, Math.round(cy + cellH * dy - sh / 2)),
      evidence = annualBlockEvidence(
        ctx.getImageData(
          sx,
          sy,
          Math.min(sw, canvas.width - sx),
          Math.min(sh, canvas.height - sy),
        ).data,
      );
    if (evidence.status === "REVISAR" || evidence.confidence < 0.34) continue;
    const current = votes.get(evidence.status) || {
      count: 0,
      weight: 0,
      strong: 0,
    };
    current.count++;
    current.weight += evidence.confidence;
    if (evidence.confidence >= 0.58) current.strong++;
    votes.set(evidence.status, current);
  }

  const ranked = [...votes.entries()].sort(
      (x, y) =>
        y[1].count - x[1].count ||
        y[1].strong - x[1].strong ||
        y[1].weight - x[1].weight,
    ),
    best = ranked[0],
    second = ranked[1];
  if (!best) return broadFallback();

  const totalVotes = ranked.reduce((n, [, v]) => n + v.count, 0),
    share = totalVotes ? best[1].count / totalVotes : 0,
    voteLead = second ? best[1].count - second[1].count : best[1].count,
    weightLead = second ? best[1].weight - second[1].weight : best[1].weight,
    uniformConsensus =
      best[1].count >= 5 &&
      share >= 0.72 &&
      best[1].weight / best[1].count >= 0.42,
    consensus =
      uniformConsensus ||
      (best[1].count >= 4 &&
        share >= 0.60 &&
        (!second || voteLead >= 2 || weightLead >= 1.10) &&
        (best[1].strong >= 2 || best[1].weight / best[1].count >= 0.52));

  if (!consensus) return broadFallback();
  return {
    status: best[0],
    confidence: Math.min(
      1,
      0.45 * share + 0.55 * (best[1].weight / best[1].count),
    ),
  };
}

type AnnualColourFeature = {
  red: number;
  green: number;
  blue: number;
  saturation: number;
  luma: number;
  rawRed: number;
  rawGreen: number;
  rawBlue: number;
};

function annualCellColourFeature(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cellW: number,
  cellH: number,
  canvas: HTMLCanvasElement,
): AnnualColourFeature | null {
  const regions = [
      [-0.31, 0, 0.18, 0.48],
      [0.31, 0, 0.18, 0.48],
      [-0.22, -0.27, 0.18, 0.14],
      [0.22, -0.27, 0.18, 0.14],
      [-0.22, 0.27, 0.18, 0.14],
      [0.22, 0.27, 0.18, 0.14],
    ],
    rs: number[] = [],
    gs: number[] = [],
    bs: number[] = [];

  for (const [dx, dy, rw, rh] of regions) {
    const sw = Math.max(2, Math.round(cellW * rw)),
      sh = Math.max(2, Math.round(cellH * rh)),
      sx = Math.max(0, Math.round(cx + cellW * dx - sw / 2)),
      sy = Math.max(0, Math.round(cy + cellH * dy - sh / 2)),
      data = ctx.getImageData(
        sx,
        sy,
        Math.min(sw, canvas.width - sx),
        Math.min(sh, canvas.height - sy),
      ).data;
    for (let p = 0; p < data.length; p += 4) {
      const r = data[p],
        g = data[p + 1],
        b = data[p + 2],
        sum = r + g + b;
      if (sum < 60) continue;
      if (r > 247 && g > 247 && b > 247) continue;
      rs.push(r);
      gs.push(g);
      bs.push(b);
    }
  }
  if (rs.length < 8) return null;
  const median = (values: number[]) => {
      const ordered = [...values].sort((a, b) => a - b);
      return ordered[Math.floor(ordered.length / 2)];
    },
    r = median(rs),
    g = median(gs),
    b = median(bs),
    sum = Math.max(1, r + g + b),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  return {
    red: r / sum,
    green: g / sum,
    blue: b / sum,
    saturation: (max - min) / 255,
    luma: (r * 0.299 + g * 0.587 + b * 0.114) / 255,
    rawRed: r,
    rawGreen: g,
    rawBlue: b,
  };
}

function annualFeatureEvidence(
  feature: AnnualColourFeature,
): { status: Status; confidence: number; detectedColour?: "BLUE" } | null {
  const r = feature.red,
    g = feature.green,
    b = feature.blue,
    saturation = feature.saturation,
    luma = feature.luma;

  // v30: the colour observed in the individual cell is authoritative.
  // Normalised chromaticity makes these rules resilient to screen brightness
  // and screenshots. Palette/cycle information is never allowed to overwrite
  // a clear direct reading.
  if (
    b > 0.45 &&
    b - r > 0.15 &&
    b - g > 0.10 &&
    saturation > 0.20 &&
    luma < 0.58
  )
    return { status: "REVISAR", confidence: 0.96, detectedColour: "BLUE" };

  if (
    g > r + 0.10 &&
    b > r + 0.10 &&
    Math.abs(g - b) < 0.13 &&
    saturation > 0.13
  )
    return { status: "DCOM", confidence: 0.92 };

  // Saturated green = enfermedad. This is deliberately broader than v28:
  // camera white balance can reduce green dominance without changing the
  // clearly green appearance of the cell.
  if (
    g > 0.40 &&
    g - r > 0.08 &&
    g - b > 0.08 &&
    saturation > 0.12
  )
    return { status: "ENFERMEDAD", confidence: 0.92 };

  if (
    r > g + 0.09 &&
    b > g + 0.09 &&
    saturation > 0.10 &&
    luma > 0.34
  )
    return { status: "FORMACION", confidence: 0.87 };

  // Very dark warm/brown is vacaciones. It is evaluated before the two
  // lighter warm families.
  if (
    luma < 0.34 &&
    b < 0.22 &&
    r >= g - 0.02 &&
    r > b + 0.08
  )
    return { status: "VACACIONES_PENDIENTES", confidence: 0.92 };

  // Laudo is orange: strong red, clearly more green than blue. Requiring the
  // green-blue separation prevents pale brown cycle holidays becoming Laudo.
  if (
    r > 0.46 &&
    g > 0.24 &&
    b < 0.20 &&
    r - g > 0.13 &&
    g - b > 0.09 &&
    saturation > 0.18 &&
    luma >= 0.34
  )
    return { status: "LAUDO", confidence: 0.91 };

  // Fiesta propia: warm/pale brown. This intentionally accepts a wider range
  // than Laudo but only after the stricter orange rule above has failed.
  if (
    r > 0.39 &&
    r > g + 0.07 &&
    g >= b - 0.015 &&
    b < 0.31 &&
    saturation > 0.08 &&
    luma >= 0.30
  )
    return { status: "FEST", confidence: 0.87 };

  // Pale green / grey-green used by revisión médica.
  if (
    g > r + 0.03 &&
    g > b + 0.025 &&
    r > 0.24 &&
    b > 0.23 &&
    saturation > 0.055
  )
    return { status: "REVISION_MEDICA", confidence: 0.78 };

  if (
    saturation < 0.15 &&
    Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b)) < 0.07
  )
    return { status: "AGCG", confidence: 0.88 };

  return null;
}

type AnnualPaletteFamily =
  | "BLUE"
  | "CYAN"
  | "GREEN"
  | "PINK"
  | "NEUTRAL"
  | "VACATION"
  | "LAUDO"
  | "WARM"
  | "MEDICAL"
  | "UNKNOWN";

function stabilizeAnnualPalette(
  raw: Record<number, DayData[]>,
  features: Record<number, (AnnualColourFeature | null)[]>,
) {
  const entries: {
      month: number;
      index: number;
      feature: AnnualColourFeature;
    }[] = [];
  for (let month = 1; month <= 12; month++)
    (raw[month] || []).forEach((day, index) => {
      const feature = features[month]?.[index];
      if (feature) entries.push({ month, index, feature });
    });

  if (entries.length < 30)
    return { changed: 0, clusters: 0, families: [] as AnnualPaletteFamily[] };

  const vector = (feature: AnnualColourFeature) => [
      feature.red * 4,
      feature.green * 4,
      feature.blue * 4,
      feature.saturation * 1.4,
      feature.luma,
    ],
    vectors = entries.map((entry) => vector(entry.feature)),
    distance2 = (a: number[], b: number[]) =>
      a.reduce((sum, value, index) => {
        const delta = value - b[index];
        return sum + delta * delta;
      }, 0),
    k = Math.min(10, entries.length),
    centers: number[][] = [];

  let seed = 0;
  for (let i = 1; i < entries.length; i++)
    if (entries[i].feature.luma < entries[seed].feature.luma) seed = i;
  centers.push([...vectors[seed]]);
  while (centers.length < k) {
    let bestIndex = 0,
      bestDistance = -1;
    for (let i = 0; i < vectors.length; i++) {
      const nearest = Math.min(
        ...centers.map((center) => distance2(vectors[i], center)),
      );
      if (nearest > bestDistance) {
        bestDistance = nearest;
        bestIndex = i;
      }
    }
    centers.push([...vectors[bestIndex]]);
  }

  let assignments = new Array(entries.length).fill(-1);
  for (let iteration = 0; iteration < 30; iteration++) {
    const next = vectors.map((item) => {
      let best = 0,
        bestDistance = Infinity;
      centers.forEach((center, index) => {
        const distance = distance2(item, center);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      return best;
    });
    const sums = Array.from({ length: k }, () => Array(5).fill(0)),
      counts = Array(k).fill(0);
    next.forEach((cluster, index) => {
      counts[cluster]++;
      vectors[index].forEach((value, dimension) => {
        sums[cluster][dimension] += value;
      });
    });
    for (let cluster = 0; cluster < k; cluster++)
      if (counts[cluster])
        centers[cluster] = sums[cluster].map(
          (value) => value / counts[cluster],
        );
    const stable = next.every((cluster, index) => cluster === assignments[index]);
    assignments = next;
    if (stable) break;
  }

  const clusterFeatures: AnnualColourFeature[] = centers.map((center) => ({
      red: center[0] / 4,
      green: center[1] / 4,
      blue: center[2] / 4,
      saturation: center[3] / 1.4,
      luma: center[4],
      rawRed: 0,
      rawGreen: 0,
      rawBlue: 0,
    })),
    counts = Array(k).fill(0);
  assignments.forEach((cluster) => counts[cluster]++);

  const familyFor = (
    feature: AnnualColourFeature,
    count: number,
  ): AnnualPaletteFamily => {
    const direct = annualFeatureEvidence(feature);
    if (direct?.detectedColour === "BLUE") return "BLUE";
    if (direct?.status === "DCOM") return "CYAN";
    if (direct?.status === "ENFERMEDAD") return "GREEN";
    if (direct?.status === "FORMACION") return "PINK";
    if (direct?.status === "VACACIONES_PENDIENTES") return "VACATION";
    if (direct?.status === "LAUDO" && count <= 8) return "LAUDO";
    if (direct?.status === "FEST") return "WARM";
    if (direct?.status === "REVISION_MEDICA") return "MEDICAL";
    if (direct?.status === "AGCG") return "NEUTRAL";
    return "UNKNOWN";
  };

  const families = clusterFeatures.map((feature, cluster) =>
    familyFor(feature, counts[cluster]),
  );

  let changed = 0;
  entries.forEach((entry, flatIndex) => {
    const current = raw[entry.month][entry.index];

    // Direct reading always wins. The palette is a recovery tool only for
    // genuinely unresolved cells.
    if (
      current.status !== "REVISAR" ||
      current.detectedColour === "BLUE" ||
      (current.confidence || 0) >= 0.72
    )
      return;

    const family = families[assignments[flatIndex]];
    let status: Status | null = null,
      detectedColour: "BLUE" | undefined,
      confidence = 0.68;

    if (family === "BLUE") {
      status = "REVISAR";
      detectedColour = "BLUE";
      confidence = 0.82;
    } else if (family === "CYAN") status = "DCOM";
    else if (family === "GREEN") status = "ENFERMEDAD";
    else if (family === "PINK") status = "FORMACION";
    else if (family === "NEUTRAL") status = "AGCG";
    else if (family === "VACATION") status = "VACACIONES_PENDIENTES";
    else if (family === "LAUDO") status = "LAUDO";
    else if (family === "MEDICAL") status = "REVISION_MEDICA";
    // WARM is intentionally left unresolved. Fiesta vs Laudo is never
    // inferred from the labour cycle; calibration may recover it only from
    // other directly recognised colours in this same image.
    if (!status) return;

    raw[entry.month][entry.index] = {
      ...current,
      status,
      baseStatus: baseOf(status),
      detectedColour,
      confidence,
      note: "Lectura dudosa recuperada por la paleta relativa de la imagen",
    };
    changed++;
  });

  return { changed, clusters: k, families };
}

function annualColourFeatureDistance(
  a: AnnualColourFeature,
  b: AnnualColourFeature,
) {
  return Math.hypot(
    (a.red - b.red) * 3.2,
    (a.green - b.green) * 3.2,
    (a.blue - b.blue) * 3.2,
    (a.saturation - b.saturation) * 0.8,
    (a.luma - b.luma) * 0.35,
  );
}

function calibrateAnnualUncertainColours(
  raw: Record<number, DayData[]>,
  features: Record<number, (AnnualColourFeature | null)[]>,
) {
  const eligibleStatuses = new Set<Status>([
      "AGCG",
      "DCOM",
      "FEST",
      "FORMACION",
      "ENFERMEDAD",
      "REVISION_MEDICA",
      "LAUDO",
      "VACACIONES_PENDIENTES",
    ]),
    samples = new Map<Status, AnnualColourFeature[]>();

  for (let month = 1; month <= 12; month++) {
    (raw[month] || []).forEach((day, index) => {
      const feature = features[month]?.[index];
      if (
        !feature ||
        !eligibleStatuses.has(day.status) ||
        day.detectedColour === "BLUE" ||
        (day.confidence || 0) < 0.55
      )
        return;
      const values = samples.get(day.status) || [];
      values.push(feature);
      samples.set(day.status, values);
    });
  }

  const median = (values: number[]) => {
      const ordered = [...values].sort((a, b) => a - b);
      return ordered[Math.floor(ordered.length / 2)];
    },
    percentile = (values: number[], q: number) => {
      const ordered = [...values].sort((a, b) => a - b);
      if (!ordered.length) return 0;
      return ordered[Math.min(
        ordered.length - 1,
        Math.floor((ordered.length - 1) * q),
      )];
    },
    models: {
      status: Status;
      center: AnnualColourFeature;
      radius: number;
    }[] = [];

  for (const [status, values] of samples) {
    if (values.length < 3) continue;
    const center: AnnualColourFeature = {
        red: median(values.map((v) => v.red)),
        green: median(values.map((v) => v.green)),
        blue: median(values.map((v) => v.blue)),
        saturation: median(values.map((v) => v.saturation)),
        luma: median(values.map((v) => v.luma)),
        rawRed: median(values.map((v) => v.rawRed)),
        rawGreen: median(values.map((v) => v.rawGreen)),
        rawBlue: median(values.map((v) => v.rawBlue)),
      },
      distances = values.map((v) => annualColourFeatureDistance(v, center)),
      radius = Math.max(0.055, percentile(distances, 0.82) * 1.9);
    models.push({ status, center, radius });
  }

  const recoveredByMonth = Array.from({ length: 12 }, () => 0);
  let total = 0;
  if (models.length < 2) return { total, recoveredByMonth };

  for (let month = 1; month <= 12; month++) {
    raw[month] = (raw[month] || []).map((day, index) => {
      const feature = features[month]?.[index];
      if (
        day.status !== "REVISAR" ||
        day.detectedColour === "BLUE" ||
        !feature
      )
        return day;

      const ranked = models
        .map((model) => ({
          ...model,
          distance: annualColourFeatureDistance(feature, model.center),
        }))
        .map((candidate) => ({
          ...candidate,
          normalized: candidate.distance / candidate.radius,
        }))
        .sort((a, b) => a.normalized - b.normalized),
        best = ranked[0],
        second = ranked[1];

      if (!best || best.normalized > 1.12) return day;
      if (
        second &&
        second.normalized - best.normalized < 0.32 &&
        second.normalized / Math.max(best.normalized, 0.001) < 1.45
      )
        return day;

      total++;
      recoveredByMonth[month - 1]++;
      return {
        ...day,
        status: best.status,
        baseStatus: baseOf(best.status),
        confidence: Math.max(
          day.confidence || 0,
          Math.min(0.78, 0.58 + (1.12 - best.normalized) * 0.18),
        ),
        note: "Color recuperado por calibración local de la misma imagen",
      };
    });
  }
  return { total, recoveredByMonth };
}

function monthlyColorMask(r: number, g: number, b: number) {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  return max - min > 34 && max > 105 && min < 235;
}

function detectMonthlyColorBand(
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const step = Math.max(1, Math.round(Math.max(width, height) / 900));
  let minX = width,
    maxX = -1,
    minY = height,
    maxY = -1,
    count = 0;
  for (let y = Math.floor(height * 0.12); y < Math.floor(height * 0.88); y += step) {
    for (let x = Math.floor(width * 0.02); x < Math.floor(width * 0.98); x += step) {
      const p = (y * width + x) * 4;
      if (!monthlyColorMask(data[p], data[p + 1], data[p + 2])) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      count++;
    }
  }
  if (count < 80 || maxX <= minX || maxY <= minY) return null;
  const bandW = maxX - minX,
    bandH = maxY - minY;
  if (bandW < width * 0.28 || bandW > width * 0.96 || bandH < height * 0.025)
    return null;
  return { x: minX, y: minY, width: bandW, height: bandH };
}

async function classifyMonthly(file: File, year: number, month: number) {
  // Primero intentamos trabajar sobre una copia enderezada de la foto.
  // Si no podemos localizar el panel mensual con suficiente seguridad,
  // conservamos exactamente el detector anterior como respaldo.
  const rectified = await rectifyMonthly(file);
  let canvas: HTMLCanvasElement;
  if (rectified) {
    canvas = rectified;
  } else {
    const bitmap = await createImageBitmap(file);
    canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const sourceCtx = canvas.getContext("2d", { willReadFrequently: true });
    if (!sourceCtx) {
      bitmap.close();
      return null;
    }
    sourceCtx.drawImage(bitmap, 0, 0);
    bitmap.close();
  }
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const full = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let border: { y: number; x: number; length: number } | null = null;
  for (
    let y = Math.floor(canvas.height * 0.12);
    y < Math.floor(canvas.height * 0.88) && !border;
    y++
  ) {
    let start = 0,
      run = 0,
      bestStart = 0,
      bestLength = 0;
    for (let x = 0; x < canvas.width; x++) {
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
  if (!border) {
    const colorBand = detectMonthlyColorBand(full, canvas.width, canvas.height);
    if (!colorBand) return null;
    border = {
      y: Math.max(0, colorBand.y - Math.max(2, colorBand.height * 0.12)),
      x: colorBand.x,
      length: colorBand.width,
    };
  }

  const cellW = border.length / 7,
    weeks = Math.ceil(
      (weekdayMon(year, month, 1) + daysInMonth(year, month)) / 7,
    );

  // En lugar de las antiguas constantes 68 y 38 px, buscamos dónde termina
  // realmente la cabecera y dónde está el borde inferior de la cuadrícula.
  let lastHeader = border.y;
  for (
    let y = border.y;
    y < Math.min(canvas.height, border.y + cellW * 2.8);
    y++
  ) {
    let header = 0,
      total = 0;
    for (
      let x = Math.round(border.x);
      x < Math.round(border.x + border.length);
      x += 2
    ) {
      const p = (y * canvas.width + Math.min(canvas.width - 1, x)) * 4;
      if (isHeaderColor(full[p], full[p + 1], full[p + 2])) header++;
      total++;
    }
    if (total && header / total > 0.42) lastHeader = y;
  }

  const gridTop = lastHeader + 1,
    expectedBottom = gridTop + cellW * weeks,
    bottom = findPanelBottom(
      ctx,
      border.x,
      expectedBottom,
      border.length,
      Math.max(cellW, canvas.height * 0.08),
      canvas,
    ),
    cellH = (bottom - gridTop) / weeks;

  // Si la geometría encontrada no es coherente, no inventamos lecturas.
  if (
    !Number.isFinite(cellH) ||
    cellH < cellW * 0.35 ||
    cellH > cellW * 1.8
  )
    return null;

  const result = new Map<number, Status>();
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const index = weekdayMon(year, month, 1) + day - 1,
      col = index % 7,
      row = Math.floor(index / 7),
      cx = border.x + cellW * (col + 0.5),
      cy = gridTop + cellH * (row + 0.5),
      evidence = annualCellEvidence(ctx, cx, cy, cellW, cellH, canvas);
    result.set(day, evidence.status);
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
function detectModernAnnualPanels(canvas: HTMLCanvasElement, year: number, allowJoinedCells = false, diagnostic?: string[]): AnnualPanel[] | null {
  const mode = allowJoinedCells ? "moderno permisivo" : "moderno estricto";
  const fail = (reason: string): null => {
    diagnostic?.push(mode + ": " + reason);
    return null;
  };
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fail("sin contexto canvas");
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
  const minimumCells = allowJoinedCells ? 280 : 350;
  if (cells.length < minimumCells) return fail(cells.length + " celdas candidatas; mínimo " + minimumCells);
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
  if (xs.length !== 28) return fail(xs.length + " columnas detectadas; esperadas 28");
  const rowGroups: number[][] = [];
  for (const y of ys) {
    const last = rowGroups[rowGroups.length - 1];
    if (last && y - last[last.length - 1] < cellHeight * 1.8) last.push(y); else rowGroups.push([y]);
  }
  if (rowGroups.length !== 3) return fail(rowGroups.length + " filas de meses detectadas; esperadas 3");
  if (allowJoinedCells) {
    // Joined JPEG cell backgrounds may lose individual components. Require
    // three separately observed regular lattices; never split one band.
    for (const rows of rowGroups) {
      if (rows.length < 5 || rows.length > 6) return fail("fila de meses con " + rows.length + " líneas de semanas; esperadas 5 o 6");
      const step = middle(rows.slice(1).map((y, i) => y - rows[i]));
      if (rows.slice(1).some((y, i) => Math.abs(y - rows[i] - step) > step * .12)) return fail("separación vertical irregular entre semanas");
    }
    for (let r = 1; r < 3; r++)
      if (rowGroups[r][0] - rowGroups[r - 1].at(-1)! < cellHeight * 2) return fail("separación insuficiente entre filas de meses");
  }
  const panels: AnnualPanel[] = [];
  for (let month = 1; month <= 12; month++) {
    const column = (month - 1) % 4, rows = rowGroups[Math.floor((month - 1) / 4)];
    const centers = xs.slice(column * 7, column * 7 + 7);
    const cellW = (centers[6] - centers[0]) / 6;
    const cellH = middle(rows.slice(1).map((y, i) => y - rows[i]));
    const panel = { x: centers[0] - cellW / 2, length: cellW * 7, gridTop: rows[0] - cellH / 2, cellH };
    if (allowJoinedCells) {
      if (centers.some((x, i) => Math.abs(x - centers[0] - i * cellW) > cellW * .08)) return fail("mes " + month + ": columnas irregulares");
      // Validate filled dates AND empty leading/trailing slots from pixels.
      // Date placement is calendar geometry, not the worker's 28-day cycle.
      const first = weekdayMon(year, month, 1), count = daysInMonth(year, month);
      for (let index = 0; index < rows.length * 7; index++) {
        const cx = centers[index % 7], cy = rows[0] + Math.floor(index / 7) * cellH;
        let filled = 0, total = 0;
        for (let y = Math.ceil(cy - cellH * .28); y <= Math.floor(cy + cellH * .28); y++)
          for (let x = Math.ceil(cx - cellW * .30); x <= Math.floor(cx + cellW * .30); x++) {
            if (x < 0 || y < 0 || x >= width || y >= height) return fail("mes " + month + ": cuadrícula fuera de los límites");
            total++; filled += originalMask[y * width + x];
          }
        const expectedDate = index >= first && index < first + count;
        if (!total || (expectedDate ? filled / total < .70 : filled / total > .15))
          return fail("mes " + month + ", posición " + (index + 1) + ": ocupación " + (total ? Math.round(filled / total * 100) : 0) + "%; " + (expectedDate ? "esperaba fecha" : "esperaba hueco"));
      }
    }
    // Every actual date must have a rectangle at its expected grid position.
    // Reject incomplete/misaligned layouts instead of accepting a count alone.
    for (let day = 1; day <= daysInMonth(year, month); day++) {
      const index = weekdayMon(year, month, 1) + day - 1;
      if (!cells.some(c => Math.abs(c.x - centers[index % 7]) < cellW * .15 &&
        Math.abs(c.y - (rows[0] + Math.floor(index / 7) * cellH)) < cellH * .15)) { if (!allowJoinedCells) return fail("mes " + month + ": no se localiza la celda del día " + day); }
    }
    panels.push(panel);
  }
  return panels;
}

function detectAnnualPanelsByBands(
  canvas: HTMLCanvasElement,
  year: number,
): AnnualPanel[] | null {
  const fail = (reason: string) => { throw new Error(`ANUAL-V5 · ${reason}`); };
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fail("sin contexto canvas");
  const { width, height } = canvas,
    data = ctx.getImageData(0, 0, width, height).data,
    filledAt = (x: number, y: number) => {
      const p = (y * width + x) * 4,
        r = data[p],
        g = data[p + 1],
        b = data[p + 2],
        max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      return max > 90 && ((r + g + b < 690 && min < 235) || max - min > 28);
    },
    rowHits = new Int32Array(height);

  for (let y = Math.floor(height * 0.08); y < Math.floor(height * 0.84); y++) {
    let hits = 0;
    for (let x = 0; x < width; x += 2) if (filledAt(x, y)) hits += 2;
    rowHits[y] = hits;
  }

  // En la captura real las filas de celdas quedan unidas visualmente. Por eso
  // buscamos las tres bandas grandes del calendario, no doce filas aisladas.
  const bands: { top: number; bottom: number }[] = [];
  let top = -1;
  for (let y = Math.floor(height * 0.08); y < Math.floor(height * 0.84); y++) {
    const on = rowHits[y] > width * 0.42;
    if (on && top < 0) top = y;
    if (top >= 0 && (!on || y === Math.floor(height * 0.84) - 1)) {
      const bottom = on ? y : y - 1;
      if (bottom - top > height * 0.07) bands.push({ top, bottom });
      top = -1;
    }
  }
  if (bands.length !== 3) {
    return fail(`bandas grandes: ${bands.length} (esperadas 3); no se subdivide una banda aislada`);
  }

  function panelRunsAt(y: number) {
    const runs: { start: number; end: number }[] = [];
    let start = -1,
      last = -1,
      gap = 0;
    const close = () => {
      if (start >= 0) {
        const length = last - start + 1;
        if (length > width * 0.18 && length < width * 0.27)
          runs.push({ start, end: last });
      }
      start = -1;
      last = -1;
      gap = 0;
    };
    for (let x = 0; x < width; x++) {
      if (filledAt(x, y)) {
        if (start < 0) start = x;
        last = x;
        gap = 0;
      } else if (start >= 0 && ++gap > Math.max(3, width * 0.003)) close();
    }
    close();
    return runs;
  }

  const panels: AnnualPanel[] = [];
  for (let row = 0; row < 3; row++) {
    const band = bands[row],
      months = [row * 4 + 1, row * 4 + 2, row * 4 + 3, row * 4 + 4],
      occupancies = Array.from({ length: 6 }, (_, week) => {
        let dates = 0;
        for (const month of months)
          for (let day = 1; day <= daysInMonth(year, month); day++)
            if (
              Math.floor((weekdayMon(year, month, 1) + day - 1) / 7) === week
            )
              dates++;
        return dates / 28;
      }),
      activeWeeks = occupancies
        .map((value, week) => ({ value, week }))
        .filter(({ value }) => value > 0.42)
        .map(({ week }) => week);
    if (!activeWeeks.length) return fail(`fila ${row + 1}: sin semanas activas`);
    const firstActiveWeek = activeWeeks[0],
      lastActiveWeek = activeWeeks[activeWeeks.length - 1],
      activeSpan = lastActiveWeek - firstActiveWeek + 1,
      cellH = (band.bottom - band.top + 1) / activeSpan,
      gridTop = band.top - firstActiveWeek * cellH;

    // En una semana central los cuatro meses tienen siete celdas completas.
    // Buscamos esa línea real para obtener los cuatro anchos y márgenes.
    let runs: ReturnType<typeof panelRunsAt> = [],
      bestCount = 0;
    // La tercera fila puede quedar muy cerca de la leyenda. Recorremos toda
    // la altura útil de la banda y nos quedamos con una línea que separe
    // claramente los cuatro meses, en vez de probar solo tres alturas fijas.
    const scanTop = Math.max(0, Math.floor(band.top + cellH * 0.15)),
      scanBottom = Math.min(height - 1, Math.ceil(band.bottom - cellH * 0.15)),
      scanStep = Math.max(1, Math.floor(cellH * 0.18));
    for (let y = scanTop; y <= scanBottom; y += scanStep) {
      const found = panelRunsAt(y);
      bestCount = Math.max(bestCount, found.length);
      if (found.length === 4) {
        runs = found;
        break;
      }
    }
    if (runs.length !== 4)
      return fail(
        `fila ${row + 1}: ${bestCount} paneles máximo (esperados 4)`,
      );

    for (const run of runs) {
      const pad = Math.max(1, Math.round(width * 0.0015)),
        x = Math.max(0, run.start - pad),
        length = Math.min(width - x, run.end - run.start + 1 + pad * 2),
        cellW = length / 7,
        // La banda de color detectada no representa la altura completa de las
        // celdas: en fotos comprimidas suele ser solo su núcleo coloreado.
        // Recuperamos la altura de la cuadrícula a partir del ancho real de
        // siete columnas, cuya proporción en el calendario TMB es estable.
        correctedCellH =
          cellH < cellW * 0.28 ? cellW * 0.42 : cellH,
        bandCenter = (band.top + band.bottom) / 2,
        activeCenter = (firstActiveWeek + lastActiveWeek + 1) / 2,
        correctedGridTop = bandCenter - activeCenter * correctedCellH;
      if (
        correctedCellH < cellW * 0.28 ||
        correctedCellH > cellW * 0.75
      )
        return fail(
          `fila ${row + 1}: proporción celda ${correctedCellH.toFixed(1)}/${cellW.toFixed(1)}`,
        );
      panels.push({
        x,
        length,
        gridTop: correctedGridTop,
        cellH: correctedCellH,
      });
    }
  }
  if (panels.length !== 12) return fail(`paneles finales: ${panels.length}`);
  return panels;
}


function detectProjectionAnnualPanels(
  canvas: HTMLCanvasElement,
  year: number,
  diagnostic?: string[],
): AnnualPanel[] | null {
  const fail = (reason: string): null => {
    diagnostic?.push("proyección: " + reason);
    return null;
  };
  const sourceContext = canvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) return fail("sin contexto canvas");

  const originalWidth = canvas.width,
    originalHeight = canvas.height,
    searchScale = Math.min(1, 1200 / originalWidth, 1000 / originalHeight);
  let search = canvas;
  if (searchScale < 1) {
    search = document.createElement("canvas");
    search.width = Math.max(1, Math.round(originalWidth * searchScale));
    search.height = Math.max(1, Math.round(originalHeight * searchScale));
    const searchContext = search.getContext("2d", { willReadFrequently: true });
    if (!searchContext) return fail("sin contexto canvas de búsqueda");
    searchContext.drawImage(canvas, 0, 0, search.width, search.height);
  }

  const W = search.width,
    H = search.height,
    searchContext = search.getContext("2d", { willReadFrequently: true });
  if (!searchContext) return fail("sin contexto canvas de proyección");
  const pixels = searchContext.getImageData(0, 0, W, H).data,
    gray = new Float32Array(W * H),
    chroma = new Float32Array(W * H);
  for (let i = 0; i < gray.length; i++) {
    const r = pixels[i * 4],
      g = pixels[i * 4 + 1],
      b = pixels[i * 4 + 2],
      max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    gray[i] = r * 0.299 + g * 0.587 + b * 0.114;
    chroma[i] = max - min;
  }

  const satAt = (x: number, y: number) => {
      const i = y * W + x,
        p = i * 4,
        max = Math.max(pixels[p], pixels[p + 1], pixels[p + 2]);
      return chroma[i] > 35 && max > 70;
    },
    rowHistogram = new Float64Array(H),
    scanTop = Math.max(0, Math.floor(H * 0.16)),
    scanBottom = Math.min(H - 1, Math.ceil(H * 0.93));

  for (let y = scanTop; y <= scanBottom; y++)
    for (let x = 0; x < W; x += 2)
      if (satAt(x, y)) rowHistogram[y]++;

  const histogramTotal = (hist: Float64Array) => {
      let total = 0;
      for (const value of hist) total += value;
      return total;
    },
    weightedQuantile = (hist: Float64Array, q: number) => {
      const total = histogramTotal(hist);
      if (!total) return 0;
      const target = total * q;
      let acc = 0;
      for (let i = 0; i < hist.length; i++) {
        acc += hist[i];
        if (acc >= target) return i;
      }
      return hist.length - 1;
    };

  const totalSaturated = histogramTotal(rowHistogram);
  if (totalSaturated < W * H * 0.002)
    return fail("muy pocos píxeles de estructura coloreada");

  let rowCenters = [
    weightedQuantile(rowHistogram, 0.2),
    weightedQuantile(rowHistogram, 0.5),
    weightedQuantile(rowHistogram, 0.8),
  ];
  for (let iteration = 0; iteration < 24; iteration++) {
    const sums = [0, 0, 0],
      weights = [0, 0, 0];
    for (let y = scanTop; y <= scanBottom; y++) {
      const weight = rowHistogram[y];
      if (!weight) continue;
      let best = 0,
        distance = Math.abs(y - rowCenters[0]);
      for (let k = 1; k < 3; k++) {
        const next = Math.abs(y - rowCenters[k]);
        if (next < distance) {
          distance = next;
          best = k;
        }
      }
      sums[best] += y * weight;
      weights[best] += weight;
    }
    const next = rowCenters.map((center, k) =>
      weights[k] ? sums[k] / weights[k] : center,
    );
    next.sort((a, b) => a - b);
    if (next.every((value, k) => Math.abs(value - rowCenters[k]) < 0.05)) {
      rowCenters = next;
      break;
    }
    rowCenters = next;
  }
  if (
    rowCenters[1] - rowCenters[0] < H * 0.08 ||
    rowCenters[2] - rowCenters[1] < H * 0.08
  )
    return fail("las tres filas del calendario no quedan separadas");

  const nearestRow = (y: number) => {
    let best = 0,
      distance = Math.abs(y - rowCenters[0]);
    for (let k = 1; k < 3; k++) {
      const next = Math.abs(y - rowCenters[k]);
      if (next < distance) {
        distance = next;
        best = k;
      }
    }
    return best;
  };

  const integralWidth = W + 1,
    featureIntegral = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let rowSum = 0;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      rowSum += 255 - gray[i] + chroma[i] * 0.8;
      featureIntegral[(y + 1) * integralWidth + x + 1] =
        featureIntegral[y * integralWidth + x + 1] + rowSum;
    }
  }
  const patchMean = (
    cx: number,
    cy: number,
    radiusX: number,
    radiusY: number,
  ) => {
    const left = Math.max(0, Math.floor(cx - radiusX)),
      right = Math.min(W - 1, Math.ceil(cx + radiusX)),
      top = Math.max(0, Math.floor(cy - radiusY)),
      bottom = Math.min(H - 1, Math.ceil(cy + radiusY));
    if (right < left || bottom < top) return 0;
    const a = top * integralWidth + left,
      b = top * integralWidth + right + 1,
      c = (bottom + 1) * integralWidth + left,
      d = (bottom + 1) * integralWidth + right + 1,
      sum =
        featureIntegral[d] -
        featureIntegral[b] -
        featureIntegral[c] +
        featureIntegral[a];
    return sum / ((right - left + 1) * (bottom - top + 1));
  };

  type GridFit = {
    x0: number;
    cellW: number;
    gap: number;
    score: number;
    y0: number;
    cellH: number;
  };
  const rowFits: GridFit[] = [];

  for (let row = 0; row < 3; row++) {
    const rowYHistogram = new Float64Array(H),
      xHistogram = new Float64Array(W);
    for (let y = scanTop; y <= scanBottom; y++) {
      if (nearestRow(y) !== row) continue;
      for (let x = 0; x < W; x += 2) {
        if (!satAt(x, y)) continue;
        rowYHistogram[y]++;
        xHistogram[x]++;
      }
    }
    const rowWeight = histogramTotal(rowYHistogram);
    if (rowWeight < totalSaturated * 0.06)
      return fail("fila " + (row + 1) + ": poca estructura visible");

    const yLow = weightedQuantile(rowYHistogram, 0.03),
      yHigh = weightedQuantile(rowYHistogram, 0.97),
      xLow = weightedQuantile(xHistogram, 0.02),
      xHigh = weightedQuantile(xHistogram, 0.98);
    if (xHigh - xLow < W * 0.45)
      return fail("fila " + (row + 1) + ": ancho útil insuficiente");

    const edgeTop = Math.max(1, Math.floor(yLow - H * 0.01)),
      edgeBottom = Math.min(H - 2, Math.ceil(yHigh + H * 0.01)),
      verticalEdge = new Float64Array(W);
    for (let x = 1; x < W - 1; x++) {
      let hits = 0,
        total = 0;
      for (let y = edgeTop; y <= edgeBottom; y++) {
        const left = gray[y * W + x - 1],
          right = gray[y * W + x + 1];
        if (Math.abs(right - left) > 25) hits++;
        total++;
      }
      verticalEdge[x] = total ? hits / total : 0;
    }
    const smoothEdge = new Float64Array(W);
    for (let x = 0; x < W; x++) {
      let best = 0;
      for (let xx = Math.max(0, x - 1); xx <= Math.min(W - 1, x + 1); xx++)
        best = Math.max(best, verticalEdge[xx]);
      smoothEdge[x] = best;
    }

    const roughCellW = (xHigh - xLow) / 26;
    let bestX:
      | { score: number; x0: number; cellW: number; gap: number }
      | undefined;
    for (
      let cellW = Math.max(6, roughCellW * 0.65);
      cellW <= roughCellW * 1.45;
      cellW += 0.5
    ) {
      for (let gapRatio = 0; gapRatio <= 0.6001; gapRatio += 0.1) {
        const gap = cellW * gapRatio,
          span = 4 * 7 * cellW + 3 * gap;
        if (span < W * 0.55 || span > W * 0.98) continue;
        const start = Math.max(0, Math.floor(xLow - cellW * 2.2)),
          end = Math.min(
            Math.floor(W - span),
            Math.floor(xLow + cellW * 0.8),
          );
        for (let x0 = start; x0 <= end; x0++) {
          let score = 0,
            samples = 0;
          for (let month = 0; month < 4; month++) {
            const base = x0 + month * (7 * cellW + gap);
            for (let boundary = 0; boundary <= 7; boundary++) {
              const x = Math.round(base + boundary * cellW);
              if (x < 0 || x >= W) continue;
              score += smoothEdge[x];
              samples++;
            }
          }
          if (!samples) continue;
          score /= samples;
          if (
            x0 <= xLow + cellW * 0.7 &&
            x0 + span >= xHigh - cellW * 0.7
          )
            score += 0.05;
          if (!bestX || score > bestX.score)
            bestX = { score, x0, cellW, gap };
        }
      }
    }
    if (!bestX || bestX.score < 0.16)
      return fail(
        "fila " +
          (row + 1) +
          ": cuadrícula vertical débil (" +
          (bestX?.score ?? 0).toFixed(3) +
          ")",
      );

    const geometryScore = (
      y0: number,
      cellH: number,
      monthStart: number,
      monthCount: number,
    ) => {
      let occupied = 0,
        occupiedCount = 0,
        empty = 0,
        emptyCount = 0;
      for (let localMonth = 0; localMonth < monthCount; localMonth++) {
        const monthIndex = monthStart + localMonth,
          month = row * 4 + monthIndex + 1,
          first = weekdayMon(year, month, 1),
          count = daysInMonth(year, month),
          baseX =
            bestX!.x0 + monthIndex * (7 * bestX!.cellW + bestX!.gap);
        for (let slot = 0; slot < 42; slot++) {
          const cx = baseX + (slot % 7 + 0.5) * bestX!.cellW,
            cy = y0 + (Math.floor(slot / 7) + 0.5) * cellH,
            value = patchMean(
              cx,
              cy,
              bestX!.cellW * 0.2,
              cellH * 0.18,
            );
          if (slot >= first && slot < first + count) {
            occupied += value;
            occupiedCount++;
          } else {
            empty += value;
            emptyCount++;
          }
        }
      }
      return occupiedCount && emptyCount
        ? occupied / occupiedCount - empty / emptyCount
        : -Infinity;
    };

    let bestY:
      | { score: number; y0: number; cellH: number }
      | undefined;
    for (
      let cellH = bestX.cellW * 0.52;
      cellH <= bestX.cellW * 0.72;
      cellH += 0.5
    ) {
      const start = Math.max(0, Math.floor(rowCenters[row] - cellH * 4)),
        end = Math.min(
          Math.floor(H - cellH * 6),
          Math.ceil(rowCenters[row] + cellH * 0.5),
        );
      for (let y0 = start; y0 <= end; y0++) {
        const score = geometryScore(y0, cellH, 0, 4);
        if (!bestY || score > bestY.score)
          bestY = { score, y0, cellH };
      }
    }
    if (!bestY || bestY.score < 12)
      return fail(
        "fila " +
          (row + 1) +
          ": fechas y huecos no separan la cuadrícula (" +
          (bestY?.score ?? 0).toFixed(1) +
          ")",
      );

    rowFits.push({ ...bestX, y0: bestY.y0, cellH: bestY.cellH });
  }

  const scaleBack = 1 / searchScale,
    panels: AnnualPanel[] = [];
  for (let row = 0; row < 3; row++) {
    const fit = rowFits[row];
    for (let column = 0; column < 4; column++) {
      const month = row * 4 + column + 1,
        first = weekdayMon(year, month, 1),
        count = daysInMonth(year, month),
        baseX = fit.x0 + column * (7 * fit.cellW + fit.gap);
      let bestMonth = {
        score: -Infinity,
        y0: fit.y0,
        cellH: fit.cellH,
      };
      for (
        let cellH = fit.cellH * 0.9;
        cellH <= fit.cellH * 1.1;
        cellH += 0.5
      ) {
        const start = Math.max(0, Math.floor(fit.y0 - fit.cellH * 1.4)),
          end = Math.min(
            Math.floor(H - cellH * 6),
            Math.ceil(fit.y0 + fit.cellH * 1.4),
          );
        for (let y0 = start; y0 <= end; y0++) {
          let occupied = 0,
            occupiedCount = 0,
            empty = 0,
            emptyCount = 0;
          for (let slot = 0; slot < 42; slot++) {
            const cx = baseX + (slot % 7 + 0.5) * fit.cellW,
              cy = y0 + (Math.floor(slot / 7) + 0.5) * cellH,
              value = patchMean(
                cx,
                cy,
                fit.cellW * 0.2,
                cellH * 0.18,
              );
            if (slot >= first && slot < first + count) {
              occupied += value;
              occupiedCount++;
            } else {
              empty += value;
              emptyCount++;
            }
          }
          const score =
            occupiedCount && emptyCount
              ? occupied / occupiedCount - empty / emptyCount
              : -Infinity;
          if (score > bestMonth.score)
            bestMonth = { score, y0, cellH };
        }
      }
      panels.push({
        x: baseX * scaleBack,
        length: 7 * fit.cellW * scaleBack,
        gridTop: bestMonth.y0 * scaleBack,
        cellH: bestMonth.cellH * scaleBack,
      });
    }
  }

  return panels.length === 12 ? panels : fail("paneles finales: " + panels.length);
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

  function runsAt(y: number, columns: 4 | 6) {
    const runs: { start: number; end: number; density: number }[] = [];
    let start = -1,
      last = -1,
      count = 0,
      gap = 0;

    const close = () => {
      if (start < 0) return;
      const length = last - start + 1,
        density = length > 0 ? count / length : 0,
        minLength = columns === 6 ? width * 0.1 : width * 0.18,
        maxLength = columns === 6 ? width * 0.19 : width * 0.29;
      if (length > minLength && length < maxLength && density > 0.42)
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

  function tryLayout(columns: 4 | 6, rowCount: 2 | 3) {
    const candidates: { y: number; runs: ReturnType<typeof runsAt> }[] = [];
    for (
      let y = Math.floor(height * 0.02);
      y < Math.floor(height * 0.94);
      y++
    ) {
      const runs = runsAt(y, columns);
      if (runs.length === columns) candidates.push({ y, runs });
    }
    if (!candidates.length) return null;

    const anchors: typeof candidates = [];
    const minRowGap = height * (rowCount === 3 ? 0.18 : 0.32);
    for (const candidate of candidates) {
      if (
        !anchors.length ||
        candidate.y - anchors[anchors.length - 1].y > minRowGap
      )
        anchors.push(candidate);
      if (anchors.length === rowCount) break;
    }
    if (anchors.length !== rowCount) return null;

    const reference = anchors[0];
    const aligned = anchors.slice(1).every((anchor) =>
      reference.runs.every(
        (run, i) =>
          Math.abs(run.start - anchor.runs[i].start) < width * 0.035,
      ),
    );
    if (!aligned) return null;

    const makeRow = (
      anchor: (typeof anchors)[number],
      monthOffset: number,
    ): AnnualPanel[] => {
      const pad = Math.max(1, Math.round(width * 0.002));
      return anchor.runs.map((run, index) => {
        const x = Math.max(0, run.start - pad),
          length = Math.min(
            width - x,
            run.end - run.start + 1 + pad * 2,
          ),
          cellW = length / 7;
        let lastHeader = anchor.y;
        for (
          let y = anchor.y;
          y < Math.min(height, anchor.y + cellW * 2.8);
          y++
        ) {
          let header = 0,
            total = 0;
          for (
            let xx = Math.round(x);
            xx < Math.round(x + length);
            xx += 2
          ) {
            const p = (y * width + Math.min(width - 1, xx)) * 4;
            if (isHeaderColor(data[p], data[p + 1], data[p + 2]))
              header++;
            total++;
          }
          if (total && header / total > 0.46) lastHeader = y;
        }

        const month = monthOffset + index + 1,
          weeks = Math.ceil(
            (weekdayMon(year, month, 1) + daysInMonth(year, month)) / 7,
          ),
          gridTop = lastHeader + 1,
          panelBottom = findPanelBottom(
            ctx!,
            x,
            gridTop + cellW * weeks,
            length,
            cellW * 0.8,
            canvas,
          );

        return {
          x,
          length,
          gridTop,
          cellH: (panelBottom - gridTop) / weeks,
        };
      });
    };

    const panels = anchors.flatMap((anchor, row) =>
      makeRow(anchor, row * columns),
    );
    return panels.length === 12 ? panels : null;
  }

  // Conserva primero el formato histórico 6×2 ya probado y añade el
  // calendario recto moderno 4×3 usado por las capturas anuales actuales.
  return tryLayout(6, 2) || tryLayout(4, 3);
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

/**
 * Endereza una foto de un calendario mensual sin imponer la proporción del
 * calendario anual. La función queda separada del detector actual para poder
 * probar la rectificación antes de cambiar classifyMonthly().
 *
 * Busca dos bordes horizontales largos del panel y usa sus extremos como un
 * cuadrilátero. El remuestreo bilineal elimina la perspectiva típica de una
 * foto de móvil hecha a una pantalla.
 */
async function rectifyMonthly(file: File) {
  const bitmap = await createImageBitmap(file),
    ratio = Math.min(1, 2200 / bitmap.width, 1800 / bitmap.height),
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
    borders: { y: number; start: number; length: number }[] = [];
  for (let y = Math.floor(height * 0.04); y < Math.ceil(height * 0.96); y++) {
    const run = longestDarkRun(pixels, width, y);
    if (run.length >= width * 0.34)
      borders.push({ y, start: run.start, length: run.length });
  }
  if (borders.length < 2) return null;

  let best:
    | {
        top: (typeof borders)[number];
        bottom: (typeof borders)[number];
        score: number;
      }
    | undefined;
  for (let a = 0; a < borders.length; a++) {
    for (let b = a + 1; b < borders.length; b++) {
      const top = borders[a],
        bottom = borders[b],
        separation = bottom.y - top.y;
      if (separation < height * 0.2) continue;
      const widthSimilarity =
          Math.min(top.length, bottom.length) /
          Math.max(top.length, bottom.length),
        centreTop = top.start + top.length / 2,
        centreBottom = bottom.start + bottom.length / 2,
        centreShift = Math.abs(centreTop - centreBottom) / width;
      if (widthSimilarity < 0.58 || centreShift > 0.22) continue;
      const score =
        separation / height +
        widthSimilarity * 0.7 -
        centreShift * 1.5 +
        Math.min(top.length, bottom.length) / width;
      if (!best || score > best.score) best = { top, bottom, score };
    }
  }
  if (!best) return null;

  const tl: Point = { x: best.top.start, y: best.top.y },
    tr: Point = {
      x: best.top.start + best.top.length - 1,
      y: best.top.y,
    },
    bl: Point = { x: best.bottom.start, y: best.bottom.y },
    br: Point = {
      x: best.bottom.start + best.bottom.length - 1,
      y: best.bottom.y,
    },
    topWidth = Math.hypot(tr.x - tl.x, tr.y - tl.y),
    bottomWidth = Math.hypot(br.x - bl.x, br.y - bl.y),
    leftHeight = Math.hypot(bl.x - tl.x, bl.y - tl.y),
    rightHeight = Math.hypot(br.x - tr.x, br.y - tr.y),
    naturalWidth = (topWidth + bottomWidth) / 2,
    naturalHeight = (leftHeight + rightHeight) / 2;

  if (naturalWidth < 280 || naturalHeight < 180) return null;

  const output = document.createElement("canvas"),
    outputWidth = Math.max(700, Math.min(1800, Math.round(naturalWidth)));
  output.width = outputWidth;
  output.height = Math.max(
    360,
    Math.min(
      1500,
      Math.round(outputWidth * (naturalHeight / naturalWidth)),
    ),
  );
  const out = output.getContext("2d", { willReadFrequently: true });
  if (!out) return null;

  const sourceData = ctx.getImageData(0, 0, width, height),
    dest = out.createImageData(output.width, output.height);
  for (let y = 0; y < output.height; y++) {
    const v = output.height === 1 ? 0 : y / (output.height - 1);
    for (let x = 0; x < output.width; x++) {
      const u = output.width === 1 ? 0 : x / (output.width - 1),
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

// Geometry-only fallback for photographed annual calendars. Classification is
// deliberately separate: no labour-cycle or colour-to-status rule is used here.
function detectPhotographedAnnual(canvas: HTMLCanvasElement, year: number, diagnostic?: string[]) {
  const failures: string[] = [];
  const reject = (reason: string) => failures.push(reason);
  const fail = (reason: string): null => {
    diagnostic?.push("fotográfico: " + reason);
    return null;
  };
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fail("sin contexto canvas");
  // Bound geometry-search cost independently of camera resolution. The final
  // sampling uses the original loaded canvas, not the small search image.
  const originalWidth = canvas.width, originalHeight = canvas.height;
  const originalPixels = ctx.getImageData(0, 0, originalWidth, originalHeight).data;
  const searchScale = Math.min(1, 1600 / originalWidth, 1600 / originalHeight);
  let search = canvas;
  if (searchScale < 1) {
    search = document.createElement("canvas");
    search.width = Math.round(originalWidth * searchScale);
    search.height = Math.round(originalHeight * searchScale);
    const searchContext = search.getContext("2d");
    if (!searchContext) return fail("sin contexto canvas de búsqueda");
    searchContext.drawImage(canvas, 0, 0, search.width, search.height);
  }
  const W = search.width, H = search.height;
  const pixels = search.getContext("2d")!.getImageData(0, 0, W, H).data;
  const gray = new Float32Array(W * H);
  for (let i = 0; i < gray.length; i++) gray[i] = pixels[i * 4] * .299 + pixels[i * 4 + 1] * .587 + pixels[i * 4 + 2] * .114;
  const median = (v: number[]) => [...v].sort((a,b)=>a-b)[Math.floor(v.length / 2)];
  const quantile = (v: number[], q: number) => { const s=[...v].sort((a,b)=>a-b), k=(s.length-1)*q, i=Math.floor(k); return s[i]+(s[Math.min(i+1,s.length-1)]-s[i])*(k-i); };
  // Separable running maximum estimates nearby screen background illumination.
  const localMaximum = (radius: number) => {
    const tmp = new Float32Array(W*H), out = new Float32Array(W*H);
    for (const vertical of [false,true]) {
      const length=vertical?H:W, lines=vertical?W:H, src=vertical?tmp:gray, dst=vertical?out:tmp;
      const deque=new Int32Array(length);
      for(let line=0;line<lines;line++) {
        let head=0,tail=0,next=0; const index=(v:number)=>vertical?v*W+line:line*W+v;
        for(let v=0;v<length;v++) {
          const end=Math.min(length-1,v+radius);
          while(next<=end){while(tail>head&&src[index(deque[tail-1])]<=src[index(next)])tail--;deque[tail++]=next++;}
          while(head<tail&&deque[head]<v-radius)head++;
          dst[index(v)]=src[index(deque[head])];
        }
      }
    }
    return out;
  };
  type Cell={x:number;y:number;w:number;h:number};
  const solve = (A:number[][], B:number[][]) => {
    const n=A[0].length, aug=Array.from({length:n},()=>Array(n+2).fill(0));
    for(let k=0;k<A.length;k++) for(let i=0;i<n;i++) {
      for(let j=0;j<n;j++)aug[i][j]+=A[k][i]*A[k][j];
      for(let j=0;j<2;j++)aug[i][n+j]+=A[k][i]*B[k][j];
    }
    for(let i=0;i<n;i++) {
      let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(aug[j][i])>Math.abs(aug[pivot][i]))pivot=j;
      if(Math.abs(aug[pivot][i])<1e-8)return null;
      [aug[i],aug[pivot]]=[aug[pivot],aug[i]];const d=aug[i][i];for(let j=i;j<n+2;j++)aug[i][j]/=d;
      for(let k=0;k<n;k++)if(k!==i){const f=aug[k][i];for(let j=i;j<n+2;j++)aug[k][j]-=f*aug[i][j];}
    }
    return aug.map(r=>r.slice(n));
  };
  const candidates: {models:number[][][];offsets:number[];columns:number;angle:number;score:number}[]=[];
  for(const scale of [.012,.024,.048]) {
    const background=localMaximum(Math.max(3,Math.round(W*scale/2)));
    const mask=new Uint8Array(W*H), seen=new Uint8Array(W*H), stack=new Int32Array(W*H);
    let maskCount=0,erodedCount=0;
    for(let i=0;i<mask.length;i++){mask[i]=gray[i]>25&&gray[i]<background[i]*.83?1:0;maskCount+=mask[i];}
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
      const i=y*W+x;let full=1;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)full&=mask[i+dy*W+dx];
      seen[i]=full;
      erodedCount+=full;
    }
    const cells:Cell[]=[]; let components=0,rejectWidth=0,rejectHeight=0,rejectHuge=0,rejectAspect=0,rejectDensity=0;
    for(let seed=0;seed<seen.length;seed++){
      if(!seen[seed])continue;let size=1,count=0,sx=0,sy=0,left=W,right=0,top=H,bottom=0;stack[0]=seed;seen[seed]=0;
      while(size){const i=stack[--size],x=i%W,y=Math.floor(i/W);count++;sx+=x;sy+=y;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
        for(const next of [x?i-1:-1,x+1<W?i+1:-1,i-W,i+W])if(next>=0&&next<seen.length&&seen[next]){seen[next]=0;stack[size++]=next;}}
      const w=right-left+1,h=bottom-top+1;
      components++; if(w<5)rejectWidth++; else if(h<4)rejectHeight++; else if(w>=W*.12)rejectHuge++; else if(w/h<=1.5||w/h>=4.5)rejectAspect++; else if(count/(w*h)<=.5)rejectDensity++; else cells.push({x:sx/count,y:sy/count,w,h});
    }
    if(cells.length<100){reject("escala " + scale + ": máscara " + maskCount + " px, tras erosión " + erodedCount + " px, componentes " + components + " (ancho<5 " + rejectWidth + ", alto<4 " + rejectHeight + ", enorme " + rejectHuge + ", proporción " + rejectAspect + ", densidad " + rejectDensity + "), " + cells.length + " celdas candidatas; mínimo 100");continue;}
    const mw=median(cells.map(c=>c.w)),mh=median(cells.map(c=>c.h));
    const usable=cells.filter(c=>c.w>mw*.7&&c.w<mw*1.4&&c.h>mh*.65&&c.h<mh*1.7);
    const angles:number[]=[];
    for(let i=0;i<usable.length;i++)for(let j=i+1;j<usable.length;j++){
      let dx=usable[j].x-usable[i].x,dy=usable[j].y-usable[i].y;if(dx<0){dx=-dx;dy=-dy;}
      if(dx>mw*.8&&dx<mw*1.5&&Math.abs(dy)<mw*.35)angles.push(Math.atan2(dy,dx));
    }
    if(angles.length<30){reject("escala " + scale + ": " + angles.length + " relaciones angulares; mínimo 30");continue;}
    const bins=new Map<number,number[]>();for(const a of angles){const k=Math.round(a/(Math.PI/90));bins.set(k,[...(bins.get(k)||[]),a]);}
    const angle=median([...bins.values()].sort((a,b)=>b.length-a.length)[0]),cos=Math.cos(angle),sin=Math.sin(angle);
    const points=usable.map(c=>({x:c.x*cos+c.y*sin,y:-c.x*sin+c.y*cos})).sort((a,b)=>a.y-b.y);
    const groups:{x:number;y:number}[][]=[];
    for(const p of points){const g=groups[groups.length-1];if(g&&p.y-g[g.length-1].y<mh*2.5)g.push(p);else groups.push([p]);}
    const rows=groups.filter(g=>g.length>=30);
    // Candidate layouts follow the observed row count, not image coordinates.
    if(rows.length!==2&&rows.length!==3){reject("escala " + scale + ": " + rows.length + " filas detectadas; esperadas 2 o 3");continue;}
    const columns=12/rows.length, ncols=columns*7, models:number[][][]=[], offsets:number[]=[];
    let failed=false,totalError=0;
    for(let row=0;row<rows.length;row++){
      const g=rows[row],lo=quantile(g.map(p=>p.x),.01),hi=quantile(g.map(p=>p.x),.99);
      let bestX={score:Infinity,step:0,indices:[] as number[]};
      for(let gi=0;gi<=12;gi++){
        const gap=mw*.6*gi/12,step=(hi-lo-(columns-1)*gap)/(ncols-1);
        if(step<mw*.8||step>mw*1.6)continue;
        for(let oi=-4;oi<=4;oi++){
          const x0=lo+step*.05*oi,indices:number[]=[];let score=0;
          for(const p of g){let distance=Infinity,index=0;for(let k=0;k<ncols;k++){const d=Math.abs(p.x-x0-k*step-Math.floor(k/7)*gap);if(d<distance){distance=d;index=k;}}indices.push(index);score+=Math.min(distance/step,.3);}
          if(score/g.length<bestX.score)bestX={score:score/g.length,step,indices};
        }
      }
      if(bestX.score>.13){reject("escala " + scale + ", fila " + (row + 1) + ": geometría horizontal " + bestX.score.toFixed(3) + " > 0.130");failed=true;break;}
      const center=g.reduce((s,p)=>s+p.x,0)/g.length;
      let bestY={score:Infinity,step:0,weeks:[] as number[]};
      for(let hi=0;hi<=24;hi++)for(let si=-10;si<=10;si++){
        const step=mh*(1.05+.6*hi/24),slope=si*.0025,ys=g.map(p=>p.y-slope*(p.x-center)),min=Math.min(...ys);
        for(let oi=0;oi<=24;oi++){
          const y0=min-step+step*1.2*oi/24,weeks=ys.map(y=>Math.round((y-y0)/step));let score=0;
          for(let i=0;i<ys.length;i++)score+=Math.min(Math.abs(ys[i]-y0-weeks[i]*step)/step,.3)+(weeks[i]<0||weeks[i]>5?1:0);
          if(score/g.length<bestY.score)bestY={score:score/g.length,step,weeks};
        }
      }
      if(bestY.score>.13){reject("escala " + scale + ", fila " + (row + 1) + ": geometría vertical " + bestY.score.toFixed(3) + " > 0.130");failed=true;break;}
      const A=g.map((_,i)=>[1,bestX.indices[i],Math.floor(bestX.indices[i]/7),bestY.weeks[i]]),B=g.map(p=>[p.x,p.y]);
      let keep=g.map(()=>true),coef:number[][]|null=null;
      for(let iter=0;iter<4;iter++){
        coef=solve(A.filter((_,i)=>keep[i]),B.filter((_,i)=>keep[i]));if(!coef)break;
        const model=coef;keep=A.map((a,i)=>{const px=a.reduce((s,v,k)=>s+v*model[k][0],0),py=a.reduce((s,v,k)=>s+v*model[k][1],0);return Math.hypot((g[i].x-px)/bestX.step,(g[i].y-py)/bestY.step)<.22;});
      }
      if(!coef||keep.filter(Boolean).length<g.length*.75){reject("escala " + scale + ", fila " + (row + 1) + ": ajuste afín insuficiente (" + keep.filter(Boolean).length + "/" + g.length + " puntos)");failed=true;break;}
      for(let m=0;m<columns;m++){const kept=keep.filter((v,i)=>v&&Math.floor(bestX.indices[i]/7)===m).length;if(kept<8){reject("escala " + scale + ", mes " + (row * columns + m + 1) + ": solo " + kept + " puntos válidos; mínimo 8");failed=true;}}
      if(failed)break;
      // Affine models per observed row handle skew, shear and changing scale.
      // Accept only if every actual date and every empty slot is supported.
      let chosen:number|null=null,bestError=Infinity;
      for(const offset of [-1,0,1]){
        let errors=0,error=0;
        for(let m=0;m<columns;m++){
          const month=row*columns+m+1,first=weekdayMon(year,month,1),days=daysInMonth(year,month);
          for(let slot=0;slot<42;slot++){
            const a=[1,m*7+slot%7,m,Math.floor(slot/7)+offset],cx=a.reduce((s,v,k)=>s+v*coef![k][0],0),cy=a.reduce((s,v,k)=>s+v*coef![k][1],0);
            let filled=0,total=0,outside=false;
            for(const fy of [-.22,-.11,0,.11,.22])for(const fx of [-.25,-.125,0,.125,.25]){
              const xx=cx+fx*coef[1][0]+fy*coef[3][0],yy=cy+fx*coef[1][1]+fy*coef[3][1];const x=Math.round(xx*cos-yy*sin),y=Math.round(xx*sin+yy*cos);
              if(x<0||y<0||x>=W||y>=H){outside=true;continue;}const i=y*W+x;filled+=gray[i]>25&&gray[i]<background[i]*.93?1:0;total++;
            }
            const occupied=slot>=first&&slot<first+days,ratio=total?filled/total:0;
            if(outside||!total||(occupied?ratio<.7:ratio>.2))errors++;
            error+=occupied?1-ratio:ratio;
          }
        }
        if(!errors&&error<bestError){chosen=offset;bestError=error;}
      }
      if(chosen===null){reject("escala " + scale + ", fila " + (row + 1) + ": fechas y huecos no validan en ningún desplazamiento");failed=true;break;}
      models.push(coef);offsets.push(chosen);totalError+=bestError;
    }
    if(!failed)candidates.push({models,offsets,columns,angle,score:totalError});
  }
  if(!candidates.length)return fail(failures.length ? failures.join(" | ") : "ninguna geometría candidata válida");
  candidates.sort((a,b)=>a.score-b.score);const best=candidates[0];
  const point=(candidate:typeof best,month:number,x:number,y:number)=>{
    const row=Math.floor(month/candidate.columns),col=month%candidate.columns,c=candidate.models[row],a=[1,col*7+x,col,y+candidate.offsets[row]];
    const px=a.reduce((s,v,k)=>s+v*c[k][0],0),py=a.reduce((s,v,k)=>s+v*c[k][1],0),co=Math.cos(candidate.angle),si=Math.sin(candidate.angle);
    return {x:px*co-py*si,y:px*si+py*co};
  };
  // Conflicting independently valid layouts are not silently selected.
  for(const candidate of candidates.slice(1)){
    // Different image scales can yield weaker alternative fits, especially on
    // the historical 6x2 sheet. Only a similarly strong fit for the same
    // layout is evidence of genuine geometric ambiguity.
    if(candidate.columns!==best.columns||candidate.score>best.score*1.35+.5)continue;
    for(let m=0;m<12;m++){
    const a=point(best,m,3,2),b=point(candidate,m,3,2);
    if(Math.hypot(a.x-b.x,a.y-b.y)>Math.hypot(best.models[0][1][0],best.models[0][1][1])*.2)return fail("dos geometrías válidas entran en conflicto");
    }
  }
  const output=document.createElement("canvas"),cw=48,ch=24,gap=24;
  output.width=best.columns*(7*cw+gap);output.height=(12/best.columns)*(6*ch+gap);
  const out=output.getContext("2d");if(!out)return fail("no se pudo crear el canvas rectificado");
  const image=out.createImageData(output.width,output.height);image.data.fill(255);
  const panels:AnnualPanel[]=[];
  for(let m=0;m<12;m++){
    const left=(m%best.columns)*(7*cw+gap),top=Math.floor(m/best.columns)*(6*ch+gap);
    panels.push({x:left,length:7*cw,gridTop:top,cellH:ch});
    for(let y=0;y<6*ch;y++)for(let x=0;x<7*cw;x++){
      const p=point(best,m,(x+.5)/cw-.5,(y+.5)/ch-.5),sx=Math.round(p.x*originalWidth/W),sy=Math.round(p.y*originalHeight/H);
      if(sx<0||sy<0||sx>=originalWidth||sy>=originalHeight)return fail("mes " + (m + 1) + ": remapeo fuera de los límites de la imagen");
      const from=(sy*originalWidth+sx)*4,to=((top+y)*output.width+left+x)*4;
      for(let k=0;k<4;k++)image.data[to+k]=originalPixels[from+k];
    }
  }
  out.putImageData(image,0,0);
  return {canvas:output,panels};
}



type AnnualPanelRefinement = {
  panel: AnnualPanel;
  changed: boolean;
  rawScore: number;
  baselineScore: number;
  confidence: number;
};

function refineAnnualPanelGrid(
  canvas: HTMLCanvasElement,
  panel: AnnualPanel,
  year: number,
  month: number,
): AnnualPanelRefinement {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return {
      panel,
      changed: false,
      rawScore: 0,
      baselineScore: 0,
      confidence: 0,
    };
  }

  const baseCellW = panel.length / 7,
    baseCellH = panel.cellH,
    marginX = baseCellW * 1.45,
    marginY = baseCellH * 1.35,
    left = Math.max(0, Math.floor(panel.x - marginX)),
    top = Math.max(0, Math.floor(panel.gridTop - marginY)),
    right = Math.min(
      canvas.width,
      Math.ceil(panel.x + panel.length + marginX),
    ),
    bottom = Math.min(
      canvas.height,
      Math.ceil(panel.gridTop + baseCellH * 6 + marginY),
    ),
    width = right - left,
    height = bottom - top;

  if (
    width < baseCellW * 6.5 ||
    height < baseCellH * 5.2 ||
    baseCellW < 4 ||
    baseCellH < 3
  ) {
    return {
      panel,
      changed: false,
      rawScore: 0,
      baselineScore: 0,
      confidence: 0,
    };
  }

  const pixels = ctx.getImageData(left, top, width, height).data,
    feature = new Float32Array(width * height),
    gray = new Float32Array(width * height),
    integralWidth = width + 1,
    integral = new Float64Array((width + 1) * (height + 1));

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const i = y * width + x,
        p = i * 4,
        r = pixels[p],
        g = pixels[p + 1],
        b = pixels[p + 2],
        max = Math.max(r, g, b),
        min = Math.min(r, g, b),
        luminance = r * 0.299 + g * 0.587 + b * 0.114,
        value = 255 - luminance + (max - min) * 0.75;
      gray[i] = luminance;
      feature[i] = value;
      rowSum += value;
      integral[(y + 1) * integralWidth + x + 1] =
        integral[y * integralWidth + x + 1] + rowSum;
    }
  }

  const patchMean = (
      cx: number,
      cy: number,
      radiusX: number,
      radiusY: number,
    ) => {
      const x0 = Math.max(0, Math.floor(cx - radiusX)),
        x1 = Math.min(width - 1, Math.ceil(cx + radiusX)),
        y0 = Math.max(0, Math.floor(cy - radiusY)),
        y1 = Math.min(height - 1, Math.ceil(cy + radiusY));
      if (x1 < x0 || y1 < y0) return 0;
      const a = y0 * integralWidth + x0,
        b = y0 * integralWidth + x1 + 1,
        c = (y1 + 1) * integralWidth + x0,
        d = (y1 + 1) * integralWidth + x1 + 1;
      return (
        (integral[d] - integral[b] - integral[c] + integral[a]) /
        ((x1 - x0 + 1) * (y1 - y0 + 1))
      );
    },
    verticalEdges = new Float32Array(width),
    horizontalEdges = new Float32Array(height);

  for (let x = 1; x < width - 1; x++) {
    let total = 0,
      samples = 0;
    for (let y = 1; y < height - 1; y += 2) {
      total += Math.abs(
        gray[y * width + x + 1] - gray[y * width + x - 1],
      );
      samples++;
    }
    verticalEdges[x] = samples ? total / samples : 0;
  }
  for (let y = 1; y < height - 1; y++) {
    let total = 0,
      samples = 0;
    for (let x = 1; x < width - 1; x += 2) {
      total += Math.abs(
        gray[(y + 1) * width + x] - gray[(y - 1) * width + x],
      );
      samples++;
    }
    horizontalEdges[y] = samples ? total / samples : 0;
  }

  const edgePeak = (
      edges: Float32Array,
      position: number,
      radius: number,
    ) => {
      let best = 0;
      const center = Math.round(position);
      for (
        let i = Math.max(0, center - radius);
        i <= Math.min(edges.length - 1, center + radius);
        i++
      )
        best = Math.max(best, edges[i]);
      return best / 255;
    },
    first = weekdayMon(year, month, 1),
    count = daysInMonth(year, month);

  const evaluate = (
    x0Abs: number,
    cellW: number,
    y0Abs: number,
    cellH: number,
  ) => {
    const localX0 = x0Abs - left,
      localY0 = y0Abs - top;
    if (
      localX0 < -cellW * 0.2 ||
      localY0 < -cellH * 0.2 ||
      localX0 + 7 * cellW > width + cellW * 0.2 ||
      localY0 + 6 * cellH > height + cellH * 0.2
    )
      return { raw: -Infinity, objective: -Infinity };

    let occupied = 0,
      occupiedCount = 0,
      empty = 0,
      emptyCount = 0;

    for (let slot = 0; slot < 42; slot++) {
      const col = slot % 7,
        row = Math.floor(slot / 7),
        cx = localX0 + (col + 0.5) * cellW,
        cy = localY0 + (row + 0.5) * cellH,
        value = patchMean(
          cx,
          cy,
          Math.max(1.5, cellW * 0.18),
          Math.max(1.2, cellH * 0.18),
        );
      if (slot >= first && slot < first + count) {
        occupied += value;
        occupiedCount++;
      } else {
        empty += value;
        emptyCount++;
      }
    }

    if (!occupiedCount || !emptyCount)
      return { raw: -Infinity, objective: -Infinity };

    const contrast =
        occupied / occupiedCount - empty / emptyCount,
      edgeRadiusX = Math.max(1, Math.round(cellW * 0.035)),
      edgeRadiusY = Math.max(1, Math.round(cellH * 0.05));
    let edge = 0,
      edgeWeight = 0;

    for (let boundary = 0; boundary <= 7; boundary++) {
      const weight = boundary === 0 || boundary === 7 ? 1.6 : 1;
      edge +=
        edgePeak(
          verticalEdges,
          localX0 + boundary * cellW,
          edgeRadiusX,
        ) * weight;
      edgeWeight += weight;
    }
    for (let boundary = 0; boundary <= 6; boundary++) {
      const weight = boundary === 0 || boundary === 6 ? 1.45 : 1;
      edge +=
        edgePeak(
          horizontalEdges,
          localY0 + boundary * cellH,
          edgeRadiusY,
        ) * weight;
      edgeWeight += weight;
    }
    const edgeScore = edgeWeight ? edge / edgeWeight : 0,
      raw = contrast + edgeScore * 20,
      dx = (x0Abs - panel.x) / Math.max(baseCellW, 1),
      dy = (y0Abs - panel.gridTop) / Math.max(baseCellH, 1),
      sx = cellW / Math.max(baseCellW, 1),
      sy = cellH / Math.max(baseCellH, 1),
      regularization =
        Math.abs(dx) * 0.9 +
        Math.abs(dy) * 0.65 +
        Math.abs(sx - 1) * 9 +
        Math.abs(sy - 1) * 7;
    return { raw, objective: raw - regularization };
  };

  const baseline = evaluate(
      panel.x,
      baseCellW,
      panel.gridTop,
      baseCellH,
    ),
    coarseDx = Array.from({ length: 15 }, (_, i) => -1.05 + i * 0.15),
    coarseDy = Array.from({ length: 11 }, (_, i) => -0.65 + i * 0.13),
    coarseSx = [0.94, 0.97, 1, 1.03, 1.06],
    coarseSy = [0.92, 0.96, 1, 1.04, 1.08];

  let best = {
    x0: panel.x,
    cellW: baseCellW,
    y0: panel.gridTop,
    cellH: baseCellH,
    raw: baseline.raw,
    objective: baseline.objective,
  };

  for (const dx of coarseDx)
    for (const sx of coarseSx)
      for (const dy of coarseDy)
        for (const sy of coarseSy) {
          const x0 = panel.x + dx * baseCellW,
            cellW = baseCellW * sx,
            y0 = panel.gridTop + dy * baseCellH,
            cellH = baseCellH * sy,
            score = evaluate(x0, cellW, y0, cellH);
          if (score.objective > best.objective)
            best = {
              x0,
              cellW,
              y0,
              cellH,
              raw: score.raw,
              objective: score.objective,
            };
        }

  // Fine pass around the best coarse candidate. This remains generic: no
  // month/day/color knowledge is used beyond which of the 42 slots belong to
  // the requested month.
  const fineDx = [-0.12, -0.08, -0.04, 0, 0.04, 0.08, 0.12],
    fineDy = [-0.12, -0.08, -0.04, 0, 0.04, 0.08, 0.12],
    fineS = [-0.018, -0.009, 0, 0.009, 0.018],
    coarseBest = { ...best };

  for (const dx of fineDx)
    for (const sx of fineS)
      for (const dy of fineDy)
        for (const sy of fineS) {
          const x0 = coarseBest.x0 + dx * baseCellW,
            cellW = coarseBest.cellW * (1 + sx),
            y0 = coarseBest.y0 + dy * baseCellH,
            cellH = coarseBest.cellH * (1 + sy),
            score = evaluate(x0, cellW, y0, cellH);
          if (score.objective > best.objective)
            best = {
              x0,
              cellW,
              y0,
              cellH,
              raw: score.raw,
              objective: score.objective,
            };
        }

  const improvement = best.objective - baseline.objective,
    moved =
      Math.abs(best.x0 - panel.x) > baseCellW * 0.04 ||
      Math.abs(best.y0 - panel.gridTop) > baseCellH * 0.04 ||
      Math.abs(best.cellW / baseCellW - 1) > 0.012 ||
      Math.abs(best.cellH / baseCellH - 1) > 0.012,
    reliable =
      Number.isFinite(best.raw) &&
      best.raw >= 9 &&
      (improvement >= 0.65 || !moved),
    confidence = reliable
      ? Math.max(
          0,
          Math.min(
            1,
            0.35 +
              Math.max(0, best.raw - 9) / 28 +
              Math.max(0, improvement) / 12,
          ),
        )
      : 0;

  if (!reliable || !moved) {
    return {
      panel,
      changed: false,
      rawScore: Number.isFinite(best.raw) ? best.raw : 0,
      baselineScore: Number.isFinite(baseline.raw) ? baseline.raw : 0,
      confidence,
    };
  }

  return {
    panel: {
      x: best.x0,
      length: best.cellW * 7,
      gridTop: best.y0,
      cellH: best.cellH,
    },
    changed: true,
    rawScore: best.raw,
    baselineScore: Number.isFinite(baseline.raw) ? baseline.raw : 0,
    confidence,
  };
}


type AnnualGridLine = { a: number; b: number };
type AnnualGridModel = {
  vertical: AnnualGridLine[];
  horizontal: AnnualGridLine[];
  confidence: number;
};
type OpenCvGridResult = {
  models: (AnnualGridModel | null)[];
  available: boolean;
  error?: string;
};

let openCvRuntimePromise: Promise<any | null> | null = null;

function loadOpenCvRuntime(): Promise<any | null> {
  if (openCvRuntimePromise) return openCvRuntimePromise;
  openCvRuntimePromise = new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }

    let finished = false;
    const finish = (value: any | null) => {
        if (finished) return;
        finished = true;
        resolve(value);
      },
      deadline = window.setTimeout(() => finish(null), 8000),
      globalWindow = window as any,
      tryReady = async () => {
        try {
          let cv = globalWindow.cv;
          if (!cv) return false;
          if (typeof cv.then === "function") {
            cv = await Promise.race([
              cv,
              new Promise<null>((resolveWait) =>
                window.setTimeout(() => resolveWait(null), 250),
              ),
            ]);
          }
          if (cv?.Mat && cv?.HoughLinesP && cv?.adaptiveThreshold) {
            window.clearTimeout(deadline);
            finish(cv);
            return true;
          }
        } catch {}
        return false;
      };

    void (async () => {
      if (await tryReady()) return;
      let script = document.getElementById(
        "opencv-runtime",
      ) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = "opencv-runtime";
        script.src = "https://docs.opencv.org/4.x/opencv.js";
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("error", () => {
        window.clearTimeout(deadline);
        finish(null);
      }, { once: true });

      const poll = async () => {
        if (finished) return;
        if (await tryReady()) return;
        window.setTimeout(() => void poll(), 150);
      };
      void poll();
    })();
  });
  return openCvRuntimePromise;
}

function annualGridIntersection(
  vertical: AnnualGridLine,
  horizontal: AnnualGridLine,
) {
  // x = av*y + bv ; y = ah*x + bh
  const denominator = 1 - vertical.a * horizontal.a;
  if (Math.abs(denominator) < 1e-6) return null;
  const x =
      (vertical.a * horizontal.b + vertical.b) / denominator,
    y = horizontal.a * x + horizontal.b;
  return { x, y };
}

function annualGridCellGeometry(
  model: AnnualGridModel,
  col: number,
  row: number,
) {
  const tl = annualGridIntersection(
      model.vertical[col],
      model.horizontal[row],
    ),
    tr = annualGridIntersection(
      model.vertical[col + 1],
      model.horizontal[row],
    ),
    bl = annualGridIntersection(
      model.vertical[col],
      model.horizontal[row + 1],
    ),
    br = annualGridIntersection(
      model.vertical[col + 1],
      model.horizontal[row + 1],
    );
  if (!tl || !tr || !bl || !br) return null;
  const cx = (tl.x + tr.x + bl.x + br.x) / 4,
    cy = (tl.y + tr.y + bl.y + br.y) / 4,
    topWidth = Math.hypot(tr.x - tl.x, tr.y - tl.y),
    bottomWidth = Math.hypot(br.x - bl.x, br.y - bl.y),
    leftHeight = Math.hypot(bl.x - tl.x, bl.y - tl.y),
    rightHeight = Math.hypot(br.x - tr.x, br.y - tr.y);
  return {
    cx,
    cy,
    cellW: (topWidth + bottomWidth) / 2,
    cellH: (leftHeight + rightHeight) / 2,
  };
}

function fitIndexedGridLines(
  candidates: {
    a: number;
    b: number;
    reference: number;
    length: number;
  }[],
  expectedCount: number,
  nominalStart: number,
  nominalStep: number,
  referenceCoordinate: number,
  tolerance: number,
) {
  const chosen: (AnnualGridLine | null)[] = Array(expectedCount).fill(null),
    referencePositions: (number | null)[] = Array(expectedCount).fill(null),
    residuals: number[] = [];

  for (let index = 0; index < expectedCount; index++) {
    const expected = nominalStart + nominalStep * index,
      nearby = candidates
        .map((candidate) => ({
          ...candidate,
          distance: Math.abs(candidate.reference - expected),
        }))
        .filter((candidate) => candidate.distance <= tolerance)
        .sort(
          (left, right) =>
            left.distance - right.distance ||
            right.length - left.length,
        )
        .slice(0, 5);
    if (!nearby.length) continue;
    let weight = 0,
      a = 0,
      b = 0,
      position = 0;
    for (const candidate of nearby) {
      const w =
        candidate.length /
        Math.max(1, 1 + candidate.distance * candidate.distance);
      weight += w;
      a += candidate.a * w;
      b += candidate.b * w;
      position += candidate.reference * w;
    }
    if (!weight) continue;
    chosen[index] = { a: a / weight, b: b / weight };
    referencePositions[index] = position / weight;
    residuals.push(Math.abs(position / weight - expected));
  }

  const detected = chosen.filter(Boolean).length;
  if (detected < Math.max(4, expectedCount - 3)) return null;

  const points = referencePositions
    .map((position, index) =>
      position === null ? null : { index, position },
    )
    .filter(Boolean) as { index: number; position: number }[];
  const meanI =
      points.reduce((sum, point) => sum + point.index, 0) /
      points.length,
    meanP =
      points.reduce((sum, point) => sum + point.position, 0) /
      points.length;
  let numerator = 0,
    denominator = 0;
  for (const point of points) {
    numerator += (point.index - meanI) * (point.position - meanP);
    denominator += (point.index - meanI) ** 2;
  }
  const fittedStep = denominator
      ? numerator / denominator
      : nominalStep,
    fittedStart = meanP - fittedStep * meanI;

  if (
    fittedStep < nominalStep * 0.72 ||
    fittedStep > nominalStep * 1.28
  )
    return null;

  const detectedSlopes = chosen
      .filter(Boolean)
      .map((line) => (line as AnnualGridLine).a)
      .sort((a, b) => a - b),
    medianSlope =
      detectedSlopes[
        Math.floor(detectedSlopes.length / 2)
      ] || 0;

  for (let index = 0; index < expectedCount; index++) {
    if (chosen[index]) continue;
    const position = fittedStart + fittedStep * index;
    chosen[index] = {
      a: medianSlope,
      b: position - medianSlope * referenceCoordinate,
    };
  }

  const fitResidual =
    points.reduce(
      (sum, point) =>
        sum +
        Math.abs(
          point.position -
            (fittedStart + fittedStep * point.index),
        ),
      0,
    ) / points.length;
  if (fitResidual > nominalStep * 0.2) return null;

  return {
    lines: chosen as AnnualGridLine[],
    detected,
    fittedStep,
    residual:
      residuals.length
        ? residuals.reduce((sum, value) => sum + value, 0) /
          residuals.length
        : 0,
    fitResidual,
  };
}

function openCvGridForPanel(
  cv: any,
  source: any,
  panel: AnnualPanel,
): AnnualGridModel | null {
  const cellW = panel.length / 7,
    cellH = panel.cellH,
    marginX = cellW * 0.55,
    marginY = cellH * 0.75,
    x = Math.max(0, Math.floor(panel.x - marginX)),
    y = Math.max(0, Math.floor(panel.gridTop - marginY)),
    right = Math.min(
      source.cols,
      Math.ceil(panel.x + panel.length + marginX),
    ),
    bottom = Math.min(
      source.rows,
      Math.ceil(panel.gridTop + cellH * 6 + marginY),
    ),
    width = right - x,
    height = bottom - y;
  if (width < cellW * 6.5 || height < cellH * 5) return null;

  const rect = new cv.Rect(x, y, width, height),
    roi = source.roi(rect),
    gray = new cv.Mat(),
    binary = new cv.Mat(),
    vertical = new cv.Mat(),
    horizontal = new cv.Mat(),
    verticalLines = new cv.Mat(),
    horizontalLines = new cv.Mat();

  let verticalKernel: any = null,
    horizontalKernel: any = null;
  try {
    cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY);
    const blockSize = Math.max(
      9,
      Math.round(Math.min(cellW, cellH) * 0.9) | 1,
    );
    cv.adaptiveThreshold(
      gray,
      binary,
      255,
      cv.ADAPTIVE_THRESH_MEAN_C,
      cv.THRESH_BINARY_INV,
      blockSize % 2 ? blockSize : blockSize + 1,
      7,
    );

    binary.copyTo(vertical);
    binary.copyTo(horizontal);
    verticalKernel = cv.getStructuringElement(
      cv.MORPH_RECT,
      new cv.Size(
        1,
        Math.max(3, Math.round(cellH * 0.62)),
      ),
    );
    horizontalKernel = cv.getStructuringElement(
      cv.MORPH_RECT,
      new cv.Size(
        Math.max(5, Math.round(cellW * 0.62)),
        1,
      ),
    );
    cv.erode(vertical, vertical, verticalKernel);
    cv.dilate(vertical, vertical, verticalKernel);
    cv.erode(horizontal, horizontal, horizontalKernel);
    cv.dilate(horizontal, horizontal, horizontalKernel);

    cv.HoughLinesP(
      vertical,
      verticalLines,
      1,
      Math.PI / 180,
      Math.max(6, Math.round(cellH * 0.45)),
      Math.max(4, cellH * 0.5),
      Math.max(2, cellH * 0.42),
    );
    cv.HoughLinesP(
      horizontal,
      horizontalLines,
      1,
      Math.PI / 180,
      Math.max(6, Math.round(cellW * 0.42)),
      Math.max(5, cellW * 0.5),
      Math.max(2, cellW * 0.38),
    );

    const verticalCandidates: {
        a: number;
        b: number;
        reference: number;
        length: number;
      }[] = [],
      horizontalCandidates: {
        a: number;
        b: number;
        reference: number;
        length: number;
      }[] = [],
      referenceY =
        panel.gridTop + cellH * 3,
      referenceX = panel.x + panel.length / 2;

    for (let i = 0; i < verticalLines.rows; i++) {
      const offset = i * 4,
        x1 = verticalLines.data32S[offset] + x,
        y1 = verticalLines.data32S[offset + 1] + y,
        x2 = verticalLines.data32S[offset + 2] + x,
        y2 = verticalLines.data32S[offset + 3] + y,
        dx = x2 - x1,
        dy = y2 - y1,
        length = Math.hypot(dx, dy);
      if (
        Math.abs(dy) < Math.abs(dx) * 1.6 ||
        Math.abs(dy) < cellH * 0.42
      )
        continue;
      const a = dx / dy,
        b = x1 - a * y1;
      verticalCandidates.push({
        a,
        b,
        reference: a * referenceY + b,
        length,
      });
    }

    for (let i = 0; i < horizontalLines.rows; i++) {
      const offset = i * 4,
        x1 = horizontalLines.data32S[offset] + x,
        y1 = horizontalLines.data32S[offset + 1] + y,
        x2 = horizontalLines.data32S[offset + 2] + x,
        y2 = horizontalLines.data32S[offset + 3] + y,
        dx = x2 - x1,
        dy = y2 - y1,
        length = Math.hypot(dx, dy);
      if (
        Math.abs(dx) < Math.abs(dy) * 1.6 ||
        Math.abs(dx) < cellW * 0.42
      )
        continue;
      const a = dy / dx,
        b = y1 - a * x1;
      horizontalCandidates.push({
        a,
        b,
        reference: a * referenceX + b,
        length,
      });
    }

    const verticalFit = fitIndexedGridLines(
        verticalCandidates,
        8,
        panel.x,
        cellW,
        referenceY,
        cellW * 0.4,
      ),
      horizontalFit = fitIndexedGridLines(
        horizontalCandidates,
        7,
        panel.gridTop,
        cellH,
        referenceX,
        cellH * 0.42,
      );
    if (!verticalFit || !horizontalFit) return null;

    const confidence = Math.max(
      0,
      Math.min(
        1,
        0.35 +
          (verticalFit.detected / 8) * 0.3 +
          (horizontalFit.detected / 7) * 0.3 -
          (verticalFit.fitResidual / cellW) * 0.45 -
          (horizontalFit.fitResidual / cellH) * 0.45,
      ),
    );
    if (confidence < 0.58) return null;

    const model: AnnualGridModel = {
      vertical: verticalFit.lines,
      horizontal: horizontalFit.lines,
      confidence,
    };
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 7; col++) {
        const geometry = annualGridCellGeometry(model, col, row);
        if (
          !geometry ||
          geometry.cellW < cellW * 0.55 ||
          geometry.cellW > cellW * 1.45 ||
          geometry.cellH < cellH * 0.5 ||
          geometry.cellH > cellH * 1.55 ||
          geometry.cx < x - cellW * 0.15 ||
          geometry.cx > right + cellW * 0.15 ||
          geometry.cy < y - cellH * 0.15 ||
          geometry.cy > bottom + cellH * 0.15
        )
          return null;
      }

    return model;
  } finally {
    if (verticalKernel) verticalKernel.delete();
    if (horizontalKernel) horizontalKernel.delete();
    verticalLines.delete();
    horizontalLines.delete();
    vertical.delete();
    horizontal.delete();
    binary.delete();
    gray.delete();
    roi.delete();
  }
}

async function refineAnnualGridsOpenCv(
  canvas: HTMLCanvasElement,
  panels: AnnualPanel[],
): Promise<OpenCvGridResult> {
  const cv = await loadOpenCvRuntime();
  if (!cv)
    return {
      models: panels.map(() => null),
      available: false,
      error: "OpenCV.js no disponible",
    };

  // v34: never run morphology/Hough on the full phone photo. OpenCV works on
  // a reduced copy (enough resolution for grid lines) and the detected line
  // equations are mapped back to the original canvas coordinates.
  const maxCvWidth = 960,
    maxCvHeight = 760,
    scale = Math.min(
      1,
      maxCvWidth / canvas.width,
      maxCvHeight / canvas.height,
    ),
    workCanvas = document.createElement("canvas");
  workCanvas.width = Math.max(1, Math.round(canvas.width * scale));
  workCanvas.height = Math.max(1, Math.round(canvas.height * scale));
  const workContext = workCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  if (!workContext)
    return {
      models: panels.map(() => null),
      available: true,
      error: "sin contexto para reducir imagen OpenCV",
    };
  workContext.drawImage(
    canvas,
    0,
    0,
    workCanvas.width,
    workCanvas.height,
  );

  const scaledPanels = panels.map((panel) => ({
      x: panel.x * scale,
      length: panel.length * scale,
      gridTop: panel.gridTop * scale,
      cellH: panel.cellH * scale,
    })),
    unscaleModel = (model: AnnualGridModel | null) => {
      if (!model || scale === 1) return model;
      return {
        confidence: model.confidence,
        vertical: model.vertical.map((line) => ({
          a: line.a,
          b: line.b / scale,
        })),
        horizontal: model.horizontal.map((line) => ({
          a: line.a,
          b: line.b / scale,
        })),
      };
    };

  let source: any = null;
  try {
    source = cv.imread(workCanvas);
    const models: (AnnualGridModel | null)[] = [];
    for (let index = 0; index < scaledPanels.length; index++) {
      const model = openCvGridForPanel(
        cv,
        source,
        scaledPanels[index],
      );
      models.push(unscaleModel(model));
      // Give the browser a paint opportunity between months. This does not
      // change the algorithm but prevents the UI from appearing frozen.
      if (index < scaledPanels.length - 1)
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, 0),
        );
    }
    return { models, available: true };
  } catch (error) {
    return {
      models: panels.map(() => null),
      available: true,
      error:
        error instanceof Error
          ? error.message
          : "error en cuadrícula OpenCV",
    };
  } finally {
    if (source) source.delete();
  }
}

async function classifyAnnual(file: File, year: number) {
  const diagnostic: string[] = [];
  let canvas = await loadAnnualCanvas(file);
  if (!canvas) return null;
  const originalSize = canvas.width + "x" + canvas.height;
  let panels =
    detectProjectionAnnualPanels(canvas, year, diagnostic) ||
    detectModernAnnualPanels(canvas, year, false, diagnostic) ||
    detectModernAnnualPanels(canvas, year, true, diagnostic) ||
    detectStraightAnnualPanels(canvas, year);
  // Historical TMB annual sheets use a straight 6x2 layout. Keep its proven
  // header-based detector ahead of the generic photographed-geometry fallback.
  if (!panels) { const photo = detectPhotographedAnnual(canvas, year, diagnostic); if (photo) { canvas = photo.canvas; panels = photo.panels; } }
  if (!panels) throw new Error("DIAGNÓSTICO " + originalSize + ". " + diagnostic.join(" · "));
  // v32: OpenCV extracts the physical grid lines. A model is used only when
  // enough vertical/horizontal lines are detected with good regularity; otherwise
  // we keep the original detector coordinates rather than "optimising" them.
  // v35 hotfix: OpenCV queda temporalmente fuera de la ruta interactiva.
  // En algunos móviles sus operaciones WASM bloquean el hilo principal durante
  // minutos incluso sobre una imagen reducida. Hasta moverlo a un Web Worker,
  // usamos la geometría base ya probada para que la creación de previsión no
  // pueda quedarse congelada.
  const openCvGrid: OpenCvGridResult = {
      models: panels.map(() => null),
      available: false,
      error: "OpenCV desactivado temporalmente en la ruta interactiva",
    },
    openCvRefinedMonths = 0,
    openCvFallbackMonths = panels.map((_, index) => index + 1);

  // Never silently apply a six-column coordinate template to an unknown layout.
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !panels) return null;
  const raw: Record<number, DayData[]> = {},
    colourFeatures: Record<number, (AnnualColourFeature | null)[]> = {};
  for (let month = 1; month <= 12; month++) {
    const panel = panels[month - 1],
      gridModel = openCvGrid.models[month - 1],
      fallbackCellW = panel.length / 7,
      fallbackCellH = panel.cellH,
      fallbackY0 = panel.gridTop + fallbackCellH * .5,
      statuses: {
        status: Status;
        confidence: number;
        detectedColour?: "BLUE";
        feature: AnnualColourFeature | null;
      }[] = [];
    for (let day = 1; day <= daysInMonth(year, month); day++) {
      const index = weekdayMon(year, month, 1) + day - 1,
        col = index % 7,
        week = Math.floor(index / 7),
        physicalGeometry = gridModel
          ? annualGridCellGeometry(gridModel, col, week)
          : null,
        cellW = physicalGeometry?.cellW || fallbackCellW,
        cellH = physicalGeometry?.cellH || fallbackCellH,
        cx =
          physicalGeometry?.cx ||
          panel.x + fallbackCellW * (col + 0.5),
        cy =
          physicalGeometry?.cy ||
          fallbackY0 + week * fallbackCellH,
        samples = [-0.22, 0, 0.22].map((dy) =>
          annualCellEvidence(
            ctx,
            cx,
            cy + cellH * dy,
            cellW,
            cellH * 0.78,
            canvas,
          ),
        ),
        evidence = samples.sort((a, b) => b.confidence - a.confidence)[0],
        feature = annualCellColourFeature(
          ctx,
          cx,
          cy,
          cellW,
          cellH,
          canvas,
        ),
        featureEvidence = feature ? annualFeatureEvidence(feature) : null,
        recovered =
          !featureEvidence &&
          evidence.status === "REVISAR" &&
          evidence.detectedColour !== "BLUE"
            ? retryUncertainAnnualCell(
                ctx,
                cx,
                cy,
                cellW,
                cellH,
                canvas,
              )
            : null,
        chosen = featureEvidence || recovered || evidence;
      statuses.push({ ...chosen, feature });
    }
    raw[month] = makeDays(year, month).map((d, i) => ({
      ...d,
      status: statuses[i].status,
      baseStatus: baseOf(statuses[i].status),
      confidence: statuses[i].confidence,
      detectedColour: statuses[i].detectedColour,
    }));
    colourFeatures[month] = statuses.map((status) => status.feature);
  }
  const palette = stabilizeAnnualPalette(raw, colourFeatures),
    calibration = calibrateAnnualUncertainColours(raw, colourFeatures),
    phase = inferCyclePhase(year, raw),
    result: YearPlan = {},
    cycleDifferenceByMonth: string[] = [],
    uncertainByMonth: string[] = [],
    uncertainDaysByMonth: string[] = [],
    blueByMonth: string[] = [],
    blueDaysByMonth: string[] = [];
  let cycleDifferences = 0,
    uncertain = 0,
    blueAmbiguous = 0;
  for (let month = 1; month <= 12; month++) {
    const audited = auditCycle(raw[month], year, month, phase),
      monthCycleDifferences = audited.filter(
        (d) => d.status !== "REVISAR" && Boolean(d.note),
      ).length,
      blueDays = raw[month].filter(
        (d) => d.status === "REVISAR" && d.detectedColour === "BLUE",
      ),
      uncertainDays = raw[month].filter(
        (d) => d.status === "REVISAR" && d.detectedColour !== "BLUE",
      ),
      monthBlue = blueDays.length,
      monthUncertain = uncertainDays.length;
    cycleDifferences += monthCycleDifferences;
    uncertain += monthUncertain;
    blueAmbiguous += monthBlue;
    cycleDifferenceByMonth.push(`${month}:${monthCycleDifferences}`);
    uncertainByMonth.push(`${month}:${monthUncertain}`);
    blueByMonth.push(`${month}:${monthBlue}`);
    if (monthUncertain) {
      uncertainDaysByMonth.push(
        `${MONTHS[month - 1].slice(0, 3)}: ${uncertainDays
          .map((d) => d.day)
          .join(", ")}`,
      );
    }
    if (monthBlue) {
      blueDaysByMonth.push(
        `${MONTHS[month - 1].slice(0, 3)}: ${blueDays
          .map((d) => d.day)
          .join(", ")}`,
      );
    }
    const recognized = copyRecognizedDays(audited);
    result[month] = {
      original: recognized.map((d) => ({ ...d })),
      days: recognized.map((d) => ({ ...d })),
      confirmed: false,
    };
  }
  return {
    plan: result,
    phase,
    cycleDifferences,
    cycleDifferenceByMonth,
    uncertain,
    uncertainByMonth,
    uncertainDaysByMonth,
    blueAmbiguous,
    blueByMonth,
    blueDaysByMonth,
    calibrated: calibration.total,
    calibratedByMonth: calibration.recoveredByMonth
      .map((count, index) => `${index + 1}:${count}`),
    paletteChanged: palette.changed,
    paletteClusters: palette.clusters,
    openCvAvailable: openCvGrid.available,
    openCvRefinedMonths,
    openCvFallbackMonths,
    openCvError: openCvGrid.error,
  };
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
  const [syncState, setSyncState] = useState<SyncState>("local");
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
    [multiSelectActive, setMultiSelectActive] = useState(false),
    [multiSelectedDays, setMultiSelectedDays] = useState<number[]>([]),
    [bulkSituation, setBulkSituation] = useState(""),
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
    setMultiSelectActive(false);
    setMultiSelectedDays([]);
    setBulkSituation("");
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
  // Primero sincroniza la copia compartida y después carga el año ya convergido.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    (async () => {
      await syncComputoStorage(setSyncState);
      loadYear(INITIAL_YEAR);
      try {
        const stored = localStorage.getItem("metro-profile-v2"),
          previous = localStorage.getItem("metro-profile-v1");
        if (stored || previous) {
          const parsed = JSON.parse(stored || previous || "{}") as Partial<UserProfile>,
            valid = !!parsed.contract && parsed.contract in CONTRACT_LABELS,
            next = {
              ...DEFAULT_PROFILE,
              ...parsed,
              contract: valid ? parsed.contract : DEFAULT_PROFILE.contract,
            } as UserProfile;
          setProfile(next);
          setProfileDraft(next);
          setProfileOpen(!stored || !valid);
        }
      } catch {
      } finally {
        setProfileLoaded(true);
      }
    })();
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
    const key = `metro-year-${year}`;
    localStorage.setItem(key, JSON.stringify(next));
    markStorageKeyPending(key);
    setSyncState("syncing");
    pushStorageKey(key)
      .then(ok => setSyncState(ok ? "synced" : navigator.onLine ? "error" : "offline"))
      .catch(() => setSyncState(navigator.onLine ? "error" : "offline"));
  }
  function persistPeriods(next: PeriodRecord[]) {
    setPeriods(next);
    const key = `metro-periods-${year}`;
    localStorage.setItem(key, JSON.stringify(next));
    markStorageKeyPending(key);
    setSyncState("syncing");
    pushStorageKey(key)
      .then(ok => setSyncState(ok ? "synced" : navigator.onLine ? "error" : "offline"))
      .catch(() => setSyncState(navigator.onLine ? "error" : "offline"));
  }
  function savePriorEntitlement(value: number) {
    const next = Math.max(0, Math.floor(value || 0));
    setPriorEntitlement(next);
    const key = `metro-prior-${year}`;
    localStorage.setItem(key, String(next));
    markStorageKeyPending(key);
    setSyncState("syncing");
    pushStorageKey(key)
      .then(ok => setSyncState(ok ? "synced" : navigator.onLine ? "error" : "offline"))
      .catch(() => setSyncState(navigator.onLine ? "error" : "offline"));
  }
  function saveProfile() {
    const name = profileDraft.name.trim(),
      employeeNumber = profileDraft.employeeNumber.trim();
    if (!name || !employeeNumber) return;

    let normalizedDraft = profileDraft;
    if (isSummer(profileDraft)) {
      const current = summerContractFor(profileDraft, year),
        months = summerAssignmentMonths(plan),
        first = current.assignments[0],
        assignments =
          current.percentage === "75"
            ? months.map((month) => {
                const existing = current.assignments.find(
                  (assignment) => assignment.month === month,
                );
                return (
                  existing || {
                    month,
                    fiestaLetter:
                      first?.fiestaLetter || profileDraft.fiestaLetter || "M",
                    shift: first?.shift || "AT86",
                  }
                );
              })
            : [];
      normalizedDraft = {
        ...profileDraft,
        summer: {
          ...(profileDraft.summer || {}),
          [String(year)]: {
            ...current,
            assignments,
          },
        },
      };
    }

    const next: UserProfile = {
      ...normalizedDraft,
      name,
      employeeNumber,
      ...(profileTurn(normalizedDraft) === "T8" && normalizedDraft.contract === "75"
        ? { subturn: normalizedDraft.subturn || "T8.1" }
        : { subturn: undefined }),
    };
    setProfile(next);
    setProfileDraft(next);
    localStorage.setItem("metro-profile-v1", JSON.stringify(next));
    localStorage.setItem("metro-profile-v2", JSON.stringify(next));
    markStorageKeyPending("metro-profile-v1");
    markStorageKeyPending("metro-profile-v2");
    setSyncState("syncing");
    Promise.all([pushStorageKey("metro-profile-v1"), pushStorageKey("metro-profile-v2")])
      .then(results => setSyncState(results.every(Boolean) ? "synced" : navigator.onLine ? "error" : "offline"))
      .catch(() => setSyncState(navigator.onLine ? "error" : "offline"));
    setProfileOpen(false);
  }
  function editProfile() {
    setProfileDraft(profile);
    setProfileOpen(true);
  }
  function updateSummerConfig(patch: Partial<SummerContract>) {
    setProfileDraft((currentProfile) => {
      const current = summerContractFor(currentProfile, year);
      return {
        ...currentProfile,
        summer: {
          ...(currentProfile.summer || {}),
          [String(year)]: { ...current, ...patch },
        },
      };
    });
  }
  function updateSummerAssignment(
    month: number,
    field: "fiestaLetter" | "shift",
    value: FiestaLetter | SummerShift,
  ) {
    setProfileDraft((currentProfile) => {
      const current = summerContractFor(currentProfile, year),
        existing = current.assignments.find(
          (assignment) => assignment.month === month,
        ),
        first = current.assignments[0],
        fallback: SummerMonthAssignment = {
          month,
          fiestaLetter:
            first?.fiestaLetter || currentProfile.fiestaLetter || "M",
          shift: first?.shift || "AT86",
        },
        next = {
          ...(existing || fallback),
          [field]: value,
        } as SummerMonthAssignment;
      return {
        ...currentProfile,
        summer: {
          ...(currentProfile.summer || {}),
          [String(year)]: {
            ...current,
            assignments: [
              ...current.assignments.filter(
                (assignment) => assignment.month !== month,
              ),
              next,
            ].sort((a, b) => a.month - b.month),
          },
        },
      };
    });
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
    setMultiSelectActive(false);
    setMultiSelectedDays([]);
    setBulkSituation("");
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
      cancelMultiSelection();
      setCalendarRetry(v => v + 1);
      setProgress(100);
      persist(found.plan);
      persistPeriods([]);
      localStorage.setItem(
        `metro-detector-version-${year}`,
        String(ANNUAL_DETECTOR_VERSION),
      );
      setDetectorVersion(ANNUAL_DETECTOR_VERSION);
      if (!isSummer(profile)) {
        localStorage.setItem(
          `metro-cycle-phase-${year}-${profile.fiestaLetter}`,
          String(found.phase),
        );
      }
      setDays(found.plan[1].days);
      setMonth(1);
      const total = Object.values(found.plan).reduce(
        (n, m) => n + m.days.length,
        0,
      );
      setMessage(
        `Detector v${ANNUAL_DETECTOR_VERSION} · Previsión de ${year} creada: ${total} días. Geometría estable sin OpenCV interactivo: ${found.openCvFallbackMonths.length}/12 meses en modo base.${found.openCvFallbackMonths.length ? ` Fallback geométrico en meses: ${found.openCvFallbackMonths.join(", ")}.` : ""}${found.openCvError ? ` ${found.openCvError}.` : ""} Lectura directa prioritaria. Paleta auxiliar de ${found.paletteClusters} grupos recuperó ${found.paletteChanged} lecturas dudosas. Calibración local recuperó ${found.calibrated} lecturas (por mes: ${found.calibratedByMonth.join(" · ")}). Lecturas realmente dudosas: ${found.uncertain} (por mes: ${found.uncertainByMonth.join(" · ")}).${found.uncertain ? ` Días dudosos: ${found.uncertainDaysByMonth.join(" · ")}.` : ""} Azul marino por identificar: ${found.blueAmbiguous} (por mes: ${found.blueByMonth.join(" · ")}).${found.blueAmbiguous ? ` Días azules: ${found.blueDaysByMonth.join(" · ")}. Revísalos en Detalle mensual y usa la selección múltiple para asignar la categoría correcta.` : ""} Diferencias visibles respecto al ciclo base: ${found.cycleDifferences} (informativas; pueden ser vacaciones, permisos, festivos u otras excepciones reales).`,
      );
    } catch (error) {
      const detail =
        error instanceof Error && error.message
          ? error.message
          : "error anual desconocido";
      console.error("[Còmput AAC] Error al analizar calendario anual:", error);
      setMessage(`No he podido localizar con seguridad los doce calendarios. ${detail}`);

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
      if (!found)
        throw new Error(
          "DIAGNÓSTICO: no se ha podido localizar una cuadrícula mensual válida.",
        );
      const read = makeDays(year, month).map((d) => {
          const status = found.get(d.day) || "REVISAR";
          return { ...d, status, baseStatus: baseOf(status) };
        }),
        storedPhase = Number(
          localStorage.getItem(
            `metro-cycle-phase-${year}-${fiestaLetterForMonth(profile, year, month)}`,
          ) ?? localStorage.getItem(`metro-cycle-phase-${year}`),
        ),
        phase =
          Number.isInteger(storedPhase) && storedPhase >= 0 && storedPhase < 28
            ? storedPhase
            : undefined,
        cycled = applyCycleValidation(read, year, month, phase),
        next = copyRecognizedDays(cycled),
        existing = plan[month];
      cancelMultiSelection();
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
    } catch (error) {
      const detail =
        error instanceof Error && error.message
          ? error.message
          : typeof error === "string" && error
            ? error
            : "error desconocido";
      console.error("[Còmput AAC] Error al analizar captura mensual:", error);
      setMessage(`DIAG-MES-2 · ${detail}`);
    } finally {
      setBusy(false);
    }
  }

  function startMultiSelection(day?: number) {
    setSelected(null);
    setMultiSelectActive(true);
    setMultiSelectedDays(day ? [day] : []);
    setBulkSituation("");
  }
  function toggleMultiDay(day: number) {
    setMultiSelectedDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  }
  function cancelMultiSelection() {
    setMultiSelectActive(false);
    setMultiSelectedDays([]);
    setBulkSituation("");
  }
  function bulkSituationLabel(value: string) {
    if (value.startsWith("prior:")) {
      const origin = value.slice(6) as PriorOrigin;
      return priorSituationLabel[origin];
    }
    if (value.startsWith("special:")) {
      const special = value.slice(8) as Special;
      return specialLabel[special];
    }
    const status = value.slice(7) as Status;
    return statusLabel[status] || "categoría";
  }
  function applyBulkSituation() {
    if (!multiSelectedDays.length || !bulkSituation) return;
    const selectedDays = new Set(multiSelectedDays),
      nextDays = days.map((day) => {
        if (!selectedDays.has(day.day)) return day;

        if (bulkSituation.startsWith("prior:")) {
          const origin = bulkSituation.slice(6) as PriorOrigin;
          return {
            ...day,
            status: "VAC_ANTERIOR" as Status,
            special: "NINGUNA" as Special,
            extraHours: 0,
            priorOrigin: origin,
            periodId: undefined,
            manualEdited: true,
            note: priorSituationLabel[origin],
          };
        }

        if (bulkSituation.startsWith("special:")) {
          const special = bulkSituation.slice(8) as Special,
            status =
              special === "NINGUNA"
                ? day.status
                : isWorking(day.status)
                  ? day.status
                  : ("AGCG" as Status);
          return {
            ...day,
            status,
            special,
            extraHours: special === "MODIFICACION" ? day.extraHours : 0,
            priorOrigin:
              special === "NINGUNA" ? day.priorOrigin : undefined,
            periodId: undefined,
            manualEdited: true,
            note:
              special === "NINGUNA"
                ? day.note
                : specialLabel[special],
          };
        }

        const status = bulkSituation.slice(7) as Status,
          working = isWorking(status),
          note =
            status === "AGCG" || status === "DCOM" || status === "FEST"
              ? ""
              : statusLabel[status];
        return {
          ...day,
          status,
          special: working ? day.special : ("NINGUNA" as Special),
          extraHours: working ? day.extraHours : 0,
          priorOrigin: undefined,
          periodId: undefined,
          manualEdited: true,
          note,
        };
      }),
      count = multiSelectedDays.length,
      label = bulkSituationLabel(bulkSituation);
    commitMonth(nextDays);
    cancelMultiSelection();
    setMessage(
      `${label} aplicado a ${count} ${count === 1 ? "día" : "días"} de ${MONTHS[month - 1]}.`,
    );
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
    const storedPhase = isSummer(profile)
        ? NaN
        : Number(
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
                : periodKind === "VAC_ANTERIOR"
                  ? d.status === "VAC_ANTERIOR" ||
                    d.status === "VACACIONES_PENDIENTES"
                  : d.status === periodKind,
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
              : periodKind === "RJ"
                ? "RJ"
                : periodKind === "PATERNIDAD"
                  ? "Permiso de paternidad"
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
  function clearAnnualImage() {
    if (annualPreview) URL.revokeObjectURL(annualPreview);
    setAnnualFile(null);
    setAnnualPreview("");
  }
  function clearMonthlyImage() {
    if (monthlyPreview) URL.revokeObjectURL(monthlyPreview);
    setMonthlyFile(null);
    setMonthlyPreview("");
  }
  function resetMonth() {
    cancelMultiSelection();
    const next = { ...plan };
    delete next[month];
    persist(next);
    setDays(makeDays(year, month));
    setSelected(null);
    clearMonthlyImage();
    setMessage(
      `${MONTHS[month - 1]} vaciado. Puedes volver a importar la captura mensual.`,
    );
  }
  function resetYear() {
    cancelMultiSelection();
    setPlan({});
    setPeriods([]);
    setPriorEntitlement(0);
    setEditingPeriodId(null);
    setPeriodStart("");
    setPeriodEnd("");
    setDays(makeDays(year, month));
    clearAnnualImage();
    clearMonthlyImage();
    const keysToDelete = [
      `metro-year-${year}`,
      `metro-periods-${year}`,
      `metro-prior-${year}`,
      `metro-detector-version-${year}`,
      `metro-cycle-phase-${year}`,
      `metro-cycle-phase-${year}-${profile.fiestaLetter}`,
    ];
    setSyncState("syncing");
    deleteStorageKeys(keysToDelete)
      .then(ok => setSyncState(ok ? "synced" : navigator.onLine ? "error" : "offline"))
      .catch(() => setSyncState(navigator.onLine ? "error" : "offline"));
    setDetectorVersion(0);
    setMessage(
      "Previsión anual e imágenes cargadas vaciadas. Puedes volver a importar el calendario.",
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
      days,
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
    outgoingPreviousCreditMinutes = isSummer(profile)
      ? 0
      : previousYearCreditMinutes(
          plan,
          year,
          profile,
        ),
    incomingPreviousCreditMinutes = useMemo(
      () =>
        isSummer(profile)
          ? 0
          : storedPreviousYearCreditMinutes(year + 1, profile),
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
    summerSpan = isSummer(profile) ? summerDetectedSpan(plan, year) : null,
    activeSummerContract = summerContractFor(profile, year),
    summerTargetHours = isSummer(profile)
      ? summerContractHours(plan, year, profile)
      : undefined,
    summerRemainingHours =
      summerTargetHours !== undefined && Number.isFinite(annualOrdinaryHours)
        ? Number((summerTargetHours - annualOrdinaryHours).toFixed(2))
        : undefined,
    activeSummerMonths = isSummer(profile)
      ? summerAssignmentMonths(plan)
      : [],
    summerMissingAssignmentMonths =
      isSummer(profile) && activeSummerContract.percentage === "75"
        ? activeSummerMonths.filter(
            (summerMonth) =>
              !activeSummerContract.assignments.some(
                (assignment) => assignment.month === summerMonth,
              ),
          )
        : [],
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
    planMonthCount = Object.keys(plan).length,
    planReady = isSummer(profile) ? planMonthCount > 0 : planMonthCount === 12,
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
            <a
              href="https://roberfernandez.github.io/tmb-agent/"
              aria-label="Tornar a TMB Agent"
              title="Tornar a TMB Agent"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition hover:bg-white/10"
            >
              <img
                src="https://roberfernandez.github.io/tmb-agent/assets/icons/tmb-agent-192.png"
                alt=""
                width={34}
                height={34}
                className="h-[34px] w-[34px] rounded-lg object-cover"
              />
            </a>
            <div className="logo-mark shrink-0">
              <img
                src="/computo-aac/computo-aac-v3-192.png"
                alt=""
                width={46}
                height={46}
                className="h-full w-full rounded-[inherit] object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#71d7cc]">
                {isSummer(profile)
                  ? profileLabel(profile, year)
                  : `Ciclo ${profile.fiestaLetter} · ${profileLabel(profile, year)}`} · versión {APP_BUILD} ·{" "}
                <span className={syncState === "syncing" ? "text-[#eeb64b]" : ""}>
                  {syncState === "synced" ? "☁ sincronizado" : syncState === "syncing" ? "☁ sincronizando…" : syncState === "offline" ? "☁ sin conexión" : syncState === "error" ? "☁ pendiente" : "☁ local"}
                </span>
                {profileTurn(profile) === "T8" && profile.contract === "75" && profile.subturn
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
            <Badge className="border border-white/15 bg-white/5 px-3 py-1.5 text-white/70">
              {isSummer(profile)
                ? summerSpan
                  ? `${summerSpan.label} · ${summerSpan.naturalDays} días · ${year}`
                  : `Periodo desde calendario · ${year}`
                : annualWorkdays
                  ? `${annualWorkdays} días · ${year}`
                  : `Días por definir · ${year}`}
            </Badge>
            <div className="annual-hours" aria-label={`Horas de ${year}`}>
              {isSummer(profile) ? (
                <>
                  <span>
                    Contrato · {activeSummerContract.percentage} %:{" "}
                    <b>
                      {summerTargetHours === undefined
                        ? "pendiente de calendario"
                        : formatHours(summerTargetHours)}
                    </b>
                  </span>
                  <span title="Horas reconocidas en el calendario del contrato, incluida la formación cuando el calendario permita computarla.">
                    Horas reconocidas:{" "}
                    <b>
                      {Object.keys(plan).length
                        ? formatHours(annualOrdinaryHours)
                        : "sin calendario"}
                    </b>
                    {summerRemainingHours !== undefined &&
                      ` · pendientes ${formatHours(summerRemainingHours)}`}
                  </span>
                </>
              ) : (
                <>
                  <span>
                    Teóricas · {profileLabel(profile, year)}: <b>{annualTheoreticalHours === undefined ? "por confirmar" : formatHours(annualTheoreticalHours)}</b>
                  </span>
                  <span title="Suma de Horas ordinarias de los meses cargados, incluidos los futuros.">
                    Horas previstas · calendario {year}: <b>{Object.keys(plan).length ? formatHours(annualOrdinaryHours) : "sin calendario"}</b>
                    {Object.keys(plan).length > 0 && (!planReady || allCurrentDays.some((d) => needsReview(d.status))) && " · provisional"}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      <div role="status" className="mx-auto max-w-[1500px] px-4 pt-4 text-sm text-amber-200 md:px-8">
        {calendarStatus}
        <Button variant="ghost" onClick={() => setCalendarRetry(v => v + 1)}>Reintentar calendario oficial</Button>
      </div>
      {isFullTime(profile) && <p className="mx-auto max-w-[1500px] px-4 pt-4 text-sm text-amber-200 md:px-8">Tiempo completo · previsión de horarios. Cómputo y conceptos retributivos pendientes de validar.{["T1", "T2"].includes(profileTurn(profile)) && " Sábados y non stop: horario histórico por confirmar."}</p>}
      {isSummer(profile) && activeSummerContract.percentage === "75" && summerMissingAssignmentMonths.length > 0 && Object.keys(plan).length > 0 && (
        <p className="mx-auto max-w-[1500px] px-4 pt-4 text-sm text-amber-200 md:px-8">
          Estiu 75 % · completa letra y AT para {summerMissingAssignmentMonths.map((m) => MONTHS[m - 1]).join(", ")} desde Perfil.
        </p>
      )}
      {isSummer(profile) && activeSummerContract.percentage === "100" && (
        <p className="mx-auto max-w-[1500px] px-4 pt-4 text-sm text-amber-200 md:px-8">
          Estiu 100 % · el objetivo contractual se calcula desde el calendario. El horario diario queda pendiente hasta disponer de su asignación operativa.
        </p>
      )}
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
                <Button
                  variant="outline"
                  onClick={resetMonth}
                  disabled={busy}
                  className="mt-2 w-full"
                >
                  <RotateCcw size={16} />
                  Vaciar mes
                </Button>
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
                  Vacaciones, mini, RJ, paternidad o días pendientes
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
                    <SelectItem value="RJ">RJ</SelectItem>
                    <SelectItem value="PATERNIDAD">Paternidad</SelectItem>
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
                    {planReady
                      ? isSummer(profile)
                        ? summerRemainingHours === undefined
                          ? "Pendiente"
                          : formatHours(summerRemainingHours)
                        : balanceLabel(profile, annual)
                      : "—"}
                  </p>
                  <p className="text-sm text-white/50">
                    {isSummer(profile)
                      ? "Horas pendientes del contrato"
                      : `Total anual ${year}`}
                  </p>
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
                  className={`score-ring ${
                    isSummer(profile)
                      ? summerRemainingHours !== undefined &&
                        Math.abs(summerRemainingHours) <= 0.02
                        ? "positive"
                        : "negative"
                      : annual >= 0
                        ? "positive"
                        : "negative"
                  }`}
                >
                  {planReady
                    ? isSummer(profile)
                      ? summerRemainingHours !== undefined &&
                        Math.abs(summerRemainingHours) <= 0.02
                        ? "✓"
                        : "…"
                      : !isFullTime(profile)
                        ? "✓"
                        : "?"
                    : "?"}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px bg-white/8">
              {isSummer(profile) ? (
                <>
                  <Stat
                    label="Modalidad"
                    value={`Estiu ${activeSummerContract.percentage} %`}
                  />
                  <Stat
                    label="Periodo detectado"
                    value={
                      summerSpan
                        ? `${summerSpan.label} · ${summerSpan.naturalDays} días`
                        : "Pendiente de calendario"
                    }
                  />
                  <Stat
                    label="Horas del contrato"
                    value={
                      summerTargetHours === undefined
                        ? "Pendiente"
                        : formatHours(summerTargetHours)
                    }
                  />
                  <Stat
                    label="Horas reconocidas"
                    value={
                      Object.keys(plan).length
                        ? formatHours(annualOrdinaryHours)
                        : "Sin calendario"
                    }
                  />
                </>
              ) : (
                <>
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
                </>
              )}
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
              multiSelectActive={multiSelectActive}
              multiSelectedDays={multiSelectedDays}
              bulkSituation={bulkSituation}
              onBulkSituationChange={setBulkSituation}
              onStartMultiSelect={startMultiSelection}
              onToggleMultiDay={toggleMultiDay}
              onCancelMultiSelect={cancelMultiSelection}
              onApplyBulk={applyBulkSituation}
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
            <a href="https://roberfernandez.github.io/tmb-agent/" className="inline-flex min-h-11 items-center self-start text-sm text-white/80 hover:text-white">← TMB Agent</a>
            <div className="profile-dialog-icon">
              <CalendarDays size={28} />
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
                  <span>{turn}</span><small>{turn === "ESTIU" ? "Contrato de verano" : turn === "T8" ? "Tiempo parcial" : "Tiempo completo"}</small>
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
            {!isSummer(profileDraft) && (
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
            )}
            {profileTurn(profileDraft) === "T8" && <div className="sm:col-span-2">
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
            {profileTurn(profileDraft) === "T8" && profileDraft.contract === "75" && (
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
            {isSummer(profileDraft) && (() => {
              const summer = summerContractFor(profileDraft, year),
                months = summerAssignmentMonths(plan);
              return (
                <div className="sm:col-span-2 rounded-xl border border-[#eeb64b]/20 bg-[#eeb64b]/5 p-4">
                  <Label>Contrato de verano</Label>
                  <div className="contract-options mt-2">
                    {(["75", "100"] as SummerPercentage[]).map((percentage) => (
                      <button
                        type="button"
                        key={percentage}
                        className={summer.percentage === percentage ? "selected" : ""}
                        onClick={() =>
                          updateSummerConfig({
                            percentage,
                            assignments:
                              percentage === "75" ? summer.assignments : [],
                          })
                        }
                      >
                        <span>{percentage} %</span>
                        <small>
                          {percentage === "75"
                            ? "Letra + AT por mes"
                            : "Jornada completa"}
                        </small>
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-white/45">
                    El periodo, los días de formación y las horas del contrato se
                    obtienen del calendario reconocido. No tienes que introducir
                    fechas ni horas manualmente.
                  </p>

                  {summer.percentage === "75" && (
                    <div className="mt-4 space-y-3">
                      <p className="text-xs leading-5 text-[#eeb64b]">
                        Para el 75 %, indica la letra de fiesta y el AT de cada mes
                        de servicio. La app usará únicamente los meses presentes en
                        el calendario cuando estén disponibles.
                      </p>
                      {months.map((summerMonth) => {
                        const assignment =
                            summer.assignments.find(
                              (item) => item.month === summerMonth,
                            ) || {
                              month: summerMonth,
                              fiestaLetter:
                                summer.assignments[0]?.fiestaLetter ||
                                profileDraft.fiestaLetter ||
                                "M",
                              shift:
                                summer.assignments[0]?.shift || "AT86",
                            };
                        return (
                          <div
                            key={summerMonth}
                            className="grid gap-2 rounded-lg border border-white/10 bg-black/10 p-3 sm:grid-cols-[1fr_150px_150px] sm:items-end"
                          >
                            <div>
                              <span className="text-sm font-semibold">
                                {MONTHS[summerMonth - 1]}
                              </span>
                              <small className="block text-white/35">
                                Asignación mensual
                              </small>
                            </div>
                            <div>
                              <Label>Letra</Label>
                              <Select
                                value={assignment.fiestaLetter}
                                onValueChange={(value) =>
                                  updateSummerAssignment(
                                    summerMonth,
                                    "fiestaLetter",
                                    value as FiestaLetter,
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(["K", "L", "M", "N"] as FiestaLetter[]).map(
                                    (letter) => (
                                      <SelectItem key={letter} value={letter}>
                                        {letter}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>AT</Label>
                              <Select
                                value={assignment.shift}
                                onValueChange={(value) =>
                                  updateSummerAssignment(
                                    summerMonth,
                                    "shift",
                                    value as SummerShift,
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(["AT86", "AT87"] as SummerShift[]).map(
                                    (shift) => (
                                      <SelectItem key={shift} value={shift}>
                                        {shift}
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
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
  const summer = summerContractFor(profile, year),
    summerSpan = isSummer(profile) ? summerDetectedSpan(plan, year) : null,
    summerTargetHours = isSummer(profile)
      ? summerContractHours(plan, year, profile)
      : undefined,
    summerAssignmentSummary =
      isSummer(profile) && summer.percentage === "75"
        ? summerAssignmentMonths(plan)
            .map((summerMonth) => {
              const assignment = summer.assignments.find(
                (item) => item.month === summerMonth,
              );
              return assignment
                ? `${MONTHS[summerMonth - 1].slice(0, 3)} ${assignment.fiestaLetter}/${assignment.shift}`
                : `${MONTHS[summerMonth - 1].slice(0, 3)} pendiente`;
            })
            .join(" · ")
        : "";
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
                    {!!p && (!Number.isFinite(monthNightHours[m]) || showMonthlyConcept(monthNightHours[m])) && <div className="annual-night">
                      <span>
                        <Moon size={12} />
                        Nocturnidad variable
                      </span>
                      <b>{p ? nightLabel(profile, monthNightHours[m]) : "—"}</b>
                    </div>}
                    {!!p && specialRetributiveDaysCount(p.days, year, m) > 0 && (
                      <div className="annual-night">
                        <span>
                          <CalendarDays size={12} />
                          Días especiales:
                        </span>
                        <b>{specialRetributiveDaysCount(p.days, year, m)}</b>
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
            {isSummer(profile) ? (
              <>
                <AnnualStat
                  label="Horas reconocidas"
                  value={formatHours(annualOrdinaryHours)}
                />
                <AnnualStat
                  label="Horas del contrato"
                  value={
                    summerTargetHours === undefined
                      ? "Pendiente de calendario"
                      : formatHours(summerTargetHours)
                  }
                />
                <AnnualStat
                  label="Periodo detectado"
                  value={
                    summerSpan
                      ? `${summerSpan.label} · ${summerSpan.naturalDays} días`
                      : "Pendiente de calendario"
                  }
                />
                <AnnualStat
                  label="Modalidad"
                  value={`Estiu ${summer.percentage} %`}
                />
                {summer.percentage === "75" && (
                  <AnnualStat
                    label="Letra + AT"
                    value={summerAssignmentSummary || "Pendiente"}
                  />
                )}
                <AnnualStat
                  label="Nocturnidad variable"
                  value={nightLabel(profile, annualNightHours)}
                />
              </>
            ) : (
              <>
                <AnnualStat
                  label="Horas totales anuales"
                  value={formatHours(annualOrdinaryHours)}
                />
                <AnnualStat
                  label="Porcentaje de contratación"
                  value={`${profileLabel(profile, year)}${profileTurn(profile) === "T8" && profile.contract === "75" && profile.subturn ? ` · ${profile.subturn}` : ""}`}
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
              </>
            )}
          </div>
        </>
      ) : (
        <div className="empty-year">
          <CalendarRange size={48} />
          <h3>Aún no hay una previsión anual</h3>
          <p>
            {isSummer(profile)
              ? "Sube el calendario del contrato de verano y la aplicación obtendrá el periodo y sus jornadas."
              : "Sube el calendario completo de TMB y la aplicación calculará los doce meses de una vez."}
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
  multiSelectActive,
  multiSelectedDays,
  bulkSituation,
  onBulkSituationChange,
  onStartMultiSelect,
  onToggleMultiDay,
  onCancelMultiSelect,
  onApplyBulk,
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
  multiSelectActive: boolean;
  multiSelectedDays: number[];
  bulkSituation: string;
  onBulkSituationChange: (value: string) => void;
  onStartMultiSelect: (day?: number) => void;
  onToggleMultiDay: (day: number) => void;
  onCancelMultiSelect: () => void;
  onApplyBulk: () => void;
  onMonthChange: (m: number) => void;
  onSelect: (d: DayData) => void;
}) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    longPressTriggered = useRef(false),
    pointerStart = useRef<{ day: number; x: number; y: number } | null>(null),
    selectedSet = useMemo(
      () => new Set(multiSelectedDays),
      [multiSelectedDays],
    );
  const clearLongPressTimer = () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    },
    startLongPress = (
      day: number,
      event: React.PointerEvent<HTMLButtonElement>,
    ) => {
      longPressTriggered.current = false;
      if (multiSelectActive || event.button !== 0) return;
      clearLongPressTimer();
      pointerStart.current = { day, x: event.clientX, y: event.clientY };
      longPressTimer.current = setTimeout(() => {
        longPressTriggered.current = true;
        onStartMultiSelect(day);
      }, 450);
    },
    moveLongPress = (event: React.PointerEvent<HTMLButtonElement>) => {
      const start = pointerStart.current;
      if (
        start &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10
      )
        clearLongPressTimer();
    },
    finishLongPress = () => {
      clearLongPressTimer();
      pointerStart.current = null;
    },
    activateDay = (day: DayData) => {
      if (longPressTriggered.current) {
        longPressTriggered.current = false;
        return;
      }
      if (multiSelectActive) {
        onToggleMultiDay(day.day);
        return;
      }
      onSelect(day);
    };

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
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={multiSelectActive ? "default" : "outline"}
            onClick={() =>
              multiSelectActive
                ? onCancelMultiSelect()
                : onStartMultiSelect()
            }
          >
            {multiSelectActive ? "Salir de selección" : "Seleccionar varios"}
          </Button>
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
        {profileLabel(profile, year)} · Las horas son una previsión de horario. El saldo, la nocturnidad abonable, la Hora Nona y los abonos por ausencias están pendientes de validar.
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
                className={`day ${d.status.toLowerCase()} ${dayColourClass(d)} ${officialHolidayFor(year, month, d.day) ? "official" : ""} ${d.status !== d.baseStatus ? "modified" : ""}`}
                style={
                  selectedSet.has(d.day)
                    ? {
                        outline: "3px solid #eeb64b",
                        outlineOffset: "2px",
                      }
                    : undefined
                }
                aria-pressed={multiSelectActive ? selectedSet.has(d.day) : undefined}
                onPointerDown={(event) => startLongPress(d.day, event)}
                onPointerMove={moveLongPress}
                onPointerUp={finishLongPress}
                onPointerCancel={finishLongPress}
                onPointerLeave={clearLongPressTimer}
                onContextMenu={(event) => {
                  if (!multiSelectActive) event.preventDefault();
                }}
                onClick={() => activateDay(d)}
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
          {multiSelectActive && (
            <div className="sticky bottom-3 z-30 mt-4 rounded-xl border border-[#eeb64b]/35 bg-[#0d222b]/95 p-3 shadow-xl backdrop-blur">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <b className="text-[#ffd173]">
                    {multiSelectedDays.length}{" "}
                    {multiSelectedDays.length === 1
                      ? "día seleccionado"
                      : "días seleccionados"}
                  </b>
                  <p className="text-xs text-white/45">
                    Toca días para añadirlos o quitarlos.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCancelMultiSelect}
                >
                  Cancelar
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Select
                  value={bulkSituation}
                  onValueChange={onBulkSituationChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Asignar categoría…" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabel)
                      .filter(
                        ([value]) =>
                          value !== "VISPERA_FESTIVO" &&
                          value !== "VACACIONES_PENDIENTES" &&
                          value !== "VAC_ANTERIOR",
                      )
                      .map(([value, label]) => (
                        <SelectItem value={`status:${value}`} key={value}>
                          {label}
                        </SelectItem>
                      ))}
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
                    {Object.entries(specialLabel)
                      .filter(([value]) => value !== "MODIFICACION")
                      .map(([value, label]) => (
                        <SelectItem value={`special:${value}`} key={value}>
                          {label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  className="bg-[#28a99c] hover:bg-[#39beb0]"
                  disabled={!multiSelectedDays.length || !bulkSituation}
                  onClick={onApplyBulk}
                >
                  Aplicar
                </Button>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-white/35">
                La modificación de jornada sigue siendo individual porque
                necesita horas y posición de la modificación.
              </p>
            </div>
          )}
          <p className="mt-4 text-xs text-white/38">
            Mantén pulsado un día para iniciar selección múltiple, o usa
            “Seleccionar varios”. La marca de festivo y NS proceden del calendario oficial TMB.
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
                <TableHead className="text-right">
                  {isSummer(profile) ? "Horas" : "Cómputo"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculations.map(({ d, c }) => (
                <TableRow
                  key={d.day}
                  className={`cursor-pointer ${multiSelectActive && selectedSet.has(d.day) ? "bg-[#eeb64b]/10" : ""}`}
                  onClick={() =>
                    multiSelectActive ? onToggleMultiDay(d.day) : onSelect(d)
                  }
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
                  <TableCell>
                    {isFullTime(profile) && isWorking(d.status) ? "Pendiente" : c.night}
                    {c.nightReason && d.status !== "COMPUTO_ANTERIOR" && (
                      <span className="block text-xs text-muted-foreground">{c.nightReason}</span>
                    )}
                  </TableCell>
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
          <Rules profile={profile} year={year} />
        </TabsContent>
      </Tabs>
    </>
  );
}
function Rules({ profile, year }: { profile: UserProfile; year: number }) {
  if (isSummer(profile)) {
    const summer = summerContractFor(profile, year);
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Rule
          n="01"
          title="Contrato proporcional"
          text="Las horas del contrato se calculan con la jornada anual del año, el porcentaje del contrato y los días naturales detectados en el calendario. No se introducen fechas ni horas manualmente."
        />
        <Rule
          n="02"
          title="Formación"
          text="Los días de formación forman parte del calendario reconocido. Se incorporan al cómputo cuando su jornada puede determinarse; si falta el horario, quedan marcados como pendientes."
        />
        <Rule
          n="03"
          title="Estiu 75 %"
          text={
            summer.percentage === "75"
              ? "La letra de fiesta y el AT86/AT87 se configuran por mes. AT86: D-J 19:20–00:18; AT87: D-J 19:52–00:50; viernes/víspera 19:20–02:50; sábado/non stop 20:30–05:00; domingo/festivo 19:20–00:50."
              : "La configuración de letra + AT se usa únicamente en los contratos Estiu al 75 %."
          }
        />
        <Rule
          n="04"
          title="Estiu 100 %"
          text="El objetivo contractual al 100 % se calcula desde el periodo reconocido. No se inventa un horario diario: queda pendiente hasta disponer de la asignación operativa correspondiente."
        />
      </div>
    );
  }
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
