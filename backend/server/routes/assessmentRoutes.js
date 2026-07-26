const express = require("express");
const pool = require("../db");
const { authenticateJWT, requireRole } = require("../../middleware/auth");

const router = express.Router();
const OBJECTIVE_TYPES = new Set(["multiple_choice", "true_false"]);
const QUESTION_TYPES = new Set([
  "multiple_choice",
  "true_false",
  "short_answer",
  "essay",
]);

async function ensureAssessmentTables() {
  await pool.query(`
    ALTER TABLE assignments
    ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'assignment'
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessments (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      gradebook_assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
      subcategory_id INTEGER REFERENCES category_subcategories(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      instructions TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'closed')),
      available_from TIMESTAMPTZ,
      due_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessment_questions (
      id SERIAL PRIMARY KEY,
      assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      question_type TEXT NOT NULL
        CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer', 'essay')),
      prompt TEXT NOT NULL,
      options_json JSONB DEFAULT '[]'::jsonb,
      correct_answer_json JSONB,
      points NUMERIC NOT NULL DEFAULT 1 CHECK (points > 0),
      teacher_feedback TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessment_attempts (
      id SERIAL PRIMARY KEY,
      assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      student_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'submitted', 'graded')),
      answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      manual_scores_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      auto_points NUMERIC NOT NULL DEFAULT 0,
      manual_points NUMERIC NOT NULL DEFAULT 0,
      score_percent NUMERIC,
      teacher_feedback TEXT DEFAULT '',
      started_at TIMESTAMPTZ DEFAULT NOW(),
      autosaved_at TIMESTAMPTZ DEFAULT NOW(),
      submitted_at TIMESTAMPTZ,
      graded_at TIMESTAMPTZ,
      UNIQUE (assessment_id, student_user_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS assessment_questions_assessment_sort_idx
    ON assessment_questions (assessment_id, sort_order, id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS assessment_attempts_assessment_status_idx
    ON assessment_attempts (assessment_id, status)
  `);
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function parseId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeOptions(value) {
  if (!Array.isArray(value)) return [];
  return value.map((option) => cleanText(option)).filter(Boolean);
}

function normalizeAnswer(value) {
  if (value === undefined) return null;
  return value;
}

function serializeAssessment(row) {
  return {
    ...row,
    points_possible: Number(row.points_possible || 0),
    question_count: Number(row.question_count || 0),
    attempt_count: Number(row.attempt_count || 0),
    submitted_count: Number(row.submitted_count || 0),
    needs_grading_count: Number(row.needs_grading_count || 0),
  };
}

async function getAssessment(assessmentId) {
  const result = await pool.query(
    `
    SELECT
      a.*,
      c.title AS course_title,
      cs.name AS subcategory_name,
      cc.name AS category_name,
      COALESCE(SUM(q.points), 0) AS points_possible,
      COUNT(q.id)::INTEGER AS question_count,
      (
        SELECT COUNT(*)::INTEGER
        FROM assessment_attempts at
        WHERE at.assessment_id = a.id
      ) AS attempt_count,
      (
        SELECT COUNT(*)::INTEGER
        FROM assessment_attempts at
        WHERE at.assessment_id = a.id
          AND at.status IN ('submitted', 'graded')
      ) AS submitted_count,
      (
        SELECT COUNT(*)::INTEGER
        FROM assessment_attempts at
        WHERE at.assessment_id = a.id
          AND at.status = 'submitted'
      ) AS needs_grading_count
    FROM assessments a
    JOIN courses c ON c.id = a.course_id
    LEFT JOIN assessment_questions q ON q.assessment_id = a.id
    LEFT JOIN category_subcategories cs ON cs.id = a.subcategory_id
    LEFT JOIN course_categories cc ON cc.id = cs.course_category_id
    WHERE a.id = $1
    GROUP BY a.id, c.title, cs.name, cc.name
    LIMIT 1
    `,
    [assessmentId]
  );
  return result.rows[0] || null;
}

async function canManageCourse(user, courseId) {
  if (String(user?.role || "").toLowerCase() === "admin") return true;
  const userId = parseId(user?.id);
  if (!userId) return false;

  const result = await pool.query(
    `
    SELECT 1
    FROM courses c
    LEFT JOIN course_teachers ct
      ON ct.course_id = c.id
      AND ct.teacher_id = $2
    WHERE c.id = $1
      AND (c.teacher_id = $2 OR ct.teacher_id = $2)
    LIMIT 1
    `,
    [courseId, userId]
  );
  return result.rows.length > 0;
}

async function canManageAssessment(user, assessmentId) {
  const assessment = await getAssessment(assessmentId);
  if (!assessment) return { allowed: false, assessment: null };
  return {
    allowed: await canManageCourse(user, assessment.course_id),
    assessment,
  };
}

async function isStudentEnrolled(studentUserId, courseId) {
  const result = await pool.query(
    `
    SELECT 1
    FROM class_enrollments
    WHERE student_user_id = $1
      AND class_id = $2
    LIMIT 1
    `,
    [studentUserId, courseId]
  );
  return result.rows.length > 0;
}

async function loadQuestions(assessmentId, includeAnswers) {
  const result = await pool.query(
    `
    SELECT
      id,
      assessment_id,
      question_type,
      prompt,
      options_json,
      ${includeAnswers ? "correct_answer_json," : ""}
      points,
      ${includeAnswers ? "teacher_feedback," : ""}
      sort_order
    FROM assessment_questions
    WHERE assessment_id = $1
    ORDER BY sort_order ASC, id ASC
    `,
    [assessmentId]
  );
  return result.rows.map((question) => ({
    ...question,
    points: Number(question.points),
    options_json: Array.isArray(question.options_json)
      ? question.options_json
      : [],
  }));
}

async function syncAttemptToGradebook(attemptId) {
  const result = await pool.query(
    `
    SELECT
      at.id,
      at.score_percent,
      at.teacher_feedback,
      a.gradebook_assignment_id,
      a.title,
      a.course_id,
      a.teacher_id,
      u.id AS student_id,
      u.name AS student_name,
      u.email AS student_email
    FROM assessment_attempts at
    JOIN assessments a ON a.id = at.assessment_id
    JOIN users u ON u.id = at.student_user_id
    WHERE at.id = $1
    LIMIT 1
    `,
    [attemptId]
  );

  const row = result.rows[0];
  if (!row || !row.gradebook_assignment_id || row.score_percent === null) return;

  const score = Number(Number(row.score_percent).toFixed(2));
  const existing = await pool.query(
    `
    SELECT id
    FROM submissions
    WHERE assignment_id = $1
      AND student_id = $2
    LIMIT 1
    `,
    [row.gradebook_assignment_id, row.student_id]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `
      UPDATE submissions
      SET score = $1,
          grade = $2,
          feedback = $3,
          content = $4
      WHERE id = $5
      `,
      [
        score,
        `${score}%`,
        row.teacher_feedback || "Assessment graded.",
        "Completed in SUPER LMS Assessments.",
        existing.rows[0].id,
      ]
    );
    return;
  }

  await pool.query(
    `
    INSERT INTO submissions (
      assignment_id,
      assignment_title,
      course_id,
      teacher_id,
      student_id,
      student_name,
      student_email,
      original_file_name,
      stored_file_name,
      file_path,
      content,
      score,
      grade,
      feedback
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,'','','',$8,$9,$10,$11)
    `,
    [
      row.gradebook_assignment_id,
      row.title,
      row.course_id,
      row.teacher_id,
      row.student_id,
      row.student_name || row.student_email,
      row.student_email,
      "Completed in SUPER LMS Assessments.",
      score,
      `${score}%`,
      row.teacher_feedback || "Assessment graded.",
    ]
  );
}

async function calculateAttempt(attemptId, manualScores = null) {
  const attemptResult = await pool.query(
    `
    SELECT at.*, a.id AS assessment_id
    FROM assessment_attempts at
    JOIN assessments a ON a.id = at.assessment_id
    WHERE at.id = $1
    LIMIT 1
    `,
    [attemptId]
  );
  const attempt = attemptResult.rows[0];
  if (!attempt) return null;

  const questions = await loadQuestions(attempt.assessment_id, true);
  const answers = attempt.answers_json || {};
  const savedManualScores =
    manualScores && typeof manualScores === "object"
      ? manualScores
      : attempt.manual_scores_json || {};

  let autoPoints = 0;
  let manualPoints = 0;
  let hasManualQuestions = false;

  for (const question of questions) {
    const answer = answers[String(question.id)];
    if (OBJECTIVE_TYPES.has(question.question_type)) {
      if (
        cleanText(answer).toLowerCase() ===
        cleanText(question.correct_answer_json).toLowerCase()
      ) {
        autoPoints += Number(question.points);
      }
    } else {
      hasManualQuestions = true;
      const manualValue = Number(savedManualScores[String(question.id)]);
      if (Number.isFinite(manualValue)) {
        manualPoints += Math.max(0, Math.min(Number(question.points), manualValue));
      }
    }
  }

  const pointsPossible = questions.reduce(
    (sum, question) => sum + Number(question.points),
    0
  );
  const manualComplete = questions
    .filter((question) => !OBJECTIVE_TYPES.has(question.question_type))
    .every((question) =>
      Number.isFinite(Number(savedManualScores[String(question.id)]))
    );
  const isGraded = !hasManualQuestions || manualComplete;
  const scorePercent =
    isGraded && pointsPossible > 0
      ? Number((((autoPoints + manualPoints) / pointsPossible) * 100).toFixed(2))
      : null;

  return {
    attempt,
    autoPoints,
    manualPoints,
    pointsPossible,
    manualScores: savedManualScores,
    isGraded,
    scorePercent,
  };
}

