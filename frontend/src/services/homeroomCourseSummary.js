function mark(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && value.trim() === '')) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function summarizeHomeroomCourse(data) {
  const assignments = Array.isArray(data.assignments) ? data.assignments : []
  const states = data.submissionStatesByAssignmentId || {}
  const tests = data.test_summary
  const metadataReady = tests && !tests.unavailable
  const testIds = new Set((tests?.test_assignment_ids || []).map(String))
  const completed = new Set((tests?.completed_test_assignment_ids || []).map(String))
  const required = assignments.filter(a => a.submission_required !== false && a.excused !== true && states[String(a.id)]?.submission?.rubric_selection?.excused !== true)
  const received = assignment => {
    const status = states[String(assignment.id)]?.submission_status
    return completed.has(String(assignment.id)) || status === 'submitted' || status === 'awaiting_approval'
  }
  const submitted = required.filter(received)
  const scores = submitted.map(a => mark(states[String(a.id)]?.submission?.score)).filter(value => value !== null)
  return {
    submissionAvailable: Boolean(metadataReady),
    submissionPercent: required.length ? submitted.length / required.length * 100 : null,
    submittedCount: submitted.length,
    requiredCount: required.length,
    submittedAverage: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
    markedSubmittedCount: scores.length,
    currentPercent: mark(data.gradebook?.current_percent),
    missingAssignments: metadataReady ? required.filter(a => !testIds.has(String(a.id)) && a.source_type !== 'assessment' && !received(a)).length : null,
    completedTests: metadataReady ? mark(tests.completed_tests) : null,
  }
}

// Bounded reads and per-course failures: one failed course must not become zero.
export async function loadHomeroomCourseSummaries(courses, read, limit = 3) {
  const results = Array(courses.length)
  let next = 0
  async function worker() {
    while (next < courses.length) {
      const index = next++
      try { results[index] = {course: courses[index], data: summarizeHomeroomCourse(await read(courses[index]))} }
      catch { results[index] = {course: courses[index], error: true} }
    }
  }
  await Promise.all(Array.from({length: Math.min(limit, courses.length)}, worker))
  return results
}
