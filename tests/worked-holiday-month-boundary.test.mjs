import test from "node:test";
import assert from "node:assert/strict";
import {calculateEntitlement} from "../lib/payroll-entitlements.js";

function month(year,month){
  const period=year+"-"+String(month).padStart(2,"0"),count=new Date(Date.UTC(year,month,0)).getUTCDate();
  return {period,profile:{percent:85.81},days:Array.from({length:count},(_,i)=>({
    date:period+"-"+String(i+1).padStart(2,"0"),schedule:"—",
    activity:{working:false,ordinary:false,weeklyRest:false,scheduleResolved:true,status:"DCOM"}
  }))};
}
function serve(months,date,shift){
  const d=months[Number(date.slice(5,7))].days.find(x=>x.date===date);
  d.schedule=shift;d.activity={...d.activity,working:true,ordinary:true,status:"AGCG"};
}
function result(months,m){
  const facts=months[m];
  return calculateEntitlement("worked-holiday-e",{facts,profile:facts.profile,period:facts.period,history:Object.values(months)});
}
test("worked Sunday premium belongs to Saturday shift at month boundaries",()=>{
  const months=Object.fromEntries([1,2,3,4].map(m=>[m,month(2026,m)]));
  for(const saturday of ["2026-01-17","2026-01-31","2026-02-14","2026-02-28","2026-03-14","2026-03-28"]){
    serve(months,saturday,"20:30–05:00");
    const sunday=new Date(Date.parse(saturday+"T00:00:00Z")+86400000).toISOString().slice(0,10);
    serve(months,sunday,"18:46–00:50");
  }
  assert.deepEqual(result(months,1).dates,["2026-01-17","2026-01-31"]);
  assert.deepEqual(result(months,2).dates,["2026-02-14","2026-02-28"]);
  assert.deepEqual(result(months,3).dates,["2026-03-14","2026-03-28"]);
  assert.equal([1,2,3].reduce((sum,m)=>sum+result(months,m).labour.value,0),6);
});
test("Sunday-only service still belongs to Sunday",()=>{
  const months={2:month(2026,2)};
  serve(months,"2026-02-08","18:46–00:50");
  const r=result(months,2);
  assert.equal(r.labour.value,1);assert.deepEqual(r.dates,["2026-02-08"]);
});
test("missing next month's Sunday is pending, not silently dropped",()=>{
  const months={1:month(2026,1)};
  serve(months,"2026-01-31","20:30–05:00");
  const r=result(months,1);
  assert.equal(r.state,"pending");
});
