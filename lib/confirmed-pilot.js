export const PILOT_OWNER='1dd672e7-707f-4197-a393-a5f6f3a6d74e';
const working=d=>['AGCG','FORMACION','REVISION_MEDICA','VISPERA_FESTIVO','COMPUTO_ANTERIOR','COMPUTO_ACTUAL'].includes(d.status)||d.special==='MODIFICACION';
export function confirmedPilotPlan(plan,uid,year){
 if(uid!==PILOT_OWNER||year!==2026)return {plan,changed:0};
 let changed=0;
 const normal=new Set(['01-01','01-05','01-06','04-02','04-06','04-30','05-24','10-11']),full=new Set(['09-11','09-23']);
 const next=Object.fromEntries(Object.entries(plan).map(([month,p])=>[month,{...p,days:p.days.map(d=>{
  const date=String(month).padStart(2,'0')+'-'+String(d.day).padStart(2,'0');let patch={};
  if(date==='02-19'&&d.status==='REVISION_MEDICA'&&!d.medicalStart&&!d.medicalEnd)patch={medicalStart:'19:00',medicalEnd:'22:00'};
  if(date==='03-02'&&d.status==='PERMISO'&&!d.permissionKind)patch={permissionKind:'FAMILY_MEDICAL_FULL_DAY'};
  if(['03-23','03-24'].includes(date)&&(d.status==='COMPUTO_ANTERIOR'||d.special==='MODIFICACION'&&d.modificationAccount==='ANTERIOR'))patch={calendarOriginalStatus:date==='03-23'?'DCOM':'FEST'};
  if(date==='07-19'&&d.special==='MODIFICACION'&&!d.paidExtensionMinutes&&(((!d.modificationPlacement||d.modificationPlacement==='FINAL')&&Number(d.extraHours)===1)||d.customEnd==='01:50'))patch.paidExtensionMinutes=60;
  if(working(d)&&!d.officialHolidayMode&&(normal.has(date)||full.has(date)))patch.officialHolidayMode=full.has(date)?'E':'PROPORTIONAL';
  if(Object.keys(patch).some(k=>d[k]!==patch[k])){changed++;return {...d,...patch,manualEdited:true};}return d;
 })}]));
 return {plan:changed?next:plan,changed};
}
function dbOpen(){return new Promise((resolve,reject)=>{const r=indexedDB.open('computo-confirmed-migrations-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('backups',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function migrateConfirmedPilot(uid,storage){
 if(uid!==PILOT_OWNER)return {changed:0};
 const key=uid+':confirmed-20261113-v3',source=storage.getItem('metro-year-2026');if(!source)return {changed:0};
 const result=confirmedPilotPlan(JSON.parse(source),uid,2026);if(!result.changed)return result;
 const db=await dbOpen();let already=false;
 try{await new Promise((resolve,reject)=>{const tx=db.transaction('backups','readwrite'),s=tx.objectStore('backups'),r=s.get(key);r.onsuccess=()=>{already=!!r.result?.applied||!!r.result&&r.result.source!==source;if(!r.result)s.add({key,source,applied:false,createdAt:new Date().toISOString()});};tx.oncomplete=resolve;tx.onabort=()=>reject(Error('No s’ha pogut crear la còpia de restauració.'));tx.onerror=()=>reject(tx.error);});}finally{db.close();}
 if(already||storage.getItem('metro-year-2026')!==source)return {changed:0};
 storage.setItem('metro-year-2026',JSON.stringify(result.plan));
 const finish=await dbOpen();try{await new Promise((resolve,reject)=>{const tx=finish.transaction('backups','readwrite'),s=tx.objectStore('backups'),r=s.get(key);r.onsuccess=()=>{if(r.result)s.put({...r.result,applied:true,appliedAt:new Date().toISOString()});};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{finish.close();}
 return result;
}
