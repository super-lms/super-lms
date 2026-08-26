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
    this.users = [];
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
    if (normalized.startsWith("SELECT id FROM users WHERE LOWER(email)")) {
      const user = this.users.find((row) => String(row.email).toLowerCase() === String(params[0]).toLowerCase());
      return { rows: user ? [{ id: user.id }] : [] };
    }
    if (normalized.startsWith("UPDATE courses SET teacher_id")) {
      const [teacherId, courseId] = params;
      this.courses.find((row) => row.id === courseId).teacher_id = teacherId;
      return { rows: [] };
    }
    if (normalized.startsWith("DELETE FROM course_teachers")) {
      const [courseId] = params;
      if (normalized.includes("role = 'primary'")) {
        this.courseTeachers = this.courseTeachers.filter((row) => row.course_id !== courseId || row.role !== "primary");
      } else if (normalized.includes("section_inherited = true")) {
        this.courseTeachers = this.courseTeachers.filter((row) => row.course_id !== courseId || !row.section_inherited);
      }
      return { rows: [] };
    }
    if (normalized.startsWith("INSERT INTO course_teachers")) {
      const [course_id, teacher_id] = params;
      if (!this.courseTeachers.some((row) => row.course_id === course_id && row.teacher_id === teacher_id)) {
        const primary = normalized.includes("'primary'");
        this.courseTeachers.push({ course_id, teacher_id, role: primary ? "primary" : "co-teacher", section_inherited: !primary });
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

test("corrects Pete Niu's FMP 10 and Accounting 11 sections to his real login", async () => {
  const pool = new FakePool();
  pool.users = [{ id: 77, email: "peterniu@cbcschools.ca" }];
  pool.courses = [
    { id: 101, title: "FMP 10A", teacher_id: null },
    { id: 102, title: "FMP 10B", teacher_id: null },
    { id: 103, title: "FMP 10C", teacher_id: null },
    { id: 104, title: "FMP 10D", teacher_id: null },
    { id: 111, title: "Accounting 11A", teacher_id: null },
    { id: 112, title: "Accounting 11B", teacher_id: null },
    { id: 113, title: "Accounting 11C", teacher_id: null },
    { id: 120, title: "Economic Theory 12", teacher_id: null },
  ];
  pool.tables = Object.fromEntries(
    ["lessons", "assignments", "course_categories", "learning_paths", "assessments", "assessment_question_banks", "submissions"]
      .map((table) => [table, []])
  );

  await ensureCourseSectionStructure(pool);

  for (const course of pool.courses.filter((course) => /^(FMP 10|Accounting 11)/.test(course.title))) {
    assert.equal(course.teacher_id, 77, course.title);
  }
  assert.equal(pool.courses.find((course) => course.title === "Economic Theory 12").teacher_id, null);
  assert.equal(pool.courseTeachers.filter((row) => row.role === "primary" && row.teacher_id === 77).length, 7);
});
