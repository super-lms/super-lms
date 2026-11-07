import test from "node:test"
import assert from "node:assert/strict"
import { loadStudentCourses, loadStudentProgressData } from "./studentPortalData.js"

test("progress uses only student-scoped reads and preserves section assignment identity and scores", async () => {
  const calls = []
  const payloads = {
    "/api/students/student%40example.invalid/classes": [{ id: 12 }, { id: 13 }],
    "/api/students/student%40example.invalid/courses/12/dashboard": {
      assignments: [{ id: 5, class_id: 1 }],
      submissionStatesByAssignmentId: { 5: { submission_status: "submitted", submission: { score: 0 } } },
    },
    "/api/students/student%40example.invalid/courses/13/dashboard": {
      assignments: [{ id: 6, class_id: 2 }],
      submissionStatesByAssignmentId: { 6: { submission_status: "awaiting_approval", submission: { score: null } } },
    },
  }
  const result = await loadStudentProgressData(async path => {
    calls.push(path)
    assert.ok(Object.hasOwn(payloads, path), path)
    return { ok: true, json: async () => payloads[path] }
  }, " Student@Example.invalid ")
  assert.equal(calls.length, 3)
  assert.deepEqual(result.assignments.map(a => [a.class_id, a.progress_course_id]), [[1, 12], [2, 13]])
  assert.equal(result.submissionStates[5].submission.score, 0)
  assert.equal(result.submissionStates[6].submission.score, null)
  assert.equal(result.submissionStates[6].submission_status, "awaiting_approval")
})

test("access errors and incomplete responses are errors, not empty course lists or zero progress", async () => {
  await assert.rejects(loadStudentCourses(async () => ({ ok: false }), "s@example.invalid"), /Could not load/)
  await assert.rejects(loadStudentCourses(async () => ({ ok: true, json: async () => ({ error: "failed" }) }), "s@example.invalid"), /incomplete/)
  await assert.rejects(loadStudentProgressData(async path => ({ ok: true, json: async () => path.endsWith("/classes") ? [{ id: 12 }] : { assignments: [] } }), "s@example.invalid"), /incomplete/)
})

test("no enrollment is a valid empty result and does not request a dashboard", async () => {
  let calls = 0
  const result = await loadStudentProgressData(async () => {
    calls++
    return { ok: true, json: async () => [] }
  }, "s@example.invalid")
  assert.equal(calls, 1)
  assert.deepEqual(result, { courses: [], assignments: [], submissionStates: {} })
})

test("dashboard concurrency stays bounded for a full timetable", async () => {
  let active = 0, maximum = 0
  await loadStudentProgressData(async path => {
    if (path.endsWith("/classes")) return { ok: true, json: async () => Array.from({ length: 11 }, (_, id) => ({ id })) }
    maximum = Math.max(maximum, ++active)
    await new Promise(resolve => setTimeout(resolve, 1))
    active--
    return { ok: true, json: async () => ({ assignments: [], submissionStatesByAssignmentId: {} }) }
  }, "s@example.invalid")
  assert.ok(maximum <= 4)
})
