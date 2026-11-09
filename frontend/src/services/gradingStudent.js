export function findGradingStudent(rows, studentId, email) {
  if (studentId) return rows.find(row => String(row.student_user_id) === String(studentId)) || null;
  const normalized = String(email || '').trim().toLowerCase();
  return normalized ? rows.find(row => String(row.student_email || '').trim().toLowerCase() === normalized) || null : null;
}

// Use roster order, skipping missing work when a submission is required.
export function firstStudentAwaitingGrade(rows, assignment) {
  return rows.find(row =>
    (assignment?.submission_required === false || row.submission_status === 'Submitted') &&
    (row.score === null || row.score === undefined || row.score === '') &&
    !String(row.grade || '').trim() && row.rubric_selection == null
  ) || rows[0] || null;
}
