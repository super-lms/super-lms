// class_id remains the shared content course; cohort_id limits the audience.
async function ensureAssignmentCohorts(pool) {
  await pool.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS cohort_id INTEGER REFERENCES courses(id) ON DELETE RESTRICT`);
  await pool.query(`CREATE INDEX IF NOT EXISTS assignments_cohort_idx ON assignments(cohort_id)`);
}
async function resolveAssignmentCohort(pool, contentCourseId, requestedCourseId, body) {
  const explicit = Object.prototype.hasOwnProperty.call(body, 'cohort_id');
  const cohortId = explicit ? body.cohort_id : (Number(requestedCourseId) === Number(contentCourseId) ? null : requestedCourseId);
  if (cohortId === null) return null;
  if (!Number.isSafeInteger(Number(cohortId)) || Number(cohortId) <= 0) {
    throw Object.assign(new Error('Choose a valid cohort or All cohorts.'), { status: 400 });
  }
  const result = await pool.query('SELECT id FROM courses WHERE id=$1 AND COALESCE(master_course_id,id)=$2', [Number(cohortId), Number(contentCourseId)]);
  if (!result.rows.length) throw Object.assign(new Error('The selected cohort does not belong to this course.'), { status: 400 });
  return Number(cohortId);
}
function cohortGradingMiddleware(pool) {
  return async (req,res,next) => {
    try {
      const result=await pool.query(`SELECT a.cohort_id FROM assignments a WHERE a.id=$1`,[Number(req.params.assignmentId)]);
      const cohortId=result.rows[0]?.cohort_id;
      if(!cohortId)return next();
      const member=await pool.query(`SELECT 1 FROM class_enrollments ce JOIN users u ON u.id=ce.student_user_id
        WHERE ce.class_id=$1 AND (u.id=$2 OR LOWER(u.email)=$3) LIMIT 1`,
        [cohortId,Number(req.body.student_user_id || req.body.student_id)||null,String(req.body.student_email||'').trim().toLowerCase()]);
      if(!member.rows.length)return res.status(403).json({error:'This student is not enrolled in the assignment cohort.'});
      return next();
    }catch(error){console.error('Assignment cohort grading:',error);return res.status(500).json({error:'Could not check assignment cohort.'});}
  };
}
module.exports = { ensureAssignmentCohorts, resolveAssignmentCohort, cohortGradingMiddleware };
