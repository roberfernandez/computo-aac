import test from 'node:test';
import assert from 'node:assert/strict';
import {applyPrivateRules,validateMigration} from '../lib/private-corrections.js';
const migration={id:'synthetic-correction-v1',year:2032,rules:[{dates:['06-07'],when:{all:[{field:'status',op:'eq',value:'AGCG'},{field:'officialHolidayMode',op:'falsy'}]},patch:{officialHolidayMode:'E'}}]};
test('private rules preserve explicit edits and unrelated dates without mutating input',()=>{
 const plan={6:{days:[{day:7,status:'AGCG'},{day:8,status:'AGCG'}]}};
 const original=JSON.stringify(plan),result=applyPrivateRules(plan,migration);
 assert.equal(result.changed,1);assert.equal(result.plan[6].days[0].officialHolidayMode,'E');assert.equal(result.plan[6].days[0].manualEdited,true);assert.equal(result.plan[6].days[1].officialHolidayMode,undefined);assert.equal(JSON.stringify(plan),original);assert.equal(applyPrivateRules(result.plan,migration).changed,0);
 const manual={6:{days:[{day:7,status:'AGCG',officialHolidayMode:'PROPORTIONAL'}]}};assert.equal(applyPrivateRules(manual,migration).changed,0);
});
test('unrecognized instructions and prototype writes fail closed',()=>{
 assert.throws(()=>validateMigration({...migration,id:'../invalid'}));
 assert.throws(()=>validateMigration({...migration,rules:[{...migration.rules[0],patch:JSON.parse('{"__proto__":{}}')}]}));
 assert.throws(()=>validateMigration({...migration,rules:[{...migration.rules[0],when:{field:'status',op:'eval',value:'anything'}}]}));
});
