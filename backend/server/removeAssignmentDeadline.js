function createRemoveDeadlineHandler(pool,deadlines,held){
 return async(req,res)=>{
  const assignmentId=Number(req.params.assignmentId);
  if(!Number.isInteger(assignmentId)||assignmentId<1)return res.status(400).json({error:'Choose a valid assignment.'});
  let client;
  try{
   const access=await pool.query(`SELECT a.id FROM assignments a JOIN courses c ON c.id=a.class_id WHERE a.id=$1 AND ($2='admin' OR a.teacher_id=$3 OR c.teacher_id=$3 OR EXISTS(SELECT 1 FROM course_teachers ct WHERE ct.course_id IN(c.id,COALESCE(c.master_course_id,c.id)) AND ct.teacher_id=$3))`,[assignmentId,req.user.role,req.user.id]);
   if(!access.rows.length)return res.status(403).json({error:'You cannot change this assignment.'});
   await deadlines.ensure();await held.ensure();
   client=await pool.connect();await client.query('BEGIN');
   // Serialize a deadline removal with uploads entering the held-work path.
   await client.query('SELECT pg_advisory_xact_lock($1::INTEGER,0)',[assignmentId]);
   const updated=await client.query('UPDATE assignments SET due_date=NULL,updated_at=NOW() WHERE id=$1 RETURNING id,due_date',[assignmentId]);
   if(!updated.rows.length)throw Error('Assignment no longer exists.');
   const students=await client.query(`SELECT DISTINCT h.student_id FROM assignment_held_work h
    WHERE h.assignment_id=$1 AND h.approved_at IS NULL AND h.declined_at IS NULL
    AND NOT EXISTS(SELECT 1 FROM assignment_submission_declines d WHERE d.assignment_id=h.assignment_id AND d.student_id=h.student_id AND d.resolved_at IS NULL)
    ORDER BY h.student_id`,[assignmentId]);
   let released=0;
   for(const row of students.rows){await held.lock(client,assignmentId,row.student_id);if(!await deadlines.activeDecline(assignmentId,row.student_id,client))released+=await held.promote(client,assignmentId,row.student_id,null);}
   await client.query('COMMIT');return res.json({...updated.rows[0],released,accepts_without_late_approval:true});
  }catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});console.error('Remove assignment deadline:',error.message);return res.status(500).json({error:'Could not save No Due Date. Please retry.'});}finally{client?.release()}
 };
}
module.exports={createRemoveDeadlineHandler};
