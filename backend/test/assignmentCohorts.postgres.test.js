const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const {Pool}=require('pg');
const {ensureAssignmentCohorts,resolveAssignmentCohort}=require('../server/assignmentCohorts');
const {loadGradingRoster}=require('../server/gradingRoster');
const bin=process.env.POSTGRES_TEST_BIN;
test('cohort assignment creation, audience correction, access and counts in PostgreSQL',{skip:!bin},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lms-cohort-test-'));let pool,started=false;
 function pg(command,args){const r=spawnSync(path.join(bin,command),args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout);}
 try{
  pg('initdb',['-D',path.join(dir,'data'),'-A','trust','-U','test','--no-locale']);
  pg('pg_ctl',['-D',path.join(dir,'data'),'-l',path.join(dir,'server.log'),'-o',`-k ${dir} -h '' -p 58428`,'-w','start']);started=true;
  pool=new Pool({host:dir,port:58428,user:'test',database:'postgres'});
  await pool.query(`CREATE TABLE courses(id INTEGER PRIMARY KEY,title TEXT,master_course_id INTEGER,is_live BOOLEAN DEFAULT TRUE);
   CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT);
   CREATE TABLE class_enrollments(class_id INTEGER,student_user_id INTEGER);
   CREATE TABLE assignments(id SERIAL PRIMARY KEY,class_id INTEGER,teacher_id INTEGER,title TEXT,description TEXT,
    due_date TIMESTAMPTZ,subcategory_id INTEGER,source_type TEXT,is_published BOOLEAN,sort_order INTEGER,updated_at TIMESTAMPTZ);
   CREATE TABLE submissions(id SERIAL PRIMARY KEY,assignment_id INTEGER,student_id INTEGER,student_email TEXT,content TEXT,score NUMERIC,grade TEXT,rubric_selection JSONB);
   CREATE TABLE submission_attachments(id INTEGER,submission_id INTEGER);
   INSERT INTO courses(id,title,master_course_id) VALUES(11,'CTS 10A',NULL),(12,'CTS 10B',11),(13,'CTS 10C',11),(14,'CTS 10D',11),(99,'Unrelated',NULL);
   INSERT INTO users VALUES(101,'a@test'),(102,'b@test'),(103,'c@test'),(104,'d@test');
   INSERT INTO class_enrollments VALUES(11,101),(12,102),(13,103),(14,104);`);
  await ensureAssignmentCohorts(pool);await ensureAssignmentCohorts(pool);
  const source=fs.readFileSync(path.join(__dirname,'../server/app.js'),'utf8');
  const routes={};
  const context={pool,resolveAssignmentCohort,loadGradingRoster,ensureAssignmentTimeZones:async()=>{},
   resolveContentCourseId:async id=>(await pool.query('SELECT COALESCE(master_course_id,id) AS id FROM courses WHERE id=$1',[id])).rows[0]?.id,
   authorizeCourseModuleAccess:async()=>({allowed:true,courseId:11}),authenticateJWT:()=>{},requireRole:()=>()=>{},console,
   app:Object.fromEntries(['post','get','patch'].map(method=>[method,(url,...handlers)=>{routes[method+url]=handlers.at(-1);}]))};
  const start=source.indexOf('// Change the audience without copying');const end=source.indexOf('/* DUPLICATE ASSIGNMENT */',start);
  vm.runInNewContext(source.slice(start,end),context);
  const accessStart=source.indexOf('async function studentHasLiveCourseAccess');
  vm.runInNewContext(source.slice(accessStart,source.indexOf('async function learnerCanAccessCourse',accessStart)),context);
  async function route(key,req){let status=200,body;await routes[key]({params:{},query:{},user:{id:1,role:'teacher'},...req},{status(n){status=n;return this},json(b){body=b;return this}});return {status,body};}
  async function create(classId,cohortId,title){const r=await route('post/api/assignments',{body:{class_id:classId,cohort_id:cohortId,teacher_id:1,title,subcategory_id:1,is_published:true}});assert.equal(r.status,200);return r.body;}
  const a=await create(11,11,'A only'),b=await create(12,12,'B only'),shared=await create(11,null,'Shared');
  assert.equal(a.class_id,11);assert.equal(a.cohort_id,11);assert.equal(b.class_id,11);assert.equal(b.cohort_id,12);assert.equal(shared.cohort_id,null);
  assert.equal(await context.studentHasLiveCourseAccess(101,11,a.cohort_id),true);
  assert.equal(await context.studentHasLiveCourseAccess(102,11,a.cohort_id),false);
  assert.equal(await context.studentHasLiveCourseAccess(104,11,null),true);
  assert.deepEqual((await loadGradingRoster(pool,11,'all',12)).students.map(s=>s.student_user_id),[102]);
  await pool.query(`INSERT INTO submissions(assignment_id,student_id,student_email,content,score) VALUES($1,102,'b@test','Saved work',85)`,[b.id]);
  const before=(await pool.query('SELECT * FROM submissions')).rows;
  const patch=await route('patch/api/assignments/:assignmentId/cohort',{params:{assignmentId:b.id},body:{cohort_id:13}});
  assert.equal(patch.status,200);assert.equal(patch.body.cohort_id,13);
  assert.deepEqual((await pool.query('SELECT * FROM submissions')).rows,before);
  const bad=await route('patch/api/assignments/:assignmentId/cohort',{params:{assignmentId:b.id},body:{cohort_id:99}});assert.equal(bad.status,400);
  const count=await route('get/api/classes/:classId/assignment-counts',{params:{classId:11}});
  assert.deepEqual(Array.from(count.body.assignments,r=>r.id).sort(),[a.id,shared.id].sort());
  const all=await route('get/api/classes/:classId/assignment-counts',{params:{classId:11},query:{scope:'all'}});
  assert.equal(all.body.assignments.find(r=>r.id===b.id).roster_count,1);
  assert.equal(all.body.assignments.find(r=>r.id===b.id).submission_count,0);
  assert.equal(all.body.assignments.find(r=>r.id===shared.id).roster_count,4);
 }finally{await pool?.end();if(started)pg('pg_ctl',['-D',path.join(dir,'data'),'-m','immediate','-w','stop']);fs.rmSync(dir,{recursive:true,force:true});}
});
