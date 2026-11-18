"use client";

import {useEffect,useState} from "react";
import {dateInMadrid,roundingPeriodEnd,roundingPilotAvailable,roundingReport,signedRoundingTime,type RoundingInput} from "@/lib/rounding-impact";
export type {RoundingInput,RoundingDay} from "@/lib/rounding-impact";

type Total={count:number;excluded:number;exact:number|null;company:number|null;seconds:number|null};
const hours=(value:number|null,digits=2)=>value===null?"Pendent":value.toLocaleString("ca-ES",{minimumFractionDigits:digits,maximumFractionDigits:digits})+" h";
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
export default function RoundingImpactPanel({input}:{input:RoundingInput|null}){
  const [today,setToday]=useState(dateInMadrid);
  const [from,setFrom]=useState(()=>`${input?.year||2026}-01-01`);
  const [customEnd,setCustomEnd]=useState<string|null>(null);
  useEffect(()=>{
    const refresh=()=>{if(!document.hidden)setToday(dateInMadrid());};
    const clock=window.setInterval(refresh,60000);
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",refresh);
    return()=>{window.clearInterval(clock);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};
  },[]);
  if(!roundingPilotAvailable(input))return null;
  const to=customEnd??roundingPeriodEnd(input!.year,today);
  const report=roundingReport(input,{from,to,asOf:today});
  const annual=roundingReport(input,{from:`${input!.year}-01-01`,to:`${input!.year}-12-31`,asOf:today});
  return <section className="panel !p-0 overflow-hidden" aria-label="Arrodoniment del meu contracte">
    <details>
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-3">
        <span className="text-sm font-semibold text-[#71d7cc]">Com t&apos;afecta l&apos;arrodoniment?</span>
        <span className="shrink-0 rounded border border-[#71d7cc]/30 px-1.5 py-0.5 text-[10px] text-[#71d7cc]">Només administrador</span>
      </summary>
      <div className="space-y-4 border-t border-white/15 p-3 sm:p-4">
        <p className="text-sm font-semibold">El teu cas · T8 · 85,81 % · {input!.year}</p>
        <p className="text-xs leading-relaxed text-white/75">La conversió diària a centèsimes d&apos;hora pot sumar o restar segons la jornada. <b>0,01 h són 36 segons.</b> Comparem el càlcul amb la pauta de l&apos;empresa que ja aplica Còmput amb el càlcul exacte, per separat en còmput horari i nocturnitat variable. El signe + suma temps; el signe − en resta.</p>
        <details className="rounded-lg border border-white/15 p-3" open>
          <summary className="cursor-pointer text-sm font-semibold">1 · Què fa l&apos;empresa i com t&apos;afecta en teoria</summary>
          {annual.ready&&<div className="mt-3 space-y-3 text-xs leading-relaxed">
            <p><b>Còmput horari.</b> La pauta observada del 85,81 % registra −0,64 h per jornada normal, +1,36 h per divendres/vigília i +1,79 h per dissabte ordinari. La referència exacta proporcional de {input!.year} és {hours(annual.annualHours,4)} ÷ {annual.workdays} dies = <b>{hours(annual.meanHours,8)}/dia</b>. Comparem aquests saldos amb la durada reconeguda menys aquesta mitjana.</p>
            <p>En aquestes jornades, la pauta equival a convertir la durada a centèsimes i restar una base de <b>6,71 h</b>. Exemple: 6 h 04 min → 6,07 h; 6,07 − 6,71 = −0,64 h. La diferència respecte de la durada i la mitjana exactes és l&apos;efecte que mostrem.</p>
            <p><b>Nocturnitat variable.</b> Comparem els minuts amb dret a nocturnitat amb la seva conversió diària a dues xifres decimals. Per exemple, 2 h 50 min es registren com 2,83 h: són 12 segons menys. Quan correspon abonar la jornada sencera, usem els minuts retribuïbles que ja calcula Còmput.</p>
            <div className="overflow-x-auto"><table className="w-full text-left text-[11px]"><caption className="mb-2 text-left text-white/60">Efecte per jornada ordinària: pauta arrodonida menys valor exacte</caption>
              <thead><tr className="border-b border-white/15"><th className="py-2 pr-2">Jornada</th><th className="px-1">Còmput</th><th className="pl-1">Nocturnitat</th></tr></thead>
              <tbody>{annual.examples.map(row=><tr key={row.label} className="border-b border-white/10 align-top"><th className="py-2 pr-2 font-normal">{row.label}<span className="block text-white/50">{row.schedule}</span></th><td className="whitespace-nowrap px-1 py-2">{signedRoundingTime(row.balance?.seconds)}</td><td className="whitespace-nowrap pl-1 py-2">{signedRoundingTime(row.night?.seconds)}</td></tr>)}</tbody>
            </table></div>
            <p className="text-[11px] text-white/55">Referència proporcional calculada amb tots els decimals. La jornada anual que mostra Còmput continua expressada a dues xifres. La comprovació del tancament anual pot incorporar compensacions posteriors.</p>
          </div>}
        </details>

        <section className="space-y-3 rounded-lg border border-white/15 p-3" aria-label="Càlcul del període escollit">
          <h3 className="text-sm font-semibold">2 · El teu període</h3>
          <div className="grid grid-cols-2 gap-2"><label className="min-w-0 text-xs">Des de<input aria-label="Arrodoniment des de" type="date" min={`${input!.year}-01-01`} max={`${input!.year}-12-31`} value={from} onChange={event=>setFrom(event.target.value)} className="mt-1 block w-full min-w-0 rounded border border-white/25 bg-[#0b2029] px-2 py-2 text-xs"/></label>
          <label className="min-w-0 text-xs">Fins a<input aria-label="Arrodoniment fins a" type="date" min={`${input!.year}-01-01`} max={`${input!.year}-12-31`} value={to} onChange={event=>setCustomEnd(event.target.value)} className="mt-1 block w-full min-w-0 rounded border border-white/25 bg-[#0b2029] px-2 py-2 text-xs"/></label></div>
          <button type="button" aria-pressed={customEnd===null} onClick={()=>setCustomEnd(null)} className="rounded border border-[#71d7cc]/40 px-3 py-2 text-xs text-[#71d7cc]">Fins avui · automàtic</button>
          <p className="text-[11px] text-white/60">{customEnd===null?"La data final d’aquest període avança automàticament cada dia.":"Període personalitzat. Prem «Fins avui» per recuperar l’actualització diària."}</p>
          {!report.ready?<p role="status" className="text-xs text-amber-200">{report.reason}</p>:<>
            <p className="text-xs font-semibold text-[#71d7cc]">Resultat del {from.split("-").reverse().join("/")} al {to.split("-").reverse().join("/")}</p>
            <p className="text-xs text-white/65">Segons les jornades del calendari dins d’aquestes dates. Si el període inclou dates futures, es mostren com a previsió.</p>
            <Result title="Còmput horari del període" value={report.forecast.balance}/><Result title="Nocturnitat variable del període" value={report.forecast.night}/>
            {(report.missing>0||report.unknownDays>0)&&<p className="text-xs text-amber-200">Cobertura parcial: {report.missing} dates sense calendari i {report.unknownDays} dies per revisar. Els dies sense dades no es compten com a zero.</p>}
          <details className="rounded border border-white/15 p-3"><summary className="cursor-pointer text-xs font-semibold">Detall del període per dies ({report.forecastDays.length})</summary>
            <div className="mt-3 max-h-80 overflow-auto"><table className="w-full text-left text-[11px]"><thead><tr><th className="pb-2">Dia / horari</th><th className="px-1 pb-2">Còmput</th><th className="pl-1 pb-2">Nocturnitat</th></tr></thead><tbody>{report.forecastDays.map((row:{date:string;schedule:string;balance:{seconds:number}|null;night:{seconds:number}|null;balanceReason:string;nightReason:string})=><tr key={row.date} className="border-t border-white/10 align-top"><th className="py-2 pr-1 font-normal">{row.date.slice(8)}/{row.date.slice(5,7)}<span className="block text-white/50">{row.schedule}</span></th><td className="px-1 py-2" title={row.balanceReason}>{row.balance?signedRoundingTime(row.balance.seconds):"Fora de l’anàlisi"}</td><td className="py-2 pl-1" title={row.nightReason}>{row.night?signedRoundingTime(row.night.seconds):"Per conciliar"}</td></tr>)}</tbody></table></div>
          </details>
          </>}
        </section>
        {annual.ready&&<>
          <section className="space-y-2 rounded-lg border border-white/15 p-3" aria-label="Acumulat fins avui">
            <h3 className="text-sm font-semibold">3 · Acumulat fins avui</h3>
            <p className="text-xs text-white/65">De l’1 de gener fins avui ({roundingPeriodEnd(input!.year,today).split("-").reverse().join("/")}), independentment del període escollit al punt 2. Inclou la jornada prevista d&apos;avui i s&apos;actualitza automàticament cada dia.</p>
            <Result title="Còmput horari acumulat" value={annual.actual.balance}/><Result title="Nocturnitat variable acumulada" value={annual.actual.night}/>
            {annual.provisionalWork>0&&<p className="text-[11px] text-white/60">Inclou {annual.provisionalWork} jornades de mesos encara no confirmats. El resultat s&apos;actualitzarà si corregeixes el calendari.</p>}
            {(annual.missingActual>0||annual.unknownActual>0)&&<p className="text-xs text-amber-200">Cobertura parcial: {annual.missingActual} dates sense calendari i {annual.unknownActual} dies per revisar. Els dies sense dades no es compten com a zero.</p>}
          </section>
          <section className="space-y-2 rounded-lg border border-[#71d7cc]/25 p-3" aria-label="Previsió anual de l’arrodoniment">
            <h3 className="text-sm font-semibold text-[#71d7cc]">4 · Previsió de tot l&apos;any {input!.year}</h3>
            <p className="text-xs text-white/65">De l&apos;1 de gener al 31 de desembre, independentment del període escollit. Inclou totes les jornades del calendari, encara que no hagin arribat. Es recalcula quan canvies un dia.</p>
            <Result title="Efecte anual previst en el còmput" value={annual.forecast.balance}/><Result title="Efecte anual previst en la nocturnitat" value={annual.forecast.night}/>
            {(annual.missing>0||annual.unknownDays>0)&&<p className="text-xs text-amber-200">Previsió parcial: {annual.missing} dates sense calendari i {annual.unknownDays} dies per revisar.</p>}
          </section>
        </>}
        <p className="text-[11px] leading-relaxed text-white/55">Les recuperacions d&apos;altres anys, prolongacions abonades a part i incidències sense una equivalència exacta queden fora del còmput analitzat. Cada concepte indica les jornades excloses. És una lectura informativa del calendari; no modifica els teus saldos ni les dades SAP.</p>
      </div>
    </details>
  </section>;
}
