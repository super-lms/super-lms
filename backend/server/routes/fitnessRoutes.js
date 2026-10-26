const express = require('express');
const {authenticateJWT,requireRole} = require('../../middleware/auth');
const {validDate,chinaToday,validateUnit,calendar} = require('../fitnessRotation');
const fail = (status,message) => Object.assign(Error(message),{status});
const teacherAccess = `(c.teacher_id=$2 OR EXISTS(SELECT 1 FROM courses parent WHERE parent.id=c.master_course_id AND parent.teacher_id=$2) OR EXISTS(SELECT 1 FROM course_teachers ct WHERE ct.course_id IN(c.id,COALESCE(c.master_course_id,c.id)) AND ct.teacher_id=$2))`;
function createFitnessRouter(pool) {
  const router=express.Router();let ready;
  function ensure(){
    if(!ready) ready=pool.query(`CREATE TABLE IF NOT EXISTS fitness_units (
      id SERIAL PRIMARY KEY,course_id INTEGER NOT NULL REFERENCES courses(id),title TEXT NOT NULL,
      start_date DATE NOT NULL,end_date DATE NOT NULL,weekdays JSONB NOT NULL,stations JSONB NOT NULL,
      revision INTEGER NOT NULL DEFAULT 0,created_by INTEGER REFERENCES users(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS fitness_groups (
      unit_id INTEGER NOT NULL REFERENCES fitness_units(id),student_id INTEGER NOT NULL REFERENCES users(id),group_index INTEGER NOT NULL CHECK(group_index BETWEEN 0 AND 3),
      PRIMARY KEY(unit_id,student_id));
      CREATE TABLE IF NOT EXISTS fitness_completions (
      unit_id INTEGER NOT NULL REFERENCES fitness_units(id),student_id INTEGER NOT NULL REFERENCES users(id),workout_date DATE NOT NULL,
      station_index INTEGER NOT NULL CHECK(station_index BETWEEN 0 AND 3),completed BOOLEAN NOT NULL,
      checked_by INTEGER NOT NULL REFERENCES users(id),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(unit_id,student_id,workout_date));
      CREATE INDEX IF NOT EXISTS fitness_units_course ON fitness_units(course_id);`).catch(e=>{ready=null;throw e;});
    return ready;
  }
  router.use(authenticateJWT,requireRole('teacher','admin','student'),(req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
  const wrap=fn=>async(req,res)=>{try{await ensure();await fn(req,res);}catch(e){if(!e.status)console.error('Fitness tracker:',e.message);res.status(e.status||500).json({error:e.status?e.message:'Could not save or load the fitness tracker. Please retry.'});}};
  async function course(req,id,client=pool){
    if(!Number.isInteger(id)||id<1)throw fail(400,'Select a valid class.');
    const query=req.user.role==='student'
      ? `c.is_live=TRUE AND EXISTS(SELECT 1 FROM class_enrollments ce WHERE ce.class_id=c.id AND ce.student_user_id=$2)`
      : `($3='admin' OR ${teacherAccess})`;
    const r=await client.query(`SELECT c.id,c.title FROM courses c WHERE c.id=$1 AND ${query}`,
      req.user.role==='student'?[id,req.user.id]:[id,req.user.id,req.user.role]);
    if(!r.rows.length)throw fail(403,'This class is not available to you.');return r.rows[0];
  }
  async function unit(req,client=pool){
    const id=Number(req.params.unitId);if(!Number.isInteger(id)||id<1)throw fail(400,'Select a valid unit.');
    const r=await client.query(`SELECT *,TO_CHAR(start_date,'YYYY-MM-DD') AS start_date,TO_CHAR(end_date,'YYYY-MM-DD') AS end_date FROM fitness_units WHERE id=$1`,[id]);
    if(!r.rows.length)throw fail(404,'Fitness unit not found.');
    await course(req,r.rows[0].course_id,client);return r.rows[0];
  }
  async function transaction(req,fn){
    if(!Number.isInteger(req.body.revision)||req.body.revision<0)throw fail(400,'Reload the unit to get its current version.');
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const u=await unit(req,client);
      await client.query('SELECT pg_advisory_xact_lock(78231,$1::INTEGER)',[u.id]);
      const revision=await client.query('UPDATE fitness_units SET revision=revision+1 WHERE id=$1 AND revision=$2 RETURNING revision',[u.id,req.body.revision]);
      if(!revision.rows.length)throw fail(409,'This unit changed in another session. Reload the unit before saving again.');
      const result=await fn(client,u);
      await client.query('COMMIT');return {...result,revision:revision.rows[0].revision};
    }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
  }
  router.get('/courses',wrap(async(req,res)=>{
    const condition=req.user.role==='student'
      ? `c.is_live=TRUE AND EXISTS(SELECT 1 FROM class_enrollments ce JOIN fitness_units fu ON fu.course_id=ce.class_id WHERE ce.class_id=c.id AND ce.student_user_id=$2)`
      : `($3='admin' OR ${teacherAccess})`;
    // Keep positional parameters identical to the class authorization query.
    const r=await pool.query(`SELECT c.id,c.title FROM courses c WHERE c.id<>$1 AND ${condition} ORDER BY c.title,c.id`,req.user.role==='student'?[0,req.user.id]:[0,req.user.id,req.user.role]);
    res.json({courses:r.rows,today:chinaToday()});
  }));
  router.get('/courses/:courseId/units',wrap(async(req,res)=>{
    const c=await course(req,Number(req.params.courseId));
    const r=await pool.query(`SELECT id,title,TO_CHAR(start_date,'YYYY-MM-DD') AS start_date,TO_CHAR(end_date,'YYYY-MM-DD') AS end_date FROM fitness_units WHERE course_id=$1 ORDER BY start_date DESC,id DESC`,[c.id]);res.json({units:r.rows});
  }));
  router.post('/courses/:courseId/units',requireRole('teacher','admin'),wrap(async(req,res)=>{
    const c=await course(req,Number(req.params.courseId));let settings;try{settings=validateUnit(req.body);}catch(e){throw fail(400,e.message);}
    const r=await pool.query(`INSERT INTO fitness_units(course_id,title,start_date,end_date,weekdays,stations,created_by) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7) RETURNING id`,[c.id,settings.title,settings.start_date,settings.end_date,JSON.stringify(settings.weekdays),JSON.stringify(settings.stations),req.user.id]);res.status(201).json(r.rows[0]);
  }));
  router.get('/units/:unitId',wrap(async(req,res)=>{
    const u=await unit(req);const student=req.user.role==='student';
    const roster=await pool.query(`SELECT DISTINCT u.id,COALESCE(NULLIF(TRIM(u.name),''),NULLIF(TRIM(CONCAT_WS(' ',u.first_name,u.last_name)),''),u.email) AS name,g.group_index,
      EXISTS(SELECT 1 FROM fitness_completions f WHERE f.unit_id=$1 AND f.student_id=u.id AND f.completed) AS group_locked
      FROM class_enrollments ce JOIN users u ON u.id=ce.student_user_id LEFT JOIN fitness_groups g ON g.unit_id=$1 AND g.student_id=u.id
      WHERE ce.class_id=$2 AND ($3::INTEGER IS NULL OR u.id=$3) ORDER BY name,u.id`,[u.id,u.course_id,student?req.user.id:null]);
    const counts=await pool.query(`SELECT g.group_index,COUNT(DISTINCT g.student_id)::INTEGER AS count FROM fitness_groups g JOIN class_enrollments ce ON ce.class_id=$2 AND ce.student_user_id=g.student_id WHERE g.unit_id=$1 GROUP BY g.group_index`,[u.id,u.course_id]);
    const groupCounts=[0,0,0,0];for(const row of counts.rows)groupCounts[row.group_index]=row.count;
    const records=await pool.query(`SELECT student_id,TO_CHAR(workout_date,'YYYY-MM-DD') AS date,station_index,completed FROM fitness_completions WHERE unit_id=$1 AND ($2::INTEGER IS NULL OR student_id=$2) ORDER BY workout_date,student_id`,[u.id,student?req.user.id:null]);
    // Read the revision again so a concurrent save cannot be silently overwritten.
    // If it changed while loading, ask the client to fetch one consistent view.
    const version=await pool.query('SELECT revision FROM fitness_units WHERE id=$1',[u.id]);
    if(version.rows[0].revision!==u.revision)throw fail(409,'The unit changed while loading. Please reload.');
    res.json({unit:u,students:roster.rows,records:records.rows,group_counts:groupCounts,calendar:calendar(u),today:chinaToday()});
  }));
  router.put('/units/:unitId/group',wrap(async(req,res)=>{
    const studentId=req.user.role==='student'?Number(req.user.id):Number(req.body.student_id),group=req.body.group_index;
    if(req.user.role==='student'&&req.body.student_id!==undefined&&Number(req.body.student_id)!==studentId)throw fail(403,'You can only choose your own group.');
    if(!Number.isInteger(studentId)||studentId<1||!Number.isInteger(group)||group<0||group>3)throw fail(400,'Choose a student and one of the four groups.');
    const result=await transaction(req,async(client,u)=>{
      if(req.user.role==='student'&&chinaToday()>u.end_date)throw fail(400,'This unit has ended.');
      const enrolled=await client.query('SELECT 1 FROM class_enrollments WHERE class_id=$1 AND student_user_id=$2',[u.course_id,studentId]);
      if(!enrolled.rows.length)throw fail(400,'This student is not enrolled in this class.');
      const checked=await client.query('SELECT 1 FROM fitness_completions WHERE unit_id=$1 AND student_id=$2 AND completed LIMIT 1',[u.id,studentId]);
      if(checked.rows.length)throw fail(409,'A completed workout locks this group to preserve the rotation history.');
      await client.query(`INSERT INTO fitness_groups(unit_id,student_id,group_index) VALUES($1,$2,$3) ON CONFLICT(unit_id,student_id) DO UPDATE SET group_index=EXCLUDED.group_index`,[u.id,studentId,group]);return {success:true};
    });res.json(result);
  }));
  router.put('/units/:unitId/day',requireRole('teacher','admin'),wrap(async(req,res)=>{
    const {date,records}=req.body;
    if(!validDate(date)||date>chinaToday())throw fail(400,'Select today or a past teaching date.');
    if(!Array.isArray(records)||!records.length||records.length>1000||records.some(r=>!Number.isInteger(r.student_id)||typeof r.completed!=='boolean')||new Set(records.map(r=>r.student_id)).size!==records.length)throw fail(400,'Send a valid completion list without duplicate students.');
    const result=await transaction(req,async(client,u)=>{
      const day=calendar(u).find(d=>d.date===date);if(!day)throw fail(400,'This date is outside the unit or is not a selected PE day.');
      const roster=await client.query(`SELECT DISTINCT g.student_id,g.group_index FROM fitness_groups g JOIN class_enrollments ce ON ce.class_id=$2 AND ce.student_user_id=g.student_id WHERE g.unit_id=$1`,[u.id,u.course_id]);
      const groups=new Map(roster.rows.map(r=>[r.student_id,r.group_index]));
      for(const r of records){
        if(!groups.has(r.student_id))throw fail(400,'Every checked student must be enrolled and have a rotation group.');
        await client.query(`INSERT INTO fitness_completions(unit_id,student_id,workout_date,station_index,completed,checked_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(unit_id,student_id,workout_date) DO UPDATE SET station_index=EXCLUDED.station_index,completed=EXCLUDED.completed,checked_by=EXCLUDED.checked_by,updated_at=NOW()`,[u.id,r.student_id,date,day.stations[groups.get(r.student_id)],r.completed,req.user.id]);
      }return {success:true,saved:records.length};
    });res.json(result);
  }));
  return router;
}
module.exports={createFitnessRouter};
