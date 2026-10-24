function normalized(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase().trim().replace(/\s+/g, ' ')
}
export function lookupStudents(students, courses, query) {
  const tokens = normalized(query).split(' ').filter(Boolean)
  if (!tokens.length) return []
  const courseById = new Map(courses.map(course => [String(course.id), course]))
  const matches = new Map()
  for (const student of students) {
    const name = student.name || [student.first_name, student.last_name].filter(Boolean).join(' ') || student.email
    const searchable = normalized([name, student.email].filter(Boolean).join(' '))
    if (!tokens.every(token => searchable.includes(token))) continue
    const classId = String(student.class_id || '')
    if (!/^\d+$/.test(classId)) continue
    const course = courseById.get(classId)
    const courseTitle = student.class_name || course?.normalized_title || course?.title || course?.class_name || `Class ${classId}`
    const key = `${student.id || normalized(student.email)}:${classId}`
    matches.set(key, { id:student.id, name, email:student.email, classId, courseTitle })
  }
  return [...matches.values()].sort((a,b) => a.name.localeCompare(b.name) || a.courseTitle.localeCompare(b.courseTitle))
}
export function quickLookupGradebookPath(student) {
  const query = new URLSearchParams({classId:String(student.classId),studentEmail:student.email || '',studentName:student.name || '',source:'quick-lookup',returnTo:'dashboard'})
  if (student.id) query.set('studentId',String(student.id))
  return `/gradebook?${query}`
}
export function lookupStudentMatches(student, id, email) {
  if (id) return String(student.student_user_id) === String(id)
  return Boolean(email && normalized(student.student_email) === normalized(email))
}
