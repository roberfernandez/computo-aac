import {authenticatedUserId,readSharedSession,SUPABASE_URL,SUPABASE_PUBLIC_KEY,type SharedSession} from "./tmb-session";
import {migratePrivateCorrection} from "../lib/private-corrections";
import {markStorageKeyPending,pushStorageKey} from "./computo-sync";
export async function applyAccountCorrections(uid:string,session:SharedSession){
 const response=await fetch(`${SUPABASE_URL}/rest/v1/computo_sync?select=payload&storage_key=eq.private-corrections-v1&user_id=eq.${encodeURIComponent(uid)}`,{headers:{apikey:SUPABASE_PUBLIC_KEY,Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
 if(!response.ok)throw Error("private-corrections-unavailable");
 const rows=await response.json();if(!Array.isArray(rows)||rows.length>1)throw Error("invalid-private-corrections");
 const manifest=rows[0]?.payload;if(!manifest)return;
 if(manifest.version!==1||!Array.isArray(manifest.migrations)||manifest.migrations.length>20)throw Error("invalid-private-corrections");
 for(const migration of manifest.migrations){
  if(readSharedSession()?.access_token!==session.access_token||await authenticatedUserId(session)!==uid)throw Error("session-changed");
  const result=await migratePrivateCorrection(uid,localStorage,migration);
  if(result.changed){const key="metro-year-"+migration.year;markStorageKeyPending(key);await pushStorageKey(key);}
 }
}
