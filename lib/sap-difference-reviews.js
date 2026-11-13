// La revisió accepta una valoració concreta, no un concepte per sempre.
// Si SAP o Còmput canvien les unitats/dates, torna a quedar pendent.
export function comparisonReviewKey(row){
 if(!/^\d{4}-\d{2}$/.test(row?.period||"")||!row?.id)throw Error("Comparació sense identificador estable.");
 return row.period+":"+row.id;
}
export function comparisonFingerprint(row){
 return JSON.stringify([
  row.period,row.id,row.status,row.sap,row.computed,
  (row.days||[]).map(d=>[d.date,d.sap,d.computed,d.difference]).sort((a,b)=>a[0].localeCompare(b[0]))
 ]);
}
export function isAcceptedReview(row,entry){
 return (row?.status==="diff"||row?.status==="temporal")&&!!entry&&entry.fingerprint===comparisonFingerprint(row);
}
export function pendingGroup(reason){
 if(/Periodo sin cerrar|Període obert/i.test(reason||""))return "Períodes encara oberts";
 if(/SAP sin valoraciones/i.test(reason||""))return "Sense valoracions de SAP";
 if(/Còmput no disponible|Obre i sincronitza/i.test(reason||""))return "Dades de Còmput no disponibles";
 return "Càlculs o dades pendents de validar";
}
