// Dependencies are injected so access denial and database filtering can be verified independently.
function createObserverAttendanceHandler({ pool, getObserverStudents }) {
  return async (req, res) => {
    try {
      const observerEmail = String(req.params.observerEmail || "").trim().toLowerCase();
      const studentEmail = String(req.params.studentEmail || "").trim().toLowerCase();
      const courseId = Number(req.params.courseId);
      if (String(req.user.role).toLowerCase() !== "admin" &&
          String(req.user.email || "").trim().toLowerCase() !== observerEmail) {
        return res.status(403).json({ error: "You can only view your own linked students" });
      }
      if (!studentEmail || !Number.isInteger(courseId) || courseId <= 0) {
        return res.status(400).json({ error: "Valid student and course are required" });
      }
      const linked = await getObserverStudents(observerEmail);
      if (!linked.rows.some(row => String(row.student_email || "").trim().toLowerCase() === studentEmail && Number(row.class_id) === courseId)) {
        return res.status(403).json({ error: "This student course is not linked to this observer" });
      }
      const result = await pool.query(`
        SELECT TO_CHAR(s.attendance_date, 'YYYY-MM-DD') AS date, r.status
        FROM attendance_sessions s
        JOIN attendance_records r ON r.attendance_session_id = s.id
        WHERE s.course_id = $1 AND LOWER(r.student_email) = $2
        ORDER BY s.attendance_date DESC, r.id DESC`, [courseId, studentEmail]);
      return res.json({ records: result.rows });
    } catch (error) {
      console.error("Observer attendance failed:", error);
      return res.status(500).json({ error: "Could not load attendance records" });
    }
  };
}
module.exports = { createObserverAttendanceHandler };
