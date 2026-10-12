const express=require('express');const {authenticateJWT,requireRole}=require('../../middleware/auth');
function createLateSubmissionRouter(pool,deadlines){
 const router=express.Router();const approvalAccess=[authenticateJWT,requireRole('admin','teacher')];
 async function access(req){
  const id=Number(req.params.assignmentId);if(!Number.isInteger(id)||id<=0)throw Object.assign(Error('Choose an assignment.'),{status:400});
  const a=await pool.query(`SELECT a.id,a.class_id,a.due_date FROM assignments a JOIN courses c ON c.id=a.class_id WHERE a.id=$1 AND ($2='admin' OR a.teacher_id=$3 OR c.teacher_id=$3 OR EXISTS(SELECT 1 FROM course_teachers ct WHERE ct.course_id IN(c.id,COALESCE(c.master_course_id,c.id)) AND ct.teacher_id=$3))`,[id,req.user.role,req.user.id]);
  if(!a.rows.length)throw Object.assign(Error('Assignment unavailable.'),{status:403});
  const email=String(req.query.student_email||req.body?.student_email||'').trim().toLowerCase();
  const s=await pool.query(`SELECT u.id FROM users u JOIN class_enrollments ce ON ce.student_user_id=u.id JOIN courses c ON c.id=ce.class_id WHERE LOWER(u.email)=$1 AND u.role='student' AND (ce.class_id=$2 OR c.master_course_id=$2) LIMIT 1`,[email,a.rows[0].class_id]);
  if(!s.rows.length)throw Object.assign(Error('Student is not enrolled in this assignment course.'),{status:400});return {assignment:a.rows[0],studentId:s.rows[0].id};
 }
 router.get('/:assignmentId/late-submission',...approvalAccess,async(req,res)=>{try{await deadlines.ensure();const {assignment,studentId}=await access(req);const permissions=await pool.query(`SELECT p.*,CONCAT(u.first_name,' ',u.last_name) AS teacher_name FROM assignment_late_permissions p JOIN users u ON u.id=p.teacher_id WHERE p.assignment_id=$1 AND p.student_id=$2 ORDER BY p.id DESC`,[assignment.id,studentId]);const accepted=await pool.query(`SELECT e.*,CONCAT(u.first_name,' ',u.last_name) AS teacher_name FROM assignment_late_acceptances e LEFT JOIN assignment_late_permissions p ON p.id=e.permission_id LEFT JOIN users u ON u.id=p.teacher_id WHERE e.assignment_id=$1 AND e.student_id=$2 ORDER BY e.id DESC`,[assignment.id,studentId]);res.set('Cache-Control','private, no-store');res.json({due_date:assignment.due_date,enabled:permissions.rows[0]?.enabled===true,permissions:permissions.rows,acceptances:accepted.rows});}catch(e){res.status(e.status||500).json({error:e.status?e.message:'Unable to load late submission approval.'});}});
 router.post('/:assignmentId/late-submission',...approvalAccess,async(req,res)=>{try{if(typeof req.body.enabled!=='boolean')return res.status(400).json({error:'Choose approve or revoke.'});await deadlines.ensure();const {assignment,studentId}=await access(req);await pool.query('INSERT INTO assignment_late_permissions(assignment_id,student_id,teacher_id,enabled) VALUES($1,$2,$3,$4)',[assignment.id,studentId,req.user.id,req.body.enabled]);res.json({enabled:req.body.enabled});}catch(e){res.status(e.status||500).json({error:e.status?e.message:'Unable to save late submission approval.'});}});
 return router;
}
module.exports={createLateSubmissionRouter};
