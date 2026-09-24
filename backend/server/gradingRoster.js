// Resolve only the assignment's own course and its linked sections.
async function loadGradingRoster(pool, contentCourseId, sectionId) {
  const allSections = sectionId === "all";
  const rosterCourseId = allSections ? null : Number(sectionId || contentCourseId);
  if (!allSections && (!Number.isInteger(rosterCourseId) || rosterCourseId <= 0)) {
    throw Object.assign(new Error("Valid sectionId is required"), { status: 400 });
  }
  const sections = await pool.query(
    `SELECT id, title FROM courses
     WHERE COALESCE(master_course_id, id) = $1
       AND ($2::INTEGER IS NULL OR id = $2)
     ORDER BY title, id`,
    [contentCourseId, rosterCourseId]
  );
  if (!sections.rows.length) {
    throw Object.assign(new Error("Selected section does not belong to this assignment's course"), { status: 400 });
  }
  const students = await pool.query(
    `SELECT ce.student_user_id, STRING_AGG(DISTINCT c.title, ', ' ORDER BY c.title) AS section_title
     FROM class_enrollments ce
     JOIN courses c ON c.id = ce.class_id
     WHERE ce.class_id = ANY($1::INTEGER[])
     GROUP BY ce.student_user_id`,
    [sections.rows.map(section => section.id)]
  );
  return { sectionId: allSections ? "all" : rosterCourseId, students: students.rows };
}
module.exports = { loadGradingRoster };