router.get(
  "/assessments",
  authenticateJWT,
  requireRole("admin", "teacher", "student"),
  async (req, res) => {
    try {
      const role = String(req.user.role || "").toLowerCase();
      const userId = parseId(req.user.id);
      const courseId = parseId(req.query.courseId);
      const params = [userId];
      let courseFilter = "";

      if (courseId) {
        params.push(courseId);
        courseFilter = `AND a.course_id = $${params.length}`;
      }

      const accessJoin =
        role === "student"
          ? "JOIN class_enrollments ce ON ce.class_id = a.course_id AND ce.student_user_id = $1"
          : role === "teacher"
            ? `LEFT JOIN course_teachers ct
                 ON ct.course_id = a.course_id AND ct.teacher_id = $1`
            : "";
      const accessWhere =
        role === "student"
          ? "AND a.status IN ('published', 'closed')"
          : role === "teacher"
            ? "AND (c.teacher_id = $1 OR ct.teacher_id = $1)"
            : "";

      const result = await pool.query(
        `
        SELECT
          a.*,
          c.title AS course_title,
          cs.name AS subcategory_name,
          cc.name AS category_name,
          COALESCE((
            SELECT SUM(q.points)
            FROM assessment_questions q
            WHERE q.assessment_id = a.id
          ), 0) AS points_possible,
          (
            SELECT COUNT(*)::INTEGER
            FROM assessment_questions q
            WHERE q.assessment_id = a.id
          ) AS question_count,
          (
            SELECT COUNT(*)::INTEGER
            FROM assessment_attempts at
            WHERE at.assessment_id = a.id
          ) AS attempt_count,
          (
            SELECT COUNT(*)::INTEGER
            FROM assessment_attempts at
            WHERE at.assessment_id = a.id
              AND at.status IN ('submitted', 'graded')
          ) AS submitted_count,
          (
            SELECT COUNT(*)::INTEGER
            FROM assessment_attempts at
            WHERE at.assessment_id = a.id
              AND at.status = 'submitted'
          ) AS needs_grading_count,
          (
            SELECT at.status
            FROM assessment_attempts at
            WHERE at.assessment_id = a.id
              AND at.student_user_id = $1
            LIMIT 1
          ) AS student_attempt_status,
          (
            SELECT at.id
            FROM assessment_attempts at
            WHERE at.assessment_id = a.id
              AND at.student_user_id = $1
            LIMIT 1
          ) AS student_attempt_id
        FROM assessments a
        JOIN courses c ON c.id = a.course_id
        ${accessJoin}
        LEFT JOIN category_subcategories cs ON cs.id = a.subcategory_id
        LEFT JOIN course_categories cc ON cc.id = cs.course_category_id
        WHERE 1 = 1
          ${accessWhere}
          ${courseFilter}
        ORDER BY a.updated_at DESC, a.id DESC
        `,
        params
      );

      return res.json(result.rows.map(serializeAssessment));
    } catch (error) {
      console.error("GET /api/assessments failed:", error);
      return res.status(500).json({ error: "Failed to load assessments" });
    }
  }
);

