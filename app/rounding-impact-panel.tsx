"use client";

import {useEffect,useState} from "react";
import {dateInMadrid,roundingPeriodEnd,roundingAvailable,roundingReport,signedRoundingTime,type RoundingInput,type RoundedDay,type RoundingTotal} from "@/lib/rounding-impact";
export type {RoundingInput,RoundingDay} from "@/lib/rounding-impact";

const hours=(value:number|null,digits=2)=>value===null?"Pendent":value.toLocaleString("ca-ES",{minimumFractionDigits:digits,maximumFractionDigits:digits})+" h";
const dateLabel=(value:string)=>value.split("-").reverse().join("/");
const minutesLabel=(value:number)=>`${Math.floor(Math.round(value)/60)} h ${Math.round(value)%60} min`;
function Result({title,value}:{title:string;value:RoundingTotal}){
  return <div className="min-w-0 rounded-lg border border-white/10 bg-[#0b2029] p-3">
    <h4 className="text-xs font-semibold text-white/85">{title}</h4>
    <p className={"mt-1 text-lg font-semibold "+(value.seconds===null?"text-white/55":value.seconds<0?"text-amber-200":"text-emerald-200")}>{signedRoundingTime(value.seconds)}</p>
    <p className="text-[11px] text-white/60">{value.count} jornades analitzades{value.excluded?` · ${value.excluded} jornades especials excloses`:""}</p>
    <dl className="mt-2 space-y-1 text-xs"><div className="flex flex-wrap justify-between gap-x-2"><dt>Amb la pauta arrodonida</dt><dd>{hours(value.company)}</dd></div>
      <div className="flex flex-wrap justify-between gap-x-2"><dt>Sense arrodoniment diari</dt><dd>{hours(value.exact,5)}</dd></div></dl>
  </div>;
}
function DailyDetails({rows}:{rows:RoundedDay[]}){
  return <details className="rounded border border-white/15 p-3"><summary className="cursor-pointer text-xs font-semibold">Detall del període per dies ({rows.length})</summary>
    <div className="mt-3 max-h-80 overflow-auto"><table className="w-full text-left text-[11px]"><thead><tr><th className="pb-2">Dia / horari</th><th className="px-1 pb-2">Còmput</th><th className="pl-1 pb-2">Nocturnitat</th></tr></thead><tbody>{rows.map(row=><tr key={row.date} className="border-t border-white/10 align-top"><th className="py-2 pr-1 font-normal">{row.date.slice(8)}/{row.date.slice(5,7)}<span className="block text-white/50">{row.schedule}</span></th><td className="px-1 py-2" title={row.balanceReason}>{row.balance?signedRoundingTime(row.balance.seconds):"Fora de l’anàlisi"}</td><td className="py-2 pl-1" title={row.nightReason}>{row.night?signedRoundingTime(row.night.seconds):"Per conciliar"}</td></tr>)}</tbody></table></div>
  </details>;
}

