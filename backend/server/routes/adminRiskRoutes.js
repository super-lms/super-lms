const express=require('express');
const {authenticateJWT,requireRole}=require('../../middleware/auth');
const {loadCourseRisk}=require('../dashboardRisk');
function createAdminRiskRouter(pool) {
 const router=express.Router();
 router.get('/',authenticateJWT,requireRole('admin'),async(req,res,next)=>{
  res.set('Cache-Control','private, no-store');
  try {
   const account=await pool.query("SELECT NULLIF(to_jsonb(u)->>'school_id','')::INTEGER AS school_id FROM users u WHERE u.id=$1",[req.user.id]);
   if(!account.rows.length)return res.status(403).json({error:'Account unavailable'});
   const courses=await pool.query(`SELECT c.*,COALESCE((SELECT json_agg(DISTINCT u.id) FROM users u WHERE u.id=c.teacher_id OR u.id=(SELECT teacher_id FROM courses WHERE id=c.master_course_id) OR EXISTS(SELECT 1 FROM course_teachers ct WHERE ct.teacher_id=u.id AND ct.course_id IN(c.id,COALESCE(c.master_course_id,c.id)))),'[]'::json) AS teacher_ids FROM courses c WHERE c.school_id IS NOT DISTINCT FROM $1 ORDER BY c.title,c.id`,[account.rows[0].school_id]);
   const ids=courses.rows.map(c=>c.id);
   const students=await pool.query(`SELECT DISTINCT u.id,COALESCE(NULLIF(TRIM(to_jsonb(u)->>'name'),''),NULLIF(TRIM(CONCAT(u.first_name,' ',u.last_name)),''),u.email) AS name,u.email,ce.class_id FROM class_enrollments ce JOIN users u ON u.id=ce.student_user_id WHERE ce.class_id=ANY($1::int[])`,[ids]);
   const teacherIds=[...new Set(courses.rows.flatMap(c=>c.teacher_ids))];
   const teachers=await pool.query(`SELECT id,COALESCE(NULLIF(TRIM(CONCAT(first_name,' ',last_name)),''),email) AS name FROM users WHERE id=ANY($1::int[]) ORDER BY name`,[teacherIds]);
   res.json({...await loadCourseRisk(pool,courses.rows,students.rows),courses:courses.rows,teachers:teachers.rows});
  }catch(error){console.error('Admin risk alerts:',error.message);res.status(500).json({error:'Unable to load student risk alerts. Please try again.'});}
 });
 return router;
}
module.exports={createAdminRiskRouter};