router.post(
  "/assessments",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const courseId = parseId(req.body.course_id);
      const title = cleanText(req.body.title);
      if (!courseId || !title) {
        return res.status(400).json({ error: "Course and title are required" });
      }
      if (!(await canManageCourse(req.user, courseId))) {
        return res.status(403).json({ error: "You cannot manage this course" });
      }

      const teacherId =
        String(req.user.role).toLowerCase() === "admin"
          ? parseId(req.body.teacher_id) || parseId(req.user.id)
          : parseId(req.user.id);
      const result = await pool.query(
        `
        INSERT INTO assessments (
          course_id, teacher_id, title, instructions, subcategory_id,
          available_from, due_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
        `,
        [
          courseId,
          teacherId,
          title,
          cleanText(req.body.instructions),
          parseId(req.body.subcategory_id),
          req.body.available_from || null,
          req.body.due_at || null,
        ]
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("POST /api/assessments failed:", error);
      return res.status(500).json({ error: "Failed to create assessment" });
    }
  }
);

router.get(
  "/assessments/:assessmentId",
  authenticateJWT,
  requireRole("admin", "teacher", "student"),
  async (req, res) => {
    try {
      const assessmentId = parseId(req.params.assessmentId);
      const assessment = assessmentId ? await getAssessment(assessmentId) : null;
      if (!assessment) {
        return res.status(404).json({ error: "Assessment not found" });
      }

      const role = String(req.user.role || "").toLowerCase();
      const isManager = role !== "student" &&
        (await canManageCourse(req.user, assessment.course_id));
      if (role === "student") {
        const enrolled = await isStudentEnrolled(req.user.id, assessment.course_id);
        if (!enrolled || assessment.status === "draft") {
          return res.status(403).json({ error: "Assessment is not available" });
        }
      } else if (!isManager) {
        return res.status(403).json({ error: "You cannot manage this assessment" });
      }

      const questions = await loadQuestions(assessmentId, isManager);
      return res.json({
        assessment: serializeAssessment(assessment),
        questions,
      });
    } catch (error) {
      console.error("GET /api/assessments/:assessmentId failed:", error);
      return res.status(500).json({ error: "Failed to load assessment" });
    }
  }
);

router.put(
  "/assessments/:assessmentId",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const assessmentId = parseId(req.params.assessmentId);
      const access = assessmentId
        ? await canManageAssessment(req.user, assessmentId)
        : { allowed: false, assessment: null };
      if (!access.assessment) {
        return res.status(404).json({ error: "Assessment not found" });
      }
      if (!access.allowed) {
        return res.status(403).json({ error: "You cannot manage this assessment" });
      }

      const title = cleanText(req.body.title);
      if (!title) {
        return res.status(400).json({ error: "Assessment title is required" });
      }
      const result = await pool.query(
        `
        UPDATE assessments
        SET title = $1,
            instructions = $2,
            subcategory_id = $3,
            available_from = $4,
            due_at = $5,
            updated_at = NOW()
        WHERE id = $6
        RETURNING *
        `,
        [
          title,
          cleanText(req.body.instructions),
          parseId(req.body.subcategory_id),
          req.body.available_from || null,
          req.body.due_at || null,
          assessmentId,
        ]
      );
      if (access.assessment.gradebook_assignment_id) {
        await pool.query(
          `
          UPDATE assignments
          SET title = $1,
              description = $2,
              due_date = $3,
              subcategory_id = $4
          WHERE id = $5
          `,
          [
            title,
            cleanText(req.body.instructions),
            req.body.due_at || null,
            parseId(req.body.subcategory_id),
            access.assessment.gradebook_assignment_id,
          ]
        );
      }
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("PUT /api/assessments/:assessmentId failed:", error);
      return res.status(500).json({ error: "Failed to update assessment" });
    }
  }
);

