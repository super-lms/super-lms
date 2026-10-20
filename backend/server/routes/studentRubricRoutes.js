function createStudentRubricHandler({ pool, studentHasLiveCourseAccess, assignmentIsAvailableToStudents }) {
  return async (req, res) => {
    const assignmentId = Number(req.params.assignmentId);
    if (!Number.isSafeInteger(assignmentId) || assignmentId <= 0) {
      return res.status(400).json({ error: "Valid assignment id is required" });
    }
    try {
      const assignmentResult = await pool.query(
        "SELECT id, class_id, cohort_id, is_published, available_from FROM assignments WHERE id = $1",
        [assignmentId]
      );
      const assignment = assignmentResult.rows[0];
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      if (!assignmentIsAvailableToStudents(assignment) ||
          !await studentHasLiveCourseAccess(req.user.id, assignment.class_id, assignment.cohort_id)) {
        return res.status(403).json({ error: "This assignment is not available to you" });
      }
      const result = await pool.query(
        "SELECT title, level_count, criteria_json FROM teacher_designed_rubrics WHERE assignment_id = $1",
        [assignmentId]
      );
      return res.json({ rubric: result.rows[0] || null });
    } catch (error) {
      console.error("Student rubric retrieval failed:", error);
      return res.status(500).json({ error: "Unable to load the assignment rubric" });
    }
  };
}
module.exports = { createStudentRubricHandler };
