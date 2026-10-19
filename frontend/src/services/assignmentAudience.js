export function assignmentsForAudience(assignments, course, sectionId, counts = []) {
  if (!course) return [];
  const contentId = course.content_course_id || course.master_course_id || course.id;
  const selectedId = sectionId || course.id;
  const countById = new Map(counts.map(row => [String(row.id), row]));
  return assignments.filter(assignment => String(assignment.class_id) === String(contentId) &&
    (selectedId === 'all' || !assignment.cohort_id || String(assignment.cohort_id) === String(selectedId)))
    .map(assignment => ({ ...assignment, submission_count: 0, graded_count: 0, ungraded_count: 0,
      ...countById.get(String(assignment.id)) }));
}