router.delete(
  "/assessments/:assessmentId",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const assessmentId = parseId(req.params.assessmentId);
      const access = assessmentId
        ? await canManageAssessment(req.user, assessmentId)
        : { allowed: false, assessment: null };
      if (!access.assessment) {
        return res.status(404).json({ error: "Assessment not found" });
      }
      if (!access.allowed) {
        return res.status(403).json({ error: "You cannot manage this assessment" });
      }
      if (access.assessment.status !== "draft") {
        return res.status(409).json({ error: "Only draft assessments can be deleted" });
      }
      await pool.query("DELETE FROM assessments WHERE id = $1", [assessmentId]);
      return res.json({ success: true });
    } catch (error) {
      console.error("DELETE /api/assessments/:assessmentId failed:", error);
      return res.status(500).json({ error: "Failed to delete assessment" });
    }
  }
);

router.post(
  "/assessments/:assessmentId/questions",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const assessmentId = parseId(req.params.assessmentId);
      const access = assessmentId
        ? await canManageAssessment(req.user, assessmentId)
        : { allowed: false, assessment: null };
      if (!access.assessment) {
        return res.status(404).json({ error: "Assessment not found" });
      }
      if (!access.allowed) {
        return res.status(403).json({ error: "You cannot manage this assessment" });
      }
      if (access.assessment.status !== "draft") {
        return res.status(409).json({ error: "Published assessment questions are locked" });
      }

      const questionType = cleanText(req.body.question_type);
      const prompt = cleanText(req.body.prompt);
      const points = Number(req.body.points);
      const options = normalizeOptions(req.body.options);
      const correctAnswer = normalizeAnswer(req.body.correct_answer);
      if (!QUESTION_TYPES.has(questionType) || !prompt || !(points > 0)) {
        return res.status(400).json({ error: "Valid type, prompt, and points are required" });
      }
      if (questionType === "multiple_choice" && options.length < 2) {
        return res.status(400).json({ error: "Multiple-choice questions need at least two choices" });
      }
      if (OBJECTIVE_TYPES.has(questionType) && cleanText(correctAnswer) === "") {
        return res.status(400).json({ error: "Objective questions require a correct answer" });
      }

      const orderResult = await pool.query(
        `
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
        FROM assessment_questions
        WHERE assessment_id = $1
        `,
        [assessmentId]
      );
      const result = await pool.query(
        `
        INSERT INTO assessment_questions (
          assessment_id, question_type, prompt, options_json,
          correct_answer_json, points, teacher_feedback, sort_order
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
        `,
        [
          assessmentId,
          questionType,
          prompt,
          JSON.stringify(options),
          JSON.stringify(correctAnswer),
          points,
          cleanText(req.body.teacher_feedback),
          orderResult.rows[0].next_order,
        ]
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("POST /api/assessments/:assessmentId/questions failed:", error);
      return res.status(500).json({ error: "Failed to add question" });
    }
  }
);

router.put(
  "/assessments/:assessmentId/questions/:questionId",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const assessmentId = parseId(req.params.assessmentId);
      const questionId = parseId(req.params.questionId);
      const access = assessmentId
        ? await canManageAssessment(req.user, assessmentId)
        : { allowed: false, assessment: null };
      if (!access.assessment) {
        return res.status(404).json({ error: "Assessment not found" });
      }
      if (!access.allowed) {
        return res.status(403).json({ error: "You cannot manage this assessment" });
      }
      if (access.assessment.status !== "draft") {
        return res.status(409).json({ error: "Published assessment questions are locked" });
      }

      const questionType = cleanText(req.body.question_type);
      const prompt = cleanText(req.body.prompt);
      const points = Number(req.body.points);
      const options = normalizeOptions(req.body.options);
      const correctAnswer = normalizeAnswer(req.body.correct_answer);
      if (!questionId || !QUESTION_TYPES.has(questionType) || !prompt || !(points > 0)) {
        return res.status(400).json({ error: "Valid question details are required" });
      }
      if (questionType === "multiple_choice" && options.length < 2) {
        return res.status(400).json({ error: "Multiple-choice questions need at least two choices" });
      }
      if (OBJECTIVE_TYPES.has(questionType) && cleanText(correctAnswer) === "") {
        return res.status(400).json({ error: "Objective questions require a correct answer" });
      }

      const result = await pool.query(
        `
        UPDATE assessment_questions
        SET question_type = $1,
            prompt = $2,
            options_json = $3,
            correct_answer_json = $4,
            points = $5,
            teacher_feedback = $6,
            updated_at = NOW()
        WHERE id = $7
          AND assessment_id = $8
        RETURNING *
        `,
        [
          questionType,
          prompt,
          JSON.stringify(options),
          JSON.stringify(correctAnswer),
          points,
          cleanText(req.body.teacher_feedback),
          questionId,
          assessmentId,
        ]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Question not found" });
      }
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("PUT assessment question failed:", error);
      return res.status(500).json({ error: "Failed to update question" });
    }
  }
);