// Public information uses only this user's calendar. The separate SAP bridge
// retains its existing administrator gate and never supplies data to this view.
export default function RoundingImpactPanel({input}:{input:RoundingInput|null}){
  return roundingAvailable(input)?<RoundingContent input={input!}/>:null;
}
function RoundingContent({input}:{input:RoundingInput}){
  const [today,setToday]=useState(dateInMadrid);
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  useEffect(()=>{
    const refresh=()=>{if(!document.hidden)setToday(dateInMadrid());};
    const clock=window.setInterval(refresh,60000);
    window.addEventListener("focus",refresh);
    document.addEventListener("visibilitychange",refresh);
    return()=>{window.clearInterval(clock);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};
  },[]);
  const report=from&&to?roundingReport(input,{from,to,asOf:today}):null;
  const annual=roundingReport(input,{from:`${input.year}-01-01`,to:`${input.year}-12-31`,asOf:today});
  const summer=input.balanceMode==="recognized-hours";
  const profileLabel=`${summer?"Estiu":"T8"} · ${input.profile.percent.toLocaleString("ca-ES")} %${input.profile.subturn?` · ${input.profile.subturn}`:""}`;
  const nightExample=annual.ready?(annual.examples.find(row=>row.night&&Math.abs(row.night.seconds)>0.001)||annual.examples.find(row=>row.night))?.night:null;
  return <section className="panel !p-0 overflow-hidden" aria-label="Arrodoniment del meu contracte">
    <details>
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 py-3"><span className="text-sm font-semibold text-[#71d7cc]">Com t&apos;afecta l&apos;arrodoniment?</span></summary>
      <div className="space-y-4 border-t border-white/15 p-3 sm:p-4">
        <p className="text-sm font-semibold">El teu cas · {profileLabel} · {input.year}</p>
        <p className="text-xs leading-relaxed text-white/75">La conversió diària a centèsimes d&apos;hora pot sumar o restar segons la jornada. <b>0,01 h són 36 segons.</b> Comparem la pauta de càlcul de Còmput amb els minuts exactes, per separat en còmput horari i nocturnitat variable. El signe + suma temps; el signe − en resta.</p>
        <details className="rounded-lg border border-white/15 p-3">
          <summary className="cursor-pointer text-sm font-semibold">1 · Com funciona l&apos;arrodoniment del teu contracte</summary>
          {annual.ready&&<div className="mt-3 space-y-3 text-xs leading-relaxed">
            {summer?<p><b>Còmput horari d&apos;estiu.</b> Còmput expressa les hores reconegudes de cada jornada a dues xifres decimals. Les comparem amb els minuts reconeguts sense arrodonir. No s&apos;hi resta la mitjana diària dels contractes T8 anuals. La previsió es limita al calendari carregat; no s&apos;inventa la durada del contracte.</p>:<>
              <p><b>Còmput horari.</b> Per al teu {input.profile.percent.toLocaleString("ca-ES")} %, la referència anual proporcional de {input.year} és {hours(annual.annualHours,4)} ÷ {annual.workdays} dies = <b>{hours(annual.meanHours,8)}/dia</b>. Comparem els saldos diaris de Còmput amb la durada reconeguda menys aquesta mitjana exacta.</p>
              {input.companyBasisHours!==undefined&&<p>En les jornades ordinàries, la pauta configurada converteix la durada a centèsimes i resta una base de <b>{hours(input.companyBasisHours)}</b>. La diferència respecte de la durada i la mitjana exactes és l&apos;efecte que mostrem. La base varia segons el contracte.</p>}
            </>}
            <p><b>Nocturnitat variable.</b> Comparem els minuts amb dret a nocturnitat amb la seva conversió diària a dues xifres decimals. Quan correspon abonar la jornada sencera, usem els minuts retribuïbles que ja calcula Còmput.{nightExample&&<> Exemple del teu horari: {minutesLabel(nightExample.exact*60)} → {hours(nightExample.company)} ({signedRoundingTime(nightExample.seconds)}).</>}</p>
            {annual.examples.length>0?<div className="overflow-x-auto"><table className="w-full text-left text-[11px]"><caption className="mb-2 text-left text-white/60">Efecte per jornada ordinària: pauta arrodonida menys valor exacte</caption>
              <thead><tr className="border-b border-white/15"><th className="py-2 pr-2">Jornada</th><th className="px-1">Còmput</th><th className="pl-1">Nocturnitat</th></tr></thead>
              <tbody>{annual.examples.map(row=><tr key={row.label} className="border-b border-white/10 align-top"><th className="py-2 pr-2 font-normal">{row.label}<span className="block text-white/50">{row.schedule}</span></th><td className="whitespace-nowrap px-1 py-2">{signedRoundingTime(row.balance?.seconds)}</td><td className="whitespace-nowrap pl-1 py-2">{signedRoundingTime(row.night?.seconds)}</td></tr>)}</tbody>
            </table></div>:<p className="text-amber-200">Completa l&apos;assignació mensual d&apos;horari al perfil per veure els exemples del contracte.</p>}
            <p className="text-[11px] text-white/55">Referència calculada amb tots els decimals i amb el contracte seleccionat. Si has canviat de contracte durant l&apos;any, consulta cada tram amb el contracte corresponent. El tancament anual pot incorporar compensacions posteriors.</p>
          </div>}
        </details>
        {annual.ready&&<section className="space-y-2 rounded-lg border border-white/15 p-3" aria-label="Acumulat fins avui">
          <h3 className="text-sm font-semibold">2 · Acumulat fins avui</h3>
          <p className="text-xs text-white/65">{today<`${input.year}-01-01`?"L’any seleccionat encara no ha començat. Les jornades es mostren a la previsió anual.":`De l’1 de gener al ${dateLabel(roundingPeriodEnd(input.year,today))}. S’actualitza automàticament cada dia, independentment del període que consultis.`}{today.startsWith(input.year+"-")&&" Inclou la jornada prevista d’avui."}</p>
          <Result title="Còmput horari acumulat" value={annual.actual.balance}/><Result title="Nocturnitat variable acumulada" value={annual.actual.night}/>
          {annual.provisionalWork>0&&<p className="text-[11px] text-white/60">Inclou {annual.provisionalWork} jornades de mesos encara no confirmats. El resultat s&apos;actualitzarà si corregeixes el calendari.</p>}
          {(annual.missingActual>0||annual.unknownActual>0)&&<p className="text-xs text-amber-200">Cobertura parcial: {annual.missingActual} dates sense calendari{summer?" o fora del període del contracte":""} i {annual.unknownActual} dies per revisar. No es compten com a zero.</p>}
        </section>}
        <section className="rounded-lg border border-white/15 p-3" aria-label="Càlcul del període escollit">
          <details>
            <summary className="cursor-pointer text-sm font-semibold">3 · Consultar un període</summary>
            <div className="mt-3 space-y-3">
              <p className="text-xs text-white/65">Tria les dues dates per calcular aquest interval.</p>
              <div className="grid grid-cols-2 gap-2"><label className="min-w-0 text-xs">Des de<input aria-label="Arrodoniment des de" type="date" min={`${input.year}-01-01`} max={`${input.year}-12-31`} value={from} onChange={event=>setFrom(event.target.value)} className="mt-1 block w-full min-w-0 rounded border border-white/25 bg-[#0b2029] px-2 py-2 text-xs"/></label>
                <label className="min-w-0 text-xs">Fins a<input aria-label="Arrodoniment fins a" type="date" min={`${input.year}-01-01`} max={`${input.year}-12-31`} value={to} onChange={event=>setTo(event.target.value)} className="mt-1 block w-full min-w-0 rounded border border-white/25 bg-[#0b2029] px-2 py-2 text-xs"/></label></div>
              {report&&(!report.ready?<p role="status" className="text-xs text-amber-200">{report.reason}</p>:<>
                <p className="text-xs font-semibold text-[#71d7cc]">Resultat del {dateLabel(from)} al {dateLabel(to)}</p>
                <p className="text-xs text-white/65">Segons les jornades del calendari dins d&apos;aquestes dates. Si inclou dates futures, es mostren com a previsió.</p>
                <Result title="Còmput horari del període" value={report.forecast.balance}/><Result title="Nocturnitat variable del període" value={report.forecast.night}/>
                {(report.missing>0||report.unknownDays>0)&&<p className="text-xs text-amber-200">Cobertura parcial: {report.missing} dates sense calendari i {report.unknownDays} dies per revisar. No es compten com a zero.</p>}
                <DailyDetails rows={report.forecastDays}/>
              </>)}
            </div>
          </details>
        </section>
        {annual.ready?<section className="space-y-2 rounded-lg border border-[#71d7cc]/25 p-3" aria-label="Previsió anual de l’arrodoniment">
          <h3 className="text-sm font-semibold text-[#71d7cc]">4 · Previsió de tot l&apos;any {input.year}</h3>
          <p className="text-xs text-white/65">De l&apos;1 de gener al 31 de desembre, independentment del període escollit. Inclou les jornades futures del calendari i es recalcula quan canvies un dia.{summer&&" En contractes d’estiu, només hi entren les jornades dels mesos carregats."}</p>
          <Result title="Efecte anual previst en el còmput" value={annual.forecast.balance}/><Result title="Efecte anual previst en la nocturnitat" value={annual.forecast.night}/>
          {(annual.missing>0||annual.unknownDays>0)&&<p className="text-xs text-amber-200">Previsió parcial: {annual.missing} dates sense calendari{summer?" o fora del període del contracte":""} i {annual.unknownDays} dies per revisar.</p>}
        </section>:<p className="text-xs text-amber-200">{annual.reason}</p>}
        <p className="text-[11px] leading-relaxed text-white/55">Les recuperacions d&apos;altres anys, prolongacions abonades a part i incidències sense una equivalència exacta queden fora del còmput analitzat. Cada concepte indica les jornades excloses. És una lectura informativa del teu calendari; no modifica els saldos ni les dades SAP.</p>
      </div>
    </details>
  </section>;
}
