import test from 'node:test'
import assert from 'node:assert/strict'
import { loadStudentReport, studentReportRows } from './studentReport.js'

const payload = { students: [{ student_email: 'me@example.invalid', student_name: '同学', assignments: [
  { assignment_id: 1, score: 0, calculated_weight_percent: 60, contribution: 0 },
  { assignment_id: 2, score: '', calculated_weight_percent: 40, contribution: 0 },
] }] }

test('personal report unwraps the server structure without recalculating marks or losing zeros and unmarked work', () => {
  const rows = studentReportRows(payload, ' Me@Example.invalid ')
  assert.deepEqual(rows.map(row => [row.score, row.weight, row.contribution]), [[0, 60, 0], ['', 40, 0]])
  assert.equal(rows[0].student_name, '同学')
})

test('reports never fall back to matching another student by name or accept class-wide data', () => {
  assert.throws(() => studentReportRows(payload, 'other@example.invalid'), /verified/)
  assert.throws(() => studentReportRows({ students: [...payload.students, { ...payload.students[0], student_email: 'other@example.invalid' }] }, 'me@example.invalid'), /verified/)
  assert.throws(() => studentReportRows({ error: 'failed' }, 'me@example.invalid'), /incomplete/)
})

test('loader uses the own-student endpoint and propagates failures', async () => {
  const rows = await loadStudentReport(async url => {
    assert.equal(url, '/api/students/me%40example.invalid/courses/12/report')
    return { ok: true, json: async () => payload }
  }, 'me@example.invalid', 12)
  assert.equal(rows.length, 2)
  await assert.rejects(loadStudentReport(async () => ({ ok: false }), 'me@example.invalid', 12), /Could not load/)
})
