const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {Pool}=require('pg');
const {createSubmissionDeadline}=require('../server/submissionDeadline');
const {createHeldSubmissions}=require('../server/heldSubmissions');
const {createLateSubmissionRouter}=require('../server/routes/lateSubmissionRoutes');
const bin=process.env.POSTGRES_TEST_BIN;
test('late work storage and approval against a disposable PostgreSQL database',{skip:!bin},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lms-held-test-'));let pool,started=false;
 function pg(command,args){const r=spawnSync(path.join(bin,command),args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);}
 try{
  pg('initdb',['-D',path.join(dir,'data'),'-A','trust','-U','test','--no-locale']);
  pg('pg_ctl',['-D',path.join(dir,'data'),'-l',path.join(dir,'server.log'),'-o',`-k ${dir} -h '' -p 58427`,'-w','start']);started=true;
  pool=new Pool({host:dir,port:58427,user:'test',database:'postgres'});
  await pool.query(`CREATE TABLE users(id INTEGER PRIMARY KEY,role TEXT,email TEXT,first_name TEXT,last_name TEXT);
   CREATE TABLE courses(id INTEGER PRIMARY KEY,teacher_id INTEGER,master_course_id INTEGER,title TEXT);
   CREATE TABLE class_enrollments(class_id INTEGER,student_user_id INTEGER);CREATE TABLE course_teachers(course_id INTEGER,teacher_id INTEGER);
   CREATE TABLE assignments(id INTEGER PRIMARY KEY,teacher_id INTEGER,class_id INTEGER,title TEXT,due_date TIMESTAMPTZ,cohort_id INTEGER);
   CREATE TABLE submissions(id SERIAL PRIMARY KEY,assignment_id INTEGER,student_id INTEGER,teacher_id INTEGER,course_id INTEGER,
    assignment_title TEXT,student_name TEXT,student_email TEXT,original_file_name TEXT,stored_file_name TEXT,file_path TEXT,content TEXT,feedback TEXT,score NUMERIC);
   CREATE TABLE submission_attachments(id SERIAL PRIMARY KEY,submission_id INTEGER,assignment_id INTEGER,student_email TEXT,original_name TEXT,
    stored_name TEXT,file_path TEXT,mime_type TEXT,size_bytes INTEGER,file_data BYTEA,created_at TIMESTAMPTZ);
   INSERT INTO users VALUES(3,'teacher','teacher@test','Teacher','One'),(10,'student','student@test','Student','One');
   INSERT INTO courses VALUES(1,3,NULL,'Test course');INSERT INTO class_enrollments VALUES(1,10);
   INSERT INTO assignments(id,teacher_id,class_id,title,due_date) VALUES(5,3,1,'Late assignment','2020-01-01');`);
  const deadlines=createSubmissionDeadline(pool),held=createHeldSubmissions(pool,deadlines,async()=>{});
  const router=createLateSubmissionRouter(pool,deadlines,held);
  async function route(method,routePath,extra={}){
   const handle=router.stack.find(l=>l.route?.path===routePath&&l.route.methods[method]).route.stack.at(-1).handle;
   let body,status=200;const res={status(n){status=n;return this},json(b){body=b;return this},set(){return this}};
   await handle({params:{assignmentId:5},query:{},user:{id:3,role:'teacher'},...extra},res);return {status,body};
  }
  const approval=enabled=>route('post','/:assignmentId/late-submission',{body:{student_email:'student@test',enabled}});
  const alerts=()=>route('get','/late-submission-alerts',{query:{classId:'1'}});
  const input={assignmentId:5,studentId:10,studentEmail:'student@test',studentName:'Student One',state:{late:true,pending:true,due:'2020-01-01'}};
  await t.test('holds latest text and files without changing existing marked work',async()=>{
   await pool.query(`INSERT INTO submissions(assignment_id,student_id,student_email,content,score) VALUES(5,10,'student@test','Earlier answer',75)`);
   assert.equal((await held.hold({...input,content:'First draft'})).pending_approval,true);
   await held.hold({...input,content:'Final answer'});
   await held.hold({...input,file:{originalname:'work.pdf',filename:'stored.pdf',mimetype:'application/pdf',size:5,data:Buffer.from('hello')}});
   assert.equal((await held.pending(5,10)).length,2);
   assert.deepEqual((await pool.query('SELECT content,score FROM submissions')).rows,[{content:'Earlier answer',score:'75'}]);
   assert.equal((await pool.query('SELECT * FROM submission_attachments')).rowCount,0);
   const r=await alerts();assert.equal(r.status,200);assert.equal(r.body.alerts[0].has_held_work,true);
   assert.equal((await held.forCourse(1,'student@test')).length,2);
  });
  await t.test('blocks grading while approval is pending',async()=>{
   let status,next=false;await held.gradeMiddleware({params:{assignmentId:5},body:{student_email:'student@test'}},{status(n){status=n;return this},json(){}},()=>{next=true});assert.equal(status,409);assert.equal(next,false);
  });
  await t.test('failure rolls back permission, text, files and audit together',async()=>{
   await pool.query(`CREATE FUNCTION fail_late_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$;
    CREATE TRIGGER fail_audit BEFORE INSERT ON assignment_late_acceptances FOR EACH ROW EXECUTE FUNCTION fail_late_audit();`);
   assert.equal((await approval(true)).status,500);assert.equal((await held.pending(5,10)).length,2);
   assert.equal((await pool.query('SELECT * FROM assignment_late_permissions')).rowCount,0);
   assert.equal((await pool.query('SELECT content FROM submissions')).rows[0].content,'Earlier answer');
   await pool.query('DROP TRIGGER fail_audit ON assignment_late_acceptances');
  });
  await t.test('approval releases work and retries do not duplicate files',async()=>{
   const r=await approval(true);assert.equal(r.status,200);assert.equal(r.body.promoted,2);
   assert.equal((await held.pending(5,10)).length,0);assert.equal((await pool.query('SELECT content FROM submissions')).rows[0].content,'Final answer');
   assert.equal((await pool.query('SELECT file_data FROM submission_attachments')).rows[0].file_data.toString(),'hello');
   assert.equal((await pool.query('SELECT * FROM assignment_late_acceptances')).rowCount,2);
   assert.equal((await approval(true)).body.promoted,0);assert.equal((await pool.query('SELECT * FROM submission_attachments')).rowCount,1);
   assert.equal((await alerts()).body.alerts.length,0);
  });
  await t.test('revocation holds revisions; concurrent approvals release once',async()=>{
   await approval(false);assert.equal((await deadlines.check(5,10,{hold:true})).pending,true);await held.hold({...input,content:'Revised answer'});
   const results=await Promise.all([approval(true),approval(true)]);assert.ok(results.every(r=>r.status===200));assert.equal(results.reduce((sum,r)=>sum+r.body.promoted,0),1);
  });
  await t.test('first submission stays outside grading until approval creates it',async()=>{
   await pool.query(`INSERT INTO users VALUES(11,'student','other@test','Other','Student'); INSERT INTO class_enrollments VALUES(1,11)`);
   const r=await held.hold({...input,studentId:11,studentEmail:'other@test',studentName:'Other Student',content:'First answer'});
   assert.equal(r.pending_approval,true);assert.equal((await pool.query('SELECT * FROM submissions WHERE student_id=11')).rowCount,0);
   const approved=await route('post','/:assignmentId/late-submission',{body:{student_email:'other@test',enabled:true}});
   assert.equal(approved.status,200);assert.equal(approved.body.promoted,1);
   assert.equal((await pool.query('SELECT content FROM submissions WHERE student_id=11')).rows[0].content,'First answer');
  });
  await t.test('upload finishing after approval is released rather than stranded',async()=>{
   const r=await held.hold({...input,file:{originalname:'later.txt',filename:'later.txt',mimetype:'text/plain',size:3,data:Buffer.from('new')}});
   assert.equal(r.pending_approval,false);assert.equal((await held.pending(5,10)).length,0);assert.equal((await pool.query('SELECT * FROM submission_attachments')).rowCount,2);
  });

  await pool.query(`INSERT INTO assignments(id,teacher_id,class_id,title,due_date) VALUES
   (6,3,1,'Keep declined work','2020-01-01'),(7,3,1,'Delete declined work','2020-01-01'),(8,3,1,'Rollback decline','2020-01-01');`);
  const decline=(id,disposition='keep',confirmed=false)=>route('post','/:assignmentId/late-submission/decline',{params:{assignmentId:id},body:{student_email:'student@test',disposition,confirm_delete:confirmed}});
  const approveId=id=>route('post','/:assignmentId/late-submission',{params:{assignmentId:id},body:{student_email:'student@test',enabled:true}});
  const messageList=(id=10)=>route('get','/submission-decisions',{user:{id,role:'student'},query:{student_id:10}});
  await t.test('decline and keep hides notices, preserves files and marks, sends one private message and blocks resubmission',async()=>{
   await pool.query(`INSERT INTO submissions(assignment_id,student_id,student_email,content,score) VALUES(6,10,'student@test','Earlier marked answer',77)`);
   await held.hold({...input,assignmentId:6,content:'Late text'});
   await held.hold({...input,assignmentId:6,file:{originalname:'late.txt',filename:'late.txt',mimetype:'text/plain',size:4,data:Buffer.from('late')}});
   assert.ok((await alerts()).body.alerts.some(a=>a.assignment_id===6));
   assert.equal((await decline(6)).status,200);assert.equal((await decline(6)).status,200);
   assert.equal((await held.pending(6,10)).length,0);
   const archived=(await pool.query('SELECT * FROM assignment_held_work WHERE assignment_id=6')).rows;
   assert.equal(archived.length,2);assert.ok(archived.every(h=>h.declined_at));assert.equal(archived[1].file_data.toString(),'late');
   assert.deepEqual((await pool.query('SELECT content,score FROM submissions WHERE assignment_id=6')).rows,[{content:'Earlier marked answer',score:'77'}]);
   assert.equal((await alerts()).body.alerts.some(a=>a.assignment_id===6),false);
   assert.equal((await messageList()).body.messages.filter(m=>m.assignment_id===6).length,1);
   assert.match((await messageList()).body.messages.find(m=>m.assignment_id===6).message,/declined.*see your teacher/);
   assert.equal((await messageList(11)).body.messages.length,0);
   await pool.query("UPDATE assignments SET due_date=NOW()+INTERVAL '1 day' WHERE id=6");
   await assert.rejects(deadlines.check(6,10,{hold:true}),e=>e.code==='SUBMISSION_DECLINED');
   await assert.rejects(held.hold({...input,assignmentId:6,content:'Upload started before decline'}),e=>e.code==='SUBMISSION_DECLINED');
   let status,next=false;await held.gradeMiddleware({params:{assignmentId:6},body:{student_email:'student@test'}},{status(n){status=n;return this},json(){}},()=>next=true);assert.equal(status,409);assert.equal(next,false);
   await pool.query("UPDATE assignments SET due_date='2020-01-01' WHERE id=6");
   assert.equal((await approveId(6)).body.promoted,2);
   assert.equal((await messageList()).body.messages.some(m=>m.assignment_id===6),false);
   assert.equal((await pool.query('SELECT content FROM submissions WHERE assignment_id=6')).rows[0].content,'Late text');
   assert.equal((await decline(6)).status,409);
  });
  await t.test('delete requires confirmation and deletes only pending late work, retaining marked work and an audit message',async()=>{
   await pool.query(`INSERT INTO submissions(assignment_id,student_id,student_email,content,score) VALUES(7,10,'student@test','Marked answer',81)`);
   await held.hold({...input,assignmentId:7,content:'Delete this pending text'});
   await held.hold({...input,assignmentId:7,file:{originalname:'delete.txt',filename:'delete.txt',mimetype:'text/plain',size:6,data:Buffer.from('delete')}});
   assert.equal((await decline(7,'delete')).status,400);assert.equal((await held.pending(7,10)).length,2);
   assert.equal((await decline(7,'delete',true)).status,200);
   assert.equal((await pool.query('SELECT * FROM assignment_held_work WHERE assignment_id=7')).rowCount,0);
   assert.deepEqual((await pool.query('SELECT content,score FROM submissions WHERE assignment_id=7')).rows,[{content:'Marked answer',score:'81'}]);
   assert.equal((await deadlines.activeDecline(7,10)).work_deleted,true);
   assert.equal((await alerts()).body.alerts.some(a=>a.assignment_id===7),false);
   assert.equal((await approveId(7)).body.promoted,0);assert.equal((await deadlines.check(7,10,{hold:true})).pending,undefined);
  });
  await t.test('failed decline rolls back deletion, permission and student notification together',async()=>{
   await held.hold({...input,assignmentId:8,content:'Preserve me on failure'});
   await pool.query(`CREATE FUNCTION fail_decline() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'notification unavailable'; END $$;
    CREATE TRIGGER fail_decline BEFORE INSERT ON assignment_submission_declines FOR EACH ROW EXECUTE FUNCTION fail_decline();`);
   assert.equal((await decline(8,'delete',true)).status,500);
   assert.equal((await held.pending(8,10)).length,1);assert.equal(await deadlines.activeDecline(8,10),null);
   assert.equal((await pool.query('SELECT * FROM assignment_late_permissions WHERE assignment_id=8')).rowCount,0);
   assert.ok((await alerts()).body.alerts.some(a=>a.assignment_id===8));
   await pool.query('DROP TRIGGER fail_decline ON assignment_submission_declines');
  });
 }finally{await pool?.end();if(started)pg('pg_ctl',['-D',path.join(dir,'data'),'-m','immediate','-w','stop']);fs.rmSync(dir,{recursive:true,force:true});}
});
