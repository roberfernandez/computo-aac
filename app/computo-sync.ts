import { authenticatedUserId, readSharedSession, SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./tmb-session";

export type SyncState = "local" | "syncing" | "synced" | "offline" | "error";
const PREFIXES = ["metro-payroll-facts-v1-", "metro-year-", "metro-periods-", "metro-prior-", "metro-detector-version-", "metro-cycle-phase-"];
const EXACT = new Set(["metro-profile-v1", "metro-profile-v2"]);
const PENDING_KEY = "computo-sync-pending-v1";
const PENDING_DELETE_KEY = "computo-sync-pending-delete-v1";
function pendingKeys(){ try { const v=JSON.parse(localStorage.getItem(PENDING_KEY)||"[]"); return Array.isArray(v)?v.filter((x):x is string=>typeof x==="string"):[]; } catch { return []; } }
function markPending(key:string){
  // A restored key supersedes any deletion queued while the calendar was absent.
  clearPendingDelete(key);
  localStorage.setItem(PENDING_KEY, JSON.stringify([...new Set([...pendingKeys(),key])]));
}
export function markStorageKeyPending(key:string){ if(isComputoStorageKey(key)) markPending(key); }
function clearPending(key:string){ localStorage.setItem(PENDING_KEY, JSON.stringify(pendingKeys().filter(k=>k!==key))); }
function pendingDeletes(){ try { const v=JSON.parse(localStorage.getItem(PENDING_DELETE_KEY)||"[]"); return Array.isArray(v)?v.filter((x):x is string=>typeof x==="string"):[]; } catch { return []; } }
function markPendingDelete(key:string){ localStorage.setItem(PENDING_DELETE_KEY, JSON.stringify([...new Set([...pendingDeletes(),key])])); clearPending(key); }
function clearPendingDelete(key:string){ localStorage.setItem(PENDING_DELETE_KEY, JSON.stringify(pendingDeletes().filter(k=>k!==key))); }
export function isComputoStorageKey(key:string){ return EXACT.has(key) || PREFIXES.some(prefix=>key.startsWith(prefix)); }
function headers(token:string){ return { apikey:SUPABASE_PUBLIC_KEY, Authorization:`Bearer ${token}`, "Content-Type":"application/json", Prefer:"resolution=merge-duplicates,return=minimal" }; }
function encodePayload(raw:string){ try { return JSON.parse(raw); } catch { return { __raw: raw }; } }
function isDeletedPayload(payload:unknown){
  return !!payload && typeof payload === "object" && !Array.isArray(payload) && (payload as Record<string,unknown>).__deleted === true;
}
function decodePayload(payload:unknown){
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    if (Object.keys(record).length === 1 && typeof record.__raw === "string") return record.__raw;
  }
  return JSON.stringify(payload);
}

async function pushStorageKeyNow(key:string){
  if(!isComputoStorageKey(key)) return false;
  const session=readSharedSession(), raw=localStorage.getItem(key);
  if(raw===null) return false;
  clearPendingDelete(key);
  if(!session){ markPending(key); return false; }
  const userId=await authenticatedUserId(session); if(!userId) return false;
  const response=await fetch(`${SUPABASE_URL}/rest/v1/computo_sync?on_conflict=user_id,storage_key`,{method:"POST",headers:headers(session.access_token),body:JSON.stringify({user_id:userId,storage_key:key,payload:encodePayload(raw),updated_at:new Date().toISOString()})});
  if(!response.ok){ markPending(key); throw new Error(`sync push ${response.status}`); }
  clearPending(key);
  return true;
}

// Payroll snapshots are whole-year replacements. Serialize their writes so an
// older response cannot overwrite a later manual correction on another device.
const payrollWrites = new Map<string, Promise<boolean>>();
export function pushStorageKey(key:string): Promise<boolean> {
  if (!key.startsWith("metro-payroll-facts-v1-")) return pushStorageKeyNow(key);
  const previous = payrollWrites.get(key) || Promise.resolve(false);
  const next = previous.catch(() => false).then(() => pushStorageKeyNow(key));
  payrollWrites.set(key, next);
  void next.finally(() => { if (payrollWrites.get(key) === next) payrollWrites.delete(key); }).catch(() => {});
  return next;
}

// Upload a generated payroll snapshot without requiring another localStorage copy.
export function pushPayrollSnapshot(key:string, raw:string): Promise<boolean> {
  if(!key.startsWith("metro-payroll-facts-v1-")) return Promise.resolve(false);
  const previous = payrollWrites.get(key) || Promise.resolve(false);
  const next = previous.catch(() => false).then(async () => {
    const session = readSharedSession();
    if(!session) return false;
    const userId = await authenticatedUserId(session);
    if(!userId) return false;
    const response = await fetch(`${SUPABASE_URL}/rest/v1/computo_sync?on_conflict=user_id,storage_key`, {
      method: "POST", headers: headers(session.access_token),
      body: JSON.stringify({user_id:userId,storage_key:key,payload:encodePayload(raw),updated_at:new Date().toISOString()})
    });
    if(!response.ok) throw new Error(`sync payroll ${response.status}`);
    clearPendingDelete(key);
    clearPending(key);
    return true;
  });
  payrollWrites.set(key,next);
  void next.finally(() => {if(payrollWrites.get(key)===next) payrollWrites.delete(key);}).catch(() => {});
  return next;
}

