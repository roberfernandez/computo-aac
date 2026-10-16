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
 if(!facts)return false;
 const count=facts.through?+facts.through.slice(-2):new Date(Date.UTC(+facts.period.slice(0,4),+facts.period.slice(5),0)).getUTCDate();
 return Array.from({length:count},(_,i)=>`${facts.period}-${String(i+1).padStart(2,'0')}`).every(date=>facts.days.some(d=>d.date===date));
}
const fmt=(n,digits=2)=>new Intl.NumberFormat('ca-ES',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(n);
function result(value,units,dates,message,rate){return {expected:round(value),state:'component',label:'Estimació',labour:{value:units,unit:'day',state:'complete',pending:0,missing:0},dates,message,calculation:`${units} dies × ${fmt(rate,4)} € = ${fmt(round(value))} €`};}
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
 const workedHoliday=id==='worked-holiday-e';
 if(workedHoliday&&![2024,2025,2026].includes(+facts.period.slice(0,4)))return pending('Falta validar tarifa i vigència de Festivo Trabajado E per a aquest any.');
 if(!workedHoliday&&+facts.period.slice(0,4)!==2026)return pending('Falta validar el calendari de festius laborals aplicable a aquest any. No s’utilitza la categoria operativa DIUMENGE com a festiu oficial.');
 if(!(profile?.percent>0&&profile.percent<=100))return pending('Falta el percentatge contractual aplicable de Còmput.');
 const all=new Map();for(const h of history){const f=h?.facts||h;if(f?.days)for(const d of f.days)all.set(d.date,d);}for(const d of days)all.set(d.date,d);
 const eligible=[];
 for(const d of days){
  if(workedHoliday?new Date(d.date+'T12:00:00Z').getUTCDay()!==0:!HOLIDAYS_2026.includes(d.date.slice(5)))continue;
  if(d.activity.weeklyRest===null)return pending(`Cal confirmar el descans setmanal propi de ${d.date}.`);
  if(d.activity.weeklyRest)continue;
  let minutes=0,excluded=false;
  for(const date of [addDate(d.date,-1),d.date]){
   const segment=all.get(date);if(!segment?.activity)return pending(`Falten les dades de ${date} per comprovar el treball nocturn que entra al festiu ${d.date}.`);
   if(segment.activity.working===null)return pending(`Situació pendent de ${date}.`);
   if(!segment.activity.working)continue;
   const times=interval(segment);if(!times)return pending(`Falta l’horari resolt de ${date}.`);
   const overlap=Math.max(0,Math.min(times[1],dateMs(d.date)+DAY)-Math.max(times[0],dateMs(d.date)))/60000;
   minutes+=overlap;
   if(special(d.date)&&date===d.date&&times[0]<dateMs(d.date)+18*3600000&&times[1]>dateMs(d.date)-3600000){
    if(segment.activity.ordinary!==true)return pending(`Cal confirmar la compatibilitat de plusos del ${date}.`);
    excluded=true;
   }
  }
  if(minutes>=(profile.percent===100?240:120)&&!excluded)eligible.push(d.date);
 }
 const rate=workedHoliday?({2024:45.28,2025:52.64,2026:60})[+facts.period.slice(0,4)]:90*profile.percent/100;
 if(workedHoliday)return result(eligible.length*rate,eligible.length,eligible,`I-38 i arts. 9–12 FMB. Diumenges, mínims d’hores, descans propi i compatibilitat amb Dia Especial. Variant E estimada a tarifa íntegra, contrastada amb rebuts; no es fusiona amb la variant proporcional. Activitat ${facts.period}; mes d’abonament pendent de conciliació.`,rate);
 return result(eligible.length*rate,eligible.length,eligible,`I-78 i arts. 9–12 FMB. Festius laborals de Barcelona 2026; mínim 4 h a jornada completa o 2 h a parcial; exclòs descans propi i incompatibilitat per inici al dia especial. Tarifa íntegra 90 € × ${fmt(profile.percent)} %. Activitat ${facts.period}; no s’assigna automàticament al rebut del mateix mes.`,rate);
}
export const VACATION_BASIS_PREFIX='nomina-vacation-basis-v1-';
export function readVacationBasis(storage,owner,period){try{return owner?JSON.parse(storage.getItem(VACATION_BASIS_PREFIX+owner+'-'+period)||'null'):null;}catch{return null;}}
export function saveVacationBasis(storage,owner,period,raw){
 if(!owner||!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw Error('Identifica’t abans de desar la base.');
 const total=Number(raw.total),calendarDays=Number(raw.calendarDays),source=String(raw.source||'').trim().slice(0,400);
 if(!Number.isFinite(total)||total<0||!Number.isFinite(calendarDays)||calendarDays<=0||!source||raw.confirmed!==true)throw Error('Completa imports, dies, període/font i confirma la base.');
 const basis={total,calendarDays,source,confirmed:true};storage.setItem(VACATION_BASIS_PREFIX+owner+'-'+period,JSON.stringify(basis));return basis;
}