router.delete(
  "/assessments/:assessmentId/questions/:questionId",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const assessmentId = parseId(req.params.assessmentId);
      const questionId = parseId(req.params.questionId);
      const access = assessmentId
        ? await canManageAssessment(req.user, assessmentId)
        : { allowed: false, assessment: null };
      if (!access.assessment) {
        return res.status(404).json({ error: "Assessment not found" });
      }
      if (!access.allowed) {
        return res.status(403).json({ error: "You cannot manage this assessment" });
      }
      if (access.assessment.status !== "draft") {
        return res.status(409).json({ error: "Published assessment questions are locked" });
      }
      await pool.query(
        "DELETE FROM assessment_questions WHERE id = $1 AND assessment_id = $2",
        [questionId, assessmentId]
      );
      return res.json({ success: true });
    } catch (error) {
      console.error("DELETE assessment question failed:", error);
      return res.status(500).json({ error: "Failed to delete question" });
    }
  }
);

router.post(
  "/assessments/:assessmentId/publish",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const assessmentId = parseId(req.params.assessmentId);
      const access = assessmentId
        ? await canManageAssessment(req.user, assessmentId)
        : { allowed: false, assessment: null };
      if (!access.assessment) {
        return res.status(404).json({ error: "Assessment not found" });
      }
      if (!access.allowed) {
        return res.status(403).json({ error: "You cannot manage this assessment" });
      }
      if (!access.assessment.subcategory_id) {
        return res.status(400).json({ error: "Choose an Evidence Tier before publishing" });
      }
      if (Number(access.assessment.question_count) === 0) {
        return res.status(400).json({ error: "Add at least one question before publishing" });
      }

      await client.query("BEGIN");
      let assignmentId = access.assessment.gradebook_assignment_id;
      if (assignmentId) {
        await client.query(
          `
          UPDATE assignments
          SET title = $1,
              description = $2,
              due_date = $3,
              subcategory_id = $4,
              is_published = true
          WHERE id = $5
          `,
          [
            access.assessment.title,
            access.assessment.instructions,
            access.assessment.due_at,
            access.assessment.subcategory_id,
            assignmentId,
          ]
        );
      } else {
        const sortResult = await client.query(
          `
          SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
          FROM assignments
          WHERE class_id = $1
          `,
          [access.assessment.course_id]
        );
        const assignmentResult = await client.query(
          `
          INSERT INTO assignments (
            class_id, teacher_id, title, description, due_date,
            subcategory_id, is_published, sort_order, scoring_method, source_type
          )
          VALUES ($1,$2,$3,$4,$5,$6,true,$7,'rubric','assessment')
          RETURNING id
          `,
          [
            access.assessment.course_id,
            access.assessment.teacher_id,
            access.assessment.title,
            access.assessment.instructions,
            access.assessment.due_at,
            access.assessment.subcategory_id,
            sortResult.rows[0].next_sort_order,
          ]
        );
        assignmentId = assignmentResult.rows[0].id;
      }

      const result = await client.query(
        `
        UPDATE assessments
        SET status = 'published',
            gradebook_assignment_id = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [assignmentId, assessmentId]
      );
      await client.query("COMMIT");
      return res.json(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("POST assessment publish failed:", error);
      return res.status(500).json({ error: "Failed to publish assessment" });
    } finally {
      client.release();
    }
  }
);

router.post(
  "/assessments/:assessmentId/close",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const assessmentId = parseId(req.params.assessmentId);
      const access = assessmentId
        ? await canManageAssessment(req.user, assessmentId)
        : { allowed: false, assessment: null };
      if (!access.assessment) {
        return res.status(404).json({ error: "Assessment not found" });
      }
      if (!access.allowed) {
        return res.status(403).json({ error: "You cannot manage this assessment" });
      }
      const result = await pool.query(
        `
        UPDATE assessments
        SET status = 'closed', updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [assessmentId]
      );
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("POST assessment close failed:", error);
      return res.status(500).json({ error: "Failed to close assessment" });
    }
  }
);

