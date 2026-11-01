const test=require('node:test');const assert=require('node:assert/strict');
const {createClassLateApprovalHandler}=require('../server/classLateApproval');
async function run({allowed=true,section='144',audience=null,enabled=true,fail=false,noSubmission=false,declined=false}={}){
 const calls=[],grants=[],promoted=[];
 const client={async query(sql,args){calls.push(sql);if(sql.startsWith('SELECT a.id'))return {rows:allowed?[{id:5,class_id:144,cohort_id:audience,submission_required:!noSubmission}]:[]};
  if(sql.startsWith('INSERT INTO assignment_late_permissions')){grants.push(args);return {rows:[{id:100+grants.length}]};}return {rows:[]};},release(){calls.push('RELEASE')}};
 const pool={connect:async()=>client};
 const deadlines={ensure:async()=>{},activeDecline:async(a,s)=>declined&&s===11?{id:1}:null};
 const held={ensure:async()=>{},lock:async(c,a,s)=>calls.push('LOCK '+s),promote:async(c,a,s)=>{promoted.push(s);if(fail)throw Error('failed promotion');return 1}};
 const roster=async(c,course,section,cohort)=>{assert.equal(c,client);assert.equal(course,144);if(section!=='144'||cohort&&cohort!==144)throw Object.assign(Error('Wrong cohort'),{status:400});return {students:[{student_user_id:11},{student_user_id:10},{student_user_id:10}]};};
 let code=200,body;
 await createClassLateApprovalHandler(pool,deadlines,held,roster)({params:{assignmentId:'5'},body:{sectionId:section,enabled},user:{id:3,role:'teacher'}},{status(n){code=n;return this},json(b){body=b}});
 return {code,body,calls,grants,promoted};
}
test('class approval grants every enrolled student once and releases saved work atomically',async()=>{
 const r=await run();assert.equal(r.code,200);assert.equal(r.body.students,2);assert.equal(r.body.promoted,2);
 assert.deepEqual(r.grants,[[5,10,3,true],[5,11,3,true]]);assert.deepEqual(r.promoted,[10,11]);
 assert.ok(r.calls.indexOf('LOCK 10')<r.calls.indexOf('LOCK 11'));assert.ok(r.calls.includes('COMMIT'));assert.equal(r.calls.at(-1),'RELEASE');
});
test('unassigned teacher and foreign or out-of-audience classes cannot receive approvals',async()=>{
 for(const options of [{allowed:false},{section:'999'},{audience:145}]){const r=await run(options);assert.ok([400,403].includes(r.code));assert.equal(r.grants.length,0);assert.ok(r.calls.includes('ROLLBACK'));}
});
test('all sections, malformed IDs and teacher-entered assignments cannot accidentally approve a larger roster',async()=>{
 for(const options of [{section:'all'},{section:'0'},{noSubmission:true}]){const r=await run(options);assert.equal(r.code,400);assert.equal(r.grants.length,0);}
});
test('declined students keep their individual decision and class revoke preserves submitted work',async()=>{
 const r=await run({declined:true});assert.equal(r.body.skipped_declined,1);assert.deepEqual(r.grants,[[5,10,3,true]]);
 const revoked=await run({enabled:false});assert.deepEqual(revoked.grants,[[5,10,3,false],[5,11,3,false]]);assert.deepEqual(revoked.promoted,[]);
 assert.ok(!revoked.calls.some(sql=>/DELETE|UPDATE submissions/.test(sql)));
});
test('a promotion failure rolls back the entire class decision',async()=>{
 const r=await run({fail:true});assert.equal(r.code,500);assert.ok(r.calls.includes('ROLLBACK'));assert.ok(!r.calls.includes('COMMIT'));
});
