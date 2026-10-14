const test=require('node:test');
const assert=require('node:assert/strict');
const {calculateTeacherRubric}=require('../server/teacherRubricScoring');
const rubric={level_count:6,criteria_json:[5,5,5,10,15,15,15,20,10].map((weight,i)=>({id:`c${i}`,name:`Criterion ${i+1}`,weight}))};
const selected=Object.fromEntries([4,4,5,5,5,6,5,3,3].map((level,i)=>[`c${i}`,level]));
test('copied unmapped rubric produces the weighted overall grade and no invented KDU breakdown',()=>{
 const result=calculateTeacherRubric(rubric,selected);
 assert.equal(result.complete,true);assert.equal(result.percent,74.17);assert.equal(result.mappingComplete,false);assert.equal(result.unmappedWeight,100);
 for(const bucket of Object.values(result.buckets)){assert.equal(bucket.level,null);assert.equal(bucket.percent,null);}
});
test('partial selections show a running percentage but cannot represent a complete saved grade',()=>{
 const result=calculateTeacherRubric(rubric,{c0:4});
 assert.equal(result.complete,false);assert.equal(result.partialPercent,3.33);assert.equal(result.percent,null);assert.equal(result.selectedCount,1);assert.equal(result.criterionCount,9);
});
test('partial mappings do not inflate KDU evidence, and complete mappings retain weighted evidence scores',()=>{
 const partial={...rubric,criteria_json:rubric.criteria_json.map((c,i)=>({...c,competency_bucket:i===0?'DO':''}))};
 assert.equal(calculateTeacherRubric(partial,selected).buckets.DO.level,null);
 const mapped={...rubric,criteria_json:rubric.criteria_json.map(c=>({...c,competency_bucket:' do '}))};
 const result=calculateTeacherRubric(mapped,selected);assert.equal(result.percent,74.17);assert.equal(result.mappingComplete,true);assert.equal(result.buckets.DO.weight,100);assert.ok(Math.abs(result.buckets.DO.level-4.45)<0.00001);assert.equal(result.buckets.KNOW.level,null);
});
test('invalid criterion IDs, weights, mappings and performance levels still fail safely',()=>{
 for(const edit of [{id:''},{id:'c1'},{weight:0},{weight:-1},{weight:6},{competency_bucket:'OTHER'}]){
  const bad={...rubric,criteria_json:rubric.criteria_json.map((c,i)=>i===0?{...c,...edit}:c)};assert.throws(()=>calculateTeacherRubric(bad,selected));
 }
 for(const level of [0,7,2.5,'bad'])assert.throws(()=>calculateTeacherRubric(rubric,{...selected,c0:level}));
 assert.throws(()=>calculateTeacherRubric(rubric,{...selected,foreign:4}),/changed/);
});
test('teacher preview and server calculation stay consistent for four, five and six level rubrics',async()=>{
 const {calculateTeacherRubric:preview}=await import('../../frontend/src/services/teacherRubricScoring.js');
 for(const levels of [4,5,6])for(const mapped of [false,true]){
  const input={level_count:levels,criteria_json:[{id:'a',weight:40,competency_bucket:mapped?'DO':''},{id:'b',weight:60,competency_bucket:mapped?'UNDERSTAND':''}]};
  for(const choices of [{},{a:levels},{a:levels,b:1}])assert.deepEqual(preview(input,choices),calculateTeacherRubric(input,choices));
 }
});
test('descending numbered level labels use the printed score, and criterion contributions sum before rounding',async()=>{
 const {calculateTeacherRubric:preview}=await import('../../frontend/src/services/teacherRubricScoring.js');
 const input={level_count:6,criteria_json:[{id:'a',weight:5,level_labels:['6 – Extending','5 – Proficient','4 – Competent','3 – Minimum','2 – Developing','1 – Emerging']},{id:'b',weight:95}]};
 const result=calculateTeacherRubric(input,{a:3,b:6});
 assert.equal(result.criterionResults[0].level,4);
 assert.ok(Math.abs(result.criterionResults[0].contribution-3.3333333333)<0.00001);
 assert.equal(result.percent,98.33);
 assert.deepEqual(preview(input,{a:3,b:6}),result);
 assert.equal(calculateTeacherRubric(input,{a:1,b:6}).percent,100);
});
