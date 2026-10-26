const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {Pool}=require('pg'),express=require('express'),jwt=require('jsonwebtoken');
const {createFitnessRouter}=require('../server/routes/fitnessRoutes');
const {chinaToday}=require('../server/fitnessRotation');
const bin=process.env.POSTGRES_TEST_BIN;
test('fitness tracker enforces enrollment, rotation, completion history and concurrent saves with PostgreSQL',{skip:!bin},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fitness-db-'));let pool,server,started=false;
 function pg(command,args){const r=spawnSync(path.join(bin,command),args,{encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.stdout)}
 try{
  pg('initdb',['-D',path.join(dir,'data'),'-A','trust','-U','test','--no-locale']);
  pg('pg_ctl',['-D',path.join(dir,'data'),'-l',path.join(dir,'server.log'),'-o',`-k ${dir} -h '' -p 58429`,'-w','start']);started=true;
  pool=new Pool({host:dir,port:58429,user:'test',database:'postgres'});
  await pool.query(`CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,first_name TEXT,last_name TEXT,email TEXT);
   CREATE TABLE courses(id INTEGER PRIMARY KEY,title TEXT,teacher_id INTEGER,master_course_id INTEGER,is_live BOOLEAN DEFAULT true);
   CREATE TABLE course_teachers(course_id INTEGER,teacher_id INTEGER);CREATE TABLE class_enrollments(class_id INTEGER,student_user_id INTEGER);
   INSERT INTO users(id,name,email) VALUES(3,'PE Teacher','pe@test'),(4,'Other Teacher','other@test'),(10,'Student One','one@test'),(11,'Student Two','two@test'),(12,'Student Other','three@test');
   INSERT INTO courses(id,title,teacher_id,master_course_id) VALUES(1,'PE 11A',3,NULL),(2,'Other class',4,NULL),(3,'PE linked section',4,1);
   INSERT INTO class_enrollments VALUES(1,10),(1,11),(2,12),(3,12);`);
  const app=express();app.use(express.json());app.use('/api/fitness',createFitnessRouter(pool));
  await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve)});const base=`http://127.0.0.1:${server.address().port}/api/fitness`;
  async function request(user,method,url,body){const headers={'Content-Type':'application/json'};if(user)headers.Authorization='Bearer '+jwt.sign(user,process.env.JWT_SECRET||'super-lms-development-secret-change-before-production');const r=await fetch(base+url,{method,headers,body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()}}
  const teacher={id:3,role:'teacher'},other={id:4,role:'teacher'},student={id:10,role:'student'},second={id:11,role:'student'},outsider={id:12,role:'student'};
  const today=chinaToday(),time=Date.parse(today+'T00:00:00Z'),start=new Date(time-30*86400000).toISOString().slice(0,10),end=new Date(time+30*86400000).toISOString().slice(0,10);
  const monday=new Date(time-((new Date(time).getUTCDay()+6)%7+7)*86400000).toISOString().slice(0,10);
  const friday=new Date(Date.parse(monday)+4*86400000).toISOString().slice(0,10);
  const config={title:'Fitness Unit',start_date:start,end_date:end,weekdays:[1,2,3,4],stations:['Back + Chest','Arms','Shoulders','Legs'].map(name=>({name,instructions:'Teacher exercise plan'}))};
  let id;
  await t.test('only assigned teachers create units; master teacher can access linked section',async()=>{
   assert.equal((await request(null,'GET','/courses')).status,401);
   assert.equal((await request(other,'POST','/courses/1/units',config)).status,403);
   assert.equal((await request(student,'POST','/courses/1/units',config)).status,403);
   assert.equal((await request(teacher,'POST','/courses/1/units',{...config,weekdays:[1,2]})).status,400);
   const created=await request(teacher,'POST','/courses/1/units',config);assert.equal(created.status,201);id=created.body.id;
   assert.equal((await request(teacher,'GET','/courses/3/units')).status,200);
  });
  await t.test('student card discloses only that student; unauthorized users cannot access unit',async()=>{
   const r=await request(student,'GET',`/units/${id}`);assert.equal(r.status,200);assert.deepEqual(r.body.students.map(s=>s.id),[10]);assert.equal(r.body.records.length,0);
   assert.equal((await request(outsider,'GET',`/units/${id}`)).status,403);assert.equal((await request(other,'GET',`/units/${id}`)).status,403);
   assert.equal((await request(student,'GET','/courses')).body.courses.length,1);
  });
  await t.test('students choose own group, teachers record choices, stale edits and impersonation rejected',async()=>{
   assert.equal((await request(student,'PUT',`/units/${id}/group`,{student_id:11,group_index:0,revision:0})).status,403);
   assert.equal((await request(student,'PUT',`/units/${id}/group`,{group_index:0,revision:0})).status,200);
   assert.equal((await request(second,'PUT',`/units/${id}/group`,{group_index:1,revision:0})).status,409);
   assert.equal((await request(teacher,'PUT',`/units/${id}/group`,{student_id:11,group_index:1,revision:1})).status,200);
   assert.equal((await request(teacher,'PUT',`/units/${id}/group`,{student_id:12,group_index:1,revision:2})).status,400);
  });
  await t.test('only teacher confirms completion on scheduled dates with server derived station',async()=>{
   const body={date:monday,revision:2,records:[{student_id:10,completed:true},{student_id:11,completed:true}]};
   assert.equal((await request(student,'PUT',`/units/${id}/day`,body)).status,403);
   assert.equal((await request(teacher,'PUT',`/units/${id}/day`,{...body,date:friday})).status,400);
   assert.equal((await request(teacher,'PUT',`/units/${id}/day`,{...body,date:end})).status,400);
   const r=await request(teacher,'PUT',`/units/${id}/day`,body);assert.equal(r.status,200);assert.equal(r.body.saved,2);
   const read=await request(student,'GET',`/units/${id}`);assert.equal(read.body.records.length,1);assert.deepEqual(read.body.group_counts,[1,1,0,0]);assert.equal(read.body.records[0].station_index,0);assert.equal(read.body.students[0].group_locked,true);
   assert.equal((await request(student,'PUT',`/units/${id}/group`,{group_index:2,revision:3})).status,409);
   assert.deepEqual((await pool.query('SELECT student_id,station_index FROM fitness_completions ORDER BY student_id')).rows,[{student_id:10,station_index:0},{student_id:11,station_index:1}]);
  });
  await t.test('mixed invalid roster saves roll back every row and the revision; unchecked work persists',async()=>{
   const date=new Date(Date.parse(monday)+86400000).toISOString().slice(0,10);
   assert.equal((await request(teacher,'PUT',`/units/${id}/day`,{date,revision:3,records:[{student_id:10,completed:true},{student_id:12,completed:true}]})).status,400);
   assert.equal((await pool.query('SELECT 1 FROM fitness_completions WHERE workout_date=$1',[date])).rowCount,0);
   assert.equal((await request(teacher,'PUT',`/units/${id}/day`,{date,revision:3,records:[{student_id:10,completed:false}]})).status,200);
   const read=await request(student,'GET',`/units/${id}`);assert.equal(read.body.records.find(r=>r.date===date).completed,false);
   assert.equal((await request(teacher,'PUT',`/units/${id}/day`,{date,revision:3,records:[{student_id:11,completed:false}]})).status,409);
  });
  await t.test('two simultaneous saves cannot overwrite each other',async()=>{
   const date=new Date(Date.parse(monday)+2*86400000).toISOString().slice(0,10);
   const responses=await Promise.all([10,11].map(student_id=>request(teacher,'PUT',`/units/${id}/day`,{date,revision:4,records:[{student_id,completed:true}]})));
   assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal((await pool.query('SELECT 1 FROM fitness_completions WHERE workout_date=$1',[date])).rowCount,1);
  });
  await t.test('disabled course access removes student access without removing saved history',async()=>{
   await pool.query('UPDATE courses SET is_live=false WHERE id=1');assert.equal((await request(student,'GET',`/units/${id}`)).status,403);assert.equal((await request(student,'GET','/courses')).body.courses.length,0);assert.equal((await request(teacher,'GET',`/units/${id}`)).body.records.length,4);
  });
 }finally{if(server)await new Promise(r=>server.close(r));await pool?.end();if(started)pg('pg_ctl',['-D',path.join(dir,'data'),'-m','immediate','-w','stop']);fs.rmSync(dir,{recursive:true,force:true});}
});
