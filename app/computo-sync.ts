import { authenticatedUserId, readSharedSession, SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./tmb-session";

export type SyncState = "local" | "syncing" | "synced" | "offline" | "error";
const PREFIXES = ["metro-year-", "metro-periods-", "metro-prior-", "metro-detector-version-", "metro-cycle-phase-"];
const EXACT = new Set(["metro-profile-v1", "metro-profile-v2"]);
const PENDING_KEY = "computo-sync-pending-v1";
function pendingKeys(){ try { const v=JSON.parse(localStorage.getItem(PENDING_KEY)||"[]"); return Array.isArray(v)?v.filter((x):x is string=>typeof x==="string"):[]; } catch { return []; } }
function markPending(key:string){ localStorage.setItem(PENDING_KEY, JSON.stringify([...new Set([...pendingKeys(),key])])); }
function clearPending(key:string){ localStorage.setItem(PENDING_KEY, JSON.stringify(pendingKeys().filter(k=>k!==key))); }
export function isComputoStorageKey(key:string){ return EXACT.has(key) || PREFIXES.some(prefix=>key.startsWith(prefix)); }
function headers(token:string){ return { apikey:SUPABASE_PUBLIC_KEY, Authorization:`Bearer ${token}`, "Content-Type":"application/json", Prefer:"resolution=merge-duplicates,return=minimal" }; }
function encodePayload(raw:string){ try { return JSON.parse(raw); } catch { return { __raw: raw }; } }
function decodePayload(payload:any){ return payload && typeof payload==="object" && Object.keys(payload).length===1 && typeof payload.__raw==="string" ? payload.__raw : JSON.stringify(payload); }

export async function pushStorageKey(key:string){
  if(!isComputoStorageKey(key)) return false;
  const session=readSharedSession(), raw=localStorage.getItem(key);
  if(raw===null) return false;
  if(!session){ markPending(key); return false; }
  const userId=await authenticatedUserId(session); if(!userId) return false;
  const response=await fetch(`${SUPABASE_URL}/rest/v1/computo_sync?on_conflict=user_id,storage_key`,{method:"POST",headers:headers(session.access_token),body:JSON.stringify({user_id:userId,storage_key:key,payload:encodePayload(raw),updated_at:new Date().toISOString()})});
  if(!response.ok){ markPending(key); throw new Error(`sync push ${response.status}`); }
  clearPending(key);
  return true;
}

export async function syncComputoStorage(onState?:(s:SyncState)=>void){
  const session=readSharedSession(); if(!session){onState?.("local");return;}
  onState?.("syncing");
  try{
    const userId=await authenticatedUserId(session); if(!userId){onState?.("local");return;}
    // Los cambios hechos sin conexión se suben antes de descargar la nube.
    for(const key of pendingKeys()) if(isComputoStorageKey(key)) await pushStorageKey(key);
    const response=await fetch(`${SUPABASE_URL}/rest/v1/computo_sync?select=storage_key,payload,updated_at&user_id=eq.${encodeURIComponent(userId)}`,{headers:headers(session.access_token),cache:"no-store"});
    if(!response.ok) throw new Error(`sync pull ${response.status}`);
    const remote=await response.json() as Array<{storage_key:string,payload:any}>;
    // Conservative first migration: remote wins for keys already in cloud; otherwise upload local keys.
    const remoteKeys=new Set(remote.map(r=>r.storage_key));
    for(const row of remote) if(isComputoStorageKey(row.storage_key)) {
      const incoming=decodePayload(row.payload), current=localStorage.getItem(row.storage_key);
      // La primera convergencia nunca destruye una copia local distinta: se conserva como respaldo recuperable.
      if(current!==null && current!==incoming) localStorage.setItem(`computo-sync-backup-v1:${row.storage_key}`, current);
      localStorage.setItem(row.storage_key,incoming);
    }
    const localKeys:string[]=[]; for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&isComputoStorageKey(key)&&!remoteKeys.has(key))localKeys.push(key);}
    for(const key of localKeys) await pushStorageKey(key);
    onState?.("synced");
  }catch{ onState?.(navigator.onLine ? "error":"offline"); }
}
