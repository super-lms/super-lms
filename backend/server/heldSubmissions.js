const {DECLINED_MESSAGE,pastDue}=require('./submissionDeadline');
// Late work stays outside submissions/gradebook until a teacher approves it.
function createHeldSubmissions(pool, deadlines, ensureAttachments) {
  let ready;
  async function ensure() {
    await deadlines.ensure();
    if (!ready) ready = pool.query(`CREATE TABLE IF NOT EXISTS assignment_held_work (
      id SERIAL PRIMARY KEY, assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES users(id), student_email TEXT NOT NULL, student_name TEXT NOT NULL,
      due_at TIMESTAMPTZ NOT NULL, method TEXT NOT NULL CHECK(method IN ('text','attachment')),
      content TEXT, original_name TEXT, stored_name TEXT, mime_type TEXT, size_bytes INTEGER, file_data BYTEA,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), approved_at TIMESTAMPTZ,
      submission_id INTEGER REFERENCES submissions(id) ON DELETE SET NULL);
      ALTER TABLE assignment_held_work ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;
      CREATE INDEX IF NOT EXISTS assignment_held_work_pending ON assignment_held_work(assignment_id,student_id) WHERE approved_at IS NULL;`)
      .catch(error => { ready = null; throw error; });
    await ready;
  }
  async function lock(client, assignmentId, studentId) {
    await client.query('SELECT pg_advisory_xact_lock($1::INTEGER,$2::INTEGER)', [assignmentId, studentId]);
  }
  async function pending(assignmentId, studentId, client = pool) {
    await ensure();
    const result = await client.query(`SELECT id,method,content,original_name,mime_type,size_bytes,received_at,due_at
      FROM assignment_held_work WHERE assignment_id=$1 AND student_id=$2 AND approved_at IS NULL AND declined_at IS NULL ORDER BY id`, [assignmentId, studentId]);
    return result.rows;
  }
  // Caller holds the per-student lock. Approval and promotion commit together.
  async function promote(client, assignmentId, studentId, permissionId) {
    const held = await client.query(`SELECT * FROM assignment_held_work
      WHERE assignment_id=$1 AND student_id=$2 AND approved_at IS NULL AND declined_at IS NULL ORDER BY id FOR UPDATE`, [assignmentId, studentId]);
    if (!held.rows.length) return 0;
    await ensureAttachments();
    const first = held.rows[0];
    const existing = await client.query(`SELECT id FROM submissions WHERE assignment_id=$1
      AND (student_id=$2 OR LOWER(student_email)=$3) ORDER BY id LIMIT 1 FOR UPDATE`, [assignmentId, studentId, first.student_email]);
    let submissionId = existing.rows[0]?.id;
    if (!submissionId) {
      const inserted = await client.query(`INSERT INTO submissions
        (assignment_id,student_id,teacher_id,course_id,assignment_title,student_name,student_email,
         original_file_name,stored_file_name,file_path,content,feedback)
        SELECT a.id,$2,a.teacher_id,a.class_id,a.title,$3,$4,'student-text-submission.txt',
         'student-text-submission.txt','student-text-submission.txt','','' FROM assignments a WHERE a.id=$1 RETURNING id`,
      [assignmentId, studentId, first.student_name, first.student_email]);
      submissionId = inserted.rows[0].id;
    }
    for (const item of held.rows) {
      if (item.method === 'text') {
        await client.query('UPDATE submissions SET content=$1 WHERE id=$2', [item.content, submissionId]);
      } else {
        await client.query(`INSERT INTO submission_attachments
          (submission_id,assignment_id,student_email,original_name,stored_name,file_path,mime_type,size_bytes,file_data,created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [submissionId, assignmentId, item.student_email,
          item.original_name, item.stored_name, `/uploads/${item.stored_name}`, item.mime_type, item.size_bytes, item.file_data, item.received_at]);
      }
      await deadlines.record({late:true,due:item.due_at,permission_id:permissionId}, assignmentId, studentId, submissionId, item.method, client);
      // Keep the receipt/audit metadata, but don't duplicate file bytes after promotion.
      await client.query('UPDATE assignment_held_work SET approved_at=NOW(),submission_id=$1,file_data=NULL WHERE id=$2', [submissionId, item.id]);
    }
    return held.rows.length;
  }
  async function hold({assignmentId, studentId, studentEmail, studentName, state, content, file}) {
    await ensure();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1::INTEGER,0)', [assignmentId]);
      await lock(client, assignmentId, studentId);
      if(await deadlines.activeDecline(assignmentId,studentId,client))throw Object.assign(Error(DECLINED_MESSAGE),{status:403,code:'SUBMISSION_DECLINED'});
      // Keep the newest held text; files accumulate, just as normal attachments do.
      if (!file) await client.query(`DELETE FROM assignment_held_work WHERE assignment_id=$1 AND student_id=$2
        AND approved_at IS NULL AND declined_at IS NULL AND method='text'`, [assignmentId, studentId]);
      await client.query(`INSERT INTO assignment_held_work
        (assignment_id,student_id,student_email,student_name,due_at,method,content,original_name,stored_name,mime_type,size_bytes,file_data)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [assignmentId, studentId, studentEmail, studentName, state.due,
        file ? 'attachment' : 'text', file ? null : content, file?.originalname, file?.filename, file?.mimetype, file?.size, file?.data]);
      await deadlines.notifyBlocked(assignmentId, studentId, client);
      // A teacher may have approved while an upload was in flight.
      const permission = await client.query(`SELECT id,enabled FROM assignment_late_permissions
        WHERE assignment_id=$1 AND student_id=$2 ORDER BY id DESC LIMIT 1`, [assignmentId, studentId]);
      const currentDeadline = await client.query('SELECT due_date FROM assignments WHERE id=$1', [assignmentId]);
      if (!currentDeadline.rows.length) throw Object.assign(Error('Assignment not found'), {status:404});
      const stillPastDue = pastDue(currentDeadline.rows[0].due_date);
      const approved = !stillPastDue || permission.rows[0]?.enabled === true;
      if (approved) await promote(client, assignmentId, studentId, permission.rows[0]?.id || null);
      const heldWork = approved ? [] : await pending(assignmentId, studentId, client);
      await client.query('COMMIT');
      return {held_work:heldWork,success:true,pending_approval:!approved,accepted_past_due:approved && stillPastDue,
        submission_status:approved ? 'submitted' : 'awaiting_approval',submission:{content:content || ''}};
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
  async function forCourse(courseId, studentEmail) {
    await ensure();
    const result = await pool.query(`SELECT h.assignment_id,h.id,h.method,h.content,h.original_name,h.received_at
      FROM assignment_held_work h JOIN assignments a ON a.id=h.assignment_id
      WHERE a.class_id=$1 AND h.student_email=$2 AND h.approved_at IS NULL AND h.declined_at IS NULL ORDER BY h.id`, [courseId, studentEmail]);
    return result.rows;
  }
  async function gradeMiddleware(req,res,next) {
    try {
      await ensure();
      const declined = await pool.query(`SELECT 1 FROM assignment_submission_declines WHERE assignment_id=$1 AND resolved_at IS NULL
        AND (student_id=$2 OR student_id=(SELECT id FROM users WHERE LOWER(email)=$3 LIMIT 1)) LIMIT 1`,[Number(req.params.assignmentId),Number(req.body.student_user_id)||null,String(req.body.student_email||'').trim().toLowerCase()]);
      if(declined.rows.length)return res.status(409).json({code:'SUBMISSION_DECLINED',error:'This submission was declined. Speak with the student and approve it before marking.'});
      const result=await pool.query(`SELECT 1 FROM assignment_held_work WHERE assignment_id=$1 AND approved_at IS NULL AND declined_at IS NULL
        AND (student_id=$2 OR student_email=$3) LIMIT 1`, [Number(req.params.assignmentId),
        Number(req.body.student_user_id)||null, String(req.body.student_email||'').trim().toLowerCase()]);
      if(result.rows.length)return res.status(409).json({code:'AWAITING_APPROVAL',error:'Approve the held late submission before marking this student.'});
      next();
    } catch(error) { res.status(500).json({error:'Unable to check held submissions. Please try again.'}); }
  }
  return {ensure, lock, pending, promote, hold, forCourse, gradeMiddleware};
}
module.exports = {createHeldSubmissions};
