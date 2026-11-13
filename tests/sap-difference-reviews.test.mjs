import test from "node:test";
import assert from "node:assert/strict";
import {comparisonReviewKey,comparisonFingerprint,isAcceptedReview,pendingGroup} from "../lib/sap-difference-reviews.js";
const row={period:"2026-07",id:"nightPayableHours",status:"diff",sap:96.56,computed:95.56,days:[{date:"2026-07-20",sap:3.83,computed:2.83,difference:-1}]};
test("accepted comparison only applies to exactly the checked values",()=>{
 const fp=comparisonFingerprint(row),accepted={fingerprint:fp,note:"Revisat",reviewedAt:"2026-11-13T18:00:00Z"};
 assert.equal(comparisonReviewKey(row),"2026-07:nightPayableHours");
 assert.equal(isAcceptedReview(row,accepted),true);
 assert.equal(isAcceptedReview({...row,sap:96.57},accepted),false);
 assert.equal(isAcceptedReview({...row,days:[{...row.days[0],sap:3.84}]},accepted),false);
 assert.equal(isAcceptedReview({...row,status:"match"},accepted),false);
});
test("pending reasons remain distinct",()=>{
 assert.equal(pendingGroup("Periodo sin cerrar"),"Períodes encara oberts");
 assert.equal(pendingGroup("SAP sin valoraciones"),"Sense valoracions de SAP");
 assert.equal(pendingGroup("Hay cálculos pendientes o datos incompletos"),"Càlculs o dades pendents de validar");
});
