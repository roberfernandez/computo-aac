// Shared, strictly reduced SAP snapshot for private per-user cross-device sync.
// No employee number, calendar activities, authorisation tickets, or credentials.
import {sapDate} from "./sap-comparison.js";

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
export const sapCloudKey = year => "metro-sap-valoracions-v1-" + year;
export const MAX_SAP_CLOUD_BYTES = 4 * 1024 * 1024;
const validTimestamp = value => typeof value === "string" && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.now() + 300000;

export function minimalSapDoc(doc, expectedYear = doc?.ano) {
  if (!isObject(doc) || !Number.isInteger(expectedYear) || expectedYear < 2020 || expectedYear > 2100 ||
      doc.ano !== expectedYear || !validTimestamp(doc.extraido) || !isObject(doc.valoraciones)) {
    throw new Error("El document SAP no és vàlid per a aquest any.");
  }
  const keys = Object.keys(doc.valoraciones);
  if (keys.length !== 12) throw new Error("La còpia SAP ha de contenir els dotze mesos.");
  let total = 0;
  const valoraciones = {};
  for (let month = 1; month <= 12; month++) {
    const period = String(expectedYear) + "-" + String(month).padStart(2, "0");
    const rows = doc.valoraciones[period];
    if (!Array.isArray(rows)) throw new Error("Falten valoracions del mes " + period);
    total += rows.length;
    if (total > 30000) throw new Error("La còpia SAP supera el límit de registres.");
    valoraciones[period] = rows.map(row => {
      if (!isObject(row) || typeof row.Date !== "string" || row.Date.length > 128 ||
          !sapDate(row.Date)?.startsWith(period + "-") || typeof row.LongText !== "string" ||
          row.LongText.length > 512 || row.LongText.length === 0 ||
          !["number", "string"].includes(typeof row.Number) ||
          String(row.Number).trim().length === 0 || !Number.isFinite(Number(String(row.Number).trim().replace(",", "."))) ||
          String(row.Number).length > 64 ||
          (row.Wagetype !== undefined && (typeof row.Wagetype !== "string" || row.Wagetype.length > 64))) {
        throw new Error("Les valoracions SAP contenen una fila no vàlida.");
      }
      const clean = {Date: row.Date, LongText: row.LongText, Number: String(row.Number)};
      if (row.Wagetype !== undefined) clean.Wagetype = row.Wagetype;
      return clean;
    });
  }
  return {ano: expectedYear, extraido: doc.extraido, valoraciones};
}

export function minimalSapRecord(record, year) {
  if (!isObject(record)) throw new Error("No hi ha cap còpia SAP vàlida.");
  const doc = minimalSapDoc(record.doc, year);
  const history = Array.isArray(record.history) ? record.history.slice(-12).filter(isObject).filter(h => validTimestamp(h.extraido)).map(h => {
    const entry = {extraido: h.extraido, cambios: Number.isFinite(h.cambios) ? h.cambios : 0};
    if (Number.isSafeInteger(h.records) && h.records >= 0) entry.records = h.records;
    if (typeof h.sha256 === "string" && /^[a-f0-9]{64}$/i.test(h.sha256)) entry.sha256 = h.sha256;
    return entry;
  }) : [];
  return {version: 1, doc, history};
}

export function readSapCloudPayload(payload, year) {
  if (!isObject(payload) || payload.version !== 1) throw new Error("La còpia SAP del núvol té un format desconegut.");
  return minimalSapRecord(payload, year);
}

// No automatic overwrite on equal timestamps with divergent content.
// A later extraction may replace an older one only after saving a local backup.
export function decideSapCloudSync(localRecord, cloudPayload) {
  if (!localRecord && !cloudPayload) return "empty";
  if (!localRecord) return "download";
  if (!cloudPayload) return "upload";
  const a = Date.parse(localRecord.doc.extraido), b = Date.parse(cloudPayload.doc.extraido);
  if (a > b) return "upload";
  if (b > a) return "download";
  return JSON.stringify(localRecord.doc) === JSON.stringify(cloudPayload.doc) ? "same" : "conflict";
}

export function sapCloudByteSize(payload) {
  return new TextEncoder().encode(JSON.stringify(payload)).byteLength;
}