router.post(
  "/assessments/:assessmentId/attempts/start",
  authenticateJWT,
  requireRole("student"),
  async (req, res) => {
    try {
      const assessmentId = parseId(req.params.assessmentId);
      const assessment = assessmentId ? await getAssessment(assessmentId) : null;
      if (!assessment || assessment.status !== "published") {
        return res.status(409).json({ error: "Assessment is not open" });
      }
      if (!(await isStudentEnrolled(req.user.id, assessment.course_id))) {
        return res.status(403).json({ error: "You are not enrolled in this course" });
      }
      const now = Date.now();
      if (assessment.available_from && new Date(assessment.available_from).getTime() > now) {
        return res.status(409).json({ error: "Assessment is not available yet" });
      }
      if (assessment.due_at && new Date(assessment.due_at).getTime() < now) {
        return res.status(409).json({ error: "Assessment has closed" });
      }

      const result = await pool.query(
        `
        INSERT INTO assessment_attempts (assessment_id, student_user_id)
        VALUES ($1,$2)
        ON CONFLICT (assessment_id, student_user_id)
        DO UPDATE SET autosaved_at = assessment_attempts.autosaved_at
        RETURNING *
        `,
        [assessmentId, req.user.id]
      );
      if (result.rows[0].status !== "in_progress") {
        return res.status(409).json({ error: "This assessment has already been submitted" });
      }
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("POST assessment attempt start failed:", error);
      return res.status(500).json({ error: "Failed to start assessment" });
    }
  }
);

router.get(
  "/assessment-attempts/:attemptId",
  authenticateJWT,
  requireRole("admin", "teacher", "student"),
  async (req, res) => {
    try {
      const attemptId = parseId(req.params.attemptId);
      const result = await pool.query(
        `
        SELECT at.*, a.course_id, a.title, a.status AS assessment_status
        FROM assessment_attempts at
        JOIN assessments a ON a.id = at.assessment_id
        WHERE at.id = $1
        LIMIT 1
        `,
        [attemptId]
      );
      const attempt = result.rows[0];
      if (!attempt) return res.status(404).json({ error: "Attempt not found" });

      const role = String(req.user.role || "").toLowerCase();
      const allowed =
        role === "student"
          ? Number(attempt.student_user_id) === Number(req.user.id)
          : await canManageCourse(req.user, attempt.course_id);
      if (!allowed) return res.status(403).json({ error: "Attempt access denied" });

      const questions = await loadQuestions(attempt.assessment_id, role !== "student");
      return res.json({ attempt, questions });
    } catch (error) {
      console.error("GET assessment attempt failed:", error);
      return res.status(500).json({ error: "Failed to load attempt" });
    }
  }
);

router.put(
  "/assessment-attempts/:attemptId/autosave",
  authenticateJWT,
  requireRole("student"),
  async (req, res) => {
    try {
      const attemptId = parseId(req.params.attemptId);
      const answers =
        req.body.answers && typeof req.body.answers === "object"
          ? req.body.answers
          : {};
      const result = await pool.query(
        `
        UPDATE assessment_attempts
        SET answers_json = $1,
            autosaved_at = NOW()
        WHERE id = $2
          AND student_user_id = $3
          AND status = 'in_progress'
        RETURNING id, autosaved_at
        `,
        [answers, attemptId, req.user.id]
      );
      if (result.rows.length === 0) {
        return res.status(409).json({ error: "Attempt cannot be autosaved" });
      }
      return res.json({ success: true, ...result.rows[0] });
    } catch (error) {
      console.error("PUT assessment autosave failed:", error);
      return res.status(500).json({ error: "Failed to autosave assessment" });
    }
  }
);

