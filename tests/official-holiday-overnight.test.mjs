import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateEntitlement} from '../lib/payroll-entitlements.js';
const idle={version:1,status:'FEST',working:false,ordinary:false,weeklyRest:true,scheduleResolved:true,vacation:false};
function october(){return {schema:'computo-economic-facts-v1',producer:'computo-aac',version:'1',period:'2026-10',profile:{percent:85.81},days:Array.from({length:31},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,schedule:'—',activity:{...idle},metrics:{}}))};}
test('overnight service from 11 to 12 October is credited to 11 even if holiday is a rest day',()=>{
 const f=october();
 f.days[10].schedule='18:46–02:50';f.days[10].activity={...idle,status:'AGCG',working:true,ordinary:true,weeklyRest:false};
 const r=calculateEntitlement('official-holiday',{facts:f,profile:f.profile,period:f.period});
 assert.equal(r.expected,77.23);assert.equal(r.labour.value,1);assert.deepEqual(r.dates,['2026-10-11']);
 f.days[10].schedule='18:46–01:59';
 assert.equal(calculateEntitlement('official-holiday',{facts:f,profile:f.profile,period:f.period}).expected,0);
});
