const express = require('express');
const {validatePeriod,courseMark} = require('../reportCards');
module.exports = function reportCardRoutes({pool,authenticateJWT,requireRole,ensureStudentInfoColumns,ensureStudentReportCommentsTable}) {
 const router=express.Router();
 router.use(authenticateJWT,requireRole('admin','teacher'));
 async function ensure(){await ensureStudentInfoColumns();await ensureStudentReportCommentsTable();await pool.query(`CREATE TABLE IF NOT EXISTS student_report_cards (id SERIAL PRIMARY KEY, class_id INTEGER NOT NULL REFERENCES courses(id), student_user_id INTEGER NOT NULL REFERENCES users(id), issuer_id INTEGER NOT NULL REFERENCES users(id), report_type TEXT NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, card JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(class_id,student_user_id,issuer_id,report_type,start_date,end_date))`);}
 async function access(req,ids){
  const result=await pool.query(`SELECT c.id,c.title,c.master_course_id,c.section_code FROM courses c WHERE c.id=ANY($1::integer[]) AND ($2='admin' OR c.teacher_id=$3 OR EXISTS(SELECT 1 FROM course_teachers ct WHERE ct.course_id IN(c.id,COALESCE(c.master_course_id,c.id)) AND ct.teacher_id=$3) OR EXISTS(SELECT 1 FROM courses m WHERE m.id=c.master_course_id AND m.teacher_id=$3))`,[ids,String(req.user.role).toLowerCase(),Number(req.user.id)]);
  if(result.rows.length!==ids.length) {const error=new Error('You do not have access to every selected class.');error.status=403;throw error;}return result.rows;
 }
 function courseIds(req){const ids=[...new Set(String(req.query.courseIds||req.params.classId).split(',').map(Number))];if(!ids.length||ids.length>50||ids.some(id=>!Number.isInteger(id)||id<=0))throw new Error('Choose up to 50 valid courses.');return ids;}
 router.get('/:classId/report-cards',async(req,res)=>{try{
  const config=validatePeriod(req.query),classId=Number(req.params.classId),ids=courseIds(req);
  const courses=await access(req,[...new Set([classId,...ids])]);await ensure();
  const students=await pool.query(`SELECT DISTINCT u.id AS student_user_id, COALESCE(NULLIF(TRIM(u.name),''),NULLIF(TRIM(CONCAT_WS(' ',u.first_name,u.last_name)),''),u.email) AS student_name,u.email AS student_email,COALESCE(NULLIF(u.student_id,''),ms.student_id,'') AS student_id,COALESCE(ms.pen,'') AS pen,COALESCE(ms.current_grade::text,to_jsonb(u)->>'grade_level','') AS student_grade,COALESCE(ms.current_homeform,to_jsonb(u)->>'class_name','') AS student_class FROM class_enrollments ce JOIN users u ON u.id=ce.student_user_id LEFT JOIN LATERAL(SELECT directory.* FROM master_students directory WHERE (NULLIF(u.student_id,'') IS NOT NULL AND directory.student_id=u.student_id) OR (NULLIF(u.email,'') IS NOT NULL AND LOWER(directory.student_email)=LOWER(u.email)) ORDER BY CASE WHEN directory.student_id=NULLIF(u.student_id,'') THEN 0 ELSE 1 END,directory.id LIMIT 1) ms ON TRUE WHERE ce.class_id=$1 ORDER BY student_name,student_email`,[classId]);
  const cards=students.rows.map(s=>({...s,courses:[]}));
  for(const course of courses.filter(c=>ids.includes(c.id))){
   const contentId=course.master_course_id||course.id;
   const assignments=await pool.query(`SELECT a.id,a.subcategory_id,((cc.weight_percent*cs.weight_percent_of_parent)/100.0) AS course_weight_percent,TO_CHAR(COALESCE(a.due_date,(to_jsonb(a)->>'available_from')::timestamptz,(to_jsonb(a)->>'created_at')::timestamptz) AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') AS reporting_date FROM assignments a LEFT JOIN category_subcategories cs ON cs.id=a.subcategory_id LEFT JOIN course_categories cc ON cc.id=cs.course_category_id WHERE a.class_id=$1 ORDER BY a.id`,[contentId]);
   const submissions=await pool.query(`SELECT s.assignment_id,s.student_id,s.student_email,s.score FROM submissions s JOIN assignments a ON a.id=s.assignment_id WHERE a.class_id=$1 ORDER BY s.id`,[contentId]);
   const enrolled=await pool.query(`SELECT ce.student_user_id,COALESCE(src.com1,'') AS com1,COALESCE(src.com2,'') AS com2 FROM class_enrollments ce LEFT JOIN student_report_comments src ON src.class_id=ce.class_id AND src.student_user_id=ce.student_user_id WHERE ce.class_id=$1`,[course.id]);
   const attendance=await pool.query(`SELECT r.student_email,r.status,COUNT(*)::int AS count FROM attendance_sessions s JOIN attendance_records r ON r.attendance_session_id=s.id WHERE s.course_id=$1 AND s.attendance_date BETWEEN $2::date AND $3::date GROUP BY r.student_email,r.status`,[course.id,config.start,config.end]);
   const sessions=await pool.query(`SELECT COUNT(*)::int AS count FROM attendance_sessions WHERE course_id=$1 AND attendance_date BETWEEN $2::date AND $3::date`,[course.id,config.start,config.end]);
   for(const card of cards){const e=enrolled.rows.find(e=>e.student_user_id===card.student_user_id);if(!e)continue;
    const counts=Object.fromEntries(['Present','Absent','Late','Excused'].map(status=>[status,attendance.rows.filter(r=>String(r.student_email).toLowerCase()===card.student_email.toLowerCase()&&r.status===status).reduce((sum,r)=>sum+Number(r.count),0)]));counts.Unrecorded=Math.max(0,Number(sessions.rows[0].count)-Object.values(counts).reduce((a,b)=>a+b,0));
    card.courses.push({course_id:course.id,title:course.title,...courseMark(assignments.rows,submissions.rows,card,config),mark_override:'',com1:e.com1,com2:e.com2,attendance:counts,sessions:Number(sessions.rows[0].count)});
   }
  }
  res.json({config,class_title:courses.find(c=>c.id===classId).title,cards});
 }catch(error){console.error('Report cards:',error);res.status(error.status||400).json({error:error.message});}});
 router.get('/:classId/report-cards/saved',async(req,res)=>{try{await access(req,[Number(req.params.classId)]);await ensure();const result=await pool.query(`SELECT id,card,updated_at FROM student_report_cards WHERE class_id=$1 AND ($2='admin' OR issuer_id=$3) ORDER BY updated_at DESC LIMIT 1000`,[Number(req.params.classId),String(req.user.role).toLowerCase(),Number(req.user.id)]);res.json(result.rows);}catch(error){res.status(error.status||500).json({error:error.message});}});
 router.post('/:classId/report-cards',async(req,res)=>{
  let client;try{const config=validatePeriod(req.body.config),classId=Number(req.params.classId),cards=req.body.cards;
   if(!Array.isArray(cards)||!cards.length||cards.length>500)throw new Error('Choose between 1 and 500 report cards.');
   const ids=[...new Set([classId,...cards.flatMap(c=>(c.courses||[]).map(x=>Number(x.course_id)))])];await access(req,ids);await ensure();
   const enrolled=await pool.query('SELECT class_id,student_user_id FROM class_enrollments WHERE class_id=ANY($1::integer[])',[ids]);
   for(const card of cards){if(!enrolled.rows.some(e=>e.class_id===classId&&e.student_user_id===Number(card.student_user_id)))throw new Error('A selected student is not enrolled in this class.');
    if(!Array.isArray(card.courses)||!card.courses.length)throw new Error('Each card needs at least one enrolled course.');
    for(const c of card.courses){if(!enrolled.rows.some(e=>e.class_id===Number(c.course_id)&&e.student_user_id===Number(card.student_user_id)))throw new Error('A report course does not match the student enrollment.');if(c.mark_override!==''&&c.mark_override!=null&&(!Number.isFinite(Number(c.mark_override))||Number(c.mark_override)<0||Number(c.mark_override)>100))throw new Error('Report marks must be between 0 and 100.');}
   }
   client=await pool.connect();await client.query('BEGIN');
   for(const card of cards)await client.query(`INSERT INTO student_report_cards(class_id,student_user_id,issuer_id,report_type,start_date,end_date,card) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT(class_id,student_user_id,issuer_id,report_type,start_date,end_date) DO UPDATE SET card=EXCLUDED.card,updated_at=NOW()`,[classId,card.student_user_id,req.user.id,config.type,config.start,config.end,JSON.stringify({...card,config,class_title:String(req.body.class_title||''),report_date:String(req.body.report_date||''),school_name:String(req.body.school_name||'')})]);
   await client.query('COMMIT');res.json({saved:cards.length});
  }catch(error){if(client)await client.query('ROLLBACK');res.status(error.status||400).json({error:error.message});}finally{client?.release();}
 });return router;
};
