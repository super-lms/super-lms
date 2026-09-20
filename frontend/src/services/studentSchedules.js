// Printing must not replace configured blocks or infer extra enrollments.
export function scheduledCoursesForStudent(student, courseById, semester) {
  return [...new Set(student.courseIds)]
    .map((id) => courseById.get(id))
    .filter(Boolean)
    .filter((course) => course.semester === semester || course.semester === "full_year")
}
