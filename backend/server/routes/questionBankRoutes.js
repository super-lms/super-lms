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

function cleanText(value) {
  return String(value ?? "").trim();
}

function parseId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean);
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
      ON ct.course_id = c.id AND ct.teacher_id = $2
    WHERE c.id = $1
      AND (c.teacher_id = $2 OR ct.teacher_id = $2)
    LIMIT 1
    `,
    [courseId, userId]
  );
  return result.rows.length > 0;
}

async function getBank(bankId) {
  const result = await pool.query(
    `
    SELECT
      b.*,
      c.title AS course_title,
      COUNT(i.id)::INTEGER AS question_count
    FROM assessment_question_banks b
    JOIN courses c ON c.id = b.course_id
    LEFT JOIN assessment_question_bank_items i ON i.bank_id = b.id
    WHERE b.id = $1
    GROUP BY b.id, c.title
    LIMIT 1
    `,
    [bankId]
  );
  return result.rows[0] || null;
}

async function requireBankAccess(req, res) {
  const bankId = parseId(req.params.bankId);
  const bank = bankId ? await getBank(bankId) : null;
  if (!bank) {
    res.status(404).json({ error: "Question bank not found" });
    return null;
  }
  if (!(await canManageCourse(req.user, bank.course_id))) {
    res.status(403).json({ error: "You cannot manage this question bank" });
    return null;
  }
  return bank;
}

function validateQuestion(body) {
  const questionType = cleanText(body.question_type);
  const prompt = cleanText(body.prompt);
  const points = Number(body.points);
  const options = normalizeList(body.options);
  const correctAnswer = body.correct_answer ?? null;
  if (!QUESTION_TYPES.has(questionType) || !prompt || !(points > 0)) {
    return { error: "Valid type, prompt, and points are required" };
  }
  if (questionType === "multiple_choice" && options.length < 2) {
    return { error: "Multiple-choice questions need at least two choices" };
  }
  if (OBJECTIVE_TYPES.has(questionType) && !cleanText(correctAnswer)) {
    return { error: "Objective questions require a correct answer" };
  }
  return {
    questionType,
    prompt,
    points,
    options,
    correctAnswer,
    teacherFeedback: cleanText(body.teacher_feedback),
    tags: normalizeList(body.tags),
  };
}

router.get(
  "/question-banks",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const courseId = parseId(req.query.courseId);
      const role = String(req.user.role || "").toLowerCase();
      const params = [];
      let where = "";
      if (role === "teacher") {
        params.push(parseId(req.user.id));
        where = `
          WHERE (
            c.teacher_id = $1 OR EXISTS (
              SELECT 1
              FROM course_teachers ct
              WHERE ct.course_id = c.id AND ct.teacher_id = $1
            )
          )
        `;
      }
      if (courseId) {
        params.push(courseId);
        where += where ? ` AND b.course_id = $${params.length}` : ` WHERE b.course_id = $${params.length}`;
      }
      const result = await pool.query(
        `
        SELECT
          b.*,
          c.title AS course_title,
          COUNT(i.id)::INTEGER AS question_count
        FROM assessment_question_banks b
        JOIN courses c ON c.id = b.course_id
        LEFT JOIN assessment_question_bank_items i ON i.bank_id = b.id
        ${where}
        GROUP BY b.id, c.title
        ORDER BY b.updated_at DESC, b.id DESC
        `,
        params
      );
      return res.json(result.rows);
    } catch (error) {
      console.error("GET question banks failed:", error);
      return res.status(500).json({ error: "Failed to load question banks" });
    }
  }
);

router.post(
  "/question-banks",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const courseId = parseId(req.body.course_id);
      const title = cleanText(req.body.title);
      if (!courseId || !title) {
        return res.status(400).json({ error: "Course and bank title are required" });
      }
      if (!(await canManageCourse(req.user, courseId))) {
        return res.status(403).json({ error: "You cannot manage this course" });
      }
      const result = await pool.query(
        `
        INSERT INTO assessment_question_banks (
          course_id, teacher_id, title, description, tags_json
        )
        VALUES ($1,$2,$3,$4,$5)
        RETURNING *
        `,
        [
          courseId,
          parseId(req.user.id),
          title,
          cleanText(req.body.description),
          JSON.stringify(normalizeList(req.body.tags)),
        ]
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("POST question bank failed:", error);
      return res.status(500).json({ error: "Failed to create question bank" });
    }
  }
);

router.put(
  "/question-banks/:bankId",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const bank = await requireBankAccess(req, res);
      if (!bank) return;
      const title = cleanText(req.body.title);
      if (!title) return res.status(400).json({ error: "Bank title is required" });
      const result = await pool.query(
        `
        UPDATE assessment_question_banks
        SET title = $1,
            description = $2,
            tags_json = $3,
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
        `,
        [
          title,
          cleanText(req.body.description),
          JSON.stringify(normalizeList(req.body.tags)),
          bank.id,
        ]
      );
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("PUT question bank failed:", error);
      return res.status(500).json({ error: "Failed to update question bank" });
    }
  }
);

router.delete(
  "/question-banks/:bankId",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const bank = await requireBankAccess(req, res);
      if (!bank) return;
      const groupResult = await pool.query(
        "SELECT COUNT(*)::INTEGER AS count FROM assessment_question_groups WHERE bank_id = $1",
        [bank.id]
      );
      if (Number(groupResult.rows[0].count) > 0) {
        return res.status(409).json({
          error: "Remove this bank from draft assessments before deleting it",
        });
      }
      await pool.query("DELETE FROM assessment_question_banks WHERE id = $1", [bank.id]);
      return res.json({ success: true });
    } catch (error) {
      console.error("DELETE question bank failed:", error);
      return res.status(500).json({ error: "Failed to delete question bank" });
    }
  }
);

router.get(
  "/question-banks/:bankId/items",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const bank = await requireBankAccess(req, res);
      if (!bank) return;
      const result = await pool.query(
        `
        SELECT *
        FROM assessment_question_bank_items
        WHERE bank_id = $1
        ORDER BY id ASC
        `,
        [bank.id]
      );
      return res.json(result.rows);
    } catch (error) {
      console.error("GET bank items failed:", error);
      return res.status(500).json({ error: "Failed to load bank questions" });
    }
  }
);

router.post(
  "/question-banks/:bankId/items",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const bank = await requireBankAccess(req, res);
      if (!bank) return;
      const question = validateQuestion(req.body);
      if (question.error) return res.status(400).json({ error: question.error });
      const result = await pool.query(
        `
        INSERT INTO assessment_question_bank_items (
          bank_id, question_type, prompt, options_json, correct_answer_json,
          points, teacher_feedback, tags_json
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
        `,
        [
          bank.id,
          question.questionType,
          question.prompt,
          JSON.stringify(question.options),
          JSON.stringify(question.correctAnswer),
          question.points,
          question.teacherFeedback,
          JSON.stringify(question.tags),
        ]
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("POST bank item failed:", error);
      return res.status(500).json({ error: "Failed to add bank question" });
    }
  }
);

router.put(
  "/question-banks/:bankId/items/:itemId",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const bank = await requireBankAccess(req, res);
      if (!bank) return;
      const itemId = parseId(req.params.itemId);
      const question = validateQuestion(req.body);
      if (!itemId || question.error) {
        return res.status(400).json({ error: question.error || "Valid item is required" });
      }
      const result = await pool.query(
        `
        UPDATE assessment_question_bank_items
        SET question_type = $1,
            prompt = $2,
            options_json = $3,
            correct_answer_json = $4,
            points = $5,
            teacher_feedback = $6,
            tags_json = $7,
            updated_at = NOW()
        WHERE id = $8 AND bank_id = $9
        RETURNING *
        `,
        [
          question.questionType,
          question.prompt,
          JSON.stringify(question.options),
          JSON.stringify(question.correctAnswer),
          question.points,
          question.teacherFeedback,
          JSON.stringify(question.tags),
          itemId,
          bank.id,
        ]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Bank question not found" });
      }
      return res.json(result.rows[0]);
    } catch (error) {
      console.error("PUT bank item failed:", error);
      return res.status(500).json({ error: "Failed to update bank question" });
    }
  }
);

router.delete(
  "/question-banks/:bankId/items/:itemId",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    try {
      const bank = await requireBankAccess(req, res);
      if (!bank) return;
      const itemId = parseId(req.params.itemId);
      await pool.query(
        "DELETE FROM assessment_question_bank_items WHERE id = $1 AND bank_id = $2",
        [itemId, bank.id]
      );
      return res.json({ success: true });
    } catch (error) {
      console.error("DELETE bank item failed:", error);
      return res.status(500).json({ error: "Failed to delete bank question" });
    }
  }
);

module.exports = router;
