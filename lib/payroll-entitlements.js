// Labour dates and intervals come from Còmput, never from an observed payslip.
// Barcelona 2026: Generalitat EMT/66/2025 + municipal local holidays.
export const HOLIDAYS_2026=['01-01','01-06','04-03','04-06','05-01','05-25','06-24','08-15','09-11','09-24','10-12','12-08','12-25','12-26'];
const DAY=86400000,round=n=>Math.round((n+Number.EPSILON)*100)/100;
const pending=message=>({expected:null,state:'pending',label:'Falten dades',labour:null,message});
const dateMs=s=>Date.parse(s+'T00:00:00Z');
const dateKey=n=>new Date(n).toISOString().slice(0,10);
const addDate=(s,n)=>dateKey(dateMs(s)+n*DAY);
const special=date=>{const y=+date.slice(0,4),md=date.slice(5);return md==='12-25'&&y>=2024||['01-01','01-06'].includes(md)&&y>=2024||md==='06-24'&&y>=2025||md==='09-24'&&y>=2026;};
function interval(d){
 if(!d?.activity?.scheduleResolved)return null;
 const m=/^(\d{2}):(\d{2})[–−-](\d{2}):(\d{2})$/.exec(d.schedule||'');if(!m)return null;
 const a=+m[1]*60 + +m[2],b=+m[3]*60 + +m[4];if(a>=1440||b>=1440||+m[2]>=60||+m[4]>=60||a===b)return null;
 const start=dateMs(d.date)+a*60000;return [start,dateMs(d.date)+(b+(b<a?1440:0))*60000];
}
function coverage(facts){
 if(!facts||!/^\d{4}-(0[1-9]|1[0-2])$/.test(facts.period||"")||!Array.isArray(facts.days))return false;
 const count=facts.through?+facts.through.slice(-2):new Date(Date.UTC(+facts.period.slice(0,4),+facts.period.slice(5),0)).getUTCDate();
 return Array.from({length:count},(_,i)=>`${facts.period}-${String(i+1).padStart(2,'0')}`).every(date=>facts.days.some(d=>d.date===date));
}
const fmt=(n,digits=2)=>new Intl.NumberFormat('ca-ES',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(n);
function result(value,units,dates,message,rate){return {expected:round(value),state:'component',label:'Estimació',labour:{value:units,unit:'day',state:'complete',pending:0,missing:0},dates,message,calculation:`${units} dies × ${fmt(rate,4)} € = ${fmt(round(value))} €`};}
export const OFFICIAL_FULL_RATES=Object.freeze({2024:79.86,2025:84.93,2026:90});
export function officialHolidayRate(year,percent,mode='PROPORTIONAL'){
 const full=OFFICIAL_FULL_RATES[year];return full&&percent>0&&percent<=100?round(full*(mode==='E'?1:percent/100)):null;
}
export function calculateEntitlement(id,{facts,profile,period,history=[],vacationBasis=null}){
 if(!coverage(facts))return pending('Falten jornades de Còmput per completar el període. Obre i sincronitza el calendari.');
 const days=facts.days.filter(d=>!facts.through||d.date<=facts.through);
 if(days.some(d=>!d.activity))return pending('Cal sincronitzar Còmput amb la nova versió: falten situacions, descansos i horaris detallats.');
 if(id==='vacation-premiums'){
  if(days.some(d=>d.activity.vacation===null))return pending('Hi ha dies de vacances o el seu origen pendents de resoldre a Còmput.');
  const vacation=days.filter(d=>d.activity.vacation),n=vacation.length;
  if(!n)return result(0,0,[],'Cap dia de vacances liquidable declarat a Còmput en aquest període.',0);
  if(!vacationBasis?.confirmed||!Number.isFinite(vacationBasis.total)||vacationBasis.total<0||!Number.isFinite(vacationBasis.calendarDays)||vacationBasis.calendarDays<=0||!vacationBasis.source?.trim())return {...pending(`Còmput aporta ${n} dies de vacances. Falta completar l’historial de primes o el calendari dels 12 mesos anteriors. No és un import de zero.`),labour:{value:n,unit:'day',state:'complete',pending:0,missing:0},dates:vacation.map(d=>d.date)};
  const rate=vacationBasis.total/vacationBasis.calendarDays;
  const r=result(n*rate,n,vacation.map(d=>d.date),`Base ${vacationBasis.automatic?'reconstruïda':'aportada'}: ${fmt(vacationBasis.total)} € / ${vacationBasis.calendarDays} dies de calendari laboral. Font: ${vacationBasis.source}. Cal una base vàlida per a tots els blocs de vacances del període. Sense tornar a aplicar el percentatge contractual.`,rate);
  if(vacationBasis.automatic)r.message+=' Criteri provisional: 12 mesos naturals previs i dies de treball del calendari original, inclosos els coberts per vacances o absències. El divisor, el període exacte i l’arrodoniment de TMB estan pendents de conciliació; no es presenta com a import verificat.';
  return r;
 }
 if(days.some(d=>d.activity.working===null))return pending('Hi ha situacions pendents de revisar a Còmput.');
 if(id==='special-day'){
  if(+facts.period.slice(0,4)<2024||+facts.period.slice(0,4)>2026)return pending('Cal validar vigència i tarifa del Dia Especial per a aquest any.');
  const all=new Map();for(const h of history){const f=h?.facts||h;if(f?.days)for(const d of f.days)all.set(d.date,d);}for(const d of days)all.set(d.date,d);
  const events=[];
  for(const event of days.filter(d=>special(d.date)).map(d=>d.date)){
   let eligible=false;
   for(const date of [addDate(event,-1),event]){
    const d=all.get(date);if(!d?.activity)return pending(`Falten les dades de ${date} per comprovar la vigília del dia especial ${event}.`);
    if(d.activity.working===null)return pending(`Situació pendent de ${date}.`);
    if(!d.activity.working)continue;
    const times=interval(d);if(!times)return pending(`Falta l’horari resolt de ${date}.`);
    if(times[0]<dateMs(event)+18*3600000&&times[1]>dateMs(event)-3600000){
     if(d.activity.ordinary!==true)return pending(`Cal confirmar servei efectiu en jornada ordinària o coincidència treballada el ${date}.`);eligible=true;
    }
   }
   if(eligible)events.push(event);
  }
  return result(events.length*202.39,events.length,events,`Art. 9–12 FMB: franja 23 h de la vigília–18 h del dia especial. Cada esdeveniment es compta una vegada, incloses les jornades iniciades la vigília. Període del dia especial ${facts.period}; mes d’abonament pendent de conciliació.`,202.39);
 }
 const officialE=id==='official-holiday-e';
 const official=id==='official-holiday'||officialE;
 if(!official&&id!=='worked-holiday-e')return pending('Concepte sense equivalència econòmica confirmada.');
 const explicit=official?days.filter(d=>['E','PROPORTIONAL'].includes(d.activity.officialHolidayMode)):[];
 if(officialE&&!explicit.some(d=>d.activity.officialHolidayMode==='E'))return pending('No hi ha modalitats de Festivo Oficial E confirmades. No es dedueix la E de la durada del torn.');
 const workedHoliday=id==='worked-holiday-e';
 if(workedHoliday&&![2024,2025,2026].includes(+facts.period.slice(0,4)))return pending('Falta validar tarifa i vigència de Festivo Trabajado E per a aquest any.');
 if(!workedHoliday&&+facts.period.slice(0,4)!==2026&&!explicit.length)return pending('Falta validar el calendari de festius laborals aplicable o confirmar modalitats amb SAP.');
 if(!(profile?.percent>0&&profile.percent<=100))return pending('Falta el percentatge contractual aplicable de Còmput.');
 const all=new Map();for(const h of history){const f=h?.facts||h;if(f?.days)for(const d of f.days)all.set(d.date,d);}for(const d of days)all.set(d.date,d);
 const eligible=[];
 const unitsByDate=[];
 for(const d of days){
  if(officialE||!workedHoliday&&+facts.period.slice(0,4)!==2026)continue;
  if(workedHoliday?new Date(d.date+'T12:00:00Z').getUTCDay()!==0:!HOLIDAYS_2026.includes(d.date.slice(5)))continue;
  if(official&&[addDate(d.date,-1),d.date].some(date=>['E','PROPORTIONAL'].includes(all.get(date)?.activity?.officialHolidayMode)))continue;
  // El plus dominical manté la comprovació existent del dia de diumenge.
  // Per al festiu oficial, un servei ordinari iniciat la vigília pot
  // travessar la mitjanit encara que el dia festiu sigui descans propi.
  if(workedHoliday){
   if(d.activity.weeklyRest===null)return pending(`Cal confirmar el descans setmanal propi de ${d.date}.`);
   if(d.activity.weeklyRest)continue;
  }
  let minutes=0,excluded=false,previousMinutes=0;
  for(const date of [addDate(d.date,-1),d.date]){
   const segment=all.get(date);if(!segment?.activity)return pending(`Falten les dades de ${date} per comprovar el treball nocturn que entra al festiu ${d.date}.`);
   if(segment.activity.working===null)return pending(`Situació pendent de ${date}.`);
   if(!segment.activity.working)continue;
   // No confondre el descans del dia festiu amb el descans de la jornada
   // d'origen: l'activitat nocturna de la vigília pot ser retribuïble.
   if(!workedHoliday){
    if(segment.activity.weeklyRest===null)return pending(`Cal confirmar el descans setmanal propi de ${date}.`);
    if(segment.activity.weeklyRest)continue;
   }
   const times=interval(segment);if(!times)return pending(`Falta l’horari resolt de ${date}.`);
   const overlap=Math.max(0,Math.min(times[1],dateMs(d.date)+DAY)-Math.max(times[0],dateMs(d.date)))/60000;
   minutes+=overlap;
   if(!workedHoliday&&date!==d.date)previousMinutes+=overlap;
   if(special(d.date)&&date===d.date&&times[0]<dateMs(d.date)+18*3600000&&times[1]>dateMs(d.date)-3600000){
    if(segment.activity.ordinary!==true)return pending(`Cal confirmar la compatibilitat de plusos del ${date}.`);
    excluded=true;
   }
  }
  const minimum=profile.percent===100?240:120;
  if(minutes>=minimum&&!excluded){
   // SAP valora el torn iniciat la vigília per la data d'inici.
   // Si l'encavalcament de la vigília no assoleix el mínim per si sol,
   // conservem la data civil del festiu fins a documentar-ne un altre criteri.
   const sourceDate=!workedHoliday&&previousMinutes>=minimum?addDate(d.date,-1):d.date;
   eligible.push(sourceDate);
  }
 }
 const year=+facts.period.slice(0,4);
 if(workedHoliday){const rate=({2024:45.28,2025:52.64,2026:60})[year];return result(eligible.length*rate,eligible.length,eligible,'I-38 i arts. 9–12 FMB. Diumenges, mínims d’hores, descans propi i compatibilitat amb Dia Especial per esdeveniment. Variant E a tarifa íntegra; la coincidència de plusos en un mateix mes no implica incompatibilitat.',rate);}
 for(const date of eligible){const percent=all.get(date)?.profile?.percent??profile.percent;const rate=officialHolidayRate(year,percent);if(rate===null)return pending('Falta tarifa o percentatge aplicable a '+date);unitsByDate.push({date,mode:'PROPORTIONAL',percent,rate,certainty:'preview'});}
 for(const d of explicit.filter(d=>(d.activity.officialHolidayMode==='E')===officialE)){
  if(d.activity.working!==true||!interval(d))return pending('Cal confirmar servei efectiu i horari de '+d.date);
  const percent=d.profile?.percent??profile.percent,rate=officialHolidayRate(year,percent,d.activity.officialHolidayMode);
  if(rate===null)return pending('Falta tarifa o percentatge aplicable a '+d.date);
  unitsByDate.push({date:d.date,mode:d.activity.officialHolidayMode,percent,rate,certainty:'confirmed-mode'});
 }
 const value=round(unitsByDate.reduce((sum,u)=>sum+u.rate,0)),dates=unitsByDate.map(u=>u.date);
 return {...result(value,dates.length,dates,officialE?'P.Festivo Oficial E: modalitat confirmada per valoració o rebut, tarifa íntegra al 100 %. No s’infereix amb un llindar de 5 hores.':'Plus Festivo Oficial proporcional: tarifa íntegra de l’any × percentatge vigent de cada jornada, arrodonida a cèntims per unitat. Les modalitats confirmades prevalen sobre la previsió per festiu; la resta manté els mínims i compatibilitats existents, pendents de conciliació.',dates.length?value/dates.length:0),unitsByDate,calculation:unitsByDate.map(u=>u.date+' · '+fmt(u.rate)+' €').join(' + ')+' = '+fmt(value)+' €'};
}
export const VACATION_BASIS_PREFIX='nomina-vacation-basis-v1-';
export function readVacationBasis(storage,owner,period){try{return owner?JSON.parse(storage.getItem(VACATION_BASIS_PREFIX+owner+'-'+period)||'null'):null;}catch{return null;}}
export function saveVacationBasis(storage,owner,period,raw){
 if(!owner||!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw Error('Identifica’t abans de desar la base.');
 const total=Number(raw.total),calendarDays=Number(raw.calendarDays),source=String(raw.source||'').trim().slice(0,400);
 if(!Number.isFinite(total)||total<0||!Number.isFinite(calendarDays)||calendarDays<=0||!source||raw.confirmed!==true)throw Error('Completa imports, dies, període/font i confirma la base.');
 const basis={total,calendarDays,source,confirmed:true};storage.setItem(VACATION_BASIS_PREFIX+owner+'-'+period,JSON.stringify(basis));return basis;
}
