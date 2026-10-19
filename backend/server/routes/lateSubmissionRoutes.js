const {DECLINED_MESSAGE}=require('../submissionDeadline');
const express=require('express');const {authenticateJWT,requireRole}=require('../../middleware/auth');
function createLateSubmissionRouter(pool,deadlines,held){
 const router=express.Router();const approvalAccess=[authenticateJWT,requireRole('admin','teacher')];
 router.get('/late-submission-alerts',...approvalAccess,async(req,res)=>{try{
  const classId=req.query?.classId ? Number(req.query.classId) : null;
  if(classId!==null&&(!Number.isInteger(classId)||classId<=0))return res.status(400).json({error:'Choose a valid class.'});
  const masterView=req.query?.scope==='master';
  await deadlines.ensure();if(held)await held.ensure();
  const result=await pool.query(`SELECT b.*,a.title,u.email AS student_email,CONCAT(u.first_name,' ',u.last_name) AS student_name,roster.course_title,roster.section_id,a.due_date AS current_due_date,
   EXISTS(SELECT 1 FROM assignment_late_permissions p WHERE p.assignment_id=b.assignment_id AND p.student_id=b.student_id AND p.enabled AND p.id=(SELECT MAX(p2.id) FROM assignment_late_permissions p2 WHERE p2.assignment_id=p.assignment_id AND p2.student_id=p.student_id)) AS approved,
   EXISTS(SELECT 1 FROM assignment_held_work h WHERE h.assignment_id=b.assignment_id AND h.student_id=b.student_id AND h.approved_at IS NULL AND h.declined_at IS NULL) AS has_held_work
   FROM assignment_late_blocked b JOIN assignments a ON a.id=b.assignment_id JOIN courses c ON c.id=a.class_id JOIN users u ON u.id=b.student_id
   JOIN LATERAL (
    SELECT STRING_AGG(DISTINCT enrolled.title, ', ' ORDER BY enrolled.title) AS course_title,
     CASE WHEN COUNT(DISTINCT enrolled.id)=1 THEN MIN(enrolled.id) END AS section_id
    FROM class_enrollments membership JOIN courses enrolled ON enrolled.id=membership.class_id
    WHERE membership.student_user_id=b.student_id
     AND COALESCE(enrolled.master_course_id,enrolled.id)=COALESCE(c.master_course_id,c.id)
     AND ($3::BOOLEAN OR $2::INTEGER IS NULL OR enrolled.id=$2)
    HAVING COUNT(*)>0
   ) roster ON TRUE
   WHERE (c.teacher_id=$1 OR EXISTS(SELECT 1 FROM course_teachers ct WHERE ct.course_id IN(c.id,COALESCE(c.master_course_id,c.id)) AND ct.teacher_id=$1)
    OR EXISTS(SELECT 1 FROM class_enrollments ce JOIN courses cohort ON cohort.id=ce.class_id
     WHERE ce.student_user_id=b.student_id AND cohort.master_course_id=c.id
     AND (cohort.teacher_id=$1 OR EXISTS(SELECT 1 FROM course_teachers ct WHERE ct.course_id=cohort.id AND ct.teacher_id=$1))))
   AND ($2::INTEGER IS NULL OR
    ($3::BOOLEAN AND (c.id=$2 OR c.master_course_id=$2)) OR
    (NOT $3::BOOLEAN AND roster.section_id=$2))
   AND ((a.due_date IS NOT NULL AND a.due_date<=NOW() AND a.due_date<=b.due_at)
    OR EXISTS(SELECT 1 FROM assignment_held_work h WHERE h.assignment_id=b.assignment_id AND h.student_id=b.student_id AND h.approved_at IS NULL AND h.declined_at IS NULL))
   AND NOT EXISTS(SELECT 1 FROM assignment_late_permissions p
    WHERE p.assignment_id=b.assignment_id AND p.student_id=b.student_id AND p.enabled
    AND p.id=(SELECT MAX(p2.id) FROM assignment_late_permissions p2 WHERE p2.assignment_id=p.assignment_id AND p2.student_id=p.student_id))
   AND NOT EXISTS(SELECT 1 FROM assignment_submission_declines d WHERE d.assignment_id=b.assignment_id AND d.student_id=b.student_id AND d.resolved_at IS NULL)
   ORDER BY b.last_attempt_at DESC LIMIT 100`,[req.user.id,classId,masterView]);
  res.set('Cache-Control','private, no-store');res.json({alerts:result.rows});
 }catch(e){console.error('Late submission alerts',e);res.status(500).json({error:'Unable to load past-due submission notices.'});}});
 async function access(req){
  const id=Number(req.params.assignmentId);if(!Number.isInteger(id)||id<=0)throw Object.assign(Error('Choose an assignment.'),{status:400});
  const a=await pool.query(`SELECT a.id,a.class_id,a.cohort_id,a.due_date FROM assignments a JOIN courses c ON c.id=a.class_id WHERE a.id=$1 AND ($2='admin' OR a.teacher_id=$3 OR c.teacher_id=$3 OR EXISTS(SELECT 1 FROM course_teachers ct WHERE ct.course_id IN(c.id,COALESCE(c.master_course_id,c.id)) AND ct.teacher_id=$3))`,[id,req.user.role,req.user.id]);
  if(!a.rows.length)throw Object.assign(Error('Assignment unavailable.'),{status:403});
  const email=String(req.query.student_email||req.body?.student_email||'').trim().toLowerCase();
  const s=await pool.query(`SELECT u.id FROM users u JOIN class_enrollments ce ON ce.student_user_id=u.id JOIN courses c ON c.id=ce.class_id WHERE LOWER(u.email)=$1 AND u.role='student' AND (ce.class_id=$2 OR c.master_course_id=$2) AND ($3::INTEGER IS NULL OR ce.class_id=$3) LIMIT 1`,[email,a.rows[0].class_id,a.rows[0].cohort_id || null]);
  if(!s.rows.length)throw Object.assign(Error('Student is not enrolled in this assignment course.'),{status:400});return {assignment:a.rows[0],studentId:s.rows[0].id};
 }
 router.get('/:assignmentId/late-submission/files/:heldId',...approvalAccess,async(req,res)=>{
  try{await held.ensure();const {assignment,studentId}=await access(req);
   const result=await pool.query(`SELECT original_name,mime_type,file_data FROM assignment_held_work
    WHERE id=$1 AND assignment_id=$2 AND student_id=$3 AND approved_at IS NULL AND method='attachment'`,
    [Number(req.params.heldId),assignment.id,studentId]);
   const file=result.rows[0];if(!file?.file_data)return res.status(404).json({error:'Held file unavailable. It may already have been approved.'});
   res.set('Cache-Control','private, no-store');res.type('application/octet-stream');res.attachment(file.original_name);res.send(file.file_data);
  }catch(e){res.status(e.status||500).json({error:e.status?e.message:'Unable to download held work.'});}
 });
 router.get('/:assignmentId/late-submission',...approvalAccess,async(req,res)=>{try{await deadlines.ensure();if(held)await held.ensure();const {assignment,studentId}=await access(req);const permissions=await pool.query(`SELECT p.*,CONCAT(u.first_name,' ',u.last_name) AS teacher_name FROM assignment_late_permissions p JOIN users u ON u.id=p.teacher_id WHERE p.assignment_id=$1 AND p.student_id=$2 ORDER BY p.id DESC`,[assignment.id,studentId]);const accepted=await pool.query(`SELECT e.*,CONCAT(u.first_name,' ',u.last_name) AS teacher_name FROM assignment_late_acceptances e LEFT JOIN assignment_late_permissions p ON p.id=e.permission_id LEFT JOIN users u ON u.id=p.teacher_id WHERE e.assignment_id=$1 AND e.student_id=$2 ORDER BY e.id DESC`,[assignment.id,studentId]);res.set('Cache-Control','private, no-store');res.json({decline:await deadlines.activeDecline(assignment.id,studentId),due_date:assignment.due_date,enabled:permissions.rows[0]?.enabled===true,permissions:permissions.rows,acceptances:accepted.rows,retained_work:held?(await pool.query(`SELECT id,method,content,original_name,received_at,declined_at FROM assignment_held_work WHERE assignment_id=$1 AND student_id=$2 AND approved_at IS NULL AND declined_at IS NOT NULL ORDER BY id`,[assignment.id,studentId])).rows:[],held_work:held?await held.pending(assignment.id,studentId):[]});}catch(e){res.status(e.status||500).json({error:e.status?e.message:'Unable to load late submission approval.'});}});
 router.post('/:assignmentId/late-submission',...approvalAccess,async(req,res)=>{try{if(typeof req.body.enabled!=='boolean')return res.status(400).json({error:'Choose approve or revoke.'});await deadlines.ensure();if(held)await held.ensure();const {assignment,studentId}=await access(req);const client=await pool.connect();let promoted=0;
  try{await client.query('BEGIN');if(held)await held.lock(client,assignment.id,studentId);
   const permission=await client.query('INSERT INTO assignment_late_permissions(assignment_id,student_id,teacher_id,enabled) VALUES($1,$2,$3,$4) RETURNING id',[assignment.id,studentId,req.user.id,req.body.enabled]);
   if(req.body.enabled){
    await client.query('UPDATE assignment_submission_declines SET resolved_at=NOW() WHERE assignment_id=$1 AND student_id=$2 AND resolved_at IS NULL',[assignment.id,studentId]);
    if(held){await client.query('UPDATE assignment_held_work SET declined_at=NULL WHERE assignment_id=$1 AND student_id=$2 AND approved_at IS NULL',[assignment.id,studentId]);promoted=await held.promote(client,assignment.id,studentId,permission.rows[0].id);}
   }
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  res.json({enabled:req.body.enabled,promoted});}catch(e){res.status(e.status||500).json({error:e.status?e.message:'Unable to save late submission approval.'});}});
 router.get('/submission-decisions',authenticateJWT,requireRole('student'),async(req,res)=>{
  try{await deadlines.ensure();const result=await pool.query(`SELECT d.id,d.assignment_id,d.message,d.created_at,a.title AS assignment_title,c.title AS course_title
   FROM assignment_submission_declines d JOIN assignments a ON a.id=d.assignment_id JOIN courses c ON c.id=a.class_id
   WHERE d.student_id=$1 AND d.resolved_at IS NULL ORDER BY d.created_at DESC,d.id DESC`,[req.user.id]);
   res.set('Cache-Control','private, no-store');res.json({messages:result.rows});
  }catch(error){res.status(500).json({error:'Unable to load submission messages.'});}
 });
 router.post('/:assignmentId/late-submission/decline',...approvalAccess,async(req,res)=>{
  try{
   const disposition=req.body.disposition || 'keep';
   if(!['keep','delete'].includes(disposition))return res.status(400).json({error:'Choose whether to keep or delete saved work.'});
   if(disposition==='delete'&&req.body.confirm_delete!==true)return res.status(400).json({error:'Confirm deletion of pending late work before continuing.'});
   await deadlines.ensure();if(held)await held.ensure();const {assignment,studentId}=await access(req);
   const client=await pool.connect();
   try{
    await client.query('BEGIN');if(held)await held.lock(client,assignment.id,studentId);
    const existing=await deadlines.activeDecline(assignment.id,studentId,client);
    if(!existing){
     const needsReview=await client.query(`SELECT 1 FROM assignment_late_blocked WHERE assignment_id=$1 AND student_id=$2
      UNION ALL SELECT 1 FROM assignment_held_work WHERE assignment_id=$1 AND student_id=$2 AND approved_at IS NULL AND declined_at IS NULL LIMIT 1`,[assignment.id,studentId]);
     if(!needsReview.rows.length)throw Object.assign(Error('There is no late submission to decline.'),{status:409});
     const permission=await client.query('SELECT enabled FROM assignment_late_permissions WHERE assignment_id=$1 AND student_id=$2 ORDER BY id DESC LIMIT 1',[assignment.id,studentId]);
     if(permission.rows[0]?.enabled)throw Object.assign(Error('This submission has already been approved. Refresh before taking another action.'),{status:409});
     await client.query('INSERT INTO assignment_late_permissions(assignment_id,student_id,teacher_id,enabled) VALUES($1,$2,$3,FALSE)',[assignment.id,studentId,req.user.id]);
     await client.query('INSERT INTO assignment_submission_declines(assignment_id,student_id,teacher_id,message,work_deleted) VALUES($1,$2,$3,$4,$5)',[assignment.id,studentId,req.user.id,DECLINED_MESSAGE,disposition==='delete']);
     if(disposition==='delete')await client.query('DELETE FROM assignment_held_work WHERE assignment_id=$1 AND student_id=$2 AND approved_at IS NULL',[assignment.id,studentId]);
     else await client.query('UPDATE assignment_held_work SET declined_at=NOW() WHERE assignment_id=$1 AND student_id=$2 AND approved_at IS NULL AND declined_at IS NULL',[assignment.id,studentId]);
    }
    await client.query('COMMIT');
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
   res.json({declined:true,message:DECLINED_MESSAGE});
  }catch(error){console.error('Decline submission',error);res.status(error.status||500).json({error:error.status?error.message:'Unable to decline this submission.'});}
 });
 return router;
}
module.exports={createLateSubmissionRouter};
