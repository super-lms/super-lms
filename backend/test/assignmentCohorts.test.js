const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveAssignmentCohort, cohortGradingMiddleware } = require('../server/assignmentCohorts');
const { loadGradingRoster } = require('../server/gradingRoster');

test('cohort creation distinguishes the root cohort from the shared master workspace', async () => {
  const calls=[];
  const pool={query:async(sql,args)=>{calls.push(args);return {rows:[{id:args[0]}]};}};
  assert.equal(await resolveAssignmentCohort(pool,11,11,{cohort_id:11}),11);
  assert.equal(await resolveAssignmentCohort(pool,11,12,{cohort_id:12}),12);
  assert.equal(await resolveAssignmentCohort(pool,11,11,{cohort_id:null}),null);
  assert.deepEqual(calls,[[11,11],[12,11]]);
  assert.equal(await resolveAssignmentCohort(pool,11,12,{}),12);
  assert.equal(await resolveAssignmentCohort(pool,11,11,{}),null);
});
test('unrelated or invalid audiences are rejected', async () => {
  const pool={query:async()=>({rows:[]})};
  for(const cohort_id of [99,0,'bad',1.5,undefined,'']) {
    await assert.rejects(resolveAssignmentCohort(pool,11,11,{cohort_id}),{status:400});
  }
});
test('all-section and default grading of a cohort assignment resolve only its cohort', async () => {
  for(const selection of ['all',undefined,'12']) {
    const calls=[];
    const pool={query:async(sql,args)=>{calls.push(args);return {rows:calls.length===1?[{id:12}]:[{student_user_id:101}]};}};
    const roster=await loadGradingRoster(pool,11,selection,12);
    assert.equal(roster.sectionId,12);
    assert.deepEqual(calls,[[11,12],[[12]]]);
  }
  await assert.rejects(loadGradingRoster({},11,'13',12),{status:400});
});
test('grading rejects a student from another cohort before saving marks', async () => {
  for(const member of [true,false]) {
    let calls=0,next=false,status=200;
    const pool={query:async(sql,args)=>{calls++;if(calls===1)return {rows:[{cohort_id:12}]};assert.deepEqual(args,[12,101,'student@test']);return {rows:member?[{}]:[]};}};
    await cohortGradingMiddleware(pool)({params:{assignmentId:5},body:{student_user_id:101,student_email:'Student@Test'}},
      {status(n){status=n;return this},json(){}},()=>{next=true});
    assert.equal(next,member);assert.equal(status,member?200:403);
  }
});
