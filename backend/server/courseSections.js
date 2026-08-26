const APPROVED_MULTI_SECTION_COURSES = [
  "Accounting 11", "Chemistry 11", "Chemistry 12", "CLC 12",
  "Composition 10", "Composition 11", "Creative Writing 10", "CTS 10",
  "Drama 10", "EFP 12", "ELSL 11", "English Studies 12",
  "Fitness and Conditioning 11/12", "FMP 10", "New Media 10", "PE 10",
  "PGEO 11", "Physics 11", "Physics 12", "Pre-Calculus 11",
  "Pre-Calculus 12", "Science 10", "Social Studies 10", "Spoken Language 10",
];

const KNOWN_TEACHER_ASSIGNMENT_CORRECTIONS = [
  {
    teacherEmail: "peterniu@cbcschools.ca",
    masterTitles: ["FMP 10", "Accounting 11"],
  },
];

function comparableCourseTitle(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function getApprovedSectionIdentity(title) {
  const comparableTitle = comparableCourseTitle(title);
  for (const masterTitle of APPROVED_MULTI_SECTION_COURSES) {
    const comparableMaster = comparableCourseTitle(masterTitle);
    if (!comparableTitle.startsWith(comparableMaster)) continue;
    const suffix = comparableTitle.slice(comparableMaster.length);
    if (!/^[a-d]$/i.test(suffix)) continue;
    const sectionCode = suffix.toUpperCase();
    return { masterTitle, sectionCode, normalizedTitle: `${masterTitle}${sectionCode}` };
  }
  return null;
}

async function ensureCourseSectionStructure(pool) {
  await pool.query(`
    ALTER TABLE courses
      ADD COLUMN IF NOT EXISTS master_course_id INTEGER REFERENCES courses(id) ON DELETE RESTRICT,
      ADD COLUMN IF NOT EXISTS master_title TEXT,
      ADD COLUMN IF NOT EXISTS section_code TEXT
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS courses_master_course_id_idx ON courses(master_course_id)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_teachers (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'co-teacher',
      section_inherited BOOLEAN NOT NULL DEFAULT false,
      UNIQUE (course_id, teacher_id)
    )
  `);
  await pool.query(`ALTER TABLE course_teachers ADD COLUMN IF NOT EXISTS section_inherited BOOLEAN NOT NULL DEFAULT false`);

  const coursesResult = await pool.query(`SELECT id, title, teacher_id FROM courses ORDER BY id ASC`);

  for (const correction of KNOWN_TEACHER_ASSIGNMENT_CORRECTIONS) {
    const teacherResult = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [correction.teacherEmail]
    );
    const teacherId = Number(teacherResult.rows[0]?.id || 0);
    if (!teacherId) continue;

    const targetCourses = coursesResult.rows.filter((course) => {
      const identity = getApprovedSectionIdentity(course.title);
      return identity && correction.masterTitles.includes(identity.masterTitle);
    });

    for (const course of targetCourses) {
      await pool.query(`UPDATE courses SET teacher_id = $1 WHERE id = $2`, [teacherId, Number(course.id)]);
      await pool.query(
        `DELETE FROM course_teachers WHERE course_id = $1 AND role = 'primary'`,
        [Number(course.id)]
      );
      await pool.query(
        `INSERT INTO course_teachers (course_id, teacher_id, role, section_inherited)
         VALUES ($1, $2, 'primary', false)
         ON CONFLICT (course_id, teacher_id) DO UPDATE
         SET role = EXCLUDED.role, section_inherited = false`,
        [Number(course.id), teacherId]
      );
      course.teacher_id = teacherId;
    }
  }

  const groups = new Map();
  for (const course of coursesResult.rows) {
    const identity = getApprovedSectionIdentity(course.title);
    if (!identity) continue;
    if (!groups.has(identity.masterTitle)) groups.set(identity.masterTitle, []);
    groups.get(identity.masterTitle).push({ ...course, ...identity });
  }

  for (const [masterTitle, sections] of groups.entries()) {
    if (sections.length < 2) continue;
    const orderedSections = [...sections].sort((a, b) =>
      a.sectionCode.localeCompare(b.sectionCode) || Number(a.id) - Number(b.id)
    );
    const contentCourse = orderedSections.find((section) => section.sectionCode === "A") || orderedSections[0];
    const sectionIds = orderedSections.map((section) => Number(section.id));
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM course_teachers WHERE course_id = $1 AND section_inherited = true`,
        [Number(contentCourse.id)]
      );
      for (const section of orderedSections) {
        if (!section.teacher_id) continue;
        await client.query(
          `INSERT INTO course_teachers (course_id, teacher_id, role, section_inherited)
           VALUES ($1, $2, 'co-teacher', true) ON CONFLICT (course_id, teacher_id) DO NOTHING`,
          [Number(contentCourse.id), Number(section.teacher_id)]
        );
      }

      const sharedContentColumns = [
        ["lessons", "course_id"], ["assignments", "class_id"],
        ["course_categories", "course_id"], ["learning_paths", "course_id"],
        ["assessments", "course_id"], ["assessment_question_banks", "course_id"],
        ["submissions", "course_id"],
      ];
      for (const [tableName, columnName] of sharedContentColumns) {
        await client.query(
          `UPDATE ${tableName} SET ${columnName} = $1
           WHERE ${columnName} = ANY($2::int[]) AND ${columnName} <> $1`,
          [Number(contentCourse.id), sectionIds]
        );
      }

      for (const section of orderedSections) {
        await client.query(
          `UPDATE courses SET title = $1, course_name = $1, master_title = $2,
                              section_code = $3, master_course_id = $4 WHERE id = $5`,
          [section.normalizedTitle, masterTitle, section.sectionCode,
            Number(section.id) === Number(contentCourse.id) ? null : Number(contentCourse.id),
            Number(section.id)]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}

async function resolveContentCourseId(pool, courseId, queryable = pool) {
  const numericCourseId = Number(courseId || 0);
  if (!numericCourseId) return 0;
  const result = await queryable.query(
    `SELECT COALESCE(master_course_id, id) AS content_course_id FROM courses WHERE id = $1 LIMIT 1`,
    [numericCourseId]
  );
  return Number(result.rows[0]?.content_course_id || 0);
}

module.exports = {
  APPROVED_MULTI_SECTION_COURSES,
  KNOWN_TEACHER_ASSIGNMENT_CORRECTIONS,
  getApprovedSectionIdentity,
  ensureCourseSectionStructure,
  resolveContentCourseId,
};
