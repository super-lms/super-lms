const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const {courseMark}=require('./reportCards');
const {gradebookSubmissionIndex,latestSubmissionByAssignment}=require('./gradebookSubmissions');

async function save(body, existing=true) {
 const calls=[];
 const pool={query:async(sql,params)=>{
  calls.push({sql,params});
  if(sql.includes('FROM assignments'))return {rows:[{id:3,title:'Volleyball week two',class_id:2,teacher_id:1,points_possible:20,scoring_method:'single_score_kdu'}]};
  if(sql.includes('FROM users'))return {rows:[{id:7,name:'Student'}]};
  if(sql.includes('SELECT id, feedback'))return {rows:existing?[{id:9,feedback:'Existing feedback'}]:[]};
  return {rows:[{id:9}]};
 }};
 const source=fs.readFileSync(__dirname+'/app.js','utf8');
 const block=source.slice(source.indexOf('/* SAVE KDU SCORES */'),source.indexOf('app.get("/api/assignments/:assignmentId/student-rubric"'));
 let handler;
 vm.runInNewContext(block,{app:{post:(_path,...args)=>handler=args.at(-1)},pool,console,authenticateJWT(){},requireRole:()=>()=>{},cohortGradingMiddleware:()=>()=>{},heldSubmissions:{gradeMiddleware(){}},require:createRequire(__filename)});
 let status=200,result;
 await handler({params:{assignmentId:'3'},body:{student_email:'student@example.com',...body}},{status(n){status=n;return this},json(value){result=value;return this}});
 return {status,result,calls};
}

test('EX persists with no numeric mark for existing and new student assessments',async()=>{
 for(const existing of [true,false]){
  const {status,result,calls}=await save({excused:true,directPercentage:true},existing);
  assert.equal(status,200);assert.equal(result.percent_score,null);assert.equal(result.rubric_selection.excused,true);
  const write=calls.find(c=>/UPDATE submissions|INSERT INTO submissions/.test(c.sql));
  assert.ok(write);assert.ok(write.params.includes('EX'));assert.equal(write.params[existing?0:11],null);
  if(existing)assert.equal(write.params[2],'Existing feedback');
 }
});
test('a regular score replaces EX and invalid numeric marks still fail',async()=>{
 const {result,status}=await save({pointsEarned:15,directPercentage:true});
 assert.equal(status,200);assert.equal(result.percent_score,75);assert.equal(result.rubric_selection.excused,undefined);
 assert.equal((await save({pointsEarned:'invalid',directPercentage:true})).status,400);
});
test('EX survives older marks and later blank duplicates; a later numeric mark replaces it',()=>{
 const rows=[{id:1,student_id:7,assignment_id:3,score:0},{id:2,student_id:7,assignment_id:3,score:null,rubric_selection:{excused:true}},{id:3,student_id:7,assignment_id:3,score:null}];
 assert.equal(gradebookSubmissionIndex(rows).get({student_user_id:7},3).id,2);
 assert.equal(latestSubmissionByAssignment(rows)['3'].id,2);
 rows.push({id:4,student_id:7,assignment_id:3,score:80});
 assert.equal(gradebookSubmissionIndex(rows).get({student_user_id:7},3).score,80);
});
test('excused work contributes neither score nor weight, including a completely excused category',()=>{
 const assignments=[{id:1,subcategory_id:1,course_weight_percent:50,reporting_date:'2026-11-05'},{id:2,subcategory_id:1,course_weight_percent:50,reporting_date:'2026-11-05'},{id:3,subcategory_id:2,course_weight_percent:50,reporting_date:'2026-11-05'}];
 const student={student_user_id:7,student_email:'student@example.com'};
 const submissions=[{assignment_id:1,student_id:7,score:80},{assignment_id:2,student_id:7,score:null,grade:'EX'},{assignment_id:3,student_id:7,score:null,grade:'EX'}];
 const config={start:'2026-01-01',end:'2026-12-31',gradeBasis:'cumulative'};
 assert.equal(courseMark(assignments,submissions,student,config).calculated_mark,80);
 submissions[0].score=null;
 assert.equal(courseMark(assignments,submissions,student,config).calculated_mark,null);
});

test('live gradebook calculation excludes EX from group averages and graded weight',async()=>{
 const source=fs.readFileSync(__dirname+'/app.js','utf8');
 const start=source.indexOf('/* GET KDU ASSESSMENT GROUP GRADEBOOK */');
 const block=source.slice(start,source.indexOf('/* GET GRADEBOOK - 6 POINT RUBRIC',start));
 const student={student_user_id:7,student_email:'student@example.com',cohort_ids:[2]};
 const assignments=[{id:1,subcategory_id:1,course_weight_percent:50},{id:2,subcategory_id:1,course_weight_percent:50},{id:3,subcategory_id:2,course_weight_percent:50}];
 const submissions=[{id:1,student_id:7,assignment_id:1,score:80},{id:2,student_id:7,assignment_id:2,score:null,rubric_selection:{excused:true}},{id:3,student_id:7,assignment_id:3,score:null,rubric_selection:{excused:true}}];
 let handler, result;
 const pool={query:async sql=>{
  if(sql.includes('FROM courses'))return {rows:[{id:2}]};
  if(sql.includes('FROM course_categories'))return {rows:[]};
  if(sql.includes('FROM assignments a'))return {rows:assignments};
  if(sql.includes('FROM users'))return {rows:[student]};
  if(sql.includes('FROM submissions s'))return {rows:submissions};
  throw Error('Unexpected query');
 }};
 vm.runInNewContext(block,{app:{get:(_path,...args)=>handler=args.at(-1)},authenticateJWT(){},requireRole:()=>()=>{},loadGradingRoster:async()=>({students:[student]}),pool,gradebookSubmissionIndex,console});
 const response={json(value){result=value},status(n){throw Error(`Unexpected status ${n}`)}};
 await handler({params:{classId:2},query:{}},response);
 assert.equal(result.students[0].current_percent,80);
 assert.equal(result.students[0].graded_weight_percent,50);
 assert.equal(result.students[0].assignment_scores[1].rubric_selection.excused,true);
 submissions[0].score=null;
 await handler({params:{classId:2},query:{}},response);
 assert.equal(result.students[0].current_percent,null);
});

 test('teacher not-submitted status saves with zero for new and existing rows and can be cleared',async()=>{
 for(const existing of [true,false]) {
  const saved=await save({pointsEarned:0,directPercentage:true,notSubmitted:true},existing);
  assert.equal(saved.status,200);assert.equal(saved.result.percent_score,0);
  assert.equal(saved.result.rubric_selection.notSubmitted,true);
 }
 const marked=await save({pointsEarned:10,directPercentage:true,notSubmitted:false});
 assert.equal(marked.result.percent_score,50);assert.equal(marked.result.rubric_selection.notSubmitted,undefined);
 const excused=await save({excused:true,notSubmitted:true});
 assert.equal(excused.result.rubric_selection.notSubmitted,undefined);
});
