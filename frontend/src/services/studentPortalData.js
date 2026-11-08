// These routes enforce the signed-in student's identity and course enrollment.
// Callers supply authFetch; this module never needs a school-wide roster.
export async function loadStudentCourses(request, email) {
  const normalized = String(email || "").trim().toLowerCase()
  if (!normalized) throw new Error("Student email is missing from the current session.")
  const response = await request(`/api/students/${encodeURIComponent(normalized)}/classes`)
  if (!response.ok) throw new Error("Could not load your courses. Please try again.")
  const courses = await response.json()
  if (!Array.isArray(courses)) throw new Error("The course response was incomplete. Please try again.")
  return courses
}

export async function loadStudentProgressData(request, email) {
  const courses = await loadStudentCourses(request, email)
  const assignments = []
  const submissionStates = {}
  // Bound parallel requests so a full timetable does not flood the server.
  for (let index = 0; index < courses.length; index += 4) {
    const dashboards = await Promise.all(courses.slice(index, index + 4).map(async (course) => {
      const response = await request(`/api/students/${encodeURIComponent(String(email).trim().toLowerCase())}/courses/${encodeURIComponent(course.id)}/dashboard`)
      if (!response.ok) throw new Error("Could not load course progress. Please try again.")
      const data = await response.json()
      if (!Array.isArray(data.assignments) || !data.submissionStatesByAssignmentId) {
        throw new Error("Course progress was incomplete. Please try again.")
      }
      return { course, data }
    }))
    for (const { course, data } of dashboards) {
      assignments.push(...data.assignments.map(assignment => ({ ...assignment, progress_course_id: course.id })))
      Object.assign(submissionStates, data.submissionStatesByAssignmentId)
    }
  }
  return { courses, assignments, submissionStates }
}

// Fallback reads only; preserve order and values while limiting server load.
export async function mapStudentReads(items, read) {
  const limit = 4
  const results = []
  for (let index = 0; index < items.length; index += limit) {
    results.push(...await Promise.all(items.slice(index, index + limit).map(read)))
  }
  return results
}
