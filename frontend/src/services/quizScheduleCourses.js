// The root content course may also be the enrolled A section.
export function quizScheduleCourses(cohorts, courseId) {
  return cohorts.filter(c => Number(c.id) === Number(courseId) || Number(c.master_course_id) === Number(courseId));
}
