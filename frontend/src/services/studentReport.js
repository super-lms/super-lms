export function studentReportRows(payload, email) {
  const normalizedEmail = String(email || "").trim().toLowerCase()
  if (!normalizedEmail || !Array.isArray(payload?.students)) {
    throw new Error("The report response was incomplete. Please try again.")
  }
  const students = payload.students.filter(student =>
    String(student.student_email || "").trim().toLowerCase() === normalizedEmail
  )
  if (students.length !== 1 || payload.students.length !== 1 || !Array.isArray(students[0].assignments)) {
    throw new Error("Your personal report could not be verified. Please try again.")
  }
  const student = students[0]
  return student.assignments.map(assignment => ({
    ...assignment,
    student_name: student.student_name,
    student_email: student.student_email,
    weight: assignment.calculated_weight_percent,
  }))
}

export async function loadStudentReport(request, email, courseId) {
  const normalizedEmail = String(email || "").trim().toLowerCase()
  if (!normalizedEmail || !courseId) throw new Error("Select a course first.")
  const response = await request(`/api/students/${encodeURIComponent(normalizedEmail)}/courses/${encodeURIComponent(courseId)}/report`)
  if (!response.ok) throw new Error("Could not load your report. Please try again.")
  return studentReportRows(await response.json(), normalizedEmail)
}
