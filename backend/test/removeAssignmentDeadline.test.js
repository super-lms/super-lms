const test=require('node:test');
const assert=require('node:assert/strict');
const {createRemoveDeadlineHandler}=require('../server/removeAssignmentDeadline');
async function run({allowed=true,fail=false}={}){
 const calls=[];const client={async query(sql,args){calls.push({sql,args});if(sql.startsWith('UPDATE assignments'))return {rows:[{id:5,due_date:null}]};if(sql.startsWith('SELECT DISTINCT'))return {rows:[{student_id:10},{student_id:11}]};return {rows:[]};},release(){calls.push({sql:'RELEASE'});}};
 const pool={async query(sql,args){calls.push({sql,args});return {rows:allowed?[{id:5}]:[]}},async connect(){return client}};
 const deadlines={async ensure(){},async activeDecline(id,student){return student===11}};
 const promoted=[];const held={async ensure(){},async lock(){},async promote(c,id,student,permission){assert.equal(permission,null);promoted.push(student);if(fail)throw Error('promotion failed');return 2;}};
 let status=200,body;await createRemoveDeadlineHandler(pool,deadlines,held)({params:{assignmentId:'5'},user:{id:3,role:'teacher'}},{status(n){status=n;return this},json(b){body=b;return this}});return {status,body,calls,promoted};
}
test('No Due Date atomically clears deadline and releases pending work while preserving declines',async()=>{const r=await run();assert.equal(r.status,200);assert.equal(r.body.due_date,null);assert.equal(r.body.released,2);assert.deepEqual(r.promoted,[10]);assert.ok(r.calls.some(c=>c.sql==='COMMIT'));assert.ok(r.calls.find(c=>c.sql.startsWith('SELECT DISTINCT')).sql.includes('resolved_at IS NULL'));assert.ok(r.calls[0].sql.includes('course_teachers'));});
test('unassigned teacher cannot remove deadline or release work',async()=>{const r=await run({allowed:false});assert.equal(r.status,403);assert.equal(r.calls.length,1);assert.equal(r.promoted.length,0);});
test('failure to release held work rolls back the deadline change',async()=>{const r=await run({fail:true});assert.equal(r.status,500);assert.ok(r.calls.some(c=>c.sql==='ROLLBACK'));assert.ok(!r.calls.some(c=>c.sql==='COMMIT'));assert.equal(r.calls.at(-1).sql,'RELEASE');});
const {createHeldSubmissions}=require('../server/heldSubmissions');
test('an upload already in flight is accepted if its old deadline was removed',async()=>{
 const calls=[];const client={async query(sql,args){calls.push(sql);if(sql==='SELECT due_date FROM assignments WHERE id=$1')return {rows:[{due_date:null}]};if(sql.includes('FROM assignment_held_work')&&sql.includes('FOR UPDATE'))return {rows:[{id:1,method:'text',content:'Answer',student_email:'s@test',student_name:'Student',due_at:'2020-01-01'}]};if(sql.includes('INSERT INTO submissions'))return {rows:[{id:20}]};return {rows:[]};},release(){}};
 let recorded=false;const deadlines={async ensure(){},async activeDecline(){return null},async notifyBlocked(){},async record(state){recorded=true;assert.equal(state.permission_id,null)}};
 const held=createHeldSubmissions({async query(){return {rows:[]}},async connect(){return client}},deadlines,async()=>{});
 const result=await held.hold({assignmentId:5,studentId:10,studentEmail:'s@test',studentName:'Student',content:'Answer',state:{due:'2020-01-01'}});
 assert.equal(result.pending_approval,false);assert.equal(result.accepted_past_due,false);assert.equal(result.submission_status,'submitted');assert.equal(recorded,true);assert.ok(calls.includes('COMMIT'));assert.ok(calls.indexOf('SELECT pg_advisory_xact_lock($1::INTEGER,0)')<calls.indexOf('SELECT pg_advisory_xact_lock($1::INTEGER,$2::INTEGER)'));
});
test('promoting an attachment copies bytes inside PostgreSQL instead of loading them into the web process',async()=>{
 const calls=[];const client={async query(sql,args){calls.push({sql,args});if(sql.includes('FROM assignment_held_work')&&sql.includes('FOR UPDATE'))return {rows:[{id:7,method:'attachment',student_email:'s@test',student_name:'Student',stored_name:'large.pptx',original_name:'Large.pptx',mime_type:'application/vnd.openxmlformats-officedocument.presentationml.presentation',size_bytes:50000000,received_at:'2020-01-01',due_at:'2020-01-01'}]};if(sql.startsWith('SELECT id FROM submissions'))return {rows:[{id:20}]};return {rows:[]};}};
 const deadlines={async ensure(){},async record(){}};const held=createHeldSubmissions({async query(){return {rows:[]}}},deadlines,async()=>{});
 const promoted=await held.promote(client,5,10,99);const copy=calls.find(call=>call.sql.includes('INSERT INTO submission_attachments'));
 assert.equal(promoted,1);assert.ok(copy.sql.includes('SELECT $1,h.assignment_id'));assert.ok(copy.sql.includes('h.file_data'));assert.deepEqual(copy.args,[20,'/uploads/large.pptx',7]);assert.ok(!calls[0].sql.includes('file_data'));
});
