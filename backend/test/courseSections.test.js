const test = require("node:test");
const assert = require("node:assert/strict");
const {
  APPROVED_MULTI_SECTION_COURSES,
  getApprovedSectionIdentity,
  ensureCourseSectionStructure,
  resolveContentCourseId,
} = require("../server/courseSections");

class FakePool {
  constructor() {
    this.courses = [
      { id: 10, title: "EFP 12 A", course_name: "EFP 12 A", teacher_id: 1 },
      { id: 20, title: "EFP 12B", course_name: "EFP 12B", teacher_id: 2 },
      { id: 30, title: "Accounting 12", course_name: "Accounting 12", teacher_id: 1 },
      { id: 40, title: "Anatomy and Physiology 12A", course_name: "Anatomy and Physiology 12A", teacher_id: 1 },
    ];
    this.courseTeachers = [];
    this.tables = Object.fromEntries(
      ["lessons", "assignments", "course_categories", "learning_paths", "assessments", "assessment_question_banks", "submissions"]
        .map((table) => [table, [{ id: 1, [table === "assignments" ? "class_id" : "course_id"]: 20 }]])
    );
    this.enrollments = [{ class_id: 20 }];
    this.attendance = [{ course_id: 20 }];
  }

  async connect() { return this; }
  release() {}

  async query(sql, params = []) {
    const normalized = String(sql).replace(/\s+/g, " ").trim();
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(normalized)) return { rows: [] };
    if (normalized.startsWith("ALTER TABLE courses") || normalized.startsWith("ALTER TABLE course_teachers") || normalized.startsWith("CREATE INDEX") || normalized.startsWith("CREATE TABLE")) return { rows: [] };
    if (normalized.startsWith("SELECT id, title, teacher_id FROM courses")) return { rows: this.courses.map((row) => ({ ...row })) };
    if (normalized.startsWith("INSERT INTO course_teachers")) {
      const [course_id, teacher_id] = params;
      if (!this.courseTeachers.some((row) => row.course_id === course_id && row.teacher_id === teacher_id)) {
        this.courseTeachers.push({ course_id, teacher_id, role: "co-teacher" });
      }
      return { rows: [] };
    }
    if (normalized.startsWith("UPDATE courses SET title")) {
      const [title, master_title, section_code, master_course_id, id] = params;
      Object.assign(this.courses.find((row) => row.id === id), { title, course_name: title, master_title, section_code, master_course_id });
      return { rows: [] };
    }
    const contentUpdate = normalized.match(/^UPDATE ([a-z_]+) SET ([a-z_]+) = \$1/);
    if (contentUpdate) {
      const [, table, column] = contentUpdate;
      for (const row of this.tables[table]) {
        if (params[1].includes(row[column]) && row[column] !== params[0]) row[column] = params[0];
      }
      return { rows: [] };
    }
    if (normalized.startsWith("SELECT COALESCE(master_course_id, id) AS content_course_id")) {
      const course = this.courses.find((row) => row.id === params[0]);
      return { rows: course ? [{ content_course_id: course.master_course_id || course.id }] : [] };
    }
    throw new Error(`Unexpected SQL in test: ${normalized}`);
  }
}

test("recognizes only approved multi-section course names", () => {
  assert.equal(APPROVED_MULTI_SECTION_COURSES.length, 24);
  for (const masterTitle of APPROVED_MULTI_SECTION_COURSES) {
    assert.equal(getApprovedSectionIdentity(`${masterTitle} A`).normalizedTitle, `${masterTitle}A`);
    assert.equal(getApprovedSectionIdentity(`${masterTitle}D`).sectionCode, "D");
  }
  assert.deepEqual(getApprovedSectionIdentity("EFP 12 b"), {
    masterTitle: "EFP 12", sectionCode: "B", normalizedTitle: "EFP 12B",
  });
  for (const title of ["Accounting 12", "Anatomy and Physiology 12A", "Marketing and Promotion 11A", "Economic Theory 12"]) {
    assert.equal(getApprovedSectionIdentity(title), null, title);
  }
});

test("migrates shared content, preserves section records, and is idempotent", async () => {
  const pool = new FakePool();
  await ensureCourseSectionStructure(pool);
  await ensureCourseSectionStructure(pool);
  assert.equal(pool.courses[0].title, "EFP 12A");
  assert.equal(pool.courses[0].master_course_id, null);
  assert.equal(pool.courses[1].title, "EFP 12B");
  assert.equal(pool.courses[1].master_course_id, 10);
  assert.equal(pool.courses[2].master_title, undefined);
  assert.equal(pool.courses[3].master_title, undefined);
  assert.equal(await resolveContentCourseId(pool, 20), 10);
  for (const rows of Object.values(pool.tables)) {
    const row = rows[0];
    assert.equal(row.course_id ?? row.class_id, 10);
  }
  assert.equal(pool.enrollments[0].class_id, 20);
  assert.equal(pool.attendance[0].course_id, 20);
  assert.deepEqual(pool.courseTeachers.map((row) => row.teacher_id).sort(), [1, 2]);
});
