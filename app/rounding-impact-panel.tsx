"use client";

import {useState} from "react";
import {roundingPilotAvailable,roundingReport,signedRoundingTime,type RoundingInput} from "@/lib/rounding-impact";
export type {RoundingInput,RoundingDay} from "@/lib/rounding-impact";

type SapDoc={ano:number;extraido:string;valoraciones:Record<string,{LongText:string;Number:string}[]>};
type Total={count:number;excluded:number;exact:number|null;company:number|null;seconds:number|null};
const hours=(value:number|null,digits=2)=>value===null?"Pendent":value.toLocaleString("ca-ES",{minimumFractionDigits:digits,maximumFractionDigits:digits})+" h";
const months=["Gener","Febrer","Març","Abril","Maig","Juny","Juliol","Agost","Setembre","Octubre","Novembre","Desembre"];
function todayMadrid(){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const part=(type:string)=>parts.find(value=>value.type===type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function defaultEnd(year:number,today:string){
  if(year<Number(today.slice(0,4)))return `${year}-12-31`;
  if(year>Number(today.slice(0,4))||today.slice(5,7)==="01")return `${year}-01-01`;
  const previous=new Date(Date.UTC(year,Number(today.slice(5,7))-1,0));
  return previous.toISOString().slice(0,10);
}
function Result({title,value}: {title:string;value:Total}){
  return <div className="min-w-0 rounded-lg border border-white/10 bg-[#0b2029] p-3">
    <h4 className="text-xs font-semibold text-white/85">{title}</h4>
    <p className={"mt-1 text-lg font-semibold "+(value.seconds===null?"text-white/55":value.seconds<0?"text-amber-200":"text-emerald-200")}>{signedRoundingTime(value.seconds)}</p>
    <p className="text-[11px] text-white/60">{value.count} jornades analitzades{value.excluded?` · ${value.excluded} jornades especials excloses`:""}</p>
    <dl className="mt-2 space-y-1 text-xs"><div className="flex flex-wrap justify-between gap-x-2"><dt>Amb la pauta arrodonida</dt><dd>{hours(value.company)}</dd></div>
      <div className="flex flex-wrap justify-between gap-x-2"><dt>Sense arrodoniment diari</dt><dd>{hours(value.exact,5)}</dd></div></dl>
  </div>;
}

// Parent renders this component only after verifiedOwner() has authenticated the
// existing private administrator claim. No bypass, user ID or personal facts here.
export default function RoundingImpactPanel({input,sapDoc}:{input:RoundingInput|null;sapDoc:SapDoc|null}){
  const [today]=useState(todayMadrid);
  const [from,setFrom]=useState(()=>`${input?.year||2026}-01-01`);
  const [to,setTo]=useState(()=>defaultEnd(input?.year||2026,today));
  if(!roundingPilotAvailable(input))return null;
  const report=roundingReport(input,{from,to,asOf:today},sapDoc);
  return <section className="panel !p-0 overflow-hidden" aria-label="Arrodoniment del meu contracte">
    <details>
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-3">
        <span className="text-sm font-semibold text-[#71d7cc]">Com t&apos;afecta l&apos;arrodoniment?</span>
        <span className="shrink-0 rounded border border-[#71d7cc]/30 px-1.5 py-0.5 text-[10px] text-[#71d7cc]">Només administrador</span>
      </summary>
      <div className="space-y-4 border-t border-white/15 p-3 sm:p-4">
        <p className="text-sm font-semibold">El teu cas · T8 · 85,81 % · {input!.year}</p>
        <p className="text-xs leading-relaxed text-white/75">La conversió diària a centèsimes d&apos;hora pot sumar o restar segons la jornada. <b>0,01 h són 36 segons.</b> Comparem per separat el còmput horari i la nocturnitat variable. El signe + suma temps; el signe − en resta.</p>
        <details className="rounded-lg border border-white/15 p-3" open>
          <summary className="cursor-pointer text-sm font-semibold">1 · Què fa l&apos;empresa i com t&apos;afecta en teoria</summary>
          {report.ready&&<div className="mt-3 space-y-3 text-xs leading-relaxed">
            <p><b>Còmput horari.</b> La pauta observada del 85,81 % registra −0,64 h per jornada normal, +1,36 h per divendres/vigília i +1,79 h per dissabte ordinari. La referència exacta proporcional de {input!.year} és {hours(report.annualHours,4)} ÷ {report.workdays} dies = <b>{hours(report.meanHours,8)}/dia</b>. Comparem aquests saldos amb la durada reconeguda menys aquesta mitjana.</p>
            <p>En aquestes jornades, la pauta equival a convertir la durada a centèsimes i restar una base de <b>6,71 h</b>. Exemple: 6 h 04 min → 6,07 h; 6,07 − 6,71 = −0,64 h. La diferència respecte de la durada i la mitjana exactes és l&apos;efecte que mostrem.</p>
            <p><b>Nocturnitat variable.</b> Comparem els minuts amb dret a nocturnitat amb la seva conversió diària a dues xifres decimals. Per exemple, 2 h 50 min es registren com 2,83 h: són 12 segons menys. Quan correspon abonar la jornada sencera, usem els minuts retribuïbles que ja calcula Còmput.</p>
            <div className="overflow-x-auto"><table className="w-full text-left text-[11px]"><caption className="mb-2 text-left text-white/60">Efecte per jornada ordinària: pauta arrodonida menys valor exacte</caption>
              <thead><tr className="border-b border-white/15"><th className="py-2 pr-2">Jornada</th><th className="px-1">Còmput</th><th className="pl-1">Nocturnitat</th></tr></thead>
              <tbody>{report.examples.map(row=><tr key={row.label} className="border-b border-white/10 align-top"><th className="py-2 pr-2 font-normal">{row.label}<span className="block text-white/50">{row.schedule}</span></th><td className="whitespace-nowrap px-1 py-2">{signedRoundingTime(row.balance?.seconds)}</td><td className="whitespace-nowrap pl-1 py-2">{signedRoundingTime(row.night?.seconds)}</td></tr>)}</tbody>
            </table></div>
            <p className="text-[11px] text-white/55">Referència proporcional calculada amb tots els decimals. La jornada anual que mostra Còmput continua expressada a dues xifres. La comprovació del tancament anual pot incorporar compensacions posteriors.</p>
          </div>}
        </details>
        <div><h3 className="mb-2 text-sm font-semibold">2 · El teu període</h3>
          <div className="grid grid-cols-2 gap-2"><label className="min-w-0 text-xs">Des de<input aria-label="Arrodoniment des de" type="date" min={`${input!.year}-01-01`} max={`${input!.year}-12-31`} value={from} onChange={event=>setFrom(event.target.value)} className="mt-1 block w-full min-w-0 rounded border border-white/25 bg-[#0b2029] px-2 py-2 text-xs"/></label>
          <label className="min-w-0 text-xs">Fins a<input aria-label="Arrodoniment fins a" type="date" min={`${input!.year}-01-01`} max={`${input!.year}-12-31`} value={to} onChange={event=>setTo(event.target.value)} className="mt-1 block w-full min-w-0 rounded border border-white/25 bg-[#0b2029] px-2 py-2 text-xs"/></label></div>
        </div>
        {!report.ready?<p role="status" className="text-xs text-amber-200">{report.reason}</p>:<>
          <details className="rounded border border-white/15 p-3"><summary className="cursor-pointer text-xs font-semibold">Previsió teòrica segons el calendari del període</summary><p className="my-2 text-[11px] text-white/60">Inclou les jornades previstes, encara que siguin futures o no confirmades.</p><div className="space-y-2"><Result title="Còmput horari previst" value={report.forecast.balance}/><Result title="Nocturnitat variable prevista" value={report.forecast.night}/></div></details>
          <div className="space-y-2"><h3 className="text-sm font-semibold">3 · Com t&apos;ha afectat a la pràctica</h3>
            <p className="text-xs text-white/65">Calculat amb les jornades passades dels mesos que has confirmat. Les dates d&apos;avui i futures no compten com a realitzades.</p>
            <Result title="Efecte en el còmput horari" value={report.actual.balance}/><Result title="Efecte en la nocturnitat variable" value={report.actual.night}/>
            {(report.missing>0||report.unknownDays>0||report.excludedWork>0)&&<p className="text-xs text-amber-200">Cobertura parcial: {report.missing} dates sense calendari, {report.unknownDays} dies per revisar i {report.excludedWork} jornades futures o no confirmades. Els dies sense dades no es compten com a zero.</p>}
          </div>
          <details className="rounded border border-white/15 p-3"><summary className="cursor-pointer text-xs font-semibold">Contrast amb SAP</summary>
            <div className="mt-2 space-y-2 text-xs text-white/75"><p><b>Còmput:</b> calculat amb el teu calendari i la pauta de saldos observada. El pont actual no aporta el saldo diari de còmput; aquest total no es presenta com a contrastat amb SAP.</p>
              <p><b>Nocturnitat:</b> {sapDoc?"contrast dels mesos complets del període amb les valoracions disponibles.":"sense còpia SAP disponible; resultat calculat amb el calendari."}</p>
              {report.sapNight.map((row:{period:string;status:string;residualSeconds?:number})=><p key={row.period}><b>{months[Number(row.period.slice(5))-1]}:</b> {row.status==="match"?"la pauta de centèsimes coincideix amb el total SAP.":row.status==="different"?`diferència addicional de ${signedRoundingTime(row.residualSeconds)} entre SAP i la pauta; pendent de conciliar, fora de l’efecte d’arrodoniment.`:"sense contrast complet disponible."}</p>)}
            </div>
          </details>
          <details className="rounded border border-white/15 p-3"><summary className="cursor-pointer text-xs font-semibold">Detall per dies ({report.days.length})</summary>
            <div className="mt-3 max-h-80 overflow-auto"><table className="w-full text-left text-[11px]"><thead><tr><th className="pb-2">Dia / horari</th><th className="px-1 pb-2">Còmput</th><th className="pl-1 pb-2">Nocturnitat</th></tr></thead><tbody>{report.days.map((row:{date:string;schedule:string;balance:{seconds:number}|null;night:{seconds:number}|null;balanceReason:string;nightReason:string})=><tr key={row.date} className="border-t border-white/10 align-top"><th className="py-2 pr-1 font-normal">{row.date.slice(8)}/{row.date.slice(5,7)}<span className="block text-white/50">{row.schedule}</span></th><td className="px-1 py-2" title={row.balanceReason}>{row.balance?signedRoundingTime(row.balance.seconds):"Fora de l’anàlisi"}</td><td className="py-2 pl-1" title={row.nightReason}>{row.night?signedRoundingTime(row.night.seconds):"Per conciliar"}</td></tr>)}</tbody></table></div>
          </details>
          <p className="text-[11px] leading-relaxed text-white/55">Les recuperacions d&apos;altres anys, prolongacions abonades a part i incidències sense una equivalència exacta queden fora del còmput analitzat. Cada concepte indica les jornades excloses. És una lectura informativa del calendari; no modifica els teus saldos ni les dades SAP.</p>
        </>}
      </div>
    </details>
  </section>;
}
