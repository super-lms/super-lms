// Read-only metadata, called only after the observer/student/course link check.
async function loadObserverTestSummary(pool, {studentEmail, courseId, contentCourseId, assignmentIds}) {
  const ids = assignmentIds.map(Number).filter(Number.isInteger);
  const courses = [...new Set([Number(courseId), Number(contentCourseId)])];
  const tables = (await pool.query(`SELECT to_regclass('assessments') AS assessments,
    to_regclass('assessment_attempts') AS attempts, to_regclass('teacher_quizzes') AS quizzes,
    to_regclass('teacher_quiz_responses') AS responses`)).rows[0];
  const tests = [];
  if (tables.assessments && tables.attempts) {
    const result = await pool.query(`SELECT a.id, a.gradebook_assignment_id AS assignment_id,
      EXISTS(SELECT 1 FROM assessment_attempts at JOIN users u ON u.id=at.student_user_id
        WHERE at.assessment_id=a.id AND LOWER(u.email)=$1 AND at.status IN ('submitted','graded')) AS completed
      FROM assessments a WHERE a.gradebook_assignment_id=ANY($2::int[])
        OR (a.gradebook_assignment_id IS NULL AND a.course_id=ANY($3::int[]) AND a.status IN ('published','closed'))`,
      [studentEmail.trim().toLowerCase(), ids, courses]);
    tests.push(...result.rows);
  }
  if (tables.quizzes && tables.responses) {
    const result = await pool.query(`SELECT q.id, q.assignment_id,
      EXISTS(SELECT 1 FROM teacher_quiz_responses r JOIN users u ON u.id=r.student_user_id
        WHERE r.survey_id=q.id AND LOWER(u.email)=$1) AS completed
      FROM teacher_quizzes q WHERE q.assignment_id=ANY($2::int[])
        OR (q.assignment_id IS NULL AND COALESCE(NULLIF(to_jsonb(q)->>'delivery_course_id','')::int,q.course_id)=ANY($3::int[])
          AND q.status IN ('open','closed'))`, [studentEmail.trim().toLowerCase(), ids, courses]);
    tests.push(...result.rows);
  }
  return {
    completed_tests: tests.filter(test => test.completed).length,
    test_assignment_ids: [...new Set(tests.map(test => Number(test.assignment_id)).filter(id => ids.includes(id)))],
    completed_test_assignment_ids: [...new Set(tests.filter(test => test.completed).map(test => Number(test.assignment_id)).filter(id => ids.includes(id)))],
  };
}
module.exports = {loadObserverTestSummary};
