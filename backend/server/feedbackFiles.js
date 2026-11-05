const fail = (status, message) => Object.assign(new Error(message), { status });
const MAX_FEEDBACK_FILE_BYTES = 10 * 1024 * 1024;
function createFeedbackFiles(pool) {
  let ready;
  const ensure = () => ready || (ready = pool.query(`CREATE TABLE IF NOT EXISTS teacher_feedback_files (
    id SERIAL PRIMARY KEY, assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_name TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL,
    file_data BYTEA NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`).catch(error => { ready = null; throw error; }));

  async function access(user, assignmentId, target = {}) {
    if (!Number.isSafeInteger(assignmentId) || assignmentId < 1) throw fail(400, 'Choose a valid assessment.');
    const role = String(user.role || '').toLowerCase();
    if (!['admin', 'teacher', 'student'].includes(role)) throw fail(403, 'Feedback files are not available for this account.');
    const assignment = (await pool.query(`SELECT a.* FROM assignments a
      JOIN courses root ON root.id=a.class_id JOIN users actor ON actor.id=$2
      WHERE a.id=$1 AND root.school_id IS NOT DISTINCT FROM NULLIF(to_jsonb(actor)->>'school_id','')::integer`,
      [assignmentId, user.id])).rows[0];
    if (!assignment) throw fail(404, 'Assessment not available.');
    const student = (await pool.query(`SELECT id, email FROM users WHERE role='student'
      AND (($1::integer IS NOT NULL AND id=$1) OR ($1::integer IS NULL AND LOWER(email)=$2)) LIMIT 1`,
      [role === 'student' ? Number(user.id) : Number(target.studentId) || null, String(target.studentEmail || '').trim().toLowerCase()])).rows[0];
    if (!student) throw fail(404, 'Student not found.');
    const membership = await pool.query(`SELECT 1 FROM class_enrollments ce JOIN courses c ON c.id=ce.class_id
      WHERE ce.student_user_id=$1 AND COALESCE(c.master_course_id,c.id)=$2
      AND ($3::integer IS NULL OR c.id=$3)
      AND ($4 <> 'student' OR c.is_live=TRUE)
      AND ($4 <> 'teacher' OR c.teacher_id=$5
        OR EXISTS(SELECT 1 FROM courses m WHERE m.id=c.master_course_id AND m.teacher_id=$5)
        OR EXISTS(SELECT 1 FROM course_teachers ct WHERE ct.course_id IN(c.id,COALESCE(c.master_course_id,c.id)) AND ct.teacher_id=$5)) LIMIT 1`,
      [student.id, assignment.class_id, assignment.cohort_id, role, user.id]);
    if (!membership.rows.length) throw fail(403, 'This student or class is not available to you.');
    if (role === 'student' && (assignment.is_published !== true ||
      (assignment.available_from && new Date(assignment.available_from).getTime() > Date.now()))) {
      throw fail(403, 'This assessment is not available yet.');
    }
    return { assignmentId, studentId: student.id };
  }
  const metadata = 'id, original_name, size_bytes, created_at';
  async function list(user, assignmentId, target) {
    const scope = await access(user, assignmentId, target); await ensure();
    return (await pool.query(`SELECT ${metadata} FROM teacher_feedback_files WHERE assignment_id=$1 AND student_id=$2 ORDER BY id`, [scope.assignmentId, scope.studentId])).rows;
  }
  async function attach(user, assignmentId, target, file) {
    if (!['admin', 'teacher'].includes(String(user.role).toLowerCase())) throw fail(403, 'Only teachers can attach feedback.');
    const scope = await access(user, assignmentId, target);
    if (!file?.buffer?.length || file.buffer.length > MAX_FEEDBACK_FILE_BYTES) throw fail(400, 'Choose a file up to 10 MB.');
    const name = String(file.originalname || 'Feedback file').split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g, '').slice(0, 240) || 'Feedback file';
    await ensure();
    return (await pool.query(`INSERT INTO teacher_feedback_files(assignment_id,student_id,original_name,mime_type,size_bytes,file_data,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING ${metadata}`,
      [scope.assignmentId, scope.studentId, name, 'application/octet-stream', file.buffer.length, file.buffer, user.id])).rows[0];
  }
  async function download(user, id) {
    if (!Number.isSafeInteger(id) || id < 1) throw fail(400, 'Choose a valid feedback file.');
    await ensure();
    const file = (await pool.query('SELECT * FROM teacher_feedback_files WHERE id=$1', [id])).rows[0];
    if (!file) throw fail(404, 'Feedback file not found.');
    if (String(user.role).toLowerCase() === 'student' && Number(file.student_id) !== Number(user.id)) throw fail(403, 'This feedback belongs to another student.');
    await access(user, Number(file.assignment_id), { studentId: file.student_id });
    return file;
  }
  return { list, attach, download };
}
module.exports = { createFeedbackFiles, MAX_FEEDBACK_FILE_BYTES };