export async function deleteStorageKeys(keys:string[]){
  const valid=keys.filter(isComputoStorageKey);
  valid.forEach(key=>{ localStorage.removeItem(key); markPendingDelete(key); });
  await Promise.all(valid.map(key => payrollWrites.get(key)?.catch(() => false)));
  const session=readSharedSession(); if(!session) return false;
  const userId=await authenticatedUserId(session); if(!userId) return false;
  for(const key of valid){
    // A calendar restored while the deletion was waiting must not be deleted.
    if(localStorage.getItem(key)!==null || !pendingDeletes().includes(key)) {
      clearPendingDelete(key);
      continue;
    }
    const response=await fetch(`${SUPABASE_URL}/rest/v1/computo_sync?on_conflict=user_id,storage_key`,{method:"POST",headers:headers(session.access_token),body:JSON.stringify({user_id:userId,storage_key:key,payload:{__deleted:true},updated_at:new Date().toISOString()})});
    if(!response.ok) throw new Error(`sync delete ${response.status}`);
    clearPendingDelete(key);
    // If restoration happened during the request, its export wins last.
    if(localStorage.getItem(key)!==null) await pushStorageKey(key);
  }
  return true;
}

// Remove only byte-for-byte duplicate backups. Different backups may hold unsynced edits.
function pruneIdenticalBackups(){
  const prefix = "computo-sync-backup-v1:";
  const redundant: string[] = [];
  for(let i=0;i<localStorage.length;i++){
    const backupKey=localStorage.key(i);
    if(!backupKey?.startsWith(prefix)) continue;
    const originalKey=backupKey.slice(prefix.length);
    if(!isComputoStorageKey(originalKey)) continue;
    const original=localStorage.getItem(originalKey);
    if(original!==null && original===localStorage.getItem(backupKey)) redundant.push(backupKey);
  }
  for(const key of redundant) localStorage.removeItem(key);
}

export async function syncComputoStorage(onState?:(s:SyncState)=>void){
  const session=readSharedSession(); if(!session){onState?.("local");return;}
  onState?.("syncing");
  try{
    pruneIdenticalBackups();
    const userId=await authenticatedUserId(session); if(!userId){onState?.("local");return;}
    // Los borrados pendientes se aplican antes de descargar para que la nube no resucite datos eliminados.
    for(const key of pendingDeletes()) if(isComputoStorageKey(key)) {
      if(localStorage.getItem(key)!==null) { clearPendingDelete(key); markPending(key); continue; }
      const response=await fetch(`${SUPABASE_URL}/rest/v1/computo_sync?on_conflict=user_id,storage_key`,{method:"POST",headers:headers(session.access_token),body:JSON.stringify({user_id:userId,storage_key:key,payload:{__deleted:true},updated_at:new Date().toISOString()})});
      if(!response.ok) throw new Error(`sync delete ${response.status}`);
      clearPendingDelete(key);
      if(localStorage.getItem(key)!==null) await pushStorageKey(key);
    }
    // Los cambios hechos sin conexión se suben antes de descargar la nube.
    for(const key of pendingKeys()) if(isComputoStorageKey(key)) await pushStorageKey(key);
    const response=await fetch(`${SUPABASE_URL}/rest/v1/computo_sync?select=storage_key,payload,updated_at&user_id=eq.${encodeURIComponent(userId)}`,{headers:headers(session.access_token),cache:"no-store"});
    if(!response.ok) throw new Error(`sync pull ${response.status}`);
    const remote=await response.json() as Array<{storage_key:string,payload:unknown}>;
    // Conservative first migration: remote wins for keys already in cloud; otherwise upload local keys.
    // Payroll exports are derived data. Remove only backups confirmed equal to
    // the authenticated cloud snapshot; never prune divergent or calendar backups.
    for (const row of remote) {
      if (!/^metro-payroll-facts-v1-\\d{4}$/.test(row.storage_key) || isDeletedPayload(row.payload)) continue;
      const backupKey = `computo-sync-backup-v1:${row.storage_key}`;
      const backup = localStorage.getItem(backupKey);
      if (backup === null) continue;
      try {
        if (JSON.stringify(JSON.parse(backup)) === JSON.stringify(row.payload)) {
          localStorage.removeItem(backupKey);
        }
      } catch {
        // Preserve backups whose contents cannot be verified.
      }
    }
    const remoteKeys=new Set(remote.map(r=>r.storage_key));
    for(const row of remote) if(isComputoStorageKey(row.storage_key)) {
      if(isDeletedPayload(row.payload)) {
        localStorage.removeItem(row.storage_key);
        clearPending(row.storage_key);
        continue;
      }
      const incoming=decodePayload(row.payload), current=localStorage.getItem(row.storage_key);
      // La primera convergencia nunca destruye una copia local distinta: se conserva como respaldo recuperable.
      if(current!==null && current!==incoming) {
        // Keep the original recoverable; if quota is full, do not overwrite it.
        try {
          localStorage.setItem(`computo-sync-backup-v1:${row.storage_key}`, current);
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "QuotaExceededError")) throw error;
          console.warn("[Còmput AAC] Sin espacio para respaldar datos locales; se conserva el original", { key: row.storage_key });
          continue;
        }
      }
      try {
        localStorage.setItem(row.storage_key,incoming);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "QuotaExceededError")) throw error;
        console.warn("[Còmput AAC] Sin espacio para descargar datos; se conserva la versión local", { key: row.storage_key });
      }
    }
    const localKeys:string[]=[]; for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&isComputoStorageKey(key)&&!remoteKeys.has(key))localKeys.push(key);}
    for(const key of localKeys) await pushStorageKey(key);
    onState?.("synced");
  }catch{ onState?.(navigator.onLine ? "error":"offline"); }
}