router.post(
  "/assessment-attempts/:attemptId/submit",
  authenticateJWT,
  requireRole("student"),
  async (req, res) => {
    try {
      const attemptId = parseId(req.params.attemptId);
      const attemptResult = await pool.query(
        `
        UPDATE assessment_attempts
        SET answers_json = $1,
            submitted_at = NOW(),
            status = 'submitted',
            autosaved_at = NOW()
        WHERE id = $2
          AND student_user_id = $3
          AND status = 'in_progress'
        RETURNING *
        `,
        [
          req.body.answers && typeof req.body.answers === "object"
            ? req.body.answers
            : {},
          attemptId,
          req.user.id,
        ]
      );
      if (attemptResult.rows.length === 0) {
        return res.status(409).json({ error: "Attempt cannot be submitted" });
      }

      const calculated = await calculateAttempt(attemptId);
      const status = calculated.isGraded ? "graded" : "submitted";
      const updated = await pool.query(
        `
        UPDATE assessment_attempts
        SET auto_points = $1,
            manual_points = $2,
            score_percent = $3,
            status = $4,
            graded_at = CASE WHEN $4 = 'graded' THEN NOW() ELSE NULL END
        WHERE id = $5
        RETURNING *
        `,
        [
          calculated.autoPoints,
          calculated.manualPoints,
          calculated.scorePercent,
          status,
          attemptId,
        ]
      );
      if (status === "graded") await syncAttemptToGradebook(attemptId);
      return res.json(updated.rows[0]);
    } catch (error) {
      console.error("POST assessment submit failed:", error);
      return res.status(500).json({ error: "Failed to submit assessment" });
    }
  }
);

router.get(
  "/assessments/:assessmentId/attempts",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const assessmentId = parseId(req.params.assessmentId);
      const access = assessmentId
        ? await canManageAssessment(req.user, assessmentId)
        : { allowed: false, assessment: null };
      if (!access.assessment) {
        return res.status(404).json({ error: "Assessment not found" });
      }
      if (!access.allowed) {
        return res.status(403).json({ error: "You cannot manage this assessment" });
      }
      const result = await pool.query(
        `
        SELECT
          at.*,
          u.name AS student_name,
          u.email AS student_email
        FROM assessment_attempts at
        JOIN users u ON u.id = at.student_user_id
        WHERE at.assessment_id = $1
        ORDER BY u.name ASC, u.email ASC
        `,
        [assessmentId]
      );
      return res.json(result.rows);
    } catch (error) {
      console.error("GET assessment attempts failed:", error);
      return res.status(500).json({ error: "Failed to load assessment attempts" });
    }
  }
);

router.put(
  "/assessment-attempts/:attemptId/grade",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const attemptId = parseId(req.params.attemptId);
      const attemptResult = await pool.query(
        `
        SELECT at.*, a.course_id
        FROM assessment_attempts at
        JOIN assessments a ON a.id = at.assessment_id
        WHERE at.id = $1
        LIMIT 1
        `,
        [attemptId]
      );
      const attempt = attemptResult.rows[0];
      if (!attempt) return res.status(404).json({ error: "Attempt not found" });
      if (!(await canManageCourse(req.user, attempt.course_id))) {
        return res.status(403).json({ error: "You cannot grade this attempt" });
      }

      const manualScores =
        req.body.manual_scores && typeof req.body.manual_scores === "object"
          ? req.body.manual_scores
          : {};
      const calculated = await calculateAttempt(attemptId, manualScores);
      if (!calculated.isGraded) {
        return res.status(400).json({ error: "Score every written response before saving" });
      }

      const result = await pool.query(
        `
        UPDATE assessment_attempts
        SET manual_scores_json = $1,
            auto_points = $2,
            manual_points = $3,
            score_percent = $4,
            teacher_feedback = $5,
            status = 'graded',
            graded_at = NOW()
        WHERE id = $6
        RETURNING *
        `,
        [
          manualScores,
          calculated.autoPoints,
          calculated.manualPoints,
          calculated.scorePercent,
          cleanText(req.body.teacher_feedback),
          attemptId,
        ]
      );
      await syncAttemptToGradebook(attemptId);
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("PUT assessment grade failed:", error);
      return res.status(500).json({ error: "Failed to grade assessment" });
    }
  }
);

module.exports = {
  router,
  ensureAssessmentTables,
};
