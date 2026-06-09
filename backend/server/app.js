const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authRoutes = require("../api/auth-api/routes");
const demoRoutes = require("./routes/demoRoutes");
const { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, TextRun } = require("docx");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

app.use("/uploads", express.static(uploadDir));
app.use("/api/auth", authRoutes);
app.use("/api/demo", demoRoutes);

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "postgres",
  password: "",
  port: 5432,
});

async function ensureStudentInfoColumns() {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_email TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id TEXT`);
}

async function ensureStudentReportCommentsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_report_comments (
      id SERIAL PRIMARY KEY,
      class_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
      student_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      com1 TEXT DEFAULT '',
      com2 TEXT DEFAULT '',
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (class_id, student_user_id)
    )
  `);
}

async function ensureSubmissionAttachmentsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS submission_attachments (
      id SERIAL PRIMARY KEY,
      submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
      assignment_id INTEGER REFERENCES assignments(id) ON DELETE CASCADE,
      student_email TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT DEFAULT '',
      size_bytes INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function ensureRubricFrameworkTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS main_competencies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT ''
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS competencies (
      id SERIAL PRIMARY KEY,
      main_competency_id INTEGER REFERENCES main_competencies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT ''
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sub_competency_facets (
      id SERIAL PRIMARY KEY,
      competency_id INTEGER REFERENCES competencies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT ''
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assignment_rubrics (
      id SERIAL PRIMARY KEY,
      assignment_id INTEGER REFERENCES assignments(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rubric_criteria (
      id SERIAL PRIMARY KEY,
      rubric_id INTEGER REFERENCES assignment_rubrics(id) ON DELETE CASCADE,
      facet_id INTEGER REFERENCES sub_competency_facets(id) ON DELETE SET NULL,
      criterion_text TEXT NOT NULL,
      sort_order INTEGER DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rubric_scores (
      id SERIAL PRIMARY KEY,
      rubric_criterion_id INTEGER REFERENCES rubric_criteria(id) ON DELETE CASCADE,
      student_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      score NUMERIC,
      evidence_note TEXT DEFAULT '',
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (rubric_criterion_id, student_user_id)
    )
  `);

  await pool.query(`
    ALTER TABLE assignment_rubrics
    ADD COLUMN IF NOT EXISTS full_rubric_json JSONB
  `);

  await pool.query(`
    ALTER TABLE assignment_rubrics
    ADD COLUMN IF NOT EXISTS full_rubric_activity_type TEXT
  `);

  await pool.query(`
    INSERT INTO main_competencies (name, description)
    VALUES
      ('Comprehend and Connect', 'Analyze, interpret, and critique texts.'),
      ('Create and Communicate', 'Write, speak, and communicate for varied purposes.'),
      ('Contextual Knowledge', 'Understand genre, form, literary elements, perspectives, and context.')
    ON CONFLICT (name) DO NOTHING
  `);
}

function rubricScoreToPercent(score) {
  const numericScore = Number(score);

  if (Number.isNaN(numericScore)) {
    return null;
  }

  if (numericScore >= 6) return 100;
  if (numericScore >= 5) return 86 + ((numericScore - 5) * (100 - 86));
  if (numericScore >= 4) return 73 + ((numericScore - 4) * (86 - 73));
  if (numericScore >= 3) return 60 + ((numericScore - 3) * (73 - 60));
  if (numericScore >= 2) return 50 + ((numericScore - 2) * (60 - 50));
  if (numericScore >= 1) return 40 + ((numericScore - 1) * (50 - 40));

  return 40;
}

function average(values) {
  const safeValues = values
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value));

  if (safeValues.length === 0) {
    return null;
  }

  const total = safeValues.reduce((sum, value) => sum + value, 0);
  return total / safeValues.length;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsvTextToRows(csvText) {
  const lines = String(csvText || "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    throw new Error("CSV must contain a header row and at least one student row");
  }

  const header = parseCsvLine(lines[0]).map((value) => value.trim());
  const requiredHeaders = [
    "class_name",
    "student_name",
    "student_email",
    "parent_email",
    "student_id",
  ];

  for (const requiredHeader of requiredHeaders) {
    if (!header.includes(requiredHeader)) {
      throw new Error(`CSV is missing required header: ${requiredHeader}`);
    }
  }

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};

    header.forEach((columnName, index) => {
      row[columnName] = String(values[index] || "").trim();
    });

    return row;
  });
}

async function importClassRows(rows) {
  await ensureStudentInfoColumns();

  const className = String(rows[0]?.class_name || "").trim();

  if (!className) {
    throw new Error("class_name is required");
  }

  const classResult = await pool.query(
    `
    SELECT id
    FROM courses
    WHERE title = $1
    LIMIT 1
    `,
    [className]
  );

  let classId;

  if (classResult.rows.length > 0) {
    classId = classResult.rows[0].id;
  } else {
    const insertedClassResult = await pool.query(
      `
      INSERT INTO courses (title, description)
      VALUES ($1, $2)
      RETURNING id
      `,
      [className, ""]
    );

    classId = insertedClassResult.rows[0].id;
  }

  let createdStudents = 0;
  let updatedStudentRoles = 0;
  let enrolledStudents = 0;

  for (const row of rows) {
    const studentName = String(row.student_name || "").trim();
    const studentEmail = String(row.student_email || "").trim().toLowerCase();
    const parentEmail = String(row.parent_email || "").trim().toLowerCase();
    const studentId = String(row.student_id || "").trim();

    if (!studentName || !studentEmail) {
      continue;
    }

    const userResult = await pool.query(
      `
      SELECT id, role
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
      `,
      [studentEmail]
    );

    let userId;

    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].id;

      const currentRole = String(userResult.rows[0].role || "").trim().toLowerCase();

      await pool.query(
        `
        UPDATE users
        SET name = $1,
            role = 'student',
            parent_email = $2,
            student_id = $3
        WHERE id = $4
        `,
        [studentName, parentEmail, studentId, userId]
      );

      if (currentRole !== "student") {
        updatedStudentRoles += 1;
      }
    } else {
      const insertedUserResult = await pool.query(
        `
        INSERT INTO users (name, email, role, parent_email, student_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        `,
        [studentName, studentEmail, "student", parentEmail, studentId]
      );

      userId = insertedUserResult.rows[0].id;
      createdStudents += 1;
    }

    const enrollmentCheckResult = await pool.query(
      `
      SELECT id
      FROM class_enrollments
      WHERE class_id = $1
        AND student_user_id = $2
      LIMIT 1
      `,
      [classId, userId]
    );

    if (enrollmentCheckResult.rows.length === 0) {
      await pool.query(
        `
        INSERT INTO class_enrollments (class_id, student_user_id)
        VALUES ($1, $2)
        `,
        [classId, userId]
      );

      enrolledStudents += 1;
    }
  }

  return {
    success: true,
    classId,
    className,
    createdStudents,
    updatedStudentRoles,
    enrolledStudents,
  };
}

async function getAssignmentsForClass(classId) {
  const result = await pool.query(
    `
    SELECT
      a.id,
      a.class_id,
      a.title,
      a.description,
      a.due_date,
      a.subcategory_id,
      a.is_published
    FROM assignments a
    WHERE a.class_id = $1
    ORDER BY a.due_date ASC NULLS LAST, a.id ASC
    `,
    [classId]
  );

  return result.rows.map((assignment) => ({
    ...assignment,
    calculated_weight: null,
  }));
}

async function getOrCreateMainCompetency(name, description) {
  const existingResult = await pool.query(
    `
    SELECT id
    FROM main_competencies
    WHERE name = $1
    LIMIT 1
    `,
    [name]
  );

  if (existingResult.rows.length > 0) {
    return existingResult.rows[0].id;
  }

  const insertedResult = await pool.query(
    `
    INSERT INTO main_competencies (name, description)
    VALUES ($1, $2)
    RETURNING id
    `,
    [name, description]
  );

  return insertedResult.rows[0].id;
}

async function getOrCreateCompetency(mainCompetencyId, name, description) {
  const existingResult = await pool.query(
    `
    SELECT id
    FROM competencies
    WHERE main_competency_id = $1
      AND name = $2
    LIMIT 1
    `,
    [mainCompetencyId, name]
  );

  if (existingResult.rows.length > 0) {
    return existingResult.rows[0].id;
  }

  const insertedResult = await pool.query(
    `
    INSERT INTO competencies (main_competency_id, name, description)
    VALUES ($1, $2, $3)
    RETURNING id
    `,
    [mainCompetencyId, name, description]
  );

  return insertedResult.rows[0].id;
}

async function getOrCreateFacet(competencyId, name, description) {
  const existingResult = await pool.query(
    `
    SELECT id
    FROM sub_competency_facets
    WHERE competency_id = $1
      AND name = $2
    LIMIT 1
    `,
    [competencyId, name]
  );

  if (existingResult.rows.length > 0) {
    return existingResult.rows[0].id;
  }

  const insertedResult = await pool.query(
    `
    INSERT INTO sub_competency_facets (competency_id, name, description)
    VALUES ($1, $2, $3)
    RETURNING id
    `,
    [competencyId, name, description]
  );

  return insertedResult.rows[0].id;
}

async function ensureEnglishStudiesRubricFramework() {
  await ensureRubricFrameworkTables();

  const comprehendId = await getOrCreateMainCompetency(
    "Comprehend and Connect",
    "Analyze, interpret, and critique texts."
  );

  const createId = await getOrCreateMainCompetency(
    "Create and Communicate",
    "Write, speak, and communicate for varied purposes."
  );

  const contextId = await getOrCreateMainCompetency(
    "Contextual Knowledge",
    "Understand genre, form, literary elements, perspectives, and context."
  );

  const analyzeTextsId = await getOrCreateCompetency(
    comprehendId,
    "Analyze and Interpret Texts",
    "Students analyze structure, meaning, evidence, and interpretation."
  );

  const evidenceId = await getOrCreateCompetency(
    comprehendId,
    "Use Evidence",
    "Students use details, quotations, and examples to support interpretation."
  );

  const writingProcessId = await getOrCreateCompetency(
    createId,
    "Apply Writing Processes",
    "Students plan, draft, revise, edit, and publish writing."
  );

  const communicationId = await getOrCreateCompetency(
    createId,
    "Communicate for Purpose",
    "Students communicate clearly for audience, purpose, and form."
  );

  const genreId = await getOrCreateCompetency(
    contextId,
    "Understand Genre and Form",
    "Students understand forms, genres, literary devices, and conventions."
  );

  const perspectivesId = await getOrCreateCompetency(
    contextId,
    "Explore Perspective and Context",
    "Students connect texts to perspectives, culture, and reconciliation."
  );

  return {
    poeticStructureFacetId: await getOrCreateFacet(
      analyzeTextsId,
      "Analyze Text Structure",
      "Recognize how poetic structure shapes meaning."
    ),
    interpretationFacetId: await getOrCreateFacet(
      analyzeTextsId,
      "Interpret Theme and Meaning",
      "Develop thoughtful interpretation of theme and meaning."
    ),
    evidenceFacetId: await getOrCreateFacet(
      evidenceId,
      "Use Textual Evidence",
      "Use relevant and accurate evidence from the poem."
    ),
    writingProcessFacetId: await getOrCreateFacet(
      writingProcessId,
      "Apply Writing Process",
      "Organize, revise, and polish written response."
    ),
    clarityFacetId: await getOrCreateFacet(
      communicationId,
      "Communicate Clearly",
      "Communicate ideas clearly using appropriate academic language."
    ),
    genreFacetId: await getOrCreateFacet(
      genreId,
      "Understand Poetic Devices",
      "Explain literary and poetic devices accurately."
    ),
    contextFacetId: await getOrCreateFacet(
      perspectivesId,
      "Connect Perspective and Context",
      "Connect text to perspective, context, or reconciliation where appropriate."
    ),
  };
}

async function getOrCreateDemoTeacherId() {
  const teacherResult = await pool.query(
    `
    SELECT id
    FROM users
    WHERE LOWER(COALESCE(role, '')) = 'teacher'
    ORDER BY id ASC
    LIMIT 1
    `
  );

  if (teacherResult.rows.length > 0) {
    return teacherResult.rows[0].id;
  }

  const insertedTeacherResult = await pool.query(
    `
    INSERT INTO users (name, email, role)
    VALUES ($1, $2, $3)
    RETURNING id
    `,
    ["Demo Teacher", "demo.teacher@school.ca", "teacher"]
  );

  return insertedTeacherResult.rows[0].id;
}

async function ensureDemoStudentsForClass(classId) {
  await ensureStudentInfoColumns();

  const existingStudentsResult = await pool.query(
    `
    SELECT
      ce.student_user_id,
      u.name,
      u.email
    FROM class_enrollments ce
    JOIN users u
      ON u.id = ce.student_user_id
    WHERE ce.class_id = $1
    ORDER BY u.name ASC
    `,
    [classId]
  );

  if (existingStudentsResult.rows.length > 0) {
    return existingStudentsResult.rows;
  }

  const demoStudents = [
    {
      name: "Jordan Lee",
      email: `jordan.lee.class${classId}@school.ca`,
      parentEmail: "parent1@email.com",
      studentId: `S${classId}001`,
    },
    {
      name: "Avery Smith",
      email: `avery.smith.class${classId}@school.ca`,
      parentEmail: "parent2@email.com",
      studentId: `S${classId}002`,
    },
    {
      name: "Morgan Chen",
      email: `morgan.chen.class${classId}@school.ca`,
      parentEmail: "parent3@email.com",
      studentId: `S${classId}003`,
    },
  ];

  for (const student of demoStudents) {
    const userResult = await pool.query(
      `
      INSERT INTO users (name, email, role, parent_email, student_id)
      VALUES ($1, $2, 'student', $3, $4)
      ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name,
          role = 'student',
          parent_email = EXCLUDED.parent_email,
          student_id = EXCLUDED.student_id
      RETURNING id
      `,
      [student.name, student.email, student.parentEmail, student.studentId]
    );

    const userId = userResult.rows[0].id;

    await pool.query(
      `
      INSERT INTO class_enrollments (class_id, student_user_id)
      SELECT $1, $2
      WHERE NOT EXISTS (
        SELECT 1
        FROM class_enrollments
        WHERE class_id = $1
          AND student_user_id = $2
      )
      `,
      [classId, userId]
    );
  }

  const refreshedStudentsResult = await pool.query(
    `
    SELECT
      ce.student_user_id,
      u.name,
      u.email
    FROM class_enrollments ce
    JOIN users u
      ON u.id = ce.student_user_id
    WHERE ce.class_id = $1
    ORDER BY u.name ASC
    `,
    [classId]
  );

  return refreshedStudentsResult.rows;
}

async function seedRubricDemoForClass(classId) {
  await ensureRubricFrameworkTables();
  await ensureStudentInfoColumns();

  const classResult = await pool.query(
    `
    SELECT id, title, teacher_id
    FROM courses
    WHERE id = $1
    LIMIT 1
    `,
    [classId]
  );

  if (classResult.rows.length === 0) {
    throw new Error("Class not found");
  }

  const course = classResult.rows[0];
  const teacherId = course.teacher_id || (await getOrCreateDemoTeacherId());
  const framework = await ensureEnglishStudiesRubricFramework();
  const students = await ensureDemoStudentsForClass(classId);

  let assignmentResult = await pool.query(
    `
    SELECT id
    FROM assignments
    WHERE class_id = $1
      AND title = $2
    LIMIT 1
    `,
    [classId, "Poetry Analysis Rubric Evidence"]
  );

  let assignmentId;

  if (assignmentResult.rows.length > 0) {
    assignmentId = assignmentResult.rows[0].id;
  } else {
    const insertedAssignmentResult = await pool.query(
      `
      INSERT INTO assignments (
        class_id,
        teacher_id,
        title,
        description,
        due_date,
        subcategory_id,
        is_published
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
      `,
      [
        classId,
        teacherId,
        "Poetry Analysis Rubric Evidence",
        "Demo poetry analysis assignment scored through the standard 6-point competency rubric.",
        "2026-10-15",
        null,
        true,
      ]
    );

    assignmentId = insertedAssignmentResult.rows[0].id;
  }

  let rubricResult = await pool.query(
    `
    SELECT id
    FROM assignment_rubrics
    WHERE assignment_id = $1
      AND title = $2
    LIMIT 1
    `,
    [assignmentId, "Standard 6-Point Literary Analysis Rubric"]
  );

  let rubricId;

  if (rubricResult.rows.length > 0) {
    rubricId = rubricResult.rows[0].id;
  } else {
    const insertedRubricResult = await pool.query(
      `
      INSERT INTO assignment_rubrics (assignment_id, title)
      VALUES ($1, $2)
      RETURNING id
      `,
      [assignmentId, "Standard 6-Point Literary Analysis Rubric"]
    );

    rubricId = insertedRubricResult.rows[0].id;
  }

  const criteria = [
    {
      facetId: framework.poeticStructureFacetId,
      text: "Analyzes how poetic structure shapes meaning.",
      sortOrder: 1,
    },
    {
      facetId: framework.interpretationFacetId,
      text: "Interprets theme and meaning with insight.",
      sortOrder: 2,
    },
    {
      facetId: framework.evidenceFacetId,
      text: "Uses relevant textual evidence to support interpretation.",
      sortOrder: 3,
    },
    {
      facetId: framework.genreFacetId,
      text: "Explains poetic devices accurately.",
      sortOrder: 4,
    },
    {
      facetId: framework.writingProcessFacetId,
      text: "Organizes and revises written response effectively.",
      sortOrder: 5,
    },
    {
      facetId: framework.clarityFacetId,
      text: "Communicates ideas clearly for academic purpose.",
      sortOrder: 6,
    },
    {
      facetId: framework.contextFacetId,
      text: "Connects the poem to perspective or context.",
      sortOrder: 7,
    },
  ];

  const criterionIds = [];

  for (const criterion of criteria) {
    const existingCriterionResult = await pool.query(
      `
      SELECT id
      FROM rubric_criteria
      WHERE rubric_id = $1
        AND criterion_text = $2
      LIMIT 1
      `,
      [rubricId, criterion.text]
    );

    let criterionId;

    if (existingCriterionResult.rows.length > 0) {
      criterionId = existingCriterionResult.rows[0].id;

      await pool.query(
        `
        UPDATE rubric_criteria
        SET facet_id = $1,
            sort_order = $2
        WHERE id = $3
        `,
        [criterion.facetId, criterion.sortOrder, criterionId]
      );
    } else {
      const insertedCriterionResult = await pool.query(
        `
        INSERT INTO rubric_criteria (
          rubric_id,
          facet_id,
          criterion_text,
          sort_order
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id
        `,
        [rubricId, criterion.facetId, criterion.text, criterion.sortOrder]
      );

      criterionId = insertedCriterionResult.rows[0].id;
    }

    criterionIds.push(criterionId);
  }

  const scorePattern = [6, 5, 5.5, 4.5, 4, 3.5, 3];

  for (const student of students) {
    for (let index = 0; index < criterionIds.length; index += 1) {
      const criterionId = criterionIds[index];
      const score = scorePattern[(index + Number(student.student_user_id || 0)) % scorePattern.length];

      await pool.query(
        `
        INSERT INTO rubric_scores (
          rubric_criterion_id,
          student_user_id,
          score,
          evidence_note,
          updated_at
        )
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (rubric_criterion_id, student_user_id)
        DO UPDATE
        SET score = EXCLUDED.score,
            evidence_note = EXCLUDED.evidence_note,
            updated_at = NOW()
        `,
        [
          criterionId,
          student.student_user_id,
          score,
          "Seeded demo evidence for standard 6-point rubric-to-percent gradebook pipeline.",
        ]
      );
    }
  }

  return {
    success: true,
    classId,
    className: course.title,
    assignmentId,
    rubricId,
    criteriaCount: criterionIds.length,
    studentCount: students.length,
    rubricScale: "6-point",
  };
}

async function buildRubricGradebookStudents(classId) {
  const studentsResult = await pool.query(
    `
    SELECT
      ce.student_user_id,
      u.name AS student_name,
      u.email AS student_email,
      u.student_id,
      u.parent_email
    FROM class_enrollments ce
    JOIN users u
      ON ce.student_user_id = u.id
    WHERE ce.class_id = $1
    ORDER BY u.name ASC, u.email ASC
    `,
    [classId]
  );

  const rubricScoresResult = await pool.query(
    `
    SELECT
      rs.student_user_id,
      rs.score,
      rs.evidence_note,
      rc.id AS rubric_criterion_id,
      rc.criterion_text,
      scf.id AS facet_id,
      scf.name AS facet_name,
      comp.id AS competency_id,
      comp.name AS competency_name,
      mc.id AS main_competency_id,
      mc.name AS main_competency_name
    FROM rubric_scores rs
    JOIN rubric_criteria rc
      ON rc.id = rs.rubric_criterion_id
    LEFT JOIN sub_competency_facets scf
      ON scf.id = rc.facet_id
    LEFT JOIN competencies comp
      ON comp.id = scf.competency_id
    LEFT JOIN main_competencies mc
      ON mc.id = comp.main_competency_id
    JOIN assignment_rubrics ar
      ON ar.id = rc.rubric_id
    JOIN assignments a
      ON a.id = ar.assignment_id
    WHERE a.class_id = $1
    `,
    [classId]
  );

  const rubricScoresByStudent = new Map();

  for (const row of rubricScoresResult.rows) {
    const key = String(row.student_user_id);

    if (!rubricScoresByStudent.has(key)) {
      rubricScoresByStudent.set(key, []);
    }

    rubricScoresByStudent.get(key).push(row);
  }

  return studentsResult.rows.map((student) => {
    const studentScores = rubricScoresByStudent.get(String(student.student_user_id)) || [];
    const scoresByMainCompetency = new Map();

    for (const scoreRow of studentScores) {
      const mainName = scoreRow.main_competency_name || "Unmapped Evidence";

      if (!scoresByMainCompetency.has(mainName)) {
        scoresByMainCompetency.set(mainName, []);
      }

      scoresByMainCompetency.get(mainName).push(Number(scoreRow.score));
    }

    const competency_profile = {};

    for (const [mainName, scoreValues] of scoresByMainCompetency.entries()) {
      const avgScore = average(scoreValues);
      const percent = rubricScoreToPercent(avgScore);

      competency_profile[mainName] = {
        average_score: avgScore === null ? null : Number(avgScore.toFixed(2)),
        percent: percent === null ? null : Number(percent.toFixed(1)),
      };
    }

    const competencyPercents = Object.values(competency_profile)
      .map((entry) => entry.percent)
      .filter((value) => value !== null && value !== undefined);

    const finalPercentAverage = average(competencyPercents);
    const finalPercent =
      finalPercentAverage === null ? 0 : Math.round(finalPercentAverage);

    return {
      student_user_id: student.student_user_id,
      student_name: student.student_name,
      student_email: student.student_email,
      student_id: student.student_id,
      parent_email: student.parent_email,
      average: finalPercent,
      weighted_total: finalPercent,
      final_percent: finalPercent,
      competency_profile,
      scores: {},
    };
  });
}


async function ensureLearningPathItemTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS learning_path_items (
      id SERIAL PRIMARY KEY,
      learning_path_id INTEGER REFERENCES learning_paths(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL DEFAULT 'lesson',
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      resource_url TEXT DEFAULT '',
      assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
      sort_order INTEGER NOT NULL DEFAULT 1,
      is_required BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE learning_path_items
    ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'lesson'
  `);

  await pool.query(`
    ALTER TABLE learning_path_items
    ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''
  `);

  await pool.query(`
    ALTER TABLE learning_path_items
    ADD COLUMN IF NOT EXISTS resource_url TEXT DEFAULT ''
  `);

  await pool.query(`
    ALTER TABLE learning_path_items
    ADD COLUMN IF NOT EXISTS assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL
  `);

  await pool.query(`
    ALTER TABLE learning_path_items
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 1
  `);

  await pool.query(`
    ALTER TABLE learning_path_items
    ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT true
  `);

  await pool.query(`
    ALTER TABLE learning_path_items
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()
  `);

  await pool.query(`
    ALTER TABLE learning_path_items
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);
}


async function ensureCourseStructureTemplateTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_structure_templates (
      id SERIAL PRIMARY KEY,
      template_name TEXT NOT NULL,
      template_description TEXT DEFAULT '',
      source_course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      created_by_teacher_email TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_structure_template_categories (
      id SERIAL PRIMARY KEY,
      template_id INTEGER REFERENCES course_structure_templates(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      weight_percent NUMERIC NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS course_structure_template_subcategories (
      id SERIAL PRIMARY KEY,
      template_category_id INTEGER REFERENCES course_structure_template_categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      weight_percent_of_parent NUMERIC NOT NULL DEFAULT 0,
      level_number INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 1
    )
  `);
}


async function ensureAssignmentSectionTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS assignment_sections (
      id SERIAL PRIMARY KEY,
      assignment_id INTEGER REFERENCES assignments(id) ON DELETE CASCADE,
      section_name TEXT NOT NULL,
      competency_bucket TEXT NOT NULL,
      max_points NUMERIC NOT NULL DEFAULT 0,
      section_weight NUMERIC NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_section_scores (
      id SERIAL PRIMARY KEY,
      student_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      assignment_section_id INTEGER REFERENCES assignment_sections(id) ON DELETE CASCADE,
      earned_points NUMERIC,
      converted_competency_level NUMERIC,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (student_user_id, assignment_section_id)
    )
  `);

  await pool.query(`
    ALTER TABLE student_section_scores
    ADD COLUMN IF NOT EXISTS student_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS student_section_scores_student_section_unique
    ON student_section_scores (student_user_id, assignment_section_id)
  `);

  await pool.query(`
    ALTER TABLE student_section_scores
    ALTER COLUMN student_email DROP NOT NULL
  `).catch(() => {});
}

function rawPercentToCompetencyLevel(earnedPoints, maxPoints) {
  const earned = Number(earnedPoints);
  const max = Number(maxPoints);

  if (!Number.isFinite(earned) || !Number.isFinite(max) || max <= 0) {
    return null;
  }

  const percent = (earned / max) * 100;

  if (percent >= 92) return 6;
  if (percent >= 80) return 5;
  if (percent >= 67) return 4;
  if (percent >= 50) return 3;
  if (percent >= 35) return 2;
  return 1;
}

function averageSectionLevels(sectionRows, bucketName) {
  const matchingRows = sectionRows.filter(
    (row) => String(row.competency_bucket || "").toUpperCase() === bucketName
  );

  const scoredRows = matchingRows.filter((row) =>
    Number.isFinite(Number(row.converted_competency_level))
  );

  if (scoredRows.length === 0) {
    return null;
  }

  const totalWeight = scoredRows.reduce(
    (sum, row) => sum + Number(row.section_weight || 1),
    0
  );

  if (totalWeight <= 0) {
    return null;
  }

  const weightedTotal = scoredRows.reduce(
    (sum, row) =>
      sum +
      Number(row.converted_competency_level) * Number(row.section_weight || 1),
    0
  );

  return Number((weightedTotal / totalWeight).toFixed(2));
}

async function syncSectionScoresToSubmission(assignmentId, studentUserId) {
  const studentResult = await pool.query(
    `
    SELECT id, name, email
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [studentUserId]
  );

  if (studentResult.rows.length === 0) {
    throw new Error("Student not found");
  }

  const student = studentResult.rows[0];
  const studentEmail = String(student.email || "").trim().toLowerCase();

  const sectionScoresResult = await pool.query(
    `
    SELECT
      aps.id AS assignment_section_id,
      aps.competency_bucket,
      aps.section_weight,
      sss.earned_points,
      sss.converted_competency_level
    FROM assignment_sections aps
    LEFT JOIN student_section_scores sss
      ON sss.assignment_section_id = aps.id
      AND sss.student_user_id = $2
    WHERE aps.assignment_id = $1
    ORDER BY aps.sort_order ASC, aps.id ASC
    `,
    [assignmentId, studentUserId]
  );

  const doScore = averageSectionLevels(sectionScoresResult.rows, "DO");
  const knowScore = averageSectionLevels(sectionScoresResult.rows, "KNOW");
  const understandScore = averageSectionLevels(sectionScoresResult.rows, "UNDERSTAND");

  const rubricSelection = {
    DO: doScore,
    KNOW: knowScore,
    UNDERSTAND: understandScore,
  };

  const weightedScore =
    Number(doScore || 0) * 0.5 +
    Number(knowScore || 0) * 0.25 +
    Number(understandScore || 0) * 0.25;

  const percentScore = Number(((weightedScore / 6) * 100).toFixed(2));

  const existingResult = await pool.query(
    `
    SELECT id
    FROM submissions
    WHERE assignment_id = $1
      AND LOWER(student_email) = $2
    LIMIT 1
    `,
    [assignmentId, studentEmail]
  );

  if (existingResult.rows.length > 0) {
    await pool.query(
      `
      UPDATE submissions
      SET score = $1,
          grade = $2,
          feedback = $3,
          rubric_selection = $4
      WHERE id = $5
      `,
      [
        percentScore,
        `${percentScore}%`,
        "Raw section marks converted to KDU scores.",
        rubricSelection,
        existingResult.rows[0].id,
      ]
    );
  } else {
    await pool.query(
      `
      INSERT INTO submissions (
        assignment_id,
        student_name,
        student_email,
        content,
        score,
        grade,
        feedback,
        rubric_selection
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        assignmentId,
        student.name || studentEmail,
        studentEmail,
        "Teacher-entered raw section marks.",
        percentScore,
        `${percentScore}%`,
        "Raw section marks converted to KDU scores.",
        rubricSelection,
      ]
    );
  }

  return {
    rubric_selection: rubricSelection,
    weighted_score: Number(weightedScore.toFixed(2)),
    percent_score: percentScore,
  };
}

/* ROOT */
app.get("/", (req, res) => {
  res.send("Super LMS backend running");
});

/* GET COURSES */
app.get("/api/courses", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.title,
        c.description,
        c.teacher_id,
        c.school_id,
        c.term_id,
        c.created_at,
        u.name AS teacher_name,
        u.email AS teacher_email,
        COUNT(ce.student_user_id)::int AS student_count
      FROM courses c
      LEFT JOIN users u
        ON c.teacher_id = u.id
      LEFT JOIN class_enrollments ce
        ON ce.class_id = c.id
      GROUP BY
        c.id,
        c.title,
        c.description,
        c.teacher_id,
        c.school_id,
        c.term_id,
        c.created_at,
        u.name,
        u.email
      ORDER BY c.id ASC
    `);

    return res.json(result.rows);
  } catch (err) {
    console.error("GET /api/courses failed:", err);
    return res.status(500).json({ error: "Failed to fetch courses" });
  }
});

/* GET CLASSES FOR GRADEBOOK */
app.get("/api/classes", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        title AS class_name,
        title,
        description,
        teacher_id,
        school_id,
        term_id,
        created_at
      FROM courses
      ORDER BY id ASC
    `);

    return res.json(result.rows);
  } catch (err) {
    console.error("GET /api/classes failed:", err);
    return res.status(500).json({ error: "Failed to fetch classes" });
  }
});

/* GET KDU CATEGORIES FOR COURSE */
app.get("/api/courses/:courseId/categories", async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);

    if (!courseId) {
      return res.status(400).json({ error: "Valid courseId required" });
    }

    const result = await pool.query(
      `
      SELECT id, course_id, name, weight_percent, sort_order
      FROM course_categories
      WHERE course_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [courseId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("GET categories failed:", err);
    return res.status(500).json({ error: "Failed to load categories" });
  }
});

/* UPDATE CATEGORY */

app.put("/api/categories/:categoryId", async (req, res) => {
  try {
    const categoryId = Number(req.params.categoryId);
    const { name, weight_percent } = req.body;

    if (!categoryId || !String(name || "").trim() || weight_percent === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await pool.query(
      `
      UPDATE course_categories
      SET name = $1,
          weight_percent = $2
      WHERE id = $3
      RETURNING id, course_id, name, weight_percent
      `,
      [String(name).trim(), Number(weight_percent), categoryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Category not found" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /api/categories/:categoryId failed:", err);
    return res.status(500).json({ error: "Failed to update category" });
  }
});


/* REORDER CATEGORY */
app.post("/api/categories/:categoryId/reorder", async (req, res) => {
  const client = await pool.connect();

  try {
    const categoryId = Number(req.params.categoryId);
    const direction = String(req.body.direction || "").trim().toLowerCase();

    if (!categoryId) {
      return res.status(400).json({ error: "Valid categoryId is required" });
    }

    if (!["up", "down"].includes(direction)) {
      return res.status(400).json({ error: "Direction must be up or down" });
    }

    await client.query("BEGIN");

    const currentResult = await client.query(
      `
      SELECT id, course_id, sort_order
      FROM course_categories
      WHERE id = $1
      LIMIT 1
      `,
      [categoryId]
    );

    if (currentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Assessment pathway not found" });
    }

    const current = currentResult.rows[0];

    await client.query(
      `
      WITH ordered AS (
        SELECT
          id,
          ROW_NUMBER() OVER (ORDER BY sort_order ASC, id ASC) AS new_sort_order
        FROM course_categories
        WHERE course_id = $1
      )
      UPDATE course_categories cc
      SET sort_order = ordered.new_sort_order
      FROM ordered
      WHERE cc.id = ordered.id
      `,
      [current.course_id]
    );

    const refreshedCurrentResult = await client.query(
      `
      SELECT id, course_id, sort_order
      FROM course_categories
      WHERE id = $1
      LIMIT 1
      `,
      [categoryId]
    );

    const refreshedCurrent = refreshedCurrentResult.rows[0];

    const neighborResult = await client.query(
      direction === "up"
        ? `
          SELECT id, sort_order
          FROM course_categories
          WHERE course_id = $1
            AND sort_order < $2
          ORDER BY sort_order DESC, id DESC
          LIMIT 1
          `
        : `
          SELECT id, sort_order
          FROM course_categories
          WHERE course_id = $1
            AND sort_order > $2
          ORDER BY sort_order ASC, id ASC
          LIMIT 1
          `,
      [refreshedCurrent.course_id, refreshedCurrent.sort_order]
    );

    if (neighborResult.rows.length === 0) {
      await client.query("COMMIT");
      return res.json({
        success: true,
        moved: false,
        reason: direction === "up" ? "Already first" : "Already last",
      });
    }

    const neighbor = neighborResult.rows[0];

    await client.query(
      `
      UPDATE course_categories
      SET sort_order = CASE
        WHEN id = $1 THEN $4
        WHEN id = $3 THEN $2
        ELSE sort_order
      END
      WHERE id IN ($1, $3)
      `,
      [
        refreshedCurrent.id,
        refreshedCurrent.sort_order,
        neighbor.id,
        neighbor.sort_order,
      ]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      moved: true,
      category_id: refreshedCurrent.id,
      swapped_with_category_id: neighbor.id,
      direction,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("POST /api/categories/:categoryId/reorder rollback failed:", rollbackErr);
    }

    console.error("POST /api/categories/:categoryId/reorder failed:", err);
    return res.status(500).json({ error: "Failed to reorder assessment pathway" });
  } finally {
    client.release();
  }
});


/* GET SUBCATEGORIES */
app.post("/api/courses/:courseId/categories", async (req, res) => {
  const client = await pool.connect();

  try {
    const courseId = Number(req.params.courseId);
    const name = String(req.body.name || "").trim();
    const weightPercent = Number(req.body.weight_percent || 0);
    const insertAfterCategoryId = req.body.insert_after_category_id
      ? Number(req.body.insert_after_category_id)
      : null;

    if (!courseId) {
      return res.status(400).json({ error: "Valid courseId is required" });
    }

    if (!name) {
      return res.status(400).json({ error: "Learning category name is required" });
    }

    if (!Number.isFinite(weightPercent) || weightPercent <= 0) {
      return res.status(400).json({ error: "Learning category weight must be greater than 0" });
    }

    await client.query("BEGIN");

    const courseResult = await client.query(
      `
      SELECT id
      FROM courses
      WHERE id = $1
      LIMIT 1
      `,
      [courseId]
    );

    if (courseResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Course not found" });
    }

    let sortOrder = null;

    if (insertAfterCategoryId) {
      const sourceCategoryResult = await client.query(
        `
        SELECT id, sort_order
        FROM course_categories
        WHERE id = $1
          AND course_id = $2
        LIMIT 1
        `,
        [insertAfterCategoryId, courseId]
      );

      if (sourceCategoryResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Source assessment pathway not found" });
      }

      const sourceSortOrder = Number(sourceCategoryResult.rows[0].sort_order || 0);
      sortOrder = sourceSortOrder + 1;

      await client.query(
        `
        UPDATE course_categories
        SET sort_order = sort_order + 1
        WHERE course_id = $1
          AND sort_order >= $2
        `,
        [courseId, sortOrder]
      );
    } else {
      const sortResult = await client.query(
        `
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
        FROM course_categories
        WHERE course_id = $1
        `,
        [courseId]
      );

      sortOrder = Number(sortResult.rows[0]?.next_sort_order || 1);
    }

    const result = await client.query(
      `
      INSERT INTO course_categories (course_id, name, weight_percent, sort_order)
      VALUES ($1, $2, $3, $4)
      RETURNING id, course_id, name, weight_percent, sort_order
      `,
      [courseId, name, weightPercent, sortOrder]
    );

    await client.query("COMMIT");

    return res.json(result.rows[0]);
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("POST /api/courses/:courseId/categories rollback failed:", rollbackErr);
    }

    console.error("POST /api/courses/:courseId/categories failed:", err);
    return res.status(500).json({ error: "Failed to create learning category" });
  } finally {
    client.release();
  }
});


app.delete("/api/categories/:categoryId", async (req, res) => {
  try {
    const categoryId = Number(req.params.categoryId);

    if (!categoryId) {
      return res.status(400).json({ error: "Valid categoryId is required" });
    }

    const subcategoryResult = await pool.query(
      `
      SELECT COUNT(*)::int AS tier_count
      FROM category_subcategories
      WHERE course_category_id = $1
      `,
      [categoryId]
    );

    const tierCount = Number(subcategoryResult.rows[0]?.tier_count || 0);

    if (tierCount > 0) {
      return res.status(409).json({
        error: "Cannot delete this learning category because evidence tiers still exist. Delete evidence tiers first.",
        tier_count: tierCount,
      });
    }

    const result = await pool.query(
      `
      DELETE FROM course_categories
      WHERE id = $1
      RETURNING id, course_id, name
      `,
      [categoryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Learning category not found" });
    }

    return res.json({
      success: true,
      deleted: result.rows[0],
    });
  } catch (err) {
    console.error("DELETE /api/categories/:categoryId failed:", err);
    return res.status(500).json({ error: "Failed to delete learning category" });
  }
});


app.put("/api/subcategories/:subcategoryId", async (req, res) => {
  try {
    const subcategoryId = Number(req.params.subcategoryId);
    const name = String(req.body.name || "").trim();
    const weightPercentOfParent = Number(req.body.weight_percent_of_parent || 0);
    const levelNumber =
      req.body.level_number === undefined || req.body.level_number === null || req.body.level_number === ""
        ? null
        : Number(req.body.level_number);

    if (!subcategoryId) {
      return res.status(400).json({ error: "Valid subcategoryId is required" });
    }

    if (!name) {
      return res.status(400).json({ error: "Evidence tier name is required" });
    }

    if (!Number.isFinite(weightPercentOfParent) || weightPercentOfParent <= 0) {
      return res.status(400).json({ error: "Evidence tier weight must be greater than 0" });
    }

    const result = await pool.query(
      `
      UPDATE category_subcategories
      SET name = $1,
          weight_percent_of_parent = $2,
          level_number = $3
      WHERE id = $4
      RETURNING id, course_category_id AS category_id, name, weight_percent_of_parent, level_number, sort_order
      `,
      [
        name,
        weightPercentOfParent,
        Number.isFinite(levelNumber) ? levelNumber : null,
        subcategoryId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Evidence tier not found" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /api/subcategories/:subcategoryId failed:", err);
    return res.status(500).json({ error: "Failed to update evidence tier" });
  }
});


app.delete("/api/subcategories/:subcategoryId", async (req, res) => {
  try {
    const subcategoryId = Number(req.params.subcategoryId);

    if (!subcategoryId) {
      return res.status(400).json({ error: "Valid subcategoryId is required" });
    }

    const assignmentResult = await pool.query(
      `
      SELECT COUNT(*)::int AS assignment_count
      FROM assignments
      WHERE subcategory_id = $1
      `,
      [subcategoryId]
    );

    const assignmentCount = Number(assignmentResult.rows[0]?.assignment_count || 0);

    if (assignmentCount > 0) {
      return res.status(409).json({
        error: "Cannot delete this evidence tier because assignments are linked to it.",
        assignment_count: assignmentCount,
      });
    }

    const result = await pool.query(
      `
      DELETE FROM category_subcategories
      WHERE id = $1
      RETURNING id, course_category_id AS category_id, name
      `,
      [subcategoryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Evidence tier not found" });
    }

    return res.json({
      success: true,
      deleted: result.rows[0],
    });
  } catch (err) {
    console.error("DELETE /api/subcategories/:subcategoryId failed:", err);
    return res.status(500).json({ error: "Failed to delete evidence tier" });
  }
});


app.post("/api/categories/:categoryId/subcategories", async (req, res) => {
  try {
    const categoryId = Number(req.params.categoryId);
    const name = String(req.body.name || "").trim();
    const weightPercentOfParent = Number(req.body.weight_percent_of_parent || 0);
    const levelNumber = req.body.level_number === undefined || req.body.level_number === null || req.body.level_number === ""
      ? null
      : Number(req.body.level_number);

    if (!categoryId) {
      return res.status(400).json({ error: "Valid categoryId is required" });
    }

    if (!name) {
      return res.status(400).json({ error: "Evidence tier name is required" });
    }

    if (!Number.isFinite(weightPercentOfParent) || weightPercentOfParent <= 0) {
      return res.status(400).json({ error: "Evidence tier weight must be greater than 0" });
    }

    const categoryResult = await pool.query(
      `
      SELECT id
      FROM course_categories
      WHERE id = $1
      LIMIT 1
      `,
      [categoryId]
    );

    if (categoryResult.rows.length === 0) {
      return res.status(404).json({ error: "Learning category not found" });
    }

    const sortResult = await pool.query(
      `
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
      FROM category_subcategories
      WHERE course_category_id = $1
      `,
      [categoryId]
    );

    const sortOrder = Number(sortResult.rows[0]?.next_sort_order || 1);

    const result = await pool.query(
      `
      INSERT INTO category_subcategories (
        course_category_id,
        name,
        weight_percent_of_parent,
        level_number,
        sort_order
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, course_category_id AS category_id, name, weight_percent_of_parent, level_number, sort_order
      `,
      [categoryId, name, weightPercentOfParent, Number.isFinite(levelNumber) ? levelNumber : null, sortOrder]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("POST /api/categories/:categoryId/subcategories failed:", err);
    return res.status(500).json({ error: "Failed to create evidence tier" });
  }
});



app.post("/api/subcategories/:subcategoryId/reorder", async (req, res) => {
  const client = await pool.connect();

  try {
    const subcategoryId = Number(req.params.subcategoryId);
    const direction = String(req.body.direction || "").trim().toLowerCase();

    if (!subcategoryId) {
      return res.status(400).json({ error: "Valid subcategoryId is required" });
    }

    if (!["up", "down"].includes(direction)) {
      return res.status(400).json({ error: "Direction must be up or down" });
    }

    await client.query("BEGIN");

    const currentResult = await client.query(
      `
      SELECT id, course_category_id, sort_order
      FROM category_subcategories
      WHERE id = $1
      LIMIT 1
      `,
      [subcategoryId]
    );

    if (currentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Evidence tier not found" });
    }

    const current = currentResult.rows[0];

    await client.query(
      `
      WITH ordered AS (
        SELECT
          id,
          ROW_NUMBER() OVER (ORDER BY sort_order ASC, id ASC) AS new_sort_order
        FROM category_subcategories
        WHERE course_category_id = $1
      )
      UPDATE category_subcategories cs
      SET sort_order = ordered.new_sort_order
      FROM ordered
      WHERE cs.id = ordered.id
      `,
      [current.course_category_id]
    );

    const refreshedCurrentResult = await client.query(
      `
      SELECT id, course_category_id, sort_order
      FROM category_subcategories
      WHERE id = $1
      LIMIT 1
      `,
      [subcategoryId]
    );

    const refreshedCurrent = refreshedCurrentResult.rows[0];

    const neighborResult = await client.query(
      direction === "up"
        ? `
          SELECT id, sort_order
          FROM category_subcategories
          WHERE course_category_id = $1
            AND sort_order < $2
          ORDER BY sort_order DESC, id DESC
          LIMIT 1
          `
        : `
          SELECT id, sort_order
          FROM category_subcategories
          WHERE course_category_id = $1
            AND sort_order > $2
          ORDER BY sort_order ASC, id ASC
          LIMIT 1
          `,
      [refreshedCurrent.course_category_id, refreshedCurrent.sort_order]
    );

    if (neighborResult.rows.length === 0) {
      await client.query("COMMIT");
      return res.json({
        success: true,
        moved: false,
        reason: direction === "up" ? "Already first" : "Already last",
      });
    }

    const neighbor = neighborResult.rows[0];

    await client.query(
      `
      UPDATE category_subcategories
      SET sort_order = CASE
        WHEN id = $1 THEN $4
        WHEN id = $3 THEN $2
        ELSE sort_order
      END
      WHERE id IN ($1, $3)
      `,
      [
        refreshedCurrent.id,
        refreshedCurrent.sort_order,
        neighbor.id,
        neighbor.sort_order,
      ]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      moved: true,
      subcategory_id: refreshedCurrent.id,
      swapped_with_subcategory_id: neighbor.id,
      direction,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("POST /api/subcategories/:subcategoryId/reorder rollback failed:", rollbackErr);
    }

    console.error("POST /api/subcategories/:subcategoryId/reorder failed:", err);
    return res.status(500).json({ error: "Failed to reorder evidence tier" });
  } finally {
    client.release();
  }
});


app.get("/api/categories/:categoryId/subcategories", async (req, res) => {
  try {
    const categoryId = Number(req.params.categoryId);

    if (!categoryId) {
      return res.status(400).json({ error: "Valid categoryId required" });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        course_category_id AS category_id,
        name,
        weight_percent_of_parent,
        level_number,
        sort_order
      FROM category_subcategories
      WHERE course_category_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [categoryId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("GET subcategories failed:", err);
    return res.status(500).json({ error: "Failed to load subcategories" });
  }
});

/* GET ASSIGNMENTS */
app.get("/api/assignments", async (req, res) => {
  try {
    await pool.query(`
      ALTER TABLE assignments
      ADD COLUMN IF NOT EXISTS sort_order INTEGER
    `);

    await pool.query(`
      WITH ordered AS (
        SELECT
          id,
          ROW_NUMBER() OVER (PARTITION BY class_id ORDER BY COALESCE(sort_order, id), id) AS new_sort_order
        FROM assignments
      )
      UPDATE assignments a
      SET sort_order = ordered.new_sort_order
      FROM ordered
      WHERE a.id = ordered.id
        AND a.sort_order IS NULL
    `);

    const result = await pool.query(`
      SELECT
        a.*,
        cs.name AS subcategory_name,
        cc.name AS category_name,
        cc.weight_percent AS category_weight_percent,
        cs.weight_percent_of_parent,
        COUNT(s.id)::INTEGER AS submission_count,
        COUNT(s.id) FILTER (
          WHERE s.score IS NOT NULL
             OR s.grade IS NOT NULL
             OR s.feedback IS NOT NULL
             OR s.rubric_selection IS NOT NULL
        )::INTEGER AS graded_count,
        (
          COUNT(s.id) -
          COUNT(s.id) FILTER (
            WHERE s.score IS NOT NULL
               OR s.grade IS NOT NULL
               OR s.feedback IS NOT NULL
               OR s.rubric_selection IS NOT NULL
          )
        )::INTEGER AS ungraded_count
      FROM assignments a
      LEFT JOIN category_subcategories cs
        ON cs.id = a.subcategory_id
      LEFT JOIN course_categories cc
        ON cc.id = cs.course_category_id
      LEFT JOIN submissions s
        ON s.assignment_id = a.id
      GROUP BY
        a.id,
        cs.name,
        cc.name,
        cc.weight_percent,
        cs.weight_percent_of_parent
      ORDER BY a.class_id ASC, a.sort_order ASC, a.id ASC
    `);

    return res.json(
      result.rows.map((assignment) => ({
        ...assignment,
        calculated_weight:
          assignment.category_weight_percent !== null &&
          assignment.category_weight_percent !== undefined &&
          assignment.weight_percent_of_parent !== null &&
          assignment.weight_percent_of_parent !== undefined
            ? (Number(assignment.category_weight_percent) *
                Number(assignment.weight_percent_of_parent)) /
              100
            : null,
      }))
    );
  } catch (err) {
    console.error("GET assignments failed:", err);
    return res.status(500).json({ error: "Failed to load assignments" });
  }
});

/* CREATE ASSIGNMENT */
app.post("/api/assignments", async (req, res) => {
  try {
    await pool.query(`
      ALTER TABLE assignments
      ADD COLUMN IF NOT EXISTS sort_order INTEGER
    `);

    const { class_id, teacher_id, title, description, due_date, subcategory_id } = req.body;

    if (!class_id || !title || !subcategory_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const sortResult = await pool.query(
      `
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
      FROM assignments
      WHERE class_id = $1
      `,
      [class_id]
    );

    const sortOrder = Number(sortResult.rows[0]?.next_sort_order || 1);

    const result = await pool.query(
      `INSERT INTO assignments (class_id, teacher_id, title, description, due_date, subcategory_id, is_published, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,true,$7)
       RETURNING *`,
      [class_id, teacher_id, title, description, due_date, subcategory_id, sortOrder]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("POST assignment failed:", err);
    return res.status(500).json({ error: "Failed to create assignment" });
  }
});


/* DUPLICATE ASSIGNMENT */
app.post("/api/assignments/:assignmentId/duplicate", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureAssignmentSectionTables();

    const assignmentId = Number(req.params.assignmentId);
    const requestedTitle = String(req.body.title || "").trim();

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    const sourceResult = await client.query(
      `
      SELECT
        id,
        class_id,
        teacher_id,
        title,
        description,
        due_date,
        subcategory_id,
        is_published
      FROM assignments
      WHERE id = $1
      LIMIT 1
      `,
      [assignmentId]
    );

    if (sourceResult.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    const source = sourceResult.rows[0];
    const newTitle = requestedTitle || `${source.title} Copy`;

    await client.query("BEGIN");

    const newAssignmentResult = await client.query(
      `
      INSERT INTO assignments (
        class_id,
        teacher_id,
        title,
        description,
        due_date,
        subcategory_id,
        is_published
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        source.class_id,
        source.teacher_id || null,
        newTitle,
        source.description || "",
        source.due_date || null,
        source.subcategory_id || null,
        source.is_published === false ? false : true,
      ]
    );

    const newAssignment = newAssignmentResult.rows[0];

    const sectionResult = await client.query(
      `
      SELECT
        section_name,
        competency_bucket,
        max_points,
        section_weight,
        sort_order
      FROM assignment_sections
      WHERE assignment_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [assignmentId]
    );

    let copiedSectionCount = 0;

    for (const section of sectionResult.rows) {
      await client.query(
        `
        INSERT INTO assignment_sections (
          assignment_id,
          section_name,
          competency_bucket,
          max_points,
          section_weight,
          sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          newAssignment.id,
          section.section_name,
          section.competency_bucket,
          Number(section.max_points || 0),
          Number(section.section_weight || 1),
          Number(section.sort_order || 1),
        ]
      );

      copiedSectionCount += 1;
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      assignment: newAssignment,
      copied: {
        assignment_sections: copiedSectionCount,
      },
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("POST /api/assignments/:assignmentId/duplicate rollback failed:", rollbackErr);
    }

    console.error("POST /api/assignments/:assignmentId/duplicate failed:", err);
    return res.status(500).json({ error: "Failed to duplicate assignment" });
  } finally {
    client.release();
  }
});





/* REORDER ASSIGNMENT */
app.post("/api/assignments/:assignmentId/reorder", async (req, res) => {
  const client = await pool.connect();

  try {
    const assignmentId = Number(req.params.assignmentId);
    const direction = String(req.body.direction || "").trim().toLowerCase();

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    if (!["up", "down"].includes(direction)) {
      return res.status(400).json({ error: "Direction must be up or down" });
    }

    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE assignments
      ADD COLUMN IF NOT EXISTS sort_order INTEGER
    `);

    const currentResult = await client.query(
      `
      SELECT id, class_id, sort_order
      FROM assignments
      WHERE id = $1
      LIMIT 1
      `,
      [assignmentId]
    );

    if (currentResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Assignment not found" });
    }

    const current = currentResult.rows[0];

    await client.query(
      `
      WITH ordered AS (
        SELECT
          id,
          ROW_NUMBER() OVER (ORDER BY COALESCE(sort_order, id), id) AS new_sort_order
        FROM assignments
        WHERE class_id = $1
      )
      UPDATE assignments a
      SET sort_order = ordered.new_sort_order
      FROM ordered
      WHERE a.id = ordered.id
      `,
      [current.class_id]
    );

    const refreshedCurrentResult = await client.query(
      `
      SELECT id, class_id, sort_order
      FROM assignments
      WHERE id = $1
      LIMIT 1
      `,
      [assignmentId]
    );

    const refreshedCurrent = refreshedCurrentResult.rows[0];

    const neighborResult = await client.query(
      direction === "up"
        ? `
          SELECT id, sort_order
          FROM assignments
          WHERE class_id = $1
            AND sort_order < $2
          ORDER BY sort_order DESC, id DESC
          LIMIT 1
          `
        : `
          SELECT id, sort_order
          FROM assignments
          WHERE class_id = $1
            AND sort_order > $2
          ORDER BY sort_order ASC, id ASC
          LIMIT 1
          `,
      [refreshedCurrent.class_id, refreshedCurrent.sort_order]
    );

    if (neighborResult.rows.length === 0) {
      await client.query("COMMIT");
      return res.json({
        success: true,
        moved: false,
        reason: direction === "up" ? "Already first" : "Already last",
      });
    }

    const neighbor = neighborResult.rows[0];

    await client.query(
      `
      UPDATE assignments
      SET sort_order = CASE
        WHEN id = $1 THEN $4
        WHEN id = $3 THEN $2
        ELSE sort_order
      END
      WHERE id IN ($1, $3)
      `,
      [
        refreshedCurrent.id,
        refreshedCurrent.sort_order,
        neighbor.id,
        neighbor.sort_order,
      ]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      moved: true,
      assignment_id: refreshedCurrent.id,
      swapped_with_assignment_id: neighbor.id,
      direction,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("POST /api/assignments/:assignmentId/reorder rollback failed:", rollbackErr);
    }

    console.error("POST /api/assignments/:assignmentId/reorder failed:", err);
    return res.status(500).json({ error: "Failed to reorder assignment" });
  } finally {
    client.release();
  }
});


/* UPDATE ASSIGNMENT */
app.put("/api/assignments/:assignmentId", async (req, res) => {
  try {
    const assignmentId = Number(req.params.assignmentId);
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const dueDate = req.body.due_date || null;
    const subcategoryId = req.body.subcategory_id ? Number(req.body.subcategory_id) : null;

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    if (!title) {
      return res.status(400).json({ error: "Assignment title is required" });
    }

    const existingAssignmentResult = await pool.query(
      `
      SELECT subcategory_id
      FROM assignments
      WHERE id = $1
      LIMIT 1
      `,
      [assignmentId]
    );

    if (existingAssignmentResult.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    const finalSubcategoryId =
      subcategoryId || existingAssignmentResult.rows[0].subcategory_id;

    if (!finalSubcategoryId) {
      return res.status(400).json({ error: "Subcategory is required" });
    }

    const result = await pool.query(
      `
      UPDATE assignments
      SET title = $1,
          description = $2,
          due_date = $3,
          subcategory_id = $4,
          updated_at = NOW()
      WHERE id = $5
      RETURNING *
      `,
      [title, description, dueDate, finalSubcategoryId, assignmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    const weightResult = await pool.query(
      `
      SELECT
        cc.weight_percent AS category_weight_percent,
        cs.weight_percent_of_parent
      FROM category_subcategories cs
      JOIN course_categories cc
        ON cc.id = cs.course_category_id
      WHERE cs.id = $1
      LIMIT 1
      `,
      [finalSubcategoryId]
    );

    let calculatedWeight = null;

    if (weightResult.rows.length > 0) {
      calculatedWeight =
        (Number(weightResult.rows[0].category_weight_percent) *
          Number(weightResult.rows[0].weight_percent_of_parent)) /
        100;
    }

    return res.json({
      ...result.rows[0],
      calculated_weight: calculatedWeight,
    });
  } catch (err) {
    console.error("PUT /api/assignments/:assignmentId failed:", err);
    return res.status(500).json({ error: "Failed to update assignment" });
  }
});

/* DELETE ASSIGNMENT */
app.delete("/api/assignments/:assignmentId", async (req, res) => {
  try {
    const assignmentId = Number(req.params.assignmentId);

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    const result = await pool.query(
      `
      DELETE FROM assignments
      WHERE id = $1
      RETURNING *
      `,
      [assignmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    return res.json({
      success: true,
      deleted: result.rows[0],
    });
  } catch (err) {
    console.error("DELETE /api/assignments/:assignmentId failed:", err);
    return res.status(500).json({ error: "Failed to delete assignment" });
  }
});


/* GET SINGLE STUDENT SUBMISSION FOR ASSIGNMENT */
app.get(
  "/api/assignments/:assignmentId/student-submission",
  async (req, res) => {
    try {
      const assignmentId = Number(req.params.assignmentId);
      const studentEmail = String(req.query.student_email || "")
        .trim()
        .toLowerCase();

      if (!assignmentId) {
        return res.status(400).json({ error: "Valid assignmentId is required" });
      }

      if (!studentEmail) {
        return res.status(400).json({ error: "student_email is required" });
      }

      const assignmentResult = await pool.query(
        `
        SELECT id, class_id, title, description, due_date, subcategory_id
        FROM assignments
        WHERE id = $1
        LIMIT 1
        `,
        [assignmentId]
      );

      if (assignmentResult.rows.length === 0) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      const submissionResult = await pool.query(
        `
        SELECT
          id,
          assignment_id,
          student_name,
          student_email,
          content,
          score,
          feedback,
          grade,
          rubric_selection
        FROM submissions
        WHERE assignment_id = $1
          AND LOWER(student_email) = $2
        LIMIT 1
        `,
        [assignmentId, studentEmail]
      );

      const submission = submissionResult.rows[0] || null;
      const hasSubmittedContent =
        submission && String(submission.content || "").trim() !== "";

      return res.json({
        assignment: assignmentResult.rows[0],
        submission,
        submission_status: hasSubmittedContent ? "submitted" : "not_submitted",
      });
    } catch (err) {
      console.error("GET /api/assignments/:assignmentId/student-submission failed:", err);
      return res.status(500).json({ error: "Failed to fetch student submission" });
    }
  }
);

/* SAVE STUDENT SUBMISSION */
app.post("/api/assignments/:assignmentId/student-submit", async (req, res) => {
  try {
    const assignmentId = Number(req.params.assignmentId);
    const studentName = String(req.body.student_name || "").trim();
    const studentEmail = String(req.body.student_email || "")
      .trim()
      .toLowerCase();
    const content = String(req.body.content || "").trim();

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    if (!studentName) {
      return res.status(400).json({ error: "student_name is required" });
    }

    if (!studentEmail) {
      return res.status(400).json({ error: "student_email is required" });
    }

    if (!content) {
      return res.status(400).json({ error: "Submission content is required" });
    }

    const assignmentResult = await pool.query(
      `
      SELECT id, class_id, title, description, due_date, subcategory_id
      FROM assignments
      WHERE id = $1
      LIMIT 1
      `,
      [assignmentId]
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    const existingResult = await pool.query(
      `
      SELECT id
      FROM submissions
      WHERE assignment_id = $1
        AND LOWER(student_email) = $2
      LIMIT 1
      `,
      [assignmentId, studentEmail]
    );

    if (existingResult.rows.length > 0) {
      const updatedResult = await pool.query(
        `
        UPDATE submissions
        SET
          student_name = $1,
          student_email = $2,
          content = $3
        WHERE id = $4
        RETURNING
          id,
          assignment_id,
          student_name,
          student_email,
          content,
          score,
          feedback,
          grade,
          rubric_selection
        `,
        [studentName, studentEmail, content, existingResult.rows[0].id]
      );

      return res.json({
        success: true,
        submission_status: "submitted",
        assignment: assignmentResult.rows[0],
        submission: updatedResult.rows[0],
      });
    }

    const insertedResult = await pool.query(
      `
      INSERT INTO submissions (
        assignment_id,
        student_name,
        student_email,
        content,
        score,
        feedback,
        grade,
        rubric_selection
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        assignment_id,
        student_name,
        student_email,
        content,
        score,
        feedback,
        grade,
        rubric_selection
      `,
      [assignmentId, studentName, studentEmail, content, null, "", null, null]
    );

    return res.json({
      success: true,
      submission_status: "submitted",
      assignment: assignmentResult.rows[0],
      submission: insertedResult.rows[0],
    });
  } catch (err) {
    console.error("POST /api/assignments/:assignmentId/student-submit failed:", err);
    return res.status(500).json({ error: "Failed to save student submission" });
  }
});



/* LIST STUDENT ATTACHMENTS FOR ASSIGNMENT */
app.get("/api/assignments/:assignmentId/student-attachments", async (req, res) => {
  try {
    await ensureSubmissionAttachmentsTable();

    const assignmentId = Number(req.params.assignmentId);
    const studentEmail = String(req.query.student_email || "").trim().toLowerCase();

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    if (!studentEmail) {
      return res.status(400).json({ error: "student_email is required" });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        submission_id,
        assignment_id,
        student_email,
        original_name,
        stored_name,
        file_path,
        mime_type,
        size_bytes,
        created_at
      FROM submission_attachments
      WHERE assignment_id = $1
        AND LOWER(student_email) = $2
      ORDER BY created_at DESC, id DESC
      `,
      [assignmentId, studentEmail]
    );

    return res.json({
      success: true,
      attachments: result.rows,
    });
  } catch (err) {
    console.error("GET /api/assignments/:assignmentId/student-attachments failed:", err);
    return res.status(500).json({ error: "Failed to load student attachments" });
  }
});


/* UPLOAD STUDENT ATTACHMENT FOR ASSIGNMENT */
app.post(
  "/api/assignments/:assignmentId/student-attachments",
  upload.single("attachment"),
  async (req, res) => {
    try {
      await ensureSubmissionAttachmentsTable();

      const assignmentId = Number(req.params.assignmentId);
      const studentEmail = String(req.body.student_email || "").trim().toLowerCase();

      if (!assignmentId) {
        return res.status(400).json({ error: "Valid assignmentId is required" });
      }

      if (!studentEmail) {
        return res.status(400).json({ error: "student_email is required" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Attachment file is required" });
      }

      const assignmentResult = await pool.query(
        `
        SELECT id
        FROM assignments
        WHERE id = $1
        LIMIT 1
        `,
        [assignmentId]
      );

      if (assignmentResult.rows.length === 0) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      const submissionResult = await pool.query(
        `
        SELECT id
        FROM submissions
        WHERE assignment_id = $1
          AND LOWER(student_email) = $2
        LIMIT 1
        `,
        [assignmentId, studentEmail]
      );

      let submissionId = submissionResult.rows[0]?.id || null;

      if (!submissionId) {
        const userResult = await pool.query(
          `
          SELECT name
          FROM users
          WHERE LOWER(email) = $1
          LIMIT 1
          `,
          [studentEmail]
        );

        const studentName = userResult.rows[0]?.name || studentEmail;

        const insertedSubmissionResult = await pool.query(
          `
          INSERT INTO submissions (
            assignment_id,
            student_name,
            student_email,
            content,
            score,
            feedback,
            grade,
            rubric_selection
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
          `,
          [assignmentId, studentName, studentEmail, "", null, "", null, null]
        );

        submissionId = insertedSubmissionResult.rows[0].id;
      }

      const storedName = req.file.filename;
      const originalName = req.file.originalname || storedName;
      const filePath = `/uploads/${storedName}`;
      const mimeType = req.file.mimetype || "";
      const sizeBytes = Number(req.file.size || 0);

      const attachmentResult = await pool.query(
        `
        INSERT INTO submission_attachments (
          submission_id,
          assignment_id,
          student_email,
          original_name,
          stored_name,
          file_path,
          mime_type,
          size_bytes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING
          id,
          submission_id,
          assignment_id,
          student_email,
          original_name,
          stored_name,
          file_path,
          mime_type,
          size_bytes,
          created_at
        `,
        [
          submissionId,
          assignmentId,
          studentEmail,
          originalName,
          storedName,
          filePath,
          mimeType,
          sizeBytes,
        ]
      );

      return res.json({
        success: true,
        attachment: attachmentResult.rows[0],
      });
    } catch (err) {
      console.error("POST /api/assignments/:assignmentId/student-attachments failed:", err);
      return res.status(500).json({ error: "Failed to upload student attachment" });
    }
  }
);

/* DELETE STUDENT ATTACHMENT */
app.delete("/api/student-attachments/:attachmentId", async (req, res) => {
  try {
    await ensureSubmissionAttachmentsTable();

    const attachmentId = Number(req.params.attachmentId);

    if (!attachmentId) {
      return res.status(400).json({ error: "Valid attachmentId is required" });
    }

    const attachmentResult = await pool.query(
      `
      SELECT
        id,
        stored_name,
        file_path
      FROM submission_attachments
      WHERE id = $1
      LIMIT 1
      `,
      [attachmentId]
    );

    if (attachmentResult.rows.length === 0) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    const attachment = attachmentResult.rows[0];

    await pool.query(
      `
      DELETE FROM submission_attachments
      WHERE id = $1
      `,
      [attachmentId]
    );

    const storedName = String(attachment.stored_name || "").trim();

    if (storedName) {
      const safeFilePath = path.join(uploadDir, path.basename(storedName));

      try {
        if (fs.existsSync(safeFilePath)) {
          fs.unlinkSync(safeFilePath);
        }
      } catch (fileError) {
        console.error("Attachment file delete warning:", fileError);
      }
    }

    return res.json({
      success: true,
      deleted_attachment_id: attachmentId,
    });
  } catch (err) {
    console.error("DELETE /api/student-attachments/:attachmentId failed:", err);
    return res.status(500).json({ error: "Failed to delete student attachment" });
  }
});


/* GET ASSIGNMENT GRADEBOOK */
app.get("/api/assignments/:assignmentId/gradebook", async (req, res) => {
  try {
    const assignmentId = Number(req.params.assignmentId);

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    const result = await pool.query(
      `
      SELECT
        u.id AS student_user_id,
        u.name AS student_name,
        u.email AS student_email,
        s.score,
        s.feedback,
        s.rubric_selection,
        CASE
          WHEN s.id IS NULL THEN 'None'
          ELSE 'Submitted'
        END AS submission_status
      FROM assignments a
      JOIN class_enrollments ce
        ON ce.class_id = a.class_id
      JOIN users u
        ON u.id = ce.student_user_id
      LEFT JOIN submissions s
        ON s.assignment_id = a.id
        AND LOWER(s.student_email) = LOWER(u.email)
      WHERE a.id = $1
      ORDER BY u.name ASC, u.email ASC
      `,
      [assignmentId]
    );

    return res.json({ rows: result.rows });
  } catch (err) {
    console.error("GET /api/assignments/:assignmentId/gradebook failed:", err);
    return res.status(500).json({ error: "Failed to load assignment gradebook" });
  }
});

/* SAVE KDU SCORES */
app.post("/api/assignments/:assignmentId/kdu-scores", async (req, res) => {
  try {
    const assignmentId = Number(req.params.assignmentId);
    const studentEmail = String(req.body.student_email || "").trim().toLowerCase();
    const doScore = Number(req.body.doScore);
    const knowScore = Number(req.body.knowScore);
    const understandScore = Number(req.body.understandScore);

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    if (!studentEmail) {
      return res.status(400).json({ error: "student_email is required" });
    }

    const rubricSelection = {
      DO: Number.isFinite(doScore) ? doScore : null,
      KNOW: Number.isFinite(knowScore) ? knowScore : null,
      UNDERSTAND: Number.isFinite(understandScore) ? understandScore : null,
    };

    const weightedScore =
      (Number(rubricSelection.DO || 0) * 0.5) +
      (Number(rubricSelection.KNOW || 0) * 0.25) +
      (Number(rubricSelection.UNDERSTAND || 0) * 0.25);

    const percentScore = Number(((weightedScore / 6) * 100).toFixed(2));

    const userResult = await pool.query(
      `
      SELECT name
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
      `,
      [studentEmail]
    );

    const studentName =
      userResult.rows.length > 0 ? userResult.rows[0].name : studentEmail;

    const existingResult = await pool.query(
      `
      SELECT id
      FROM submissions
      WHERE assignment_id = $1
        AND LOWER(student_email) = $2
      LIMIT 1
      `,
      [assignmentId, studentEmail]
    );

    let result;

    if (existingResult.rows.length > 0) {
      result = await pool.query(
        `
        UPDATE submissions
        SET score = $1,
            grade = $2,
            feedback = $3,
            rubric_selection = $4
        WHERE id = $5
        RETURNING *
        `,
        [
          percentScore,
          `${percentScore}%`,
          "KDU rubric scores saved.",
          rubricSelection,
          existingResult.rows[0].id,
        ]
      );
    } else {
      result = await pool.query(
        `
        INSERT INTO submissions (
          assignment_id,
          student_name,
          student_email,
          content,
          score,
          grade,
          feedback,
          rubric_selection
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        `,
        [
          assignmentId,
          studentName,
          studentEmail,
          "Teacher-entered KDU rubric score.",
          percentScore,
          `${percentScore}%`,
          "KDU rubric scores saved.",
          rubricSelection,
        ]
      );
    }

    return res.json({
      success: true,
      submission: result.rows[0],
      rubric_selection: rubricSelection,
      weighted_score: Number(weightedScore.toFixed(2)),
      percent_score: percentScore,
    });
  } catch (err) {
    console.error("POST /api/assignments/:assignmentId/kdu-scores failed:", err);
    return res.status(500).json({ error: "Failed to save KDU scores" });
  }
});

/* GET KDU RUBRIC FOR ASSIGNMENT */
app.get("/api/assignments/:assignmentId/kdu-rubric", async (req, res) => {
  try {
    const assignmentId = Number(req.params.assignmentId);

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    const rubricResult = await pool.query(
      `
      SELECT id, title
      FROM assignment_rubrics
      WHERE assignment_id = $1
        AND title = 'KDU Competency Rubric'
      LIMIT 1
      `,
      [assignmentId]
    );

    if (rubricResult.rows.length === 0) {
      return res.json({
        rubric: null,
        criteria: [],
      });
    }

    const rubric = rubricResult.rows[0];

    const criteriaResult = await pool.query(
      `
      SELECT
        id,
        criterion_text,
        sort_order,
        competency_bucket,
        bucket_weight_percent
      FROM rubric_criteria
      WHERE rubric_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [rubric.id]
    );

    return res.json({
      rubric,
      criteria: criteriaResult.rows,
    });
  } catch (err) {
    console.error("GET /api/assignments/:assignmentId/kdu-rubric failed:", err);
    return res.status(500).json({ error: "Failed to load KDU rubric" });
  }
});

/* SAVE KDU RUBRIC CRITERIA */
app.put("/api/assignments/:assignmentId/kdu-rubric", async (req, res) => {
  try {
    const assignmentId = Number(req.params.assignmentId);
    const criteria = Array.isArray(req.body.criteria) ? req.body.criteria : [];

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    if (criteria.length === 0) {
      return res.status(400).json({ error: "At least one criterion is required" });
    }

    const rubricResult = await pool.query(
      `
      SELECT id
      FROM assignment_rubrics
      WHERE assignment_id = $1
        AND title = 'KDU Competency Rubric'
      LIMIT 1
      `,
      [assignmentId]
    );

    if (rubricResult.rows.length === 0) {
      return res.status(404).json({ error: "Build the KDU rubric before editing it" });
    }

    const rubricId = rubricResult.rows[0].id;

    for (const item of criteria) {
      const criterionId = Number(item.id);
      const criterionText = String(item.criterion_text || "").trim();

      if (!criterionId || !criterionText) {
        continue;
      }

      await pool.query(
        `
        UPDATE rubric_criteria
        SET criterion_text = $1
        WHERE id = $2
          AND rubric_id = $3
        `,
        [criterionText, criterionId, rubricId]
      );
    }

    const updatedCriteriaResult = await pool.query(
      `
      SELECT
        id,
        criterion_text,
        sort_order,
        competency_bucket,
        bucket_weight_percent
      FROM rubric_criteria
      WHERE rubric_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [rubricId]
    );

    return res.json({
      success: true,
      rubric: {
        id: rubricId,
        title: "KDU Competency Rubric",
      },
      criteria: updatedCriteriaResult.rows,
    });
  } catch (err) {
    console.error("PUT /api/assignments/:assignmentId/kdu-rubric failed:", err);
    return res.status(500).json({ error: "Failed to save KDU rubric" });
  }
});


/* SAVE FULL GENERATED 6-LEVEL KDU RUBRIC JSON */
app.put("/api/assignments/:assignmentId/full-kdu-rubric", async (req, res) => {
  try {
    await ensureRubricFrameworkTables();

    const assignmentId = Number(req.params.assignmentId);
    const title = String(req.body.title || "Generated KDU Rubric").trim();
    const activityType = String(req.body.activityType || "").trim();
    const rubric = Array.isArray(req.body.rubric) ? req.body.rubric : [];

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    if (rubric.length === 0) {
      return res.status(400).json({ error: "Full rubric rows are required" });
    }

    const assignmentResult = await pool.query(
      `
      SELECT id
      FROM assignments
      WHERE id = $1
      LIMIT 1
      `,
      [assignmentId]
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    let rubricResult = await pool.query(
      `
      SELECT id
      FROM assignment_rubrics
      WHERE assignment_id = $1
        AND title = 'KDU Competency Rubric'
      LIMIT 1
      `,
      [assignmentId]
    );

    let rubricId;

    if (rubricResult.rows.length > 0) {
      rubricId = rubricResult.rows[0].id;
    } else {
      const insertedRubricResult = await pool.query(
        `
        INSERT INTO assignment_rubrics (assignment_id, title)
        VALUES ($1, 'KDU Competency Rubric')
        RETURNING id
        `,
        [assignmentId]
      );

      rubricId = insertedRubricResult.rows[0].id;
    }

    await pool.query(
      `
      UPDATE assignment_rubrics
      SET full_rubric_json = $1,
          full_rubric_activity_type = $2
      WHERE id = $3
      `,
      [
        JSON.stringify({
          title,
          rows: rubric,
          saved_at: new Date().toISOString(),
        }),
        activityType,
        rubricId,
      ]
    );

    return res.json({
      success: true,
      assignmentId,
      rubricId,
      title,
      activityType,
      rubric,
    });
  } catch (err) {
    console.error("PUT /api/assignments/:assignmentId/full-kdu-rubric failed:", err);
    return res.status(500).json({ error: "Failed to save full KDU rubric" });
  }
});

/* LOAD FULL GENERATED 6-LEVEL KDU RUBRIC JSON */
app.get("/api/assignments/:assignmentId/full-kdu-rubric", async (req, res) => {
  try {
    await ensureRubricFrameworkTables();

    const assignmentId = Number(req.params.assignmentId);

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        full_rubric_json,
        full_rubric_activity_type
      FROM assignment_rubrics
      WHERE assignment_id = $1
        AND title = 'KDU Competency Rubric'
      LIMIT 1
      `,
      [assignmentId]
    );

    if (result.rows.length === 0 || !result.rows[0].full_rubric_json) {
      return res.json({
        success: true,
        rubric: null,
      });
    }

    const savedRubric = result.rows[0].full_rubric_json;

    return res.json({
      success: true,
      rubricId: result.rows[0].id,
      title: savedRubric.title || "Generated KDU Rubric",
      activityType: result.rows[0].full_rubric_activity_type || "",
      rows: Array.isArray(savedRubric.rows) ? savedRubric.rows : [],
      savedAt: savedRubric.saved_at || null,
    });
  } catch (err) {
    console.error("GET /api/assignments/:assignmentId/full-kdu-rubric failed:", err);
    return res.status(500).json({ error: "Failed to load full KDU rubric" });
  }
});


/* BUILD KDU RUBRIC FOR ASSIGNMENT */
app.post("/api/assignments/:assignmentId/build-kdu-rubric", async (req, res) => {
  try {
    await ensureRubricFrameworkTables();

    const assignmentId = Number(req.params.assignmentId);

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    const assignmentResult = await pool.query(
      `
      SELECT id, title
      FROM assignments
      WHERE id = $1
      LIMIT 1
      `,
      [assignmentId]
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    await pool.query(`
      ALTER TABLE rubric_criteria
      ADD COLUMN IF NOT EXISTS competency_bucket TEXT
    `);

    await pool.query(`
      ALTER TABLE rubric_criteria
      ADD COLUMN IF NOT EXISTS bucket_weight_percent NUMERIC
    `);

    let rubricResult = await pool.query(
      `
      SELECT id
      FROM assignment_rubrics
      WHERE assignment_id = $1
        AND title = 'KDU Competency Rubric'
      LIMIT 1
      `,
      [assignmentId]
    );

    let rubricId;

    if (rubricResult.rows.length > 0) {
      rubricId = rubricResult.rows[0].id;
    } else {
      const insertedRubricResult = await pool.query(
        `
        INSERT INTO assignment_rubrics (assignment_id, title)
        VALUES ($1, 'KDU Competency Rubric')
        RETURNING id
        `,
        [assignmentId]
      );

      rubricId = insertedRubricResult.rows[0].id;
    }

    const templateCriteria = [
      {
        bucket: "DO",
        weight: 50,
        text: "Teacher-entered Content Learning Standards criteria: What skill, process, product, or performance will the student demonstrate?",
        sortOrder: 1,
      },
      {
        bucket: "KNOW",
        weight: 25,
        text: "Teacher-entered Curricular Competencies criteria: What content, vocabulary, concepts, rules, or genre features must the student know?",
        sortOrder: 2,
      },
      {
        bucket: "UNDERSTAND",
        weight: 25,
        text: "Teacher-entered Core Competencies criteria: How will the student explain the why, how, purpose, audience, or meaning behind their work?",
        sortOrder: 3,
      },
    ];

    for (const criterion of templateCriteria) {
      await pool.query(
        `
        INSERT INTO rubric_criteria (
          rubric_id,
          facet_id,
          criterion_text,
          sort_order,
          competency_bucket,
          bucket_weight_percent
        )
        SELECT $1, NULL, $2, $3, $4, $5
        WHERE NOT EXISTS (
          SELECT 1
          FROM rubric_criteria
          WHERE rubric_id = $1
            AND competency_bucket = $4
        )
        `,
        [
          rubricId,
          criterion.text,
          criterion.sortOrder,
          criterion.bucket,
          criterion.weight,
        ]
      );
    }

    const criteriaResult = await pool.query(
      `
      SELECT
        id,
        criterion_text,
        sort_order,
        competency_bucket,
        bucket_weight_percent
      FROM rubric_criteria
      WHERE rubric_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [rubricId]
    );

    return res.json({
      success: true,
      assignment: assignmentResult.rows[0],
      rubric: {
        id: rubricId,
        title: "KDU Competency Rubric",
      },
      criteria: criteriaResult.rows,
    });
  } catch (err) {
    console.error("POST /api/assignments/:assignmentId/build-kdu-rubric failed:", err);
    return res.status(500).json({ error: "Failed to build KDU rubric" });
  }
});



/* GENERATE FULL 6-LEVEL KDU RUBRIC - BUILDER LAYER ONLY */
app.post("/api/assignments/:assignmentId/generate-kdu-rubric", async (req, res) => {
  try {
    const assignmentId = Number(req.params.assignmentId);
    const {
      activityText = "",
      knowCriteria = "",
      doCriteria = "",
      understandCriteria = "",
    } = req.body || {};

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    if (!String(activityText || "").trim()) {
      return res.status(400).json({ error: "Activity text is required" });
    }

    const normalizedText = String(activityText || "").toLowerCase();
    const isLiterary =
      normalizedText.includes("poem") ||
      normalizedText.includes("poetry") ||
      normalizedText.includes("literary") ||
      normalizedText.includes("theme") ||
      normalizedText.includes("tone") ||
      normalizedText.includes("speaker") ||
      normalizedText.includes("audience") ||
      normalizedText.includes("symbol") ||
      normalizedText.includes("metaphor") ||
      normalizedText.includes("imagery");

    const title =
      normalizedText.includes("song of the sky loom")
        ? "Song of the Sky Loom"
        : "the activity text";

    const knowFocus =
      String(knowCriteria || "").trim() ||
      (isLiterary
        ? "key literary details, structure, imagery, symbolism, speaker, audience, and important words or phrases"
        : "key facts, vocabulary, details, concepts, and examples from the activity");

    const doFocus =
      String(doCriteria || "").trim() ||
      (isLiterary
        ? "identify, describe, analyze, explain, connect, interpret, and support ideas with evidence"
        : "complete the task, explain ideas clearly, use evidence, and connect details to meaning");

    const understandFocus =
      String(understandCriteria || "").trim() ||
      (isLiterary
        ? "theme, purpose, worldview, relationship, responsibility, culture, and deeper meaning"
        : "why the learning matters and how facts, skills, and bigger ideas connect");

    const rubric = [
      {
        level: 6,
        know: `I can explain the complex details in ${title}, including ${knowFocus}. I do not just name details — I explain how they work together.`,
        do: `My work is insightful. I can ${doFocus}, and I use strong evidence to explain why each detail matters. I move beyond summary into interpretation.`,
        understand: `I deeply understand ${understandFocus}. I can explain meaning, purpose, and connections beyond the assignment.`,
      },
      {
        level: 5,
        know: `I can clearly explain the important details in ${title}, including ${knowFocus}. I can show how several details connect to the meaning of the task.`,
        do: `My work is thoughtful. I can ${doFocus} with clear evidence and explanation. I usually explain the “so what?” instead of only listing answers.`,
        understand: `I understand ${understandFocus}. I can explain the deeper message and why it is important.`,
      },
      {
        level: 4,
        know: `I can identify and explain the key details in ${title}, including most of ${knowFocus}. My answers are accurate and complete.`,
        do: `My work is clear. I complete the task, use relevant evidence, and explain my thinking in a way that makes sense.`,
        understand: `I understand the main message connected to ${understandFocus}. I can explain the basic importance of the task.`,
      },
      {
        level: 3,
        know: `I can identify some details in ${title}, but I may miss, confuse, or only briefly explain parts of ${knowFocus}.`,
        do: `My work is developing. I answer parts of the task, but I often summarize, repeat, or give thin explanations instead of explaining why details matter.`,
        understand: `I have a basic understanding of ${understandFocus}, but I need support to explain the deeper meaning clearly.`,
      },
      {
        level: 2,
        know: `I can identify a few simple details in ${title}, but I need help understanding and explaining ${knowFocus}.`,
        do: `My work is beginning. I may start the task, but some responses are incomplete, unclear, missing evidence, or missing explanation.`,
        understand: `I am beginning to understand ${understandFocus}, but I am not yet clear about why these ideas matter.`,
      },
      {
        level: 1,
        know: `I need help identifying the important details in ${title}.`,
        do: `I need support to begin analyzing, explaining, connecting, and using evidence.`,
        understand: `I am still working toward understanding the meaning, purpose, and significance of the task.`,
      },
    ];

    return res.json({
      success: true,
      assignmentId,
      activityType: isLiterary ? "literary_analysis" : "general",
      rubric,
    });
  } catch (err) {
    console.error("POST /api/assignments/:assignmentId/generate-kdu-rubric failed:", err);
    return res.status(500).json({ error: "Failed to generate KDU rubric" });
  }
});



/* EXPORT FULL 6-LEVEL KDU RUBRIC TO WORD DOC */
app.post("/api/assignments/:assignmentId/export-kdu-rubric-docx", async (req, res) => {
  try {
    const assignmentId = Number(req.params.assignmentId);
    const title = String(req.body.title || "Generated KDU Rubric").trim();
    const activityType = String(req.body.activityType || "").trim();
    const rubric = Array.isArray(req.body.rubric) ? req.body.rubric : [];

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    if (rubric.length === 0) {
      return res.status(400).json({ error: "Rubric rows are required" });
    }

    const tableRows = [
      new TableRow({
        children: ["Level", "KNOW", "DO", "UNDERSTAND"].map(
          (heading) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: heading, bold: true })],
                }),
              ],
            })
        ),
      }),
      ...rubric.map(
        (row) =>
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(String(row.level || ""))] }),
              new TableCell({ children: [new Paragraph(String(row.know || ""))] }),
              new TableCell({ children: [new Paragraph(String(row.do || ""))] }),
              new TableCell({ children: [new Paragraph(String(row.understand || ""))] }),
            ],
          })
      ),
    ];

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [new TextRun({ text: title, bold: true, size: 32 })],
            }),
            new Paragraph(""),
            new Paragraph(`Assignment ID: ${assignmentId}`),
            activityType ? new Paragraph(`Detected activity type: ${activityType}`) : new Paragraph(""),
            new Paragraph(""),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: tableRows,
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const safeFileName = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "kdu-rubric"}.docx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
    return res.send(buffer);
  } catch (err) {
    console.error("POST /api/assignments/:assignmentId/export-kdu-rubric-docx failed:", err);
    return res.status(500).json({ error: "Failed to export KDU rubric Word document" });
  }
});


/* SET UP ENGLISH STUDIES 12 ASSESSMENT STRUCTURE */
app.post("/api/courses/:courseId/setup-kdu-assessment-structure", async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const replaceExisting = Boolean(req.body?.replaceExisting);

    if (!courseId) {
      return res.status(400).json({ error: "Valid courseId is required" });
    }

    const courseResult = await pool.query(
      `
      SELECT id, title
      FROM courses
      WHERE id = $1
      LIMIT 1
      `,
      [courseId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    const existingResult = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM course_categories
      WHERE course_id = $1
      `,
      [courseId]
    );

    const existingCount = Number(existingResult.rows[0]?.count || 0);

    if (existingCount > 0 && !replaceExisting) {
      return res.status(409).json({
        error: "This course already has assessment groups. Send replaceExisting: true to replace them.",
        existing_count: existingCount,
      });
    }

    const templateGroups = [
      ["Literary Analysis Tier 1 Midterm", 10, 1],
      ["Literary Analysis Tier 1.1 Final Exam Part 2", 8, 2],
      ["Literary Analysis Tier 2", 10, 3],
      ["Literary Analysis Tier 3 Daily", 2, 4],
      ["Comparative & Synthesis Tier 1 Final Exam Essay", 8, 5],
      ["Comparative & Synthesis Tier 2", 5, 6],
      ["Comparative & Synthesis Tier 3 Daily", 2, 7],
      ["Formal Writing Tier 1 Midterm", 10, 8],
      ["Formal Writing Tier 2", 5, 9],
      ["Media & Media Literacy Analysis Tier 1", 10, 10],
      ["Media & Media Literacy Analysis Tier 2 Act Assessments", 8, 11],
      ["Media & Media Literacy Tier 3 Daily", 2, 12],
      ["Reflection and Collaboration Tier 1 Final Exam Part 1", 4, 13],
      ["Reflection & Collaborative Tier 2", 10, 14],
      ["Reflection & Collaborative Tier 3 Daily Annotations", 4, 15],
      ["Reflection and Collaborative Competencies", 2, 16],
    ];

    await pool.query("BEGIN");

    if (replaceExisting) {
      await pool.query(
        `
        UPDATE assignments
        SET subcategory_id = NULL
        WHERE class_id = $1
        `,
        [courseId]
      );

      await pool.query(
        `
        DELETE FROM course_categories
        WHERE course_id = $1
        `,
        [courseId]
      );
    }

    for (const [name, weightPercent, sortOrder] of templateGroups) {
      const categoryResult = await pool.query(
        `
        INSERT INTO course_categories (course_id, name, weight_percent, sort_order)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        `,
        [courseId, name, weightPercent, sortOrder]
      );

      await pool.query(
        `
        INSERT INTO category_subcategories (
          course_category_id,
          name,
          weight_percent_of_parent,
          level_number,
          sort_order
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          categoryResult.rows[0].id,
          "KDU Rubric Assessments",
          100,
          1,
          sortOrder,
        ]
      );
    }

    await pool.query("COMMIT");

    const structureResult = await pool.query(
      `
      SELECT
        cc.id AS category_id,
        cc.name AS assessment_group,
        cc.weight_percent,
        cs.id AS subcategory_id,
        cs.name AS assignment_bucket,
        cs.weight_percent_of_parent
      FROM course_categories cc
      LEFT JOIN category_subcategories cs
        ON cs.course_category_id = cc.id
      WHERE cc.course_id = $1
      ORDER BY cc.sort_order ASC, cc.id ASC
      `,
      [courseId]
    );

    return res.json({
      success: true,
      course: courseResult.rows[0],
      replaced_existing: replaceExisting,
      assessment_group_count: structureResult.rows.length,
      total_weight: structureResult.rows.reduce(
        (sum, row) => sum + Number(row.weight_percent || 0),
        0
      ),
      assessment_groups: structureResult.rows,
    });
  } catch (err) {
    await pool.query("ROLLBACK").catch(() => {});
    console.error("POST /api/courses/:courseId/setup-kdu-assessment-structure failed:", err);
    return res.status(500).json({ error: "Failed to set up KDU assessment structure" });
  }
});



/* COURSE STRUCTURE TEMPLATE API */
app.get("/api/course-structure-templates", async (req, res) => {
  try {
    await ensureCourseStructureTemplateTables();

    const templatesResult = await pool.query(
      `
      SELECT
        id,
        template_name,
        template_description,
        source_course_id,
        created_by_teacher_email,
        created_at,
        updated_at
      FROM course_structure_templates
      ORDER BY created_at DESC, id DESC
      `
    );

    const templates = [];

    for (const template of templatesResult.rows) {
      const categoriesResult = await pool.query(
        `
        SELECT
          id,
          template_id,
          name,
          weight_percent,
          sort_order
        FROM course_structure_template_categories
        WHERE template_id = $1
        ORDER BY sort_order ASC, id ASC
        `,
        [template.id]
      );

      const categories = [];

      for (const category of categoriesResult.rows) {
        const subcategoriesResult = await pool.query(
          `
          SELECT
            id,
            template_category_id,
            name,
            weight_percent_of_parent,
            level_number,
            sort_order
          FROM course_structure_template_subcategories
          WHERE template_category_id = $1
          ORDER BY sort_order ASC, id ASC
          `,
          [category.id]
        );

        categories.push({
          ...category,
          subcategories: subcategoriesResult.rows,
        });
      }

      templates.push({
        ...template,
        category_count: categories.length,
        subcategory_count: categories.reduce(
          (sum, category) => sum + Number(category.subcategories?.length || 0),
          0
        ),
        categories,
      });
    }

    return res.json({
      success: true,
      templates,
    });
  } catch (err) {
    console.error("GET /api/course-structure-templates failed:", err);
    return res.status(500).json({ error: "Failed to load course structure templates" });
  }
});


app.delete("/api/course-structure-templates/:templateId", async (req, res) => {
  try {
    await ensureCourseStructureTemplateTables();

    const templateId = Number(req.params.templateId);

    if (!templateId) {
      return res.status(400).json({ error: "Valid templateId is required" });
    }

    const result = await pool.query(
      `
      DELETE FROM course_structure_templates
      WHERE id = $1
      RETURNING id, template_name
      `,
      [templateId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Template not found" });
    }

    return res.json({
      success: true,
      deleted: result.rows[0],
    });
  } catch (err) {
    console.error("DELETE /api/course-structure-templates/:templateId failed:", err);
    return res.status(500).json({ error: "Failed to delete course structure template" });
  }
});


app.post("/api/courses/:courseId/apply-structure-template/:templateId", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureCourseStructureTemplateTables();

    const courseId = Number(req.params.courseId);
    const templateId = Number(req.params.templateId);
    const replaceExisting = Boolean(req.body.replace_existing || req.body.replaceExisting || false);

    if (!courseId) {
      return res.status(400).json({ error: "Valid courseId is required" });
    }

    if (!templateId) {
      return res.status(400).json({ error: "Valid templateId is required" });
    }

    const courseResult = await client.query(
      `
      SELECT
        c.id,
        c.title,
        u.email AS teacher_email
      FROM courses c
      LEFT JOIN users u
        ON u.id = c.teacher_id
      WHERE c.id = $1
      LIMIT 1
      `,
      [courseId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    const templateResult = await client.query(
      `
      SELECT id, template_name, template_description
      FROM course_structure_templates
      WHERE id = $1
      LIMIT 1
      `,
      [templateId]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: "Template not found" });
    }

    const existingResult = await client.query(
      `
      SELECT COUNT(*)::int AS count
      FROM course_categories
      WHERE course_id = $1
      `,
      [courseId]
    );

    const existingCount = Number(existingResult.rows[0]?.count || 0);

    if (existingCount > 0 && !replaceExisting) {
      return res.status(409).json({
        error: "This course already has Assessment Pathways. Send replace_existing: true to replace them.",
        existing_count: existingCount,
      });
    }

    const templateCategoriesResult = await client.query(
      `
      SELECT id, name, weight_percent, sort_order
      FROM course_structure_template_categories
      WHERE template_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [templateId]
    );

    const templateCategories = templateCategoriesResult.rows;

    if (templateCategories.length === 0) {
      return res.status(400).json({ error: "This template does not contain Assessment Pathways." });
    }

    await client.query("BEGIN");

    if (replaceExisting) {
      await client.query(
        `
        UPDATE assignments
        SET subcategory_id = NULL
        WHERE class_id = $1
        `,
        [courseId]
      );

      await client.query(
        `
        DELETE FROM course_categories
        WHERE course_id = $1
        `,
        [courseId]
      );
    }

    const createdCategories = [];

    for (const templateCategory of templateCategories) {
      const createdCategoryResult = await client.query(
        `
        INSERT INTO course_categories (
          course_id,
          name,
          weight_percent,
          sort_order
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, course_id, name, weight_percent, sort_order
        `,
        [
          courseId,
          templateCategory.name,
          templateCategory.weight_percent,
          templateCategory.sort_order || 1,
        ]
      );

      const createdCategory = createdCategoryResult.rows[0];

      const templateSubcategoriesResult = await client.query(
        `
        SELECT id, name, weight_percent_of_parent, level_number, sort_order
        FROM course_structure_template_subcategories
        WHERE template_category_id = $1
        ORDER BY sort_order ASC, id ASC
        `,
        [templateCategory.id]
      );

      const createdSubcategories = [];

      for (const templateSubcategory of templateSubcategoriesResult.rows) {
        const createdSubcategoryResult = await client.query(
          `
          INSERT INTO category_subcategories (
            course_category_id,
            name,
            weight_percent_of_parent,
            level_number,
            sort_order
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, course_category_id AS category_id, name, weight_percent_of_parent, level_number, sort_order
          `,
          [
            createdCategory.id,
            templateSubcategory.name,
            templateSubcategory.weight_percent_of_parent,
            templateSubcategory.level_number,
            templateSubcategory.sort_order || 1,
          ]
        );

        createdSubcategories.push(createdSubcategoryResult.rows[0]);
      }

      createdCategories.push({
        ...createdCategory,
        subcategories: createdSubcategories,
      });
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      course: courseResult.rows[0],
      template: templateResult.rows[0],
      replaced_existing: replaceExisting,
      category_count: createdCategories.length,
      subcategory_count: createdCategories.reduce(
        (sum, category) => sum + Number(category.subcategories?.length || 0),
        0
      ),
      categories: createdCategories,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Apply structure template rollback failed:", rollbackErr);
    }

    console.error("POST /api/courses/:courseId/apply-structure-template/:templateId failed:", err);
    return res.status(500).json({ error: "Failed to apply course structure template" });
  } finally {
    client.release();
  }
});


app.post("/api/courses/:courseId/save-structure-template", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureCourseStructureTemplateTables();

    const courseId = Number(req.params.courseId);
    const templateName = String(req.body.template_name || "").trim();
    const templateDescription = String(req.body.template_description || "").trim();
    const teacherEmail = String(req.body.teacher_email || "").trim().toLowerCase();

    if (!courseId) {
      return res.status(400).json({ error: "Valid courseId is required" });
    }

    if (!templateName) {
      return res.status(400).json({ error: "Template name is required" });
    }

    const courseResult = await client.query(
      `
      SELECT
        c.id,
        c.title,
        u.email AS teacher_email
      FROM courses c
      LEFT JOIN users u
        ON u.id = c.teacher_id
      WHERE c.id = $1
      LIMIT 1
      `,
      [courseId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    const categoriesResult = await client.query(
      `
      SELECT id, name, weight_percent, sort_order
      FROM course_categories
      WHERE course_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [courseId]
    );

    const categories = categoriesResult.rows;

    if (categories.length === 0) {
      return res.status(400).json({
        error: "This course does not have Assessment Pathways yet. Create pathways before saving a template.",
      });
    }

    await client.query("BEGIN");

    const templateResult = await client.query(
      `
      INSERT INTO course_structure_templates (
        template_name,
        template_description,
        source_course_id,
        created_by_teacher_email,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, template_name, template_description, source_course_id, created_by_teacher_email, created_at, updated_at
      `,
      [
        templateName,
        templateDescription,
        courseId,
        teacherEmail || courseResult.rows[0]?.teacher_email || "",
      ]
    );

    const template = templateResult.rows[0];
    const savedCategories = [];

    for (const category of categories) {
      const templateCategoryResult = await client.query(
        `
        INSERT INTO course_structure_template_categories (
          template_id,
          name,
          weight_percent,
          sort_order
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, template_id, name, weight_percent, sort_order
        `,
        [
          template.id,
          category.name,
          category.weight_percent,
          category.sort_order || 1,
        ]
      );

      const templateCategory = templateCategoryResult.rows[0];

      const subcategoriesResult = await client.query(
        `
        SELECT id, name, weight_percent_of_parent, level_number, sort_order
        FROM category_subcategories
        WHERE course_category_id = $1
        ORDER BY sort_order ASC, id ASC
        `,
        [category.id]
      );

      const savedSubcategories = [];

      for (const subcategory of subcategoriesResult.rows) {
        const templateSubcategoryResult = await client.query(
          `
          INSERT INTO course_structure_template_subcategories (
            template_category_id,
            name,
            weight_percent_of_parent,
            level_number,
            sort_order
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, template_category_id, name, weight_percent_of_parent, level_number, sort_order
          `,
          [
            templateCategory.id,
            subcategory.name,
            subcategory.weight_percent_of_parent,
            subcategory.level_number,
            subcategory.sort_order || 1,
          ]
        );

        savedSubcategories.push(templateSubcategoryResult.rows[0]);
      }

      savedCategories.push({
        ...templateCategory,
        subcategories: savedSubcategories,
      });
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      template,
      category_count: savedCategories.length,
      subcategory_count: savedCategories.reduce(
        (sum, category) => sum + Number(category.subcategories?.length || 0),
        0
      ),
      categories: savedCategories,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("Save structure template rollback failed:", rollbackErr);
    }

    console.error("POST /api/courses/:courseId/save-structure-template failed:", err);
    return res.status(500).json({ error: "Failed to save course structure template" });
  } finally {
    client.release();
  }
});


/* LEARNING PATHS API */
app.get("/api/courses/:courseId/learning-paths", async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);

    if (!courseId) {
      return res.status(400).json({ error: "Valid courseId is required" });
    }

    const courseResult = await pool.query(
      `
      SELECT id, title
      FROM courses
      WHERE id = $1
      LIMIT 1
      `,
      [courseId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    const pathsResult = await pool.query(
      `
      SELECT
        id,
        course_id,
        title,
        description,
        sort_order,
        is_published,
        created_at,
        updated_at
      FROM learning_paths
      WHERE course_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [courseId]
    );

    return res.json({
      success: true,
      course: courseResult.rows[0],
      learning_paths: pathsResult.rows,
    });
  } catch (err) {
    console.error("GET /api/courses/:courseId/learning-paths failed:", err);
    return res.status(500).json({ error: "Failed to load learning paths" });
  }
});

app.post("/api/courses/:courseId/learning-paths", async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();

    if (!courseId) {
      return res.status(400).json({ error: "Valid courseId is required" });
    }

    if (!title) {
      return res.status(400).json({ error: "Learning path title is required" });
    }

    const courseResult = await pool.query(
      `
      SELECT id, title
      FROM courses
      WHERE id = $1
      LIMIT 1
      `,
      [courseId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    const sortResult = await pool.query(
      `
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
      FROM learning_paths
      WHERE course_id = $1
      `,
      [courseId]
    );

    const nextSortOrder = Number(sortResult.rows[0]?.next_sort_order || 1);

    const result = await pool.query(
      `
      INSERT INTO learning_paths (
        course_id,
        title,
        description,
        sort_order,
        is_published,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, false, NOW(), NOW())
      RETURNING
        id,
        course_id,
        title,
        description,
        sort_order,
        is_published,
        created_at,
        updated_at
      `,
      [courseId, title, description, nextSortOrder]
    );

    return res.json({
      success: true,
      learning_path: result.rows[0],
    });
  } catch (err) {
    console.error("POST /api/courses/:courseId/learning-paths failed:", err);
    return res.status(500).json({ error: "Failed to create learning path" });
  }
});

app.delete("/api/learning-paths/:learningPathId", async (req, res) => {
  try {
    const learningPathId = Number(req.params.learningPathId);

    if (!learningPathId) {
      return res.status(400).json({ error: "Valid learningPathId is required" });
    }

    const result = await pool.query(
      `
      DELETE FROM learning_paths
      WHERE id = $1
      RETURNING id, course_id, title
      `,
      [learningPathId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Learning path not found" });
    }

    return res.json({
      success: true,
      deleted: result.rows[0],
    });
  } catch (err) {
    console.error("DELETE /api/learning-paths/:learningPathId failed:", err);
    return res.status(500).json({ error: "Failed to delete learning path" });
  }
});


/* LEARNING PATH ITEMS API */
app.get("/api/learning-paths/:learningPathId/items", async (req, res) => {
  try {
    await ensureLearningPathItemTables();

    const learningPathId = Number(req.params.learningPathId);

    if (!learningPathId) {
      return res.status(400).json({ error: "Valid learningPathId is required" });
    }

    const result = await pool.query(
      `
      SELECT
        lpi.id,
        lpi.learning_path_id,
        lpi.item_type,
        lpi.title,
        lpi.description,
        lpi.resource_url,
        lpi.assignment_id,
        a.title AS assignment_title,
        lpi.sort_order,
        lpi.is_required,
        lpi.created_at,
        lpi.updated_at
      FROM learning_path_items lpi
      LEFT JOIN assignments a
        ON a.id = lpi.assignment_id
      WHERE lpi.learning_path_id = $1
      ORDER BY lpi.sort_order ASC, lpi.id ASC
      `,
      [learningPathId]
    );

    return res.json({
      success: true,
      learning_path_id: learningPathId,
      items: result.rows,
    });
  } catch (err) {
    console.error("GET /api/learning-paths/:learningPathId/items failed:", err);
    return res.status(500).json({ error: "Failed to load learning path items" });
  }
});

app.post("/api/learning-paths/:learningPathId/items", async (req, res) => {
  try {
    await ensureLearningPathItemTables();

    const learningPathId = Number(req.params.learningPathId);
    const itemType = String(req.body.item_type || "lesson").trim().toLowerCase();
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const resourceUrl = String(req.body.resource_url || "").trim();
    const assignmentId = req.body.assignment_id ? Number(req.body.assignment_id) : null;
    const isRequired = req.body.is_required === undefined ? true : Boolean(req.body.is_required);

    if (!learningPathId) {
      return res.status(400).json({ error: "Valid learningPathId is required" });
    }

    if (!title) {
      return res.status(400).json({ error: "Learning path item title is required" });
    }

    const pathResult = await pool.query(
      `
      SELECT id
      FROM learning_paths
      WHERE id = $1
      LIMIT 1
      `,
      [learningPathId]
    );

    if (pathResult.rows.length === 0) {
      return res.status(404).json({ error: "Learning path not found" });
    }

    const sortResult = await pool.query(
      `
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
      FROM learning_path_items
      WHERE learning_path_id = $1
      `,
      [learningPathId]
    );

    const nextSortOrder = Number(sortResult.rows[0]?.next_sort_order || 1);

    const result = await pool.query(
      `
      INSERT INTO learning_path_items (
        learning_path_id,
        item_type,
        title,
        description,
        resource_url,
        assignment_id,
        sort_order,
        is_required,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING
        id,
        learning_path_id,
        item_type,
        title,
        description,
        resource_url,
        assignment_id,
        sort_order,
        is_required,
        created_at,
        updated_at
      `,
      [
        learningPathId,
        itemType,
        title,
        description,
        resourceUrl,
        assignmentId,
        nextSortOrder,
        isRequired,
      ]
    );

    return res.json({
      success: true,
      item: result.rows[0],
    });
  } catch (err) {
    console.error("POST /api/learning-paths/:learningPathId/items failed:", err);
    return res.status(500).json({ error: "Failed to create learning path item" });
  }
});

app.put("/api/learning-path-items/:itemId", async (req, res) => {
  try {
    await ensureLearningPathItemTables();

    const itemId = Number(req.params.itemId);
    const itemType = String(req.body.item_type || "lesson").trim().toLowerCase();
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const resourceUrl = String(req.body.resource_url || "").trim();
    const assignmentId = req.body.assignment_id ? Number(req.body.assignment_id) : null;
    const sortOrder = req.body.sort_order ? Number(req.body.sort_order) : 1;
    const isRequired = req.body.is_required === undefined ? true : Boolean(req.body.is_required);

    if (!itemId) {
      return res.status(400).json({ error: "Valid itemId is required" });
    }

    if (!title) {
      return res.status(400).json({ error: "Learning path item title is required" });
    }

    const result = await pool.query(
      `
      UPDATE learning_path_items
      SET item_type = $1,
          title = $2,
          description = $3,
          resource_url = $4,
          assignment_id = $5,
          sort_order = $6,
          is_required = $7,
          updated_at = NOW()
      WHERE id = $8
      RETURNING
        id,
        learning_path_id,
        item_type,
        title,
        description,
        resource_url,
        assignment_id,
        sort_order,
        is_required,
        created_at,
        updated_at
      `,
      [itemType, title, description, resourceUrl, assignmentId, sortOrder, isRequired, itemId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Learning path item not found" });
    }

    return res.json({
      success: true,
      item: result.rows[0],
    });
  } catch (err) {
    console.error("PUT /api/learning-path-items/:itemId failed:", err);
    return res.status(500).json({ error: "Failed to update learning path item" });
  }
});

app.delete("/api/learning-path-items/:itemId", async (req, res) => {
  try {
    await ensureLearningPathItemTables();

    const itemId = Number(req.params.itemId);

    if (!itemId) {
      return res.status(400).json({ error: "Valid itemId is required" });
    }

    const result = await pool.query(
      `
      DELETE FROM learning_path_items
      WHERE id = $1
      RETURNING id, learning_path_id, title
      `,
      [itemId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Learning path item not found" });
    }

    return res.json({
      success: true,
      deleted: result.rows[0],
    });
  } catch (err) {
    console.error("DELETE /api/learning-path-items/:itemId failed:", err);
    return res.status(500).json({ error: "Failed to delete learning path item" });
  }
});


async function applyEnglishStudiesCompetencyTemplate(client, courseId) {
  const learningCategories = [
    ["Literary Analysis", 20, 1],
    ["Formal Writing", 20, 2],
    ["Comparative & Synthesis", 20, 3],
    ["Media Literacy", 20, 4],
    ["Reflection & Collaboration", 20, 5],
  ];

  const tiers = [
    ["Tier 1 - Major Evidence", 40, 1, 1],
    ["Tier 2 - Developing Evidence", 35, 2, 2],
    ["Tier 3 - Daily / Process Evidence", 25, 3, 3],
  ];

  const createdCategories = [];

  for (const [categoryName, weightPercent, sortOrder] of learningCategories) {
    const categoryResult = await client.query(
      `
      INSERT INTO course_categories (course_id, name, weight_percent, sort_order)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, weight_percent, sort_order
      `,
      [courseId, categoryName, weightPercent, sortOrder]
    );

    const category = categoryResult.rows[0];
    const createdTiers = [];

    for (const [tierName, tierWeight, levelNumber, tierSortOrder] of tiers) {
      const subcategoryResult = await client.query(
        `
        INSERT INTO category_subcategories (
          course_category_id,
          name,
          weight_percent_of_parent,
          level_number,
          sort_order
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, weight_percent_of_parent, level_number, sort_order
        `,
        [category.id, tierName, tierWeight, levelNumber, tierSortOrder]
      );

      createdTiers.push(subcategoryResult.rows[0]);
    }

    createdCategories.push({
      ...category,
      subcategories: createdTiers,
    });
  }

  return createdCategories;
}


/* CREATE COURSE */
app.post("/api/courses", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query(`
      ALTER TABLE courses
      ADD COLUMN IF NOT EXISTS course_type TEXT DEFAULT 'custom_competency'
    `);

    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const teacherEmail = String(req.body.teacher_email || "").trim().toLowerCase();
    const requestedCourseType = String(req.body.course_type || "custom_competency").trim();

    const allowedCourseTypes = new Set([
      "english_11_template",
      "english_12_template",
      "custom_competency",
    ]);

    const courseType = allowedCourseTypes.has(requestedCourseType)
      ? requestedCourseType
      : "custom_competency";

    if (!title) {
      return res.status(400).json({ error: "Course title is required" });
    }

    await client.query("BEGIN");

    let teacherId = null;

    if (teacherEmail) {
      const teacherResult = await client.query(
        `
        SELECT id
        FROM users
        WHERE LOWER(email) = $1
        LIMIT 1
        `,
        [teacherEmail]
      );

      if (teacherResult.rows.length > 0) {
        teacherId = teacherResult.rows[0].id;
      }
    }

    const result = await client.query(
      `
      INSERT INTO courses (title, description, teacher_id, course_type)
      VALUES ($1, $2, $3, $4)
      RETURNING id, title, description, teacher_id, course_type, school_id, term_id, created_at
      `,
      [title, description, teacherId, courseType]
    );

    const course = result.rows[0];
    let templateCategories = [];

    if (courseType === "english_11_template" || courseType === "english_12_template") {
      templateCategories = await applyEnglishStudiesCompetencyTemplate(client, course.id);
    }

    await client.query("COMMIT");

    return res.json({
      ...course,
      template_applied: courseType === "english_11_template" || courseType === "english_12_template",
      template_category_count: templateCategories.length,
      template_subcategory_count: templateCategories.reduce(
        (sum, category) => sum + Number(category.subcategories?.length || 0),
        0
      ),
      template_categories: templateCategories,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("POST /api/courses rollback failed:", rollbackErr);
    }

    console.error("POST /api/courses failed:", err);
    return res.status(500).json({ error: "Failed to create course" });
  } finally {
    client.release();
  }
});


/* DUPLICATE COURSE */
app.post("/api/courses/:courseId/duplicate", async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureAssignmentSectionTables();

    const sourceCourseId = Number(req.params.courseId);
    const requestedTitle = String(req.body.title || "").trim();

    if (!sourceCourseId) {
      return res.status(400).json({ error: "Valid source courseId is required" });
    }

    const sourceCourseResult = await client.query(
      `
      SELECT id, title, description, teacher_id, course_type, school_id, term_id
      FROM courses
      WHERE id = $1
      LIMIT 1
      `,
      [sourceCourseId]
    );

    if (sourceCourseResult.rows.length === 0) {
      return res.status(404).json({ error: "Source course not found" });
    }

    const sourceCourse = sourceCourseResult.rows[0];
    const newTitle = requestedTitle || `${sourceCourse.title} Copy`;

    await client.query("BEGIN");

    const newCourseResult = await client.query(
      `
      INSERT INTO courses (title, description, teacher_id, course_type, school_id, term_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, title, description, teacher_id, course_type, school_id, term_id, created_at
      `,
      [
        newTitle,
        sourceCourse.description || "",
        sourceCourse.teacher_id || null,
        sourceCourse.course_type || "custom_competency",
        sourceCourse.school_id || null,
        sourceCourse.term_id || null,
      ]
    );

    const newCourse = newCourseResult.rows[0];

    const categoryResult = await client.query(
      `
      SELECT id, name, weight_percent, sort_order
      FROM course_categories
      WHERE course_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [sourceCourseId]
    );

    const categoryIdMap = new Map();
    const subcategoryIdMap = new Map();
    let copiedCategoryCount = 0;
    let copiedSubcategoryCount = 0;
    let copiedAssignmentCount = 0;
    let copiedSectionCount = 0;

    for (const category of categoryResult.rows) {
      const newCategoryResult = await client.query(
        `
        INSERT INTO course_categories (course_id, name, weight_percent, sort_order)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, weight_percent, sort_order
        `,
        [
          newCourse.id,
          category.name,
          Number(category.weight_percent || 0),
          Number(category.sort_order || 1),
        ]
      );

      const newCategory = newCategoryResult.rows[0];
      categoryIdMap.set(Number(category.id), Number(newCategory.id));
      copiedCategoryCount += 1;

      const subcategoryResult = await client.query(
        `
        SELECT id, name, weight_percent_of_parent, level_number, sort_order
        FROM category_subcategories
        WHERE course_category_id = $1
        ORDER BY sort_order ASC, id ASC
        `,
        [category.id]
      );

      for (const subcategory of subcategoryResult.rows) {
        const newSubcategoryResult = await client.query(
          `
          INSERT INTO category_subcategories (
            course_category_id,
            name,
            weight_percent_of_parent,
            level_number,
            sort_order
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, name, weight_percent_of_parent, level_number, sort_order
          `,
          [
            newCategory.id,
            subcategory.name,
            Number(subcategory.weight_percent_of_parent || 0),
            subcategory.level_number === null || subcategory.level_number === undefined
              ? null
              : Number(subcategory.level_number),
            Number(subcategory.sort_order || 1),
          ]
        );

        const newSubcategory = newSubcategoryResult.rows[0];
        subcategoryIdMap.set(Number(subcategory.id), Number(newSubcategory.id));
        copiedSubcategoryCount += 1;
      }
    }

    const assignmentResult = await client.query(
      `
      SELECT id, teacher_id, title, description, due_date, subcategory_id, is_published
      FROM assignments
      WHERE class_id = $1
      ORDER BY id ASC
      `,
      [sourceCourseId]
    );

    for (const assignment of assignmentResult.rows) {
      const oldSubcategoryId = assignment.subcategory_id ? Number(assignment.subcategory_id) : null;
      const newSubcategoryId = oldSubcategoryId ? subcategoryIdMap.get(oldSubcategoryId) || null : null;

      const newAssignmentResult = await client.query(
        `
        INSERT INTO assignments (
          class_id,
          teacher_id,
          title,
          description,
          due_date,
          subcategory_id,
          is_published
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        `,
        [
          newCourse.id,
          assignment.teacher_id || sourceCourse.teacher_id || null,
          assignment.title,
          assignment.description || "",
          assignment.due_date || null,
          newSubcategoryId,
          assignment.is_published === false ? false : true,
        ]
      );

      const newAssignmentId = Number(newAssignmentResult.rows[0].id);
      copiedAssignmentCount += 1;

      const sectionResult = await client.query(
        `
        SELECT section_name, competency_bucket, max_points, section_weight, sort_order
        FROM assignment_sections
        WHERE assignment_id = $1
        ORDER BY sort_order ASC, id ASC
        `,
        [assignment.id]
      );

      for (const section of sectionResult.rows) {
        await client.query(
          `
          INSERT INTO assignment_sections (
            assignment_id,
            section_name,
            competency_bucket,
            max_points,
            section_weight,
            sort_order
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            newAssignmentId,
            section.section_name,
            section.competency_bucket,
            Number(section.max_points || 0),
            Number(section.section_weight || 1),
            Number(section.sort_order || 1),
          ]
        );

        copiedSectionCount += 1;
      }
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      course: newCourse,
      copied: {
        categories: copiedCategoryCount,
        subcategories: copiedSubcategoryCount,
        assignments: copiedAssignmentCount,
        assignment_sections: copiedSectionCount,
      },
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("POST /api/courses/:courseId/duplicate rollback failed:", rollbackErr);
    }

    console.error("POST /api/courses/:courseId/duplicate failed:", err);
    return res.status(500).json({ error: "Failed to duplicate course" });
  } finally {
    client.release();
  }
});


/* DELETE COURSE */

/* UPDATE COURSE */
app.put("/api/courses/:courseId", async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const teacherEmail = String(req.body.teacher_email || "").trim().toLowerCase();
    const courseType = String(req.body.course_type || "custom_competency").trim();

    if (!courseId) {
      return res.status(400).json({ error: "Valid courseId is required" });
    }

    if (!title) {
      return res.status(400).json({ error: "Course title is required" });
    }

    const result = await pool.query(
      `
      UPDATE courses
      SET title = $1,
          description = $2
      WHERE id = $3
      RETURNING id, title, description, teacher_id
      `,
      [title, description, courseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /api/courses/:courseId failed:", err);
    return res.status(500).json({ error: "Failed to update course" });
  }
});

app.delete("/api/courses/:courseId", async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);

    if (!courseId) {
      return res.status(400).json({ error: "Valid courseId is required" });
    }

    await pool.query(`DELETE FROM class_enrollments WHERE class_id = $1`, [courseId]);
    await pool.query(`DELETE FROM course_categories WHERE course_id = $1`, [courseId]);

    const result = await pool.query(
      `
      DELETE FROM courses
      WHERE id = $1
      RETURNING *
      `,
      [courseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    return res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error("DELETE /api/courses/:courseId failed:", err);
    return res.status(500).json({ error: "Failed to delete course" });
  }
});


/* GET USERS */
app.get("/api/users", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        role,
        parent_email,
        student_id,
        created_at
      FROM users
      ORDER BY
        CASE LOWER(COALESCE(role, ''))
          WHEN 'admin' THEN 1
          WHEN 'teacher' THEN 2
          WHEN 'student' THEN 3
          ELSE 4
        END,
        name ASC,
        email ASC
      `
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("GET /api/users failed:", err);
    return res.status(500).json({ error: "Failed to load users" });
  }
});

/* CREATE OR PROMOTE TEACHER */
app.post("/api/teachers", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!name) {
      return res.status(400).json({ error: "Teacher name is required" });
    }

    if (!email) {
      return res.status(400).json({ error: "Teacher email is required" });
    }

    const existingUserResult = await pool.query(
      `
      SELECT id
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
      `,
      [email]
    );

    if (existingUserResult.rows.length > 0) {
      const updatedResult = await pool.query(
        `
        UPDATE users
        SET name = $1,
            role = 'teacher'
        WHERE id = $2
        RETURNING id, name, email, role, created_at
        `,
        [name, existingUserResult.rows[0].id]
      );

      return res.json({
        success: true,
        action: "updated_existing_user_to_teacher",
        teacher: updatedResult.rows[0],
      });
    }

    const insertedResult = await pool.query(
      `
      INSERT INTO users (name, email, role)
      VALUES ($1, $2, 'teacher')
      RETURNING id, name, email, role, created_at
      `,
      [name, email]
    );

    return res.json({
      success: true,
      action: "created_teacher",
      teacher: insertedResult.rows[0],
    });
  } catch (err) {
    console.error("POST /api/teachers failed:", err);
    return res.status(500).json({ error: "Failed to create teacher" });
  }
});

/* GET TEACHER DASHBOARD */
app.get("/api/teachers/:teacherId/dashboard", async (req, res) => {
  try {
    const teacherId = Number(req.params.teacherId);

    if (!teacherId) {
      return res.status(400).json({ error: "Valid teacherId is required" });
    }

    const teacherResult = await pool.query(
      `
      SELECT id, name, email, role
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [teacherId]
    );

    if (teacherResult.rows.length === 0) {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const coursesResult = await pool.query(
      `
      SELECT *
      FROM courses
      WHERE teacher_id = $1
      ORDER BY id ASC
      `,
      [teacherId]
    );

    const teacherCourseIds = coursesResult.rows.map((course) => Number(course.id)).filter(Boolean);

    let students = [];
    let grades = [];
    let kduHeatmap = [];

    if (teacherCourseIds.length > 0) {
      const studentsResult = await pool.query(
        `
        SELECT DISTINCT
          u.id,
          u.name,
          u.email,
          u.role,
          ce.class_id
        FROM class_enrollments ce
        JOIN users u
          ON u.id = ce.student_user_id
        WHERE ce.class_id = ANY($1::int[])
        ORDER BY u.name ASC, u.email ASC
        `,
        [teacherCourseIds]
      );

      students = studentsResult.rows;

      const gradesResult = await pool.query(
        `
        SELECT
          s.id,
          a.class_id,
          c.title AS course_title,
          s.student_name,
          s.student_email,
          s.score,
          s.grade,
          s.rubric_selection
        FROM submissions s
        JOIN assignments a
          ON a.id = s.assignment_id
        LEFT JOIN courses c
          ON c.id = a.class_id
        WHERE a.class_id = ANY($1::int[])
        ORDER BY s.id DESC
        `,
        [teacherCourseIds]
      );

      grades = gradesResult.rows;

      const heatmapByStudent = new Map();

      gradesResult.rows.forEach((row) => {
        const email = String(row.student_email || "").trim().toLowerCase();
        const studentName = row.student_name || email || "Unknown student";
        const key = email || studentName;

        if (!heatmapByStudent.has(key)) {
          heatmapByStudent.set(key, {
            student_name: studentName,
            student_email: email,
            course_title: row.course_title || "Course",
            KNOW: [],
            DO: [],
            UNDERSTAND: [],
          });
        }

        const entry = heatmapByStudent.get(key);
        const selection = row.rubric_selection || {};

        if (selection.KNOW !== undefined && selection.KNOW !== null) {
          entry.KNOW.push(Number(selection.KNOW));
        }

        if (selection.DO !== undefined && selection.DO !== null) {
          entry.DO.push(Number(selection.DO));
        }

        if (selection.UNDERSTAND !== undefined && selection.UNDERSTAND !== null) {
          entry.UNDERSTAND.push(Number(selection.UNDERSTAND));
        }
      });

      kduHeatmap = Array.from(heatmapByStudent.values()).map((entry) => {
        const averageScore = (scores) => {
          const safeScores = scores.filter((score) => Number.isFinite(score));

          if (safeScores.length === 0) {
            return null;
          }

          return Number((safeScores.reduce((sum, score) => sum + score, 0) / safeScores.length).toFixed(2));
        };

        return {
          student_name: entry.student_name,
          student_email: entry.student_email,
          course_title: entry.course_title,
          KNOW: averageScore(entry.KNOW),
          DO: averageScore(entry.DO),
          UNDERSTAND: averageScore(entry.UNDERSTAND),
        };
      });
    }

    return res.json({
      teacher: teacherResult.rows[0],
      courses: coursesResult.rows,
      students,
      grades,
      kdu_heatmap: kduHeatmap,
    });
  } catch (err) {
    console.error("GET /api/teachers/:teacherId/dashboard failed:", err);
    return res.status(500).json({ error: "Failed to load dashboard" });
  }
});

/* IMPORT CLASS FROM CSV TEXT */
app.post("/api/import/class-from-csv-text", async (req, res) => {
  try {
    const csvText = String(req.body.csvText || "").trim();

    if (!csvText) {
      return res.status(400).json({ error: "csvText is required" });
    }

    const rows = parseCsvTextToRows(csvText);
    const importResult = await importClassRows(rows);

    return res.json(importResult);
  } catch (err) {
    console.error("POST /api/import/class-from-csv-text failed:", err);
    return res.status(500).json({ error: err.message || "Import failed" });
  }
});

/* GET CLASS ROSTER */
app.get("/api/class-roster/:courseId", async (req, res) => {
  try {
    await ensureStudentInfoColumns();

    const courseId = Number(req.params.courseId);

    if (!courseId) {
      return res.status(400).json({ error: "Valid courseId is required" });
    }

    const courseResult = await pool.query(
      `
      SELECT id, title
      FROM courses
      WHERE id = $1
      LIMIT 1
      `,
      [courseId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    const studentsResult = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.parent_email,
        u.student_id
      FROM class_enrollments ce
      JOIN users u
        ON u.id = ce.student_user_id
      WHERE ce.class_id = $1
      ORDER BY u.name ASC, u.email ASC
      `,
      [courseId]
    );

    return res.json({
      course: courseResult.rows[0],
      students: studentsResult.rows,
    });
  } catch (err) {
    console.error("GET /api/class-roster/:courseId failed:", err);
    return res.status(500).json({ error: "Failed to load class roster" });
  }
});


/* MANUAL STUDENT ENROLLMENT */
app.post("/api/class-roster/:courseId/students", async (req, res) => {
  try {
    await ensureStudentInfoColumns();

    const courseId = Number(req.params.courseId);
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const parentEmail = String(req.body?.parent_email || "").trim();
    const studentId = String(req.body?.student_id || "").trim();

    if (!courseId) {
      return res.status(400).json({ error: "Valid courseId is required" });
    }

    if (!name) {
      return res.status(400).json({ error: "Student name is required" });
    }

    if (!email) {
      return res.status(400).json({ error: "Student email is required" });
    }

    const courseResult = await pool.query(
      `
      SELECT id, title
      FROM courses
      WHERE id = $1
      LIMIT 1
      `,
      [courseId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    const userResult = await pool.query(
      `
      INSERT INTO users (name, email, role, parent_email, student_id)
      VALUES ($1, $2, 'student', $3, $4)
      ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name,
          role = 'student',
          parent_email = EXCLUDED.parent_email,
          student_id = EXCLUDED.student_id
      RETURNING id, name, email, parent_email, student_id
      `,
      [name, email, parentEmail || null, studentId || null]
    );

    const student = userResult.rows[0];

    await pool.query(
      `
      INSERT INTO class_enrollments (class_id, student_user_id)
      SELECT $1, $2
      WHERE NOT EXISTS (
        SELECT 1
        FROM class_enrollments
        WHERE class_id = $1
          AND student_user_id = $2
      )
      `,
      [courseId, student.id]
    );

    return res.status(201).json({
      message: "Student enrolled successfully",
      student,
    });
  } catch (err) {
    console.error("POST /api/class-roster/:courseId/students failed:", err);
    return res.status(500).json({ error: "Failed to enroll student" });
  }
});


/* REMOVE STUDENT FROM CLASS ROSTER */
app.delete("/api/class-roster/:courseId/students/:studentId", async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const studentId = Number(req.params.studentId);

    if (!courseId) {
      return res.status(400).json({ error: "Valid courseId is required" });
    }

    if (!studentId) {
      return res.status(400).json({ error: "Valid studentId is required" });
    }

    const deleteResult = await pool.query(
      `
      DELETE FROM class_enrollments
      WHERE class_id = $1
        AND student_user_id = $2
      RETURNING id, class_id, student_user_id
      `,
      [courseId, studentId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        error: "Student enrollment was not found for this course",
      });
    }

    return res.json({
      message: "Student removed from this course",
      removedEnrollment: deleteResult.rows[0],
    });
  } catch (err) {
    console.error(
      "DELETE /api/class-roster/:courseId/students/:studentId failed:",
      err
    );
    return res.status(500).json({ error: "Failed to remove student" });
  }
});

/* SEED RUBRIC DEMO */
app.post("/api/classes/:classId/seed-rubric-demo", async (req, res) => {
  try {
    const classId = Number(req.params.classId);

    if (!classId) {
      return res.status(400).json({ error: "Valid classId is required" });
    }

    const result = await seedRubricDemoForClass(classId);

    return res.json(result);
  } catch (err) {
    console.error("POST /api/classes/:classId/seed-rubric-demo failed:", err);
    return res.status(500).json({
      error: err.message || "Failed to seed rubric demo",
    });
  }
});



/* REPORTS API - CURRENT KDU STRUCTURE */
app.get("/api/reports/:courseId", async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const {
      studentName = "",
      studentEmail = "",
      categoryName = "",
      levelName = "",
      reportScope = "student",
    } = req.query;

    if (!courseId) {
      return res.status(400).json({ error: "Valid courseId is required" });
    }

    const courseResult = await pool.query(
      `
      SELECT id, title AS course_title
      FROM courses
      WHERE id = $1
      LIMIT 1
      `,
      [courseId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    const studentsResult = await pool.query(
      `
      SELECT
        u.id AS student_user_id,
        u.name AS student_name,
        u.email AS student_email,
        u.student_id,
        u.parent_email
      FROM class_enrollments ce
      JOIN users u
        ON u.id = ce.student_user_id
      WHERE ce.class_id = $1
      ORDER BY u.name ASC, u.email ASC
      `,
      [courseId]
    );

    const assignmentsResult = await pool.query(
      `
      SELECT
        a.id AS assignment_id,
        a.title AS assignment_title,
        a.due_date,
        cc.name AS category_name,
        cs.name AS level_name,
        ((cc.weight_percent * cs.weight_percent_of_parent) / 100.0) AS calculated_weight_percent
      FROM assignments a
      LEFT JOIN category_subcategories cs
        ON cs.id = a.subcategory_id
      LEFT JOIN course_categories cc
        ON cc.id = cs.course_category_id
      WHERE a.class_id = $1
      ORDER BY a.due_date ASC NULLS LAST, a.id ASC
      `,
      [courseId]
    );

    const submissionsResult = await pool.query(
      `
      SELECT
        s.id AS submission_id,
        s.assignment_id,
        LOWER(s.student_email) AS student_email,
        s.score,
        s.grade,
        s.feedback,
        s.rubric_selection
      FROM submissions s
      JOIN assignments a
        ON a.id = s.assignment_id
      WHERE a.class_id = $1
      `,
      [courseId]
    );

    const submissionsByStudentAssignment = new Map();

    submissionsResult.rows.forEach((submission) => {
      submissionsByStudentAssignment.set(
        `${String(submission.student_email || "").toLowerCase()}:${submission.assignment_id}`,
        submission
      );
    });

    let reportStudents = studentsResult.rows;

    if (reportScope === "student") {
      const requestedEmail = String(studentEmail || "").trim().toLowerCase();
      const requestedName = String(studentName || "").trim().toLowerCase();

      reportStudents = reportStudents.filter((student) => {
        const emailMatch =
          requestedEmail &&
          String(student.student_email || "").trim().toLowerCase() === requestedEmail;

        const nameMatch =
          requestedName &&
          String(student.student_name || "").trim().toLowerCase() === requestedName;

        return emailMatch || nameMatch;
      });
    }

    const requestedCategory = String(categoryName || "").trim().toLowerCase();
    const requestedLevel = String(levelName || "").trim().toLowerCase();

    const students = reportStudents.map((student) => {
      const categoryTotals = {};
      let courseTotal = 0;

      const assignments = assignmentsResult.rows
        .filter((assignment) => {
          const categoryMatches =
            !requestedCategory ||
            String(assignment.category_name || "").trim().toLowerCase() === requestedCategory;

          const levelMatches =
            !requestedLevel ||
            String(assignment.level_name || "").trim().toLowerCase() === requestedLevel;

          return categoryMatches && levelMatches;
        })
        .map((assignment) => {
          const submission = submissionsByStudentAssignment.get(
            `${String(student.student_email || "").toLowerCase()}:${assignment.assignment_id}`
          );

          const numericScore =
            submission && submission.score !== null && submission.score !== undefined
              ? Number(submission.score)
              : null;

          const weight = Number(assignment.calculated_weight_percent || 0);
          const contribution =
            numericScore === null ? 0 : Number(((numericScore * weight) / 100).toFixed(2));

          if (assignment.category_name) {
            categoryTotals[assignment.category_name] =
              Number(categoryTotals[assignment.category_name] || 0) + contribution;
          }

          courseTotal += contribution;

          return {
            submission_id: submission?.submission_id || null,
            assignment_title: assignment.assignment_title || "",
            lesson_title: "",
            category_name: assignment.category_name || "Unlinked",
            level_name: assignment.level_name || "KDU Rubric Assessments",
            score: numericScore === null ? "" : numericScore,
            calculated_weight_percent: Number(weight.toFixed(2)),
            contribution,
          };
        });

      const roundedCategoryTotals = {};

      Object.entries(categoryTotals).forEach(([name, value]) => {
        roundedCategoryTotals[name] = Number(Number(value || 0).toFixed(2));
      });

      return {
        student_user_id: student.student_user_id,
        student_name: student.student_name,
        student_email: student.student_email,
        student_id: student.student_id,
        parent_email: student.parent_email,
        course_total: Number(courseTotal.toFixed(2)),
        category_totals: roundedCategoryTotals,
        assignments,
      };
    });

    const courseTotals = students.map((student) => Number(student.course_total || 0));

    const classSummary = {
      student_count: students.length,
      class_average:
        courseTotals.length > 0
          ? Number((courseTotals.reduce((sum, value) => sum + value, 0) / courseTotals.length).toFixed(2))
          : 0,
      highest_grade:
        courseTotals.length > 0 ? Number(Math.max(...courseTotals).toFixed(2)) : 0,
      lowest_grade:
        courseTotals.length > 0 ? Number(Math.min(...courseTotals).toFixed(2)) : 0,
    };

    const uniqueCategories = [
      ...new Set(assignmentsResult.rows.map((row) => row.category_name).filter(Boolean)),
    ];

    const uniqueLevels = [
      ...new Set(assignmentsResult.rows.map((row) => row.level_name).filter(Boolean)),
    ];

    return res.json({
      course_id: courseId,
      course_title: courseResult.rows[0].course_title,
      report_scope: reportScope,
      filters: {
        student_name: studentName,
        student_email: studentEmail,
        category_name: categoryName,
        level_name: levelName,
      },
      available_categories: uniqueCategories,
      available_levels: uniqueLevels,
      lessons: [],
      students,
      class_summary: classSummary,
    });
  } catch (error) {
    console.error("GET /api/reports/:courseId failed:", error);
    return res.status(500).json({ error: "Failed to generate report data" });
  }
});


/* GET KDU ASSESSMENT GROUP GRADEBOOK */
app.get("/api/classes/:classId/kdu-gradebook", async (req, res) => {
  try {
    const classId = Number(req.params.classId);

    if (!classId) {
      return res.status(400).json({ error: "Valid classId is required" });
    }

    const classResult = await pool.query(
      `
      SELECT id, title AS class_name, description
      FROM courses
      WHERE id = $1
      LIMIT 1
      `,
      [classId]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: "Class not found" });
    }

    const groupsResult = await pool.query(
      `
      SELECT
        cc.id AS category_id,
        cc.name AS category_name,
        cc.weight_percent AS category_weight_percent,
        cs.id AS subcategory_id,
        cs.name AS subcategory_name,
        cs.weight_percent_of_parent,
        ((cc.weight_percent * cs.weight_percent_of_parent) / 100.0) AS course_weight_percent
      FROM course_categories cc
      JOIN category_subcategories cs
        ON cs.course_category_id = cc.id
      WHERE cc.course_id = $1
      ORDER BY cc.sort_order ASC, cc.id ASC, cs.sort_order ASC, cs.id ASC
      `,
      [classId]
    );

    const assignmentsResult = await pool.query(
      `
      SELECT
        a.id,
        a.title,
        a.description,
        a.due_date,
        a.subcategory_id,
        cs.name AS subcategory_name,
        cc.id AS category_id,
        cc.name AS category_name,
        cc.weight_percent AS category_weight_percent,
        cs.weight_percent_of_parent,
        ((cc.weight_percent * cs.weight_percent_of_parent) / 100.0) AS course_weight_percent
      FROM assignments a
      LEFT JOIN category_subcategories cs
        ON cs.id = a.subcategory_id
      LEFT JOIN course_categories cc
        ON cc.id = cs.course_category_id
      WHERE a.class_id = $1
      ORDER BY a.due_date ASC NULLS LAST, a.id ASC
      `,
      [classId]
    );

    const studentsResult = await pool.query(
      `
      SELECT
        ce.student_user_id,
        u.name AS student_name,
        u.email AS student_email
      FROM class_enrollments ce
      JOIN users u
        ON u.id = ce.student_user_id
      WHERE ce.class_id = $1
      ORDER BY u.name ASC, u.email ASC
      `,
      [classId]
    );

    const submissionsResult = await pool.query(
      `
      SELECT
        s.assignment_id,
        LOWER(s.student_email) AS student_email,
        s.score,
        s.rubric_selection,
        s.feedback
      FROM submissions s
      JOIN assignments a
        ON a.id = s.assignment_id
      WHERE a.class_id = $1
      `,
      [classId]
    );

    const submissionsByStudentAssignment = new Map();

    for (const submission of submissionsResult.rows) {
      submissionsByStudentAssignment.set(
        `${submission.student_email}:${submission.assignment_id}`,
        submission
      );
    }

    const students = studentsResult.rows.map((student) => {
      const assignmentScores = assignmentsResult.rows.map((assignment) => {
        const submission = submissionsByStudentAssignment.get(
          `${String(student.student_email).toLowerCase()}:${assignment.id}`
        );

        return {
          assignment_id: assignment.id,
          assignment_title: assignment.title,
          category_id: assignment.category_id,
          category_name: assignment.category_name,
          subcategory_id: assignment.subcategory_id,
          subcategory_name: assignment.subcategory_name,
          course_weight_percent:
            assignment.course_weight_percent === null
              ? null
              : Number(assignment.course_weight_percent),
          score:
            submission && submission.score !== null
              ? Number(submission.score)
              : null,
          rubric_selection: submission ? submission.rubric_selection : null,
          feedback: submission ? submission.feedback : null,
        };
      });

      const groupedScores = new Map();

      for (const item of assignmentScores) {
        if (!item.subcategory_id || item.score === null) {
          continue;
        }

        const key = String(item.subcategory_id);

        if (!groupedScores.has(key)) {
          groupedScores.set(key, {
            subcategory_id: item.subcategory_id,
            subcategory_name: item.subcategory_name,
            category_id: item.category_id,
            category_name: item.category_name,
            course_weight_percent: Number(item.course_weight_percent || 0),
            scores: [],
          });
        }

        groupedScores.get(key).scores.push(Number(item.score));
      }

      const groupBreakdown = Array.from(groupedScores.values()).map((group) => {
        const averageScore =
          group.scores.reduce((sum, value) => sum + value, 0) / group.scores.length;

        return {
          subcategory_id: group.subcategory_id,
          subcategory_name: group.subcategory_name,
          category_id: group.category_id,
          category_name: group.category_name,
          course_weight_percent: group.course_weight_percent,
          average_score: Number(averageScore.toFixed(2)),
          earned_course_points: Number(
            ((averageScore * group.course_weight_percent) / 100).toFixed(2)
          ),
        };
      });

      const earnedCoursePoints = groupBreakdown.reduce(
        (sum, group) => sum + group.earned_course_points,
        0
      );

      const gradedWeight = groupBreakdown.reduce(
        (sum, group) => sum + group.course_weight_percent,
        0
      );

      const currentPercent =
        gradedWeight > 0 ? (earnedCoursePoints / gradedWeight) * 100 : null;

      return {
        student_user_id: student.student_user_id,
        student_name: student.student_name,
        student_email: student.student_email,
        assignment_scores: assignmentScores,
        group_breakdown: groupBreakdown,
        earned_course_points: Number(earnedCoursePoints.toFixed(2)),
        graded_weight_percent: Number(gradedWeight.toFixed(2)),
        current_percent:
          currentPercent === null ? null : Number(currentPercent.toFixed(2)),
      };
    });

    return res.json({
      class: classResult.rows[0],
      assessment_groups: groupsResult.rows.map((group) => ({
        ...group,
        category_weight_percent: Number(group.category_weight_percent),
        weight_percent_of_parent: Number(group.weight_percent_of_parent),
        course_weight_percent: Number(group.course_weight_percent),
      })),
      assignments: assignmentsResult.rows,
      students,
    });
  } catch (err) {
    console.error("GET /api/classes/:classId/kdu-gradebook failed:", err);
    return res.status(500).json({ error: "Failed to load KDU gradebook" });
  }
});


/* GET GRADEBOOK - 6 POINT RUBRIC TO PERCENT PIPELINE */
app.get("/api/classes/:classId/gradebook", async (req, res) => {
  try {
    await ensureRubricFrameworkTables();

    const classId = Number(req.params.classId);

    if (!classId) {
      return res.status(400).json({ error: "Valid classId is required" });
    }

    const classResult = await pool.query(
      `
      SELECT id, title AS class_name, description
      FROM courses
      WHERE id = $1
      LIMIT 1
      `,
      [classId]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: "Class not found" });
    }

    const assignments = await getAssignmentsForClass(classId);
    const students = await buildRubricGradebookStudents(classId);

    return res.json({
      class: classResult.rows[0],
      assignments,
      students,
      grading_model: {
        input: "standard_6_point_rubric_score",
        output: "final_percent",
        conversion: [
          { score: 6, label: "Superior", percent: 100 },
          { score: 5, label: "Proficient", percent: 86 },
          { score: 4, label: "Satisfactory", percent: 73 },
          { score: 3, label: "Developing", percent: 60 },
          { score: 2, label: "Emerging", percent: 50 },
          { score: 1, label: "Incomplete", percent: 40 },
        ],
        decimal_scores: "Decimals such as 4.5 are converted between score bands.",
      },
    });
  } catch (err) {
    console.error("GET /api/classes/:classId/gradebook failed:", err);
    return res.status(500).json({ error: "Failed to fetch class gradebook" });
  }
});


function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function roundSchoolMark(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "";
  }

  return String(Math.floor(numericValue + 0.5));
}


/* GET REPORT CARD COMMENTS FOR CLASS */
app.get("/api/classes/:classId/report-comments", async (req, res) => {
  try {
    await ensureStudentInfoColumns();
    await ensureStudentReportCommentsTable();

    const classId = Number(req.params.classId);

    if (!classId) {
      return res.status(400).json({ error: "Valid classId is required" });
    }

    const result = await pool.query(
      `
      SELECT
        u.id AS student_user_id,
        u.name AS student_name,
        u.email AS student_email,
        u.student_id,
        COALESCE(src.com1, '') AS com1,
        COALESCE(src.com2, '') AS com2,
        src.updated_at
      FROM class_enrollments ce
      JOIN users u
        ON u.id = ce.student_user_id
      LEFT JOIN student_report_comments src
        ON src.class_id = ce.class_id
        AND src.student_user_id = u.id
      WHERE ce.class_id = $1
      ORDER BY u.name ASC, u.email ASC
      `,
      [classId]
    );

    return res.json({
      success: true,
      classId,
      comments: result.rows,
    });
  } catch (err) {
    console.error("GET /api/classes/:classId/report-comments failed:", err);
    return res.status(500).json({ error: "Failed to load report comments" });
  }
});

/* SAVE REPORT CARD COMMENTS FOR STUDENT */
app.put("/api/classes/:classId/report-comments/:studentUserId", async (req, res) => {
  try {
    await ensureStudentReportCommentsTable();

    const classId = Number(req.params.classId);
    const studentUserId = Number(req.params.studentUserId);
    const com1 = String(req.body.com1 || "").trim();
    const com2 = String(req.body.com2 || "").trim();

    if (!classId) {
      return res.status(400).json({ error: "Valid classId is required" });
    }

    if (!studentUserId) {
      return res.status(400).json({ error: "Valid studentUserId is required" });
    }

    const enrollmentResult = await pool.query(
      `
      SELECT 1
      FROM class_enrollments
      WHERE class_id = $1
        AND student_user_id = $2
      LIMIT 1
      `,
      [classId, studentUserId]
    );

    if (enrollmentResult.rows.length === 0) {
      return res.status(404).json({ error: "Student is not enrolled in this class" });
    }

    const result = await pool.query(
      `
      INSERT INTO student_report_comments (
        class_id,
        student_user_id,
        com1,
        com2,
        updated_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (class_id, student_user_id)
      DO UPDATE
      SET com1 = EXCLUDED.com1,
          com2 = EXCLUDED.com2,
          updated_at = NOW()
      RETURNING id, class_id, student_user_id, com1, com2, updated_at
      `,
      [classId, studentUserId, com1, com2]
    );

    return res.json({
      success: true,
      comment: result.rows[0],
    });
  } catch (err) {
    console.error("PUT /api/classes/:classId/report-comments/:studentUserId failed:", err);
    return res.status(500).json({ error: "Failed to save report comments" });
  }
});

/* EXPORT WEBTESS / MINISTRY MARKS CSV */
app.get("/api/classes/:classId/webtess-marks-csv", async (req, res) => {
  try {
    await ensureStudentInfoColumns();

    const classId = Number(req.params.classId);

    if (!classId) {
      return res.status(400).json({ error: "Valid classId is required" });
    }

    const classResult = await pool.query(
      `
      SELECT id, title
      FROM courses
      WHERE id = $1
      LIMIT 1
      `,
      [classId]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: "Class not found" });
    }

    const assignmentsResult = await pool.query(
      `
      SELECT
        a.id,
        a.subcategory_id,
        ((cc.weight_percent * cs.weight_percent_of_parent) / 100.0) AS course_weight_percent
      FROM assignments a
      LEFT JOIN category_subcategories cs
        ON cs.id = a.subcategory_id
      LEFT JOIN course_categories cc
        ON cc.id = cs.course_category_id
      WHERE a.class_id = $1
      ORDER BY a.id ASC
      `,
      [classId]
    );

    const studentsResult = await pool.query(
      `
      SELECT
        u.name AS student_name,
        u.email AS student_email,
        u.student_id,
        COALESCE(src.com1, '') AS com1,
        COALESCE(src.com2, '') AS com2
      FROM class_enrollments ce
      JOIN users u
        ON u.id = ce.student_user_id
      LEFT JOIN student_report_comments src
        ON src.class_id = ce.class_id
        AND src.student_user_id = u.id
      WHERE ce.class_id = $1
      ORDER BY u.name ASC, u.email ASC
      `,
      [classId]
    );

    const submissionsResult = await pool.query(
      `
      SELECT
        s.assignment_id,
        LOWER(s.student_email) AS student_email,
        s.score
      FROM submissions s
      JOIN assignments a
        ON a.id = s.assignment_id
      WHERE a.class_id = $1
      `,
      [classId]
    );

    const submissionsByStudentAssignment = new Map();

    for (const submission of submissionsResult.rows) {
      submissionsByStudentAssignment.set(
        `${submission.student_email}:${submission.assignment_id}`,
        submission
      );
    }

    const csvRows = [
      ["Student ID", "Mark", "Work", "Att", "Com1", "Com2"],
    ];

    for (const student of studentsResult.rows) {
      const groupedScores = new Map();

      for (const assignment of assignmentsResult.rows) {
        const submission = submissionsByStudentAssignment.get(
          `${String(student.student_email).toLowerCase()}:${assignment.id}`
        );

        if (!assignment.subcategory_id || !submission || submission.score === null) {
          continue;
        }

        const key = String(assignment.subcategory_id);

        if (!groupedScores.has(key)) {
          groupedScores.set(key, {
            course_weight_percent: Number(assignment.course_weight_percent || 0),
            scores: [],
          });
        }

        groupedScores.get(key).scores.push(Number(submission.score));
      }

      const groupBreakdown = Array.from(groupedScores.values()).map((group) => {
        const averageScore =
          group.scores.reduce((sum, value) => sum + value, 0) / group.scores.length;

        return {
          course_weight_percent: group.course_weight_percent,
          earned_course_points: (averageScore * group.course_weight_percent) / 100,
        };
      });

      const earnedCoursePoints = groupBreakdown.reduce(
        (sum, group) => sum + group.earned_course_points,
        0
      );

      const gradedWeight = groupBreakdown.reduce(
        (sum, group) => sum + group.course_weight_percent,
        0
      );

      const currentPercent = gradedWeight > 0 ? (earnedCoursePoints / gradedWeight) * 100 : null;
      const mark = currentPercent === null ? "" : roundSchoolMark(currentPercent);

      csvRows.push([
        student.student_id || "",
        mark,
        "",
        "",
        student.com1 || "",
        student.com2 || "",
      ]);
    }

    const csvText = csvRows
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");

    const safeClassTitle = String(classResult.rows[0].title || "class")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeClassTitle || "class"}-webtess-marks.csv"`
    );

    return res.send(csvText);
  } catch (err) {
    console.error("GET /api/classes/:classId/webtess-marks-csv failed:", err);
    return res.status(500).json({ error: "Failed to export WebTESS marks CSV" });
  }
});


/* EXAM SECTION MARK ENTRY - RAW MARKS TO KDU CONVERSION */
app.get("/api/assignments/:assignmentId/sections", async (req, res) => {
  try {
    await ensureAssignmentSectionTables();

    const assignmentId = Number(req.params.assignmentId);

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        assignment_id,
        section_name,
        competency_bucket,
        max_points,
        section_weight,
        sort_order
      FROM assignment_sections
      WHERE assignment_id = $1
      ORDER BY sort_order ASC, id ASC
      `,
      [assignmentId]
    );

    return res.json({
      success: true,
      assignmentId,
      sections: result.rows,
    });
  } catch (err) {
    console.error("GET /api/assignments/:assignmentId/sections failed:", err);
    return res.status(500).json({ error: "Failed to load assignment sections" });
  }
});

app.put("/api/assignments/:assignmentId/sections", async (req, res) => {
  try {
    await ensureAssignmentSectionTables();

    const assignmentId = Number(req.params.assignmentId);
    const sections = Array.isArray(req.body.sections) ? req.body.sections : [];

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    if (sections.length === 0) {
      return res.status(400).json({ error: "At least one section is required" });
    }

    const assignmentResult = await pool.query(
      `
      SELECT id
      FROM assignments
      WHERE id = $1
      LIMIT 1
      `,
      [assignmentId]
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    await pool.query("BEGIN");

    await pool.query(
      `
      DELETE FROM assignment_sections
      WHERE assignment_id = $1
      `,
      [assignmentId]
    );

    const insertedSections = [];

    for (let index = 0; index < sections.length; index += 1) {
      const section = sections[index];
      const sectionName = String(section.section_name || section.name || "").trim();
      const competencyBucket = String(section.competency_bucket || "").trim().toUpperCase();
      const maxPoints = Number(section.max_points);
      const sectionWeight = Number(section.section_weight || 1);

      if (!sectionName) {
        throw new Error("Every section needs a name");
      }

      if (!["KNOW", "DO", "UNDERSTAND"].includes(competencyBucket)) {
        throw new Error("Every section needs a KDU bucket: KNOW, DO, or UNDERSTAND");
      }

      if (!Number.isFinite(maxPoints) || maxPoints <= 0) {
        throw new Error("Every section needs max_points greater than 0");
      }

      const insertedResult = await pool.query(
        `
        INSERT INTO assignment_sections (
          assignment_id,
          section_name,
          competency_bucket,
          max_points,
          section_weight,
          sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, assignment_id, section_name, competency_bucket, max_points, section_weight, sort_order
        `,
        [
          assignmentId,
          sectionName,
          competencyBucket,
          maxPoints,
          Number.isFinite(sectionWeight) && sectionWeight > 0 ? sectionWeight : 1,
          index + 1,
        ]
      );

      insertedSections.push(insertedResult.rows[0]);
    }

    await pool.query("COMMIT");

    return res.json({
      success: true,
      assignmentId,
      sections: insertedSections,
    });
  } catch (err) {
    await pool.query("ROLLBACK").catch(() => {});
    console.error("PUT /api/assignments/:assignmentId/sections failed:", err);
    return res.status(500).json({ error: err.message || "Failed to save assignment sections" });
  }
});

app.get("/api/assignments/:assignmentId/section-scores", async (req, res) => {
  try {
    await ensureAssignmentSectionTables();

    const assignmentId = Number(req.params.assignmentId);

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    const result = await pool.query(
      `
      SELECT
        aps.id AS assignment_section_id,
        aps.section_name,
        aps.competency_bucket,
        aps.max_points,
        aps.section_weight,
        aps.sort_order,
        u.id AS student_user_id,
        u.name AS student_name,
        u.email AS student_email,
        sss.earned_points,
        sss.converted_competency_level
      FROM assignments a
      JOIN class_enrollments ce
        ON ce.class_id = a.class_id
      JOIN users u
        ON u.id = ce.student_user_id
      JOIN assignment_sections aps
        ON aps.assignment_id = a.id
      LEFT JOIN student_section_scores sss
        ON sss.assignment_section_id = aps.id
        AND sss.student_user_id = u.id
      WHERE a.id = $1
      ORDER BY u.name ASC, u.email ASC, aps.sort_order ASC, aps.id ASC
      `,
      [assignmentId]
    );

    return res.json({
      success: true,
      assignmentId,
      rows: result.rows,
    });
  } catch (err) {
    console.error("GET /api/assignments/:assignmentId/section-scores failed:", err);
    return res.status(500).json({ error: "Failed to load section scores" });
  }
});

app.post("/api/assignments/:assignmentId/section-scores", async (req, res) => {
  try {
    await ensureAssignmentSectionTables();

    const assignmentId = Number(req.params.assignmentId);
    const studentUserId = Number(req.body.student_user_id);
    const scores = Array.isArray(req.body.scores) ? req.body.scores : [];

    if (!assignmentId) {
      return res.status(400).json({ error: "Valid assignmentId is required" });
    }

    if (!studentUserId) {
      return res.status(400).json({ error: "Valid student_user_id is required" });
    }

    await pool.query("BEGIN");

    for (const scoreRow of scores) {
      const assignmentSectionId = Number(scoreRow.assignment_section_id);
      const earnedPoints =
        scoreRow.earned_points === "" || scoreRow.earned_points === null || scoreRow.earned_points === undefined
          ? null
          : Number(scoreRow.earned_points);

      if (!assignmentSectionId) {
        continue;
      }

      const sectionResult = await pool.query(
        `
        SELECT id, max_points
        FROM assignment_sections
        WHERE id = $1
          AND assignment_id = $2
        LIMIT 1
        `,
        [assignmentSectionId, assignmentId]
      );

      if (sectionResult.rows.length === 0) {
        continue;
      }

      const convertedLevel =
        earnedPoints === null
          ? null
          : rawPercentToCompetencyLevel(earnedPoints, sectionResult.rows[0].max_points);

      await pool.query(
        `
        INSERT INTO student_section_scores (
          student_user_id,
          assignment_section_id,
          earned_points,
          converted_competency_level,
          updated_at
        )
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (student_user_id, assignment_section_id)
        DO UPDATE
        SET earned_points = EXCLUDED.earned_points,
            converted_competency_level = EXCLUDED.converted_competency_level,
            updated_at = NOW()
        `,
        [studentUserId, assignmentSectionId, earnedPoints, convertedLevel]
      );
    }

    const syncedResult = await syncSectionScoresToSubmission(assignmentId, studentUserId);

    await pool.query("COMMIT");

    return res.json({
      success: true,
      assignmentId,
      student_user_id: studentUserId,
      ...syncedResult,
    });
  } catch (err) {
    await pool.query("ROLLBACK").catch(() => {});
    console.error("POST /api/assignments/:assignmentId/section-scores failed:", err);
    return res.status(500).json({ error: err.message || "Failed to save section scores" });
  }
});


Promise.all([
  ensureStudentInfoColumns(),
  ensureRubricFrameworkTables(),
  ensureStudentReportCommentsTable(),
  ensureAssignmentSectionTables(),
  ensureLearningPathItemTables(),
])
  .then(() => {
    app.listen(port, () => {
      console.log("Super LMS backend running on port 3000");
    });
  })
  .catch((err) => {
    console.error("Failed to prepare backend database:", err);
    process.exit(1);
  });