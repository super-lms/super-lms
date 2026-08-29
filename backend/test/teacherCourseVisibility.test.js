const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeCourseTitle,
  shouldShowCourseForTeacher,
} = require("../server/teacherCourseVisibility");

test("normalizes punctuation and spacing in course titles", () => {
  assert.equal(normalizeCourseTitle("Pre-Calculus 11 A"), "precalculus11a");
  assert.equal(normalizeCourseTitle("Fitness & Conditioning 11/12A"), "fitnessandconditioning1112a");
});

test("Harry sees only the spreadsheet-authorized lettered courses", () => {
  assert.equal(shouldShowCourseForTeacher({
    email: "harryfeng@cbcschools.ca",
    teacherId: 20,
    course: { title: "Pre-Calculus 11A", teacher_id: 20 },
  }), true);
  assert.equal(shouldShowCourseForTeacher({
    email: "harryfeng@cbcschools.ca",
    teacherId: 20,
    course: { title: "Pre-Calculus 11", teacher_id: 20 },
  }), false);
  assert.equal(shouldShowCourseForTeacher({
    email: "harryfeng@cbcschools.ca",
    teacherId: 20,
    course: { title: "Summer Session Spoken Language 10 Upgrade", teacher_id: 20 },
  }), false);
});

test("Jennifer keeps the worked-on ELSL course but not the old test course", () => {
  assert.equal(shouldShowCourseForTeacher({
    email: "jenniferboyd@cbcschools.ca",
    teacherId: 30,
    course: { title: "ELSL 11 - English First Peoples’ Literary Analysis and Spoken Language", teacher_id: 30 },
  }), true);
  assert.equal(shouldShowCourseForTeacher({
    email: "jenniferboyd@cbcschools.ca",
    teacherId: 30,
    course: { title: "ELSL11 - sem 1 2026-27", teacher_id: 30 },
  }), false);
});

test("Michael sees only Drama, Spoken Language, and New Media 10", () => {
  assert.equal(shouldShowCourseForTeacher({
    email: "michaelsamuels@cbcschools.ca",
    teacherId: 40,
    course: { title: "Drama 10D", teacher_id: 99 },
  }), true);
  assert.equal(shouldShowCourseForTeacher({
    email: "michaelsamuels@cbcschools.ca",
    teacherId: 40,
    course: { title: "English Studies 12", teacher_id: 40 },
  }), false);
});

test("Academic Planning remains visible only to its current assigned teacher", () => {
  assert.equal(shouldShowCourseForTeacher({
    email: "davidbrecht@cbcschools.ca",
    teacherId: 50,
    course: { title: "Academic Planning 12A", teacher_id: 50 },
  }), true);
  assert.equal(shouldShowCourseForTeacher({
    email: "davidbrecht@cbcschools.ca",
    teacherId: 50,
    course: { title: "Academic Planning 12A", teacher_id: 51 },
  }), false);
});

test("accepts timetable abbreviations for spreadsheet-authorized courses", () => {
  assert.equal(shouldShowCourseForTeacher({
    email: "harryfeng@cbcschools.ca",
    teacherId: 20,
    course: { title: "Pre-calc 11B", teacher_id: 20 },
  }), true);
  assert.equal(shouldShowCourseForTeacher({
    email: "davidvainer@cbcschools.ca",
    teacherId: 21,
    course: { title: "Chem 12C", teacher_id: 21 },
  }), true);
  assert.equal(shouldShowCourseForTeacher({
    email: "nicolinevanderwatt@cbcschools.ca",
    teacherId: 22,
    course: { title: "Physical Geography 11A", teacher_id: 22 },
  }), true);
});
