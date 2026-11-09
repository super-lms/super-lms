const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process'),{Pool}=require('pg'),{createSelfStudyNotices}=require('../server/selfStudyNotices');
const bin=process.env.POSTGRES_TEST_BIN;
test('range posts include both dates, preserve other teachers, and reject invalid ranges without writes',{skip:!bin},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'self-study-range-'));let pool,started=false;
 function pg(cmd,args){const r=spawnSync(path.join(bin,cmd),args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout)}
 try{
 pg('initdb',['-D',path.join(dir,'data'),'-A','trust','-U','test','--no-locale']);pg('pg_ctl',['-D',path.join(dir,'data'),'-l',path.join(dir,'server.log'),'-o',`-k ${dir} -h '' -p 58484`,'-w','start']);started=true;
 pool=new Pool({host:dir,port:58484,user:'test',database:'postgres'});
 await pool.query(`CREATE TABLE users(id INT PRIMARY KEY,school_id INT,name TEXT,first_name TEXT,last_name TEXT);
 CREATE TABLE courses(id INT PRIMARY KEY,title TEXT,school_id INT,teacher_id INT,master_course_id INT);
 CREATE TABLE course_teachers(course_id INT,teacher_id INT);
 INSERT INTO users VALUES(1,2,'One','',''),(2,2,'Two','',''),(3,3,'Other school','','');
 INSERT INTO courses VALUES(10,'Example course',2,1,NULL);INSERT INTO course_teachers VALUES(10,2);`);
 const service=createSelfStudyNotices(pool),one={id:1,role:'teacher'},two={id:2,role:'teacher'};
 const body={course_id:10,ipad_status:'needed',notes:'Online practice',start_date:'2026-12-31',end_date:'2027-01-02'};
 assert.equal((await service.save(one,body)).count,3);assert.equal((await service.list(one,'2026-12-31','2027-01-02')).length,3);
 await service.save(two,{...body,start_date:'2027-01-01',end_date:'2027-01-01',notes:'Other teacher'});
 await service.save(one,{...body,ipad_status:'not_needed'});
 const snapshot=async()=>(await pool.query('SELECT teacher_id,study_date::text,ipad_status,notes FROM self_study_ipad_notices ORDER BY teacher_id,study_date')).rows;
 const rows=await snapshot();assert.equal(rows.length,4);assert.equal(rows.filter(r=>r.teacher_id===1&&r.ipad_status==='not_needed').length,3);assert.equal(rows.find(r=>r.teacher_id===2).notes,'Other teacher');
 for(const change of [{end_date:'2026-12-30'},{end_date:'2027-02-01'},{start_date:'2026-02-30'}])await assert.rejects(service.save(one,{...body,...change}),{status:400});
 await assert.rejects(service.save({id:3,role:'teacher'},body),{status:403});await assert.rejects(service.save(one,body,1),{status:400});
 assert.deepEqual(await snapshot(),rows);
 }finally{await pool?.end();if(started)pg('pg_ctl',['-D',path.join(dir,'data'),'-m','fast','-w','stop']);fs.rmSync(dir,{recursive:true,force:true})}
});
