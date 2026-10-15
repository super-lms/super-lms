export function findGradingStudent(rows, studentId, email) {
  if (studentId) return rows.find(row => String(row.student_user_id) === String(studentId)) || null;
  const normalized = String(email || '').trim().toLowerCase();
  return normalized ? rows.find(row => String(row.student_email || '').trim().toLowerCase() === normalized) || null : null;
}
