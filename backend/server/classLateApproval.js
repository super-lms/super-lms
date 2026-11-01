const {loadGradingRoster} = require('./gradingRoster');
function createClassLateApprovalHandler(pool, deadlines, held, rosterLoader = loadGradingRoster) {
  return async (req, res) => {
    let client;
    try {
      const assignmentId = Number(req.params.assignmentId);
      const sectionId = Number(req.body.sectionId);
      if (!Number.isSafeInteger(assignmentId) || assignmentId <= 0 || !Number.isSafeInteger(sectionId) || sectionId <= 0)
        return res.status(400).json({error:'Choose one class section before approving the whole class.'});
      if (typeof req.body.enabled !== 'boolean') return res.status(400).json({error:'Choose approve or revoke.'});
      await deadlines.ensure(); await held.ensure();
      client = await pool.connect();
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1::INTEGER,0)',[assignmentId]);
      const result = await client.query(`SELECT a.id,a.class_id,a.cohort_id,a.submission_required FROM assignments a
        JOIN courses c ON c.id=a.class_id WHERE a.id=$1
        AND ($2='admin' OR a.teacher_id=$3 OR c.teacher_id=$3
          OR EXISTS(SELECT 1 FROM course_teachers ct WHERE ct.course_id IN(c.id,COALESCE(c.master_course_id,c.id)) AND ct.teacher_id=$3)
          OR EXISTS(SELECT 1 FROM courses section WHERE section.id=$4 AND COALESCE(section.master_course_id,section.id)=c.id
            AND (section.teacher_id=$3 OR EXISTS(SELECT 1 FROM course_teachers ct WHERE ct.course_id=section.id AND ct.teacher_id=$3))))
        FOR SHARE OF a`, [assignmentId,req.user.role,req.user.id,sectionId]);
      const assignment=result.rows[0];
      if (!assignment) throw Object.assign(Error('Assignment unavailable.'),{status:403});
      if (assignment.submission_required === false) throw Object.assign(Error('This assignment does not require student submissions.'),{status:400});
      const roster=await rosterLoader(client,assignment.class_id,String(sectionId),assignment.cohort_id);
      const ids=[...new Set(roster.students.map(s=>Number(s.student_user_id)))].sort((a,b)=>a-b);
      if (!ids.length) throw Object.assign(Error('There are no enrolled students in this class.'),{status:400});
      // Serialize with deadline changes and in-flight uploads, then lock students
      // in a stable order so bulk and individual decisions cannot interleave.
      let approved=0,promoted=0,skippedDeclined=0;
      for (const studentId of ids) {
        await held.lock(client,assignmentId,studentId);
        if (req.body.enabled && await deadlines.activeDecline(assignmentId,studentId,client)) { skippedDeclined++; continue; }
        const permission=await client.query('INSERT INTO assignment_late_permissions(assignment_id,student_id,teacher_id,enabled) VALUES($1,$2,$3,$4) RETURNING id',[assignmentId,studentId,req.user.id,req.body.enabled]);
        if (req.body.enabled) promoted+=await held.promote(client,assignmentId,studentId,permission.rows[0].id);
        approved++;
      }
      await client.query('COMMIT');
      return res.json({enabled:req.body.enabled,students:approved,promoted,skipped_declined:skippedDeclined,sectionId});
    } catch(error) {
      if(client) await client.query('ROLLBACK').catch(()=>{});
      console.error('Class late approval:',error.message);
      return res.status(error.status||500).json({error:error.status?error.message:'Class approval could not be saved. No changes were applied.'});
    } finally { client?.release(); }
  };
}
module.exports={createClassLateApprovalHandler};
