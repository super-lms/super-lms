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
      question_snapshot_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      UNIQUE (assessment_id, student_user_id)
    )
  `);

  await pool.query(`
    ALTER TABLE assessments
    ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS shuffle_answers BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER,
    ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 1
  `);

  await pool.query(`
    ALTER TABLE assessment_attempts
    ADD COLUMN IF NOT EXISTS question_snapshot_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS time_limit_minutes_applied INTEGER,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reopened_count INTEGER NOT NULL DEFAULT 0
  `);

  await pool.query(`
    ALTER TABLE assessment_attempts
    DROP CONSTRAINT IF EXISTS assessment_attempts_assessment_id_student_user_id_key
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS assessment_attempts_student_number_idx
    ON assessment_attempts (assessment_id, student_user_id, attempt_number)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessment_accommodations (
      id SERIAL PRIMARY KEY,
      assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      student_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      extra_time_minutes INTEGER NOT NULL DEFAULT 0,
      extra_attempts INTEGER NOT NULL DEFAULT 0,
      available_from_override TIMESTAMPTZ,
      due_at_override TIMESTAMPTZ,
      notes TEXT DEFAULT '',
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (assessment_id, student_user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessment_audit_events (
      id BIGSERIAL PRIMARY KEY,
      assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      attempt_id INTEGER REFERENCES assessment_attempts(id) ON DELETE SET NULL,
      student_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessment_question_banks (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessment_question_bank_items (
      id SERIAL PRIMARY KEY,
      bank_id INTEGER NOT NULL REFERENCES assessment_question_banks(id) ON DELETE CASCADE,
      question_type TEXT NOT NULL
        CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer', 'essay')),
      prompt TEXT NOT NULL,
      options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      correct_answer_json JSONB,
      points NUMERIC NOT NULL DEFAULT 1 CHECK (points > 0),
      teacher_feedback TEXT DEFAULT '',
      tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessment_question_groups (
      id SERIAL PRIMARY KEY,
      assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      bank_id INTEGER NOT NULL REFERENCES assessment_question_banks(id) ON DELETE RESTRICT,
      title TEXT NOT NULL,
      draw_count INTEGER NOT NULL CHECK (draw_count > 0),
      points_per_question NUMERIC NOT NULL DEFAULT 1 CHECK (points_per_question > 0),
      sort_order INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
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

  await pool.query(`
    CREATE INDEX IF NOT EXISTS assessment_audit_events_assessment_created_idx
    ON assessment_audit_events (assessment_id, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS assessment_question_bank_items_bank_idx
    ON assessment_question_bank_items (bank_id, id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS assessment_question_groups_assessment_idx
    ON assessment_question_groups (assessment_id, sort_order, id)
  `);
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function parseId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function nonNegativeInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function positiveInteger(value, fallback = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeOptions(value) {
  if (!Array.isArray(value)) return [];
  return value.map((option) => cleanText(option)).filter(Boolean);
}

function normalizeAnswer(value) {
  if (value === undefined) return null;
  return value;
}

function shuffleArray(values) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }
  return next;
}

function hideSnapshotAnswers(questions) {
  return questions.map(({ correct_answer_json, teacher_feedback, ...question }) => question);
}

async function loadQuestionGroups(assessmentId) {
  const result = await pool.query(
    `
    SELECT
      g.*,
      b.title AS bank_title,
      COUNT(i.id)::INTEGER AS bank_question_count
    FROM assessment_question_groups g
    JOIN assessment_question_banks b ON b.id = g.bank_id
    LEFT JOIN assessment_question_bank_items i ON i.bank_id = b.id
    WHERE g.assessment_id = $1
    GROUP BY g.id, b.title
    ORDER BY g.sort_order ASC, g.id ASC
    `,
    [assessmentId]
  );
  return result.rows.map((group) => ({
    ...group,
    draw_count: Number(group.draw_count),
    points_per_question: Number(group.points_per_question),
    bank_question_count: Number(group.bank_question_count),
  }));
}

async function buildAttemptQuestionSnapshot(assessment) {
  const directQuestions = await loadQuestions(assessment.id, true);
  const groups = await loadQuestionGroups(assessment.id);
  const snapshot = directQuestions.map((question) => ({
    ...question,
    id: `direct:${question.id}`,
    source_question_id: question.id,
    source_type: "direct",
  }));

  for (const group of groups) {
    const itemResult = await pool.query(
      `
      SELECT *
      FROM assessment_question_bank_items
      WHERE bank_id = $1
      ORDER BY id ASC
      `,
      [group.bank_id]
    );
    const selectedItems = shuffleArray(itemResult.rows).slice(0, group.draw_count);
    selectedItems.forEach((item) => {
      snapshot.push({
        id: `group:${group.id}:item:${item.id}`,
        source_question_id: item.id,
        source_group_id: group.id,
        source_type: "question_bank",
        question_type: item.question_type,
        prompt: item.prompt,
        options_json: Array.isArray(item.options_json) ? item.options_json : [],
        correct_answer_json: item.correct_answer_json,
        points: Number(group.points_per_question),
        teacher_feedback: item.teacher_feedback || "",
      });
    });
  }

  const ordered = assessment.shuffle_questions ? shuffleArray(snapshot) : snapshot;
  return ordered.map((question) => ({
    ...question,
    options_json:
      assessment.shuffle_answers && question.question_type === "multiple_choice"
        ? shuffleArray(question.options_json || [])
        : question.options_json || [],
  }));
}

async function loadAttemptQuestions(attempt, includeAnswers) {
  const snapshot = Array.isArray(attempt.question_snapshot_json)
    ? attempt.question_snapshot_json
    : [];
  if (snapshot.length > 0) {
    return includeAnswers ? snapshot : hideSnapshotAnswers(snapshot);
  }
  return loadQuestions(attempt.assessment_id, includeAnswers);
}

function serializeAssessment(row) {
  return {
    ...row,
    points_possible: Number(row.points_possible || 0),
    question_count: Number(row.question_count || 0),
    attempt_count: Number(row.attempt_count || 0),
    submitted_count: Number(row.submitted_count || 0),
    needs_grading_count: Number(row.needs_grading_count || 0),
    time_limit_minutes:
      row.time_limit_minutes === null || row.time_limit_minutes === undefined
        ? null
        : Number(row.time_limit_minutes),
    max_attempts: positiveInteger(row.max_attempts, 1),
    attempts_used: Number(row.attempts_used || 0),
    allowed_attempts: positiveInteger(row.allowed_attempts, row.max_attempts || 1),
  };
}

async function recordAssessmentAudit({
  assessmentId,
  attemptId = null,
  studentUserId = null,
  actorUserId = null,
  eventType,
  details = {},
}) {
  await pool.query(
    `
    INSERT INTO assessment_audit_events (
      assessment_id, attempt_id, student_user_id, actor_user_id,
      event_type, details_json
    )
    VALUES ($1,$2,$3,$4,$5,$6)
    `,
    [
      assessmentId,
      attemptId,
      studentUserId,
      actorUserId,
      eventType,
      JSON.stringify(details),
    ]
  );
}

async function getStudentAssessmentPolicy(assessment, studentUserId) {
  const result = await pool.query(
    `
    SELECT *
    FROM assessment_accommodations
    WHERE assessment_id = $1
      AND student_user_id = $2
    LIMIT 1
    `,
    [assessment.id, studentUserId]
  );
  const accommodation = result.rows[0] || {};
  const baseTime =
    assessment.time_limit_minutes === null ||
    assessment.time_limit_minutes === undefined
      ? null
      : positiveInteger(assessment.time_limit_minutes, null);
  return {
    accommodation,
    availableFrom:
      accommodation.available_from_override || assessment.available_from || null,
    dueAt: accommodation.due_at_override || assessment.due_at || null,
    allowedAttempts:
      positiveInteger(assessment.max_attempts, 1) +
      nonNegativeInteger(accommodation.extra_attempts),
    timeLimitMinutes:
      baseTime === null
        ? null
        : baseTime + nonNegativeInteger(accommodation.extra_time_minutes),
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
      COALESCE(SUM(q.points), 0) + COALESCE((
        SELECT SUM(g.draw_count * g.points_per_question)
        FROM assessment_question_groups g
        WHERE g.assessment_id = a.id
      ), 0) AS points_possible,
      COUNT(q.id)::INTEGER + COALESCE((
        SELECT SUM(g.draw_count)::INTEGER
        FROM assessment_question_groups g
        WHERE g.assessment_id = a.id
      ), 0) AS question_count,
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

  const questions = await loadAttemptQuestions(attempt, true);
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
          ), 0) + COALESCE((
            SELECT SUM(g.draw_count * g.points_per_question)
            FROM assessment_question_groups g
            WHERE g.assessment_id = a.id
          ), 0) AS points_possible,
          (
            SELECT COUNT(*)::INTEGER
            FROM assessment_questions q
            WHERE q.assessment_id = a.id
          ) + COALESCE((
            SELECT SUM(g.draw_count)::INTEGER
            FROM assessment_question_groups g
            WHERE g.assessment_id = a.id
          ), 0) AS question_count,
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
            ORDER BY
              CASE WHEN at.status = 'in_progress' THEN 0 ELSE 1 END,
              at.attempt_number DESC,
              at.id DESC
            LIMIT 1
          ) AS student_attempt_status,
          (
            SELECT at.id
            FROM assessment_attempts at
            WHERE at.assessment_id = a.id
              AND at.student_user_id = $1
            ORDER BY
              CASE WHEN at.status = 'in_progress' THEN 0 ELSE 1 END,
              at.attempt_number DESC,
              at.id DESC
            LIMIT 1
          ) AS student_attempt_id,
          (
            SELECT COUNT(*)::INTEGER
            FROM assessment_attempts at
            WHERE at.assessment_id = a.id
              AND at.student_user_id = $1
          ) AS attempts_used,
          (
            COALESCE(a.max_attempts, 1) + COALESCE((
              SELECT ac.extra_attempts
              FROM assessment_accommodations ac
              WHERE ac.assessment_id = a.id
                AND ac.student_user_id = $1
              LIMIT 1
            ), 0)
          ) AS allowed_attempts,
          COALESCE((
            SELECT ac.available_from_override
            FROM assessment_accommodations ac
            WHERE ac.assessment_id = a.id
              AND ac.student_user_id = $1
            LIMIT 1
          ), a.available_from) AS effective_available_from,
          COALESCE((
            SELECT ac.due_at_override
            FROM assessment_accommodations ac
            WHERE ac.assessment_id = a.id
              AND ac.student_user_id = $1
            LIMIT 1
          ), a.due_at) AS effective_due_at
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
          available_from, due_at, time_limit_minutes, max_attempts
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
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
          req.body.time_limit_minutes
            ? positiveInteger(req.body.time_limit_minutes, null)
            : null,
          positiveInteger(req.body.max_attempts, 1),
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
      const questionGroups = isManager
        ? await loadQuestionGroups(assessmentId)
        : [];
      let serializedAssessment = serializeAssessment(assessment);
      if (role === "student") {
        const policy = await getStudentAssessmentPolicy(assessment, req.user.id);
        const attemptCount = await pool.query(
          `
          SELECT COUNT(*)::INTEGER AS attempts_used
          FROM assessment_attempts
          WHERE assessment_id = $1
            AND student_user_id = $2
          `,
          [assessmentId, req.user.id]
        );
        serializedAssessment = {
          ...serializedAssessment,
          effective_available_from: policy.availableFrom,
          effective_due_at: policy.dueAt,
          allowed_attempts: policy.allowedAttempts,
          attempts_used: Number(attemptCount.rows[0].attempts_used || 0),
          effective_time_limit_minutes: policy.timeLimitMinutes,
        };
      }
      return res.json({
        assessment: serializedAssessment,
        questions,
        question_groups: questionGroups,
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
            shuffle_questions = $6,
            shuffle_answers = $7,
            time_limit_minutes = $8,
            max_attempts = $9,
            updated_at = NOW()
        WHERE id = $10
        RETURNING *
        `,
        [
          title,
          cleanText(req.body.instructions),
          parseId(req.body.subcategory_id),
          req.body.available_from || null,
          req.body.due_at || null,
          Boolean(req.body.shuffle_questions),
          Boolean(req.body.shuffle_answers),
          req.body.time_limit_minutes
            ? positiveInteger(req.body.time_limit_minutes, null)
            : null,
          positiveInteger(req.body.max_attempts, 1),
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
  "/assessments/:assessmentId/question-groups",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const assessmentId = parseId(req.params.assessmentId);
      const bankId = parseId(req.body.bank_id);
      const drawCount = Number(req.body.draw_count);
      const pointsPerQuestion = Number(req.body.points_per_question);
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
        return res.status(409).json({ error: "Published assessment groups are locked" });
      }
      if (!bankId || !Number.isInteger(drawCount) || drawCount < 1 || !(pointsPerQuestion > 0)) {
        return res.status(400).json({ error: "Bank, draw count, and points are required" });
      }

      const bankResult = await pool.query(
        `
        SELECT b.id, b.title, b.course_id, COUNT(i.id)::INTEGER AS question_count
        FROM assessment_question_banks b
        LEFT JOIN assessment_question_bank_items i ON i.bank_id = b.id
        WHERE b.id = $1
        GROUP BY b.id
        `,
        [bankId]
      );
      const bank = bankResult.rows[0];
      if (!bank || Number(bank.course_id) !== Number(access.assessment.course_id)) {
        return res.status(400).json({ error: "Choose a question bank from this course" });
      }
      if (drawCount > Number(bank.question_count)) {
        return res.status(400).json({
          error: `This bank contains only ${bank.question_count} questions`,
        });
      }

      const orderResult = await pool.query(
        `
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
        FROM assessment_question_groups
        WHERE assessment_id = $1
        `,
        [assessmentId]
      );
      const result = await pool.query(
        `
        INSERT INTO assessment_question_groups (
          assessment_id, bank_id, title, draw_count,
          points_per_question, sort_order
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *
        `,
        [
          assessmentId,
          bankId,
          cleanText(req.body.title) || bank.title,
          drawCount,
          pointsPerQuestion,
          orderResult.rows[0].next_order,
        ]
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("POST assessment question group failed:", error);
      return res.status(500).json({ error: "Failed to add random question group" });
    }
  }
);

router.delete(
  "/assessments/:assessmentId/question-groups/:groupId",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const assessmentId = parseId(req.params.assessmentId);
      const groupId = parseId(req.params.groupId);
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
        return res.status(409).json({ error: "Published assessment groups are locked" });
      }
      await pool.query(
        `
        DELETE FROM assessment_question_groups
        WHERE id = $1 AND assessment_id = $2
        `,
        [groupId, assessmentId]
      );
      return res.json({ success: true });
    } catch (error) {
      console.error("DELETE assessment question group failed:", error);
      return res.status(500).json({ error: "Failed to delete random question group" });
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
      const policy = await getStudentAssessmentPolicy(assessment, req.user.id);
      const now = Date.now();
      if (policy.availableFrom && new Date(policy.availableFrom).getTime() > now) {
        return res.status(409).json({ error: "Assessment is not available yet" });
      }
      if (policy.dueAt && new Date(policy.dueAt).getTime() < now) {
        return res.status(409).json({ error: "Assessment has closed" });
      }

      const existing = await pool.query(
        `
        SELECT *
        FROM assessment_attempts
        WHERE assessment_id = $1
          AND student_user_id = $2
          AND status = 'in_progress'
        ORDER BY attempt_number DESC, id DESC
        LIMIT 1
        `,
        [assessmentId, req.user.id]
      );
      if (existing.rows[0]) {
        return res.json({
          ...existing.rows[0],
          question_snapshot_json: hideSnapshotAnswers(
            Array.isArray(existing.rows[0].question_snapshot_json)
              ? existing.rows[0].question_snapshot_json
              : []
          ),
        });
      }

      const countResult = await pool.query(
        `
        SELECT
          COUNT(*)::INTEGER AS attempts_used,
          COALESCE(MAX(attempt_number), 0)::INTEGER AS last_attempt_number
        FROM assessment_attempts
        WHERE assessment_id = $1
          AND student_user_id = $2
        `,
        [assessmentId, req.user.id]
      );
      const attemptsUsed = Number(countResult.rows[0].attempts_used || 0);
      if (attemptsUsed >= policy.allowedAttempts) {
        return res.status(409).json({ error: "No assessment attempts remain" });
      }

      const questionSnapshot = await buildAttemptQuestionSnapshot(assessment);
      const result = await pool.query(
        `
        INSERT INTO assessment_attempts (
          assessment_id, student_user_id, question_snapshot_json,
          attempt_number, time_limit_minutes_applied, expires_at
        )
        VALUES (
          $1,$2,$3,$4,$5,
          CASE WHEN $5::INTEGER IS NULL
            THEN NULL
            ELSE NOW() + ($5::INTEGER * INTERVAL '1 minute')
          END
        )
        RETURNING *
        `,
        [
          assessmentId,
          req.user.id,
          JSON.stringify(questionSnapshot),
          Number(countResult.rows[0].last_attempt_number || 0) + 1,
          policy.timeLimitMinutes,
        ]
      );
      await recordAssessmentAudit({
        assessmentId,
        attemptId: result.rows[0].id,
        studentUserId: req.user.id,
        actorUserId: req.user.id,
        eventType: "attempt_started",
        details: {
          attempt_number: result.rows[0].attempt_number,
          time_limit_minutes: policy.timeLimitMinutes,
        },
      });
      return res.json({
        ...result.rows[0],
        question_snapshot_json: hideSnapshotAnswers(
          Array.isArray(result.rows[0].question_snapshot_json)
            ? result.rows[0].question_snapshot_json
            : []
        ),
      });
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

      const questions = await loadAttemptQuestions(attempt, role !== "student");
      const safeAttempt =
        role === "student"
          ? {
              ...attempt,
              question_snapshot_json: hideSnapshotAnswers(
                Array.isArray(attempt.question_snapshot_json)
                  ? attempt.question_snapshot_json
                  : []
              ),
            }
          : attempt;
      return res.json({ attempt: safeAttempt, questions });
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
          AND (expires_at IS NULL OR expires_at > NOW())
        RETURNING id, autosaved_at
        `,
        [answers, attemptId, req.user.id]
      );
      if (result.rows.length === 0) {
        return res.status(409).json({ error: "Attempt is closed or time has expired" });
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
        SET answers_json = CASE
              WHEN expires_at IS NOT NULL AND expires_at <= NOW()
                THEN answers_json
              ELSE $1
            END,
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
      const submittedAttempt = attemptResult.rows[0];
      await recordAssessmentAudit({
        assessmentId: submittedAttempt.assessment_id,
        attemptId,
        studentUserId: req.user.id,
        actorUserId: req.user.id,
        eventType:
          submittedAttempt.expires_at &&
          new Date(submittedAttempt.expires_at).getTime() <= Date.now()
            ? "attempt_auto_submitted"
            : "attempt_submitted",
        details: { attempt_number: submittedAttempt.attempt_number },
      });

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
  "/assessments/:assessmentId/accommodations",
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
          u.id AS student_user_id,
          u.name AS student_name,
          u.email AS student_email,
          COALESCE(ac.extra_time_minutes, 0) AS extra_time_minutes,
          COALESCE(ac.extra_attempts, 0) AS extra_attempts,
          ac.available_from_override,
          ac.due_at_override,
          COALESCE(ac.notes, '') AS notes,
          ac.updated_at
        FROM class_enrollments ce
        JOIN users u ON u.id = ce.student_user_id
        LEFT JOIN assessment_accommodations ac
          ON ac.assessment_id = $1
          AND ac.student_user_id = u.id
        WHERE ce.class_id = $2
        ORDER BY u.name ASC, u.email ASC
        `,
        [assessmentId, access.assessment.course_id]
      );
      return res.json(result.rows);
    } catch (error) {
      console.error("GET assessment accommodations failed:", error);
      return res.status(500).json({ error: "Failed to load accommodations" });
    }
  }
);

router.put(
  "/assessments/:assessmentId/accommodations/:studentId",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const assessmentId = parseId(req.params.assessmentId);
      const studentId = parseId(req.params.studentId);
      const access = assessmentId
        ? await canManageAssessment(req.user, assessmentId)
        : { allowed: false, assessment: null };
      if (!access.assessment || !studentId) {
        return res.status(404).json({ error: "Assessment or student not found" });
      }
      if (!access.allowed) {
        return res.status(403).json({ error: "You cannot manage this assessment" });
      }
      if (!(await isStudentEnrolled(studentId, access.assessment.course_id))) {
        return res.status(409).json({ error: "Student is not enrolled in this course" });
      }
      const result = await pool.query(
        `
        INSERT INTO assessment_accommodations (
          assessment_id, student_user_id, extra_time_minutes, extra_attempts,
          available_from_override, due_at_override, notes, updated_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (assessment_id, student_user_id)
        DO UPDATE SET
          extra_time_minutes = EXCLUDED.extra_time_minutes,
          extra_attempts = EXCLUDED.extra_attempts,
          available_from_override = EXCLUDED.available_from_override,
          due_at_override = EXCLUDED.due_at_override,
          notes = EXCLUDED.notes,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING *
        `,
        [
          assessmentId,
          studentId,
          nonNegativeInteger(req.body.extra_time_minutes),
          nonNegativeInteger(req.body.extra_attempts),
          req.body.available_from_override || null,
          req.body.due_at_override || null,
          cleanText(req.body.notes),
          req.user.id,
        ]
      );
      await recordAssessmentAudit({
        assessmentId,
        studentUserId: studentId,
        actorUserId: req.user.id,
        eventType: "accommodation_updated",
        details: {
          extra_time_minutes: result.rows[0].extra_time_minutes,
          extra_attempts: result.rows[0].extra_attempts,
          available_from_override: result.rows[0].available_from_override,
          due_at_override: result.rows[0].due_at_override,
        },
      });
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("PUT assessment accommodation failed:", error);
      return res.status(500).json({ error: "Failed to save accommodation" });
    }
  }
);

router.get(
  "/assessments/:assessmentId/audit-events",
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
          ae.*,
          student.name AS student_name,
          actor.name AS actor_name
        FROM assessment_audit_events ae
        LEFT JOIN users student ON student.id = ae.student_user_id
        LEFT JOIN users actor ON actor.id = ae.actor_user_id
        WHERE ae.assessment_id = $1
        ORDER BY ae.created_at DESC, ae.id DESC
        LIMIT 100
        `,
        [assessmentId]
      );
      return res.json(result.rows);
    } catch (error) {
      console.error("GET assessment audit failed:", error);
      return res.status(500).json({ error: "Failed to load assessment history" });
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
  "/assessment-attempts/:attemptId/reopen",
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
        return res.status(403).json({ error: "You cannot reopen this attempt" });
      }
      const extensionMinutes = positiveInteger(req.body.extension_minutes, null);
      const result = await pool.query(
        `
        UPDATE assessment_attempts
        SET status = 'in_progress',
            submitted_at = NULL,
            graded_at = NULL,
            expires_at = CASE
              WHEN $1::INTEGER IS NULL THEN NULL
              ELSE NOW() + ($1::INTEGER * INTERVAL '1 minute')
            END,
            time_limit_minutes_applied = $1,
            reopened_count = reopened_count + 1,
            autosaved_at = NOW()
        WHERE id = $2
        RETURNING *
        `,
        [extensionMinutes, attemptId]
      );
      await recordAssessmentAudit({
        assessmentId: attempt.assessment_id,
        attemptId,
        studentUserId: attempt.student_user_id,
        actorUserId: req.user.id,
        eventType: "attempt_reopened",
        details: { extension_minutes: extensionMinutes },
      });
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("PUT assessment reopen failed:", error);
      return res.status(500).json({ error: "Failed to reopen attempt" });
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
      await recordAssessmentAudit({
        assessmentId: attempt.assessment_id,
        attemptId,
        studentUserId: attempt.student_user_id,
        actorUserId: req.user.id,
        eventType: "attempt_graded",
        details: { score_percent: calculated.scorePercent },
      });
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
