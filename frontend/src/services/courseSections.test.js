import test from "node:test"
import assert from "node:assert/strict"
import { getCourseSectionIdentity, groupCoursesByMaster } from "./courseSections.js"

test("normalizes approved section names without converting single offerings", () => {
  assert.equal(getCourseSectionIdentity({ title: "EFP 12 c" }).normalizedTitle, "EFP 12C")
  for (const title of [
    "Accounting 12",
    "Anatomy and Physiology 12A",
    "Marketing and Promotion 11A",
    "Economic Theory 12",
  ]) {
    assert.equal(getCourseSectionIdentity({ title }).isMultiSection, false, title)
  }
})

test("groups sections and honors the backend content-course relationship", () => {
  const groups = groupCoursesByMaster([
    { id: 20, title: "EFP 12B", master_title: "EFP 12", section_code: "B", content_course_id: 10 },
    { id: 10, title: "EFP 12A", master_title: "EFP 12", section_code: "A", content_course_id: 10 },
    { id: 30, title: "Accounting 12" },
  ])
  const efp = groups.find((group) => group.masterTitle === "EFP 12")
  assert.deepEqual(efp.sections.map((section) => section.id), [10, 20])
  assert.equal(efp.contentCourse.id, 10)
  assert.equal(groups.find((group) => group.masterTitle === "Accounting 12").isMultiSection, false)
})

test("collapses every approved core-course section group into one admin workspace", () => {
  const approvedGroups = [
    ["Accounting 11", ["A", "B", "C"]],
    ["Chemistry 12", ["A", "B", "C"]],
    ["Composition 10", ["A", "B", "C", "D"]],
    ["EFP 12", ["A", "B", "C"]],
    ["Fitness and Conditioning 11/12", ["A", "B"]],
    ["Social Studies 10", ["A", "B", "C", "D"]],
  ]
  const courses = approvedGroups.flatMap(([master, sectionCodes], groupIndex) =>
    sectionCodes.map((sectionCode, sectionIndex) => ({
      id: groupIndex * 10 + sectionIndex + 1,
      title: `${master}${sectionCode}`,
    }))
  )

  const groups = groupCoursesByMaster(courses)
  assert.equal(groups.length, approvedGroups.length)
  for (const [master, sectionCodes] of approvedGroups) {
    const group = groups.find((candidate) => candidate.masterTitle === master)
    assert.ok(group, master)
    assert.equal(group.isMultiSection, true)
    assert.deepEqual(group.sections.map((section) => section.section_code), sectionCodes)
    assert.equal(group.contentCourse.section_code, "A")
  }
})
