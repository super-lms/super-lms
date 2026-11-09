const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process'),{Pool}=require('pg'),{loadHomeroomDirectory}=require('../server/homeroomDirectory');
const bin=process.env.POSTGRES_TEST_BIN;
test('homeroom directory includes all 233 students independently of live courses and preserves the 138 saved links',{skip:!bin},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'homeroom-directory-'));let pool,started=false;
 function pg(cmd,args){const r=spawnSync(path.join(bin,cmd),args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout)}
 try{
 pg('initdb',['-D',path.join(dir,'data'),'-A','trust','-U','test','--no-locale']);pg('pg_ctl',['-D',path.join(dir,'data'),'-l',path.join(dir,'server.log'),'-o',`-k ${dir} -h '' -p 58485`,'-w','start']);started=true;
 pool=new Pool({host:dir,port:58485,user:'test',database:'postgres'});
 await pool.query(`CREATE TABLE users(id INT PRIMARY KEY,school_id INT,name TEXT,first_name TEXT,last_name TEXT,email TEXT,role TEXT,observer_relationship TEXT);
 CREATE TABLE master_students(id INT PRIMARY KEY,school_id INT,display_name TEXT,student_email TEXT,student_id TEXT,status TEXT);
 CREATE TABLE courses(id INT PRIMARY KEY,title TEXT,is_live BOOLEAN,teacher_id INT);
 CREATE TABLE class_enrollments(student_user_id INT,class_id INT);
 CREATE TABLE observer_student_links(observer_user_id INT,student_user_id INT,relationship TEXT);
 INSERT INTO users VALUES(1000,NULL,'Home','','','home@example.invalid','observer','chinese_homeroom_teacher'),
 (1001,NULL,'Parent','','','parent@example.invalid','parent','parent'),(1002,NULL,'Staff','','','staff@example.invalid','observer','observer');
 INSERT INTO users SELECT n,NULL,'Student '||n,'Student',n::text,'s'||n||'@example.invalid','student',NULL FROM generate_series(1,232) n;
 INSERT INTO master_students SELECT n,NULL,'Student '||n,'s'||n||'@example.invalid',n::text,'active' FROM generate_series(1,233) n;
 INSERT INTO users VALUES(234,7,'Other school','','','other@example.invalid','student',NULL);
 INSERT INTO master_students VALUES(234,7,'Other school','other@example.invalid','234','active');
 INSERT INTO courses VALUES(10,'Live',TRUE,1000),(11,'Next semester',FALSE,1000);
 INSERT INTO class_enrollments SELECT n,CASE WHEN n<=138 THEN 10 ELSE 11 END FROM generate_series(1,232) n;
 INSERT INTO observer_student_links SELECT 1000,n,'chinese_homeroom_teacher' FROM generate_series(1,138) n;`);
 const before=(await pool.query('SELECT * FROM observer_student_links ORDER BY student_user_id')).rows;
 const result=await loadHomeroomDirectory(pool,'home@example.invalid');
 assert.equal(new Set(result.rows.map(row=>row.master_student_id)).size,233);
 assert.equal(result.rows.filter(row=>row.in_homeroom).length,138);
 assert.equal(result.studentUserIds.length,138);
 assert.equal(result.rows.find(row=>row.master_student_id===200).class_id,null);
 assert.equal(result.rows.find(row=>row.master_student_id===233).student_user_id,null);
 assert.equal(result.rows.some(row=>row.master_student_id===234),false);
 assert.equal(await loadHomeroomDirectory(pool,'parent@example.invalid'),null);
 assert.equal(await loadHomeroomDirectory(pool,'staff@example.invalid'),null);
 assert.deepEqual((await pool.query('SELECT * FROM observer_student_links ORDER BY student_user_id')).rows,before);

 }finally{await pool?.end();if(started)pg('pg_ctl',['-D',path.join(dir,'data'),'-m','fast','-w','stop']);fs.rmSync(dir,{recursive:true,force:true})}
});
