/**
 * Comparador experimental SAP ↔ Còmput.
 * No interpreta diferencias como errores empresariales ni altera reglas de cálculo.
 * Archivo exclusivamente local: no hay llamadas de red en este módulo.
 */
const LABELS = Object.freeze([
  {id:"horaNonaHours", sap:["Prima Hora Nona"], title:"Prima Hora Nona", unit:"h", metric:"horaNonaHours"},
  {id:"plusConveniDays", sap:["Plus Convenio"], title:"Plus Convenio", unit:"días", metric:"plusConveniDays"},
  {id:"nightPayableHours", sap:["Nocturnidad Variable"], title:"Nocturnidad variable", unit:"h", metric:"nightPayableHours"},
  {id:"ordinaryHours", sap:["Horas Ordinarias Diurnas","Horas Ordinarias Nocturna"], title:"Horas ordinarias (diurnas + nocturnas)", unit:"h", metric:"ordinaryHours"},
  {id:"plusFestiuDays", sap:["P.Festivo Trabajado E"], title:"Festivo trabajado, variante E", unit:"unid.", metric:"plusFestiuDays", note:"La imputación por día puede desplazarse por servicios nocturnos; verificar antes de atribuir un error."},
  {id:"dcom", sap:["DCOMs"], title:"Descansos DCOM", unit:"días"},
  {id:"fest", sap:["Festivos"], title:"Descansos FEST", unit:"días"}
]);
const DIRECT = new Set(LABELS.flatMap(x=>x.sap));
const ERROR = message=>{throw new Error(message);};
const obj=x=>x!==null && typeof x==="object" && !Array.isArray(x);
const numeric=x=>{
  if(typeof x!=="string" && typeof x!=="number")return null;
  const n=Number(String(x).trim().replace(",","."));
  return Number.isFinite(n)?n:null;
};
const round=x=>Math.round((x+Number.EPSILON)*100)/100;
const isLeap=y=>y%4===0&&(y%100!==0||y%400===0);
const isoMonth=(year,m)=>String(year)+String(m).padStart(2,"0");
export function sapDate(raw) {
  if(typeof raw!=="string")return null;
  const match=/^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(raw);
  if(match){ const ms=Number(match[1]); if(!Number.isFinite(ms))return null; return new Date(ms).toISOString().slice(0,10); }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:null;
}
export function validateSapExport(doc) {
  if(!obj(doc)||doc.origen!=="Consultes Bàsiques TMB - SAP")ERROR("No es una exportación reconocida de Consultes Bàsiques.");
  const year=doc.ano;
  if(!Number.isInteger(year)||year<2020||year>2100)ERROR("El año SAP no es válido.");
  if(!obj(doc.anuales)||!obj(doc.valoraciones)||!["actividades","calendario","contingentes","leyenda"].every(k=>Array.isArray(doc.anuales[k])))
    ERROR("Faltan secciones obligatorias de SAP.");
  const date=Date.parse(doc.extraido);
  if(!Number.isFinite(date)||date>Date.now()+300000)ERROR("La fecha de extracción no es válida.");
  const days=new Set();
  for(const row of doc.anuales.calendario){
    if(!obj(row)||!sapDate(row.Date)?.startsWith(String(year)))ERROR("El calendario incluye fechas inválidas o de otro año.");
    days.add(sapDate(row.Date));
  }
  if(days.size!==(isLeap(year)?366:365))ERROR("El calendario anual no está completo; conservaremos la extracción anterior.");
  const normalized={};
  for(let month=1;month<=12;month++){
    const key=isoMonth(year,month), short=String(year)+"-"+String(month).padStart(2,"0");
    const data=doc.valoraciones[key]??doc.valoraciones[short];
    if(!Array.isArray(data))ERROR("Faltan las valoraciones de "+short+".");
    for(const row of data) {
      if(!obj(row)||typeof row.LongText!=="string"||numeric(row.Number)===null||!sapDate(row.Date)?.startsWith(String(year)))
        ERROR("Hay valoraciones inválidas en "+short+".");
    }
    normalized[short]=data;
  }
  return {...doc,valoraciones:normalized};
}
export function compareSapToComputo(doc, facts){
  const year=doc.ano;
  if(!obj(facts)||Number(facts.year)!==year||!obj(facts.months))return {ready:false,reason:"No hay hechos de Còmput sincronizados para "+year+".",rows:[],unmapped:[]};
  const rows=[],unmapped=[], summary={match:0,diff:0,pending:0};
  const extracted=new Date(doc.extraido);
  const exportMonth=extracted.getUTCFullYear()*100+(extracted.getUTCMonth()+1);
  const allCategories=new Set();
  for(let month=1;month<=12;month++){
    const period=String(year)+"-"+String(month).padStart(2,"0");
    const sapRows=doc.valoraciones[period]||[];
    for(const r of sapRows)allCategories.add(r.LongText);
    const monthFacts=facts.months[String(month)]||facts.months[period]||facts.months[isoMonth(year,month)];
    const ownDays=Array.isArray(monthFacts?.days)?monthFacts.days:null;
    const expectedDays=new Date(year,month,0).getDate();
    const closed=year*100+month<exportMonth;
    for(const cfg of LABELS){
      // Sólo comparar los meses cerrados, con registros reales de SAP
      // y calendario completo de Còmput. Mes en curso: "pendiente".
      const official=sapRows.filter(r=>cfg.sap.includes(r.LongText));
      const sapTotal=round(official.reduce((a,r)=>a+numeric(r.Number),0));
      const dayMap=new Map();
      for(const r of official){
        const date=sapDate(r.Date);
        dayMap.set(date,round((dayMap.get(date)||0)+numeric(r.Number)));
      }
      let ownTotal=null,ownMap=new Map(),possible=true;
      if(ownDays && ownDays.length===expectedDays) {
        for(const d of ownDays){
          if(!obj(d)||typeof d.date!=="string"||!d.date.startsWith(period)) {possible=false;break;}
          let value=null;
          if(cfg.metric){
            const metric=d.metrics?.[cfg.metric];
            if(metric?.state==="known"&&numeric(metric.value)!==null)value=numeric(metric.value);
            else {possible=false;break;}
          }else if(cfg.id==="dcom")value=d.activity?.status==="DCOM"?1:0;
          else if(cfg.id==="fest")value=d.activity?.weeklyRest===true?1:0;
          else {possible=false;break;}
          ownMap.set(d.date,round(value));
        }
        if(possible)ownTotal=round([...ownMap.values()].reduce((a,b)=>a+b,0));
      }
      const status=!closed||sapRows.length===0||!possible||ownTotal===null?"pending":Math.abs(sapTotal-ownTotal)<=0.011?"match":"diff";
      summary[status]++;
      const days=[];
      if(status==="diff"){
        for(const date of new Set([...dayMap.keys(),...ownMap.keys()])){
          const sap=dayMap.get(date)||0,computed=ownMap.get(date)||0;
          if(Math.abs(sap-computed)>0.011)days.push({date,sap:round(sap),computed:round(computed),difference:round(computed-sap)});
        }
        days.sort((a,b)=>a.date.localeCompare(b.date));
      }
      rows.push({period,concept:cfg.title,unit:cfg.unit,sap:sapTotal,computed:ownTotal,difference:ownTotal===null?null:round(ownTotal-sapTotal),status,days,note:cfg.note||"",reason:status!=="pending"?"":!closed?"Periodo sin cerrar":sapRows.length===0?"SAP sin valoraciones":!ownDays?"Còmput no disponible":"Hay cálculos pendientes o datos incompletos"});
    }
  }
  for(const category of [...allCategories].filter(c=>!DIRECT.has(c)).sort()) {
    const perMonth=Object.entries(doc.valoraciones).map(([period,entries])=>({period,value:round(entries.filter(r=>r.LongText===category).reduce((a,r)=>a+numeric(r.Number),0))})).filter(x=>x.value!==0);
    unmapped.push({category,perMonth});
  }
  return {ready:true,rows,unmapped,summary};
}
export function sapChangeCount(before,after){
  if(!before)return 0;
  const rows=x=>Object.values(x.valoraciones||{}).flat().map(r=>[sapDate(r.Date),r.Wagetype,r.LongText,r.Number].join("|")).sort();
  const a=rows(before),b=rows(after);
  let i=0,j=0,count=0;
  while(i<a.length||j<b.length){
    if(i===a.length){count+=b.length-j;break;}
    if(j===b.length){count+=a.length-i;break;}
    if(a[i]===b[j]){i++;j++;continue;}
    if(a[i]<b[j]){count++;i++;}else{count++;j++;}
  }
  return count;
}
