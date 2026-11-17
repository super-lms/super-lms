import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canTryScore,whatIfGrades} from './whatIfGrades.js';
const assignments=[{id:1,subcategory_id:10,course_weight_percent:30,points_possible:10},{id:2,subcategory_id:20,course_weight_percent:40,points_possible:40},{id:3,subcategory_id:30,course_weight_percent:20,points_possible:20},{id:4,subcategory_id:20,course_weight_percent:40,points_possible:40}];
const states={'1':{submission:{score:72}},'2':{submission:{score:72.7}}};
test('weighted trial grades activate an empty tier and average within a tier once',()=>{
 assert.equal(whatIfGrades(assignments,states,{}).percent,72.4);
 assert.equal(whatIfGrades(assignments,states,{'3':'16'}).percent,74.09);
 assert.equal(whatIfGrades(assignments,states,{'3':'16','4':'35'}).percent,77.38);
});
test('zero counts; blanks are excluded; invalid points expose an error',()=>{
 assert.equal(whatIfGrades(assignments,states,{'3':'0'}).percent,56.31);
 assert.equal(whatIfGrades(assignments,states,{'3':''}).percent,72.4);
 for(const value of [-1,21,'invalid',Infinity]){
  const result=whatIfGrades(assignments,states,{'3':value});assert.equal(result.percent,null);assert.ok(result.errors['3']);
 }
});
test('recorded marks, zero marks and excuses cannot be replaced by a guess',()=>{
 const original=JSON.stringify(states);
 assert.equal(whatIfGrades(assignments,states,{'1':'10'}).percent,72.4);
 assert.equal(canTryScore(assignments[0],{submission:{score:0}}),false);
 assert.equal(canTryScore(assignments[0],{submission:{score:null,rubric_selection:{excused:true}}}),false);
 assert.equal(JSON.stringify(states),original);
 assert.equal(canTryScore({id:5,points_possible:20},{}),false);
});
test('full server group totals retain hidden graded evidence in the denominator',()=>{
 const a=[{id:1,subcategory_id:20,course_weight_percent:100,points_possible:20}];
 const gradebook={current_percent:80,group_breakdown:[{subcategory_id:20,course_weight_percent:100,score_total:240,graded_count:3}]};
 assert.equal(whatIfGrades(a,{}, {'1':'20'},gradebook).percent,85);
 assert.equal(gradebook.group_breakdown[0].score_total,240);
 assert.equal(whatIfGrades(a,{}, {},{current_percent:80,group_breakdown:[{average_score:80,course_weight_percent:100}]}).incomplete,true);
});
test('a later teacher grade automatically supersedes a stale trial score',()=>{
 const updated={...states,'3':{submission:{score:90}}};
 assert.equal(whatIfGrades(assignments,updated,{'3':'0'}).count,0);
 assert.equal(whatIfGrades(assignments,updated,{'3':'0'}).percent,76.31);
});
test('explicitly missing work with a teacher-entered zero can be tried without double counting',()=>{
 const a=[{id:1,subcategory_id:10,course_weight_percent:100,points_possible:10}];
 const s={'1':{submission:{score:0,rubric_selection:{notSubmitted:true}}}};
 assert.equal(canTryScore(a[0],s['1']),true);
 assert.equal(whatIfGrades(a,s,{'1':'7'}).percent,70);
 assert.equal(s['1'].submission.score,0);
 const gradebook={current_percent:0,group_breakdown:[{subcategory_id:10,score_total:0,graded_count:1,course_weight_percent:100}]};
 assert.equal(whatIfGrades(a,s,{'1':'7'},gradebook).percent,70);
});
