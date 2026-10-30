const test = require('node:test');
const assert = require('node:assert/strict');
const {createSubmissionDeadline} = require('../server/submissionDeadline');
const {calculateRawMark} = require('../server/rawMark');
function poolFor(assignment) {
 const calls=[];
 return {calls, async query(sql) { calls.push(sql); return {rows: sql.startsWith('SELECT id,due_date') ? [assignment] : []}; }};
}
test('teacher entered assignments reject text and attachment submissions before the late approval path', async () => {
 for (const due_date of [null,'2020-01-01']) {
  const pool=poolFor({id:1,due_date,submission_required:false});
  const deadlines=createSubmissionDeadline(pool);
  let advanced=false,status,body;
  await deadlines.holdMiddleware({user:{role:'student',id:2},params:{assignmentId:1}}, {status(n){status=n;return this},json(b){body=b}},()=>{advanced=true});
  assert.equal(status,403);assert.equal(body.code,'NO_SUBMISSION_REQUIRED');assert.equal(advanced,false);
  assert.ok(!pool.calls.some(sql=>sql.startsWith('SELECT * FROM assignment_late_permissions')));
 }
});
test('legacy assignments still accept undated student submissions', async () => {
 const pool=poolFor({id:1,due_date:null});
 assert.deepEqual(await createSubmissionDeadline(pool).check(1,2),{late:false});
});
test('teacher marks retain zero and decimal scores and reject invalid marks', () => {
 assert.deepEqual(calculateRawMark(15,20),{pointsEarned:15,pointsPossible:20,percentage:75});
 assert.equal(calculateRawMark(0,20).percentage,0);
 assert.equal(calculateRawMark('7.5',10).percentage,75);
 for(const mark of ['',null,-1,21,'no'])assert.throws(()=>calculateRawMark(mark,20));
});

// Exercise the production grade-save handler with its existing persistence interface.
const fs=require('node:fs');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const path=require('node:path');
async function saveMark(body){
 const source=fs.readFileSync(path.join(__dirname,'../server/app.js'),'utf8');
 const start=source.indexOf('app.post("/api/assignments/:assignmentId/kdu-scores"');
 const end=source.indexOf('app.get("/api/assignments/:assignmentId/student-rubric"',start);
 let handler,write;
 const pool={async query(sql,args){
  if(sql.includes('FROM assignments'))return {rows:[{id:5,title:'In class assessment',class_id:10,teacher_id:3,submission_required:false,scoring_method:'single_score_kdu',points_possible:20}]};
  if(sql.includes('FROM users'))return {rows:[{id:2,name:'Student'}]};
  if(sql.includes('SELECT id, feedback'))return {rows:[{id:40,feedback:''}]};
  if(sql.includes('UPDATE submissions')){write=args;return {rows:[{id:40,score:args[0],rubric_selection:args[3]}]};}
  throw Error('Unexpected SQL: '+sql);
 }};
 vm.runInNewContext(source.slice(start,end),{app:{post(...args){handler=args.at(-1)}},pool,authenticateJWT(){},requireRole(){},cohortGradingMiddleware(){},heldSubmissions:{gradeMiddleware(){}},require:createRequire(path.join(__dirname,'../server/app.js')),console});
 let status=200,result;
 await handler({params:{assignmentId:5},body:{student_email:'s@test',...body}}, {status(n){status=n;return this},json(b){result=b}});
 return {status,result,write};
}
test('grade save persists points, percentage, feedback and zero without any student upload',async()=>{
 for(const body of [{pointsEarned:15,directPercentage:true},{overallScore:75,directPercentage:true}]){
  const saved=await saveMark({...body,feedback:'Observed in class'});
  assert.equal(saved.status,200);assert.equal(saved.result.percent_score,75);
  assert.equal(saved.write[0],75);assert.equal(saved.write[2],'Observed in class');assert.equal(saved.write[3].DO,4.5);
 }
 const zero=await saveMark({pointsEarned:0,directPercentage:true});assert.equal(zero.write[0],0);
 const invalid=await saveMark({pointsEarned:21,directPercentage:true});assert.equal(invalid.status,400);assert.equal(invalid.write,undefined);
});
