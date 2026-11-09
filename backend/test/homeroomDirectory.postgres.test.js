const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process'),{Pool}=require('pg'),{loadHomeroomDirectory}=require('../server/homeroomDirectory');
const bin=process.env.POSTGRES_TEST_BIN;
test('combined directory includes accounts absent from master records and saves the exact homeroom without changing marks',{skip:!bin},async()=>{
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
 await pool.query('ALTER TABLE users ADD COLUMN student_id TEXT');
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
 // Reproduce the live failure: only 140 master records but 255 LMS student accounts.
 await pool.query(`TRUNCATE users,master_students,courses,class_enrollments,observer_student_links;
 ALTER TABLE users ADD COLUMN password_hash TEXT,ADD COLUMN current_grade TEXT;
 CREATE SEQUENCE test_user_ids START 10000; ALTER TABLE users ALTER COLUMN id SET DEFAULT nextval('test_user_ids');
 ALTER TABLE users ADD UNIQUE(email);
 ALTER TABLE master_students ADD COLUMN pen TEXT,ADD COLUMN current_grade TEXT,ADD COLUMN current_homeform TEXT;
 ALTER TABLE observer_student_links ADD COLUMN id SERIAL,ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW(),ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW(),ADD UNIQUE(observer_user_id,student_user_id);
 INSERT INTO users(id,name,email,role,observer_relationship) VALUES(1000,'Home','home@example.invalid','observer','chinese_homeroom_teacher'),(1001,'Other','otherstaff@example.invalid','observer','chinese_homeroom_teacher');
 INSERT INTO users(id,name,email,role,student_id,current_grade,password_hash) SELECT n,'Student '||n,'s'||n||'@example.invalid','student','S'||n,CASE WHEN n<=100 THEN '10' WHEN n<=180 THEN '11' ELSE '12' END,'unchanged' FROM generate_series(1,255) n;
 INSERT INTO master_students(id,display_name,student_email,student_id,status,current_grade) SELECT n,'Student '||n,'s'||n||'@example.invalid','S'||n,CASE WHEN n>138 THEN 'Review' ELSE 'Active' END,CASE WHEN n<=100 THEN '10' ELSE '11' END FROM generate_series(1,140) n;
 INSERT INTO master_students(id,display_name,student_email,student_id,status) VALUES(256,'No account yet','new@example.invalid','S256','Active'),(300,'Duplicate master record','s1@example.invalid','S1','Active');
 INSERT INTO observer_student_links(observer_user_id,student_user_id,relationship) SELECT 1000,n,'chinese_homeroom_teacher' FROM generate_series(1,26) n;
 INSERT INTO observer_student_links(observer_user_id,student_user_id,relationship) VALUES(1001,50,'chinese_homeroom_teacher'),(1000,202,'observer');
 CREATE TABLE submissions(id INT,student_id INT,score NUMERIC);INSERT INTO submissions VALUES(1,200,80),(2,255,0);`);
 const {findHomeroomOwner,loadHomeroomRoster}=require('../server/homeroomDirectory');
 const owner=await findHomeroomOwner(pool,'home@example.invalid');
 let roster=await loadHomeroomRoster(pool,owner);assert.equal(roster.length,256);assert.equal(roster.filter(r=>r.already_linked).length,26);
 assert.equal(roster.find(r=>r.student_user_id===200).master_student_id,null);assert.equal(roster.filter(r=>r.current_grade==='10').length,100);assert.equal(roster.filter(r=>r.current_grade==='11').length,80);assert.equal(roster.filter(r=>r.current_grade==='12').length,75);
 const academicBefore=(await pool.query('SELECT * FROM submissions ORDER BY id')).rows;
 const accountsBefore=(await pool.query('SELECT id,name,email,role,password_hash FROM users ORDER BY id')).rows;
 const {createHomeroomRosterHandlers}=require('../server/homeroomRosterRoutes');
 const handlers=createHomeroomRosterHandlers({pool,ensureStudentInfoColumns:async()=>{}});
 async function call(method,body,user={id:1000,role:'observer'}){let status=200,payload;await handlers[method]({params:{email:'home@example.invalid'},query:{},body,user},{status(code){status=code;return this},json(value){payload=value}});return {status,payload};}
 const requested=Array.from({length:26},(_,i)=>i+1).concat([200,255]);
 assert.equal((await call('save',{studentUserIds:requested,masterStudentIds:[]})).payload.linkedCount,28);
 roster=(await call('list')).payload.students;assert.equal(roster.length,256);assert.equal(roster.filter(r=>r.already_linked).length,28);
 const directory=await loadHomeroomDirectory(pool,'home@example.invalid');assert.deepEqual([...directory.studentUserIds].sort((a,b)=>a-b),requested);
 assert.equal((await call('save',{studentUserIds:[1001]})).status,400);assert.equal((await call('save',{studentUserIds:requested},{id:1001,role:'observer'})).status,403);
 assert.deepEqual((await pool.query('SELECT * FROM submissions ORDER BY id')).rows,academicBefore);
 assert.deepEqual((await pool.query('SELECT id,name,email,role,password_hash FROM users ORDER BY id')).rows,accountsBefore);
 assert.equal((await pool.query("SELECT COUNT(*)::int AS n FROM observer_student_links WHERE observer_user_id=1001 OR (observer_user_id=1000 AND relationship='observer')")).rows[0].n,2);
 assert.equal((await call('save',{masterStudentIds:[256],studentUserIds:requested})).payload.linkedCount,29);
 assert.equal((await call('list')).payload.students.filter(r=>r.already_linked).length,29);


 }finally{await pool?.end();if(started)pg('pg_ctl',['-D',path.join(dir,'data'),'-m','fast','-w','stop']);fs.rmSync(dir,{recursive:true,force:true})}
});
