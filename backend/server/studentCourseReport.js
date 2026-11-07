// A student-specific entry point for the existing report generator.
// Teacher reporting permissions and grade calculations remain unchanged.
function createStudentReportHandler({ pool, generateReport }) {
  return async function studentCourseReport(req, res) {
    const email = String(req.user?.email || '').trim().toLowerCase();
    const requestedEmail = String(req.params.studentEmail || '').trim().toLowerCase();
    const studentId = Number(req.user?.id);
    const courseId = Number(req.params.courseId);
    if (req.user?.role !== 'student' || !email || email !== requestedEmail || !Number.isSafeInteger(studentId) || studentId <= 0) {
      return res.status(403).json({ error: 'Students may only open their own reports.' });
    }
    if (!Number.isSafeInteger(courseId) || courseId <= 0) {
      return res.status(400).json({ error: 'A valid course is required.' });
    }
    try {
      const enrolled = await pool.query(
        `SELECT 1 FROM class_enrollments ce
         JOIN courses c ON c.id = ce.class_id
         WHERE ce.student_user_id = $1 AND ce.class_id = $2 AND c.is_live = TRUE
         LIMIT 1`,
        [studentId, courseId]
      );
      if (!enrolled.rows.length) {
        return res.status(403).json({ error: 'This course is not available to your account.' });
      }
      // Never trust identity or class-wide scope supplied in the query string.
      req.studentReportUserId = studentId;
      req.studentReportFilters = {
        studentEmail: email,
        studentName: '',
        reportScope: 'student',
        categoryName: '',
        levelName: '',
      };
      return await generateReport(req, res);
    } catch (error) {
      console.error('Student course report failed:', error.message);
      return res.status(500).json({ error: 'Could not load your report. Please try again.' });
    }
  };
}

module.exports = { createStudentReportHandler };
