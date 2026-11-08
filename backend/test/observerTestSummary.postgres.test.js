const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {spawnSync}=require('node:child_process');const {Pool}=require('pg');
const {loadObserverTestSummary}=require('../server/observerTestSummary');
const bin=process.env.POSTGRES_TEST_BIN;
test('observer test counts use completed tests once, isolate course/student, and never change saved marks',{skip:!bin},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'observer-summary-test-'));let pool,started=false;
 function pg(cmd,args){const result=spawnSync(path.join(bin,cmd),args,{encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout)}
 try{
  pg('initdb',['-D',path.join(dir,'data'),'-A','trust','-U','test','--no-locale']);pg('pg_ctl',['-D',path.join(dir,'data'),'-l',path.join(dir,'server.log'),'-o',`-k ${dir} -h '' -p 58483`,'-w','start']);started=true;
  pool=new Pool({host:dir,port:58483,user:'test',database:'postgres'});
  const args={studentEmail:' ME@example.invalid ',courseId:12,contentCourseId:1,assignmentIds:[101,103,105]};
  assert.deepEqual(await loadObserverTestSummary(pool,args),{completed_tests:0,test_assignment_ids:[],completed_test_assignment_ids:[]});
  await pool.query(`CREATE TABLE users(id INT PRIMARY KEY,email TEXT);
   CREATE TABLE assessments(id INT PRIMARY KEY,course_id INT,gradebook_assignment_id INT,status TEXT);
   CREATE TABLE assessment_attempts(id INT,assessment_id INT,student_user_id INT,status TEXT);
   CREATE TABLE teacher_quizzes(id INT PRIMARY KEY,course_id INT,assignment_id INT,delivery_course_id INT,status TEXT);
   CREATE TABLE teacher_quiz_responses(id INT,survey_id INT,student_user_id INT);
   CREATE TABLE submissions(id INT,score NUMERIC);
   INSERT INTO users VALUES(7,'me@example.invalid'),(8,'other@example.invalid');
   INSERT INTO submissions VALUES(1,0),(2,80),(3,NULL);
   INSERT INTO assessments VALUES(1,1,101,'published'),(2,1,102,'published'),(3,1,NULL,'published'),(4,999,NULL,'published');
   INSERT INTO assessment_attempts VALUES(1,1,7,'submitted'),(2,1,7,'graded'),(3,2,7,'graded'),(4,3,7,'in_progress'),(5,4,7,'graded'),(6,3,8,'graded');
   INSERT INTO teacher_quizzes VALUES(201,1,103,NULL,'closed'),(202,NULL,NULL,1,'open'),(203,999,NULL,NULL,'open'),(204,1,104,NULL,'open'),(205,1,105,NULL,'open');
   INSERT INTO teacher_quiz_responses VALUES(1,201,7),(2,201,7),(3,202,7),(4,203,7),(5,204,7),(6,205,8);`);
  const before=(await pool.query('SELECT * FROM submissions ORDER BY id')).rows;
  const result=await loadObserverTestSummary(pool,args);
  assert.equal(result.completed_tests,3);assert.deepEqual(result.test_assignment_ids.sort((a,b)=>a-b),[101,103,105]);assert.deepEqual(result.completed_test_assignment_ids.sort((a,b)=>a-b),[101,103]);
  assert.deepEqual((await pool.query('SELECT * FROM submissions ORDER BY id')).rows,before);
  const otherCourse=await loadObserverTestSummary(pool,{...args,courseId:99,contentCourseId:99,assignmentIds:[]});assert.equal(otherCourse.completed_tests,0);
 }finally{if(pool)await pool.end();if(started)pg('pg_ctl',['-D',path.join(dir,'data'),'-m','immediate','-w','stop']);fs.rmSync(dir,{recursive:true,force:true})}
});
