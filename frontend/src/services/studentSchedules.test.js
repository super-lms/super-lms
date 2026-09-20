import test from "node:test"
import assert from "node:assert/strict"
import { scheduledCoursesForStudent } from "./studentSchedules.js"

test("12C printing preserves configured Chemistry and CLC blocks", () => {
  const courses = new Map([
    [1, { id: 1, title: "Chemistry 12C", semester: "semester1", block_key: "block4", room: "505" }],
    [2, { id: 2, title: "CLC 12C", semester: "semester1", block_key: "block1", room: "201" }],
    [3, { id: 3, title: "Physics 12C", semester: "semester1", block_key: "block2" }],
  ])
  const result = scheduledCoursesForStudent({ cohort: "12C", courseIds: [1, 2, 1] }, courses, "semester1")
  assert.deepEqual(result, [courses.get(1), courses.get(2)])
  assert.equal(result.find((c) => c.block_key === "block1").title, "CLC 12C")
  assert.equal(result.find((c) => c.block_key === "block4").title, "Chemistry 12C")
  assert.equal(result.some((c) => c.id === 3), false)
})

test("all cohorts honor term changes and retain enrolled full-year courses", () => {
  const courses = new Map([
    [1, { id: 1, title: "Academic Planning 12C", semester: "semester1", block_key: "block2" }],
    [2, { id: 2, semester: "semester2", block_key: "block3" }],
    [3, { id: 3, semester: "full_year", block_key: "after_school" }],
  ])
  for (const cohort of ["12A", "12B", "12C", "11A", "10D"]) {
    const student = { cohort, courseIds: [1, 2, 3, 999] }
    assert.deepEqual(scheduledCoursesForStudent(student, courses, "semester1"), [courses.get(1), courses.get(3)])
    assert.deepEqual(scheduledCoursesForStudent(student, courses, "semester2"), [courses.get(2), courses.get(3)])
  }
})
