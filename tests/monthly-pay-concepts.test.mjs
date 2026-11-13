import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {calculateEntitlement} from "../lib/payroll-entitlements.js";

function month(year,month){
  const period=year+"-"+String(month).padStart(2,"0");
  return {period,profile:{percent:85.81},days:Array.from({length:new Date(Date.UTC(year,month,0)).getUTCDate()},(_,i)=>({
    date:period+"-"+String(i+1).padStart(2,"0"),
    schedule:"—",
    activity:{working:false,ordinary:false,weeklyRest:false,scheduleResolved:true,officialHolidayMode:null,status:"DCOM"}
  }))};
}

test("all twelve completed months without a confirmed E are zero, not pending",()=>{
  for(let m=1;m<=12;m++){
    const facts=month(2026,m);
    const result=calculateEntitlement("official-holiday-e",{facts,profile:facts.profile,period:facts.period,history:[facts]});
    assert.equal(result.state,"component",facts.period);
    assert.equal(result.expected,0,facts.period);
    assert.equal(result.labour.value,0,facts.period);
    assert.equal(result.labour.state,"complete",facts.period);
  }
});

test("confirmed Festivo Oficial E in September is still counted and shown",()=>{
  const facts=month(2026,9),day=facts.days[10];
  day.schedule="08:00–14:00";
  day.activity={...day.activity,working:true,ordinary:true,officialHolidayMode:"E",status:"AGCG"};
  const result=calculateEntitlement("official-holiday-e",{facts,profile:facts.profile,period:facts.period,history:[facts]});
  assert.equal(result.state,"component");
  assert.equal(result.labour.value,1);
  assert.equal(result.expected,90);
  assert.deepEqual(result.dates,["2026-09-11"]);
});

test("months with incomplete or unresolved calendar remain pending, not false zero",()=>{
  const incomplete=month(2026,8);incomplete.days.pop();
  const a=calculateEntitlement("official-holiday-e",{facts:incomplete,profile:incomplete.profile,period:incomplete.period,history:[incomplete]});
  assert.equal(a.state,"pending");
  assert.equal(a.labour,null);
  const unknown=month(2026,8);unknown.days[0].activity.working=null;
  const b=calculateEntitlement("official-holiday-e",{facts:unknown,profile:unknown.profile,period:unknown.period,history:[unknown]});
  assert.equal(b.state,"pending");
});

test("monthly pay tiles render after the calendar and omit zero or unknown concepts",()=>{
  const page=readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
  const monthStart=page.indexOf("function MonthView(");
  assert.ok(monthStart>0);
  const calendar=page.indexOf('        <TabsContent value="calendar">',monthStart);
  const grid=page.indexOf('          <div className="calendar-grid">',calendar);
  const cards=page.indexOf('          <section className="mt-5 border-t border-white/10 pt-4" aria-label="Resum retributiu del mes">',grid);
  const selection=page.indexOf('          {multiSelectActive && (',grid);
  assert.ok(calendar>monthStart && grid>calendar && cards>grid && selection>cards);
  assert.ok(!page.slice(monthStart,calendar).includes('className="month-kpis"'));
  assert.match(page,/payrollConcepts\.filter\(item => item\.value !== null && Number\.isFinite\(item\.value\) && item\.value !== 0\)/);
  assert.match(page,/showMonthlyConcept\(monthOrdinaryHours\) && <div className="month-kpi"/);
  assert.match(page,/showMonthlyConcept\(monthPlusConvenio\) && <div className="month-kpi payroll"/);
  assert.match(page,/className="month-kpis month-kpis-below"/);
  assert.match(page,/Unidades estimadas según condiciones/);
});
