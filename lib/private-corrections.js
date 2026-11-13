// Personal rule values are fetched from authenticated, row-protected storage.
// Keep the existing backup database and migration IDs so old restore points survive.
const fields=new Set(['status','special','medicalStart','medicalEnd','permissionKind','modificationAccount','modificationPlacement','extraHours','customEnd','paidExtensionMinutes','officialHolidayMode']);
const patchFields=new Set(['medicalStart','medicalEnd','permissionKind','calendarOriginalStatus','paidExtensionMinutes','officialHolidayMode']);
function validateCondition(c,depth=0){
 if(!c||depth>8)throw Error('invalid-private-rule');
 if(c.all||c.any){const list=c.all||c.any;if(!Array.isArray(list)||list.length>20)throw Error('invalid-private-rule');list.forEach(x=>validateCondition(x,depth+1));return;}
 if(!fields.has(c.field)||!['eq','falsy','in','numberEq'].includes(c.op)||(c.op==='in'&&!Array.isArray(c.value)))throw Error('invalid-private-rule');
}
export function validateMigration(m){
 if(!m||typeof m.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(m.id)||!Number.isInteger(m.year)||m.year<2000||m.year>2200||!Array.isArray(m.rules)||m.rules.length>100)throw Error('invalid-private-migration');
 for(const r of m.rules){
  if(!Array.isArray(r.dates)||!r.dates.every(d=>typeof d==='string'&&/^\d{2}-\d{2}$/.test(d))||!r.patch||typeof r.patch!=='object'||!Object.keys(r.patch).every(k=>patchFields.has(k)))throw Error('invalid-private-rule');
  validateCondition(r.when);
 }
}
function matches(d,c){
 if(c.all)return c.all.every(x=>matches(d,x));
 if(c.any)return c.any.some(x=>matches(d,x));
 const v=d[c.field];
 if(c.op==='eq')return v===c.value;
 if(c.op==='falsy')return !v;
 if(c.op==='in')return c.value.includes(v);
 if(c.op==='numberEq')return Number(v)===c.value;
 return false;
}
export function applyPrivateRules(plan,migration){
 validateMigration(migration);let changed=0;
 const next=Object.fromEntries(Object.entries(plan).map(([month,p])=>[month,{...p,days:p.days.map(d=>{
  const date=String(month).padStart(2,'0')+'-'+String(d.day).padStart(2,'0');let patch={};
  for(const rule of migration.rules)if(rule.dates.includes(date)&&matches(d,rule.when))patch={...patch,...rule.patch};
  if(Object.keys(patch).some(k=>d[k]!==patch[k])){changed++;return {...d,...patch,manualEdited:true};}return d;
 })}]));
 return {plan:changed?next:plan,changed};
}
function dbOpen(){return new Promise((resolve,reject)=>{const r=indexedDB.open('computo-confirmed-migrations-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('backups',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function migratePrivateCorrection(uid,storage,migration){
 if(!uid)throw Error("authentication-required");
 validateMigration(migration);
 const storageKey='metro-year-'+migration.year,key=uid+':'+migration.id,source=storage.getItem(storageKey);if(!source)return {changed:0};
 const result=applyPrivateRules(JSON.parse(source),migration);if(!result.changed)return result;
 const db=await dbOpen();let already=false;
 try{await new Promise((resolve,reject)=>{const tx=db.transaction('backups','readwrite'),s=tx.objectStore('backups'),r=s.get(key);r.onsuccess=()=>{already=!!r.result?.applied||!!r.result&&r.result.source!==source;if(!r.result)s.add({key,source,applied:false,createdAt:new Date().toISOString()});};tx.oncomplete=resolve;tx.onabort=()=>reject(Error('No s’ha pogut crear la còpia de restauració.'));tx.onerror=()=>reject(tx.error);});}finally{db.close();}
 if(already||storage.getItem(storageKey)!==source)return {changed:0};
 storage.setItem(storageKey,JSON.stringify(result.plan));
 const finish=await dbOpen();try{await new Promise((resolve,reject)=>{const tx=finish.transaction('backups','readwrite'),s=tx.objectStore('backups'),r=s.get(key);r.onsuccess=()=>{if(r.result)s.put({...r.result,applied:true,appliedAt:new Date().toISOString()});};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{finish.close();}
 return result;
}
