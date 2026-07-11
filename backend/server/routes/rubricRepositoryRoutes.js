const express = require("express");
const pool = require("../db");

const router = express.Router();

const VALID_SCOPES = ["ASSIGNMENT", "PERSONAL", "DEPARTMENT", "SCHOOL"];
const VALID_STATUSES = ["DRAFT", "PENDING", "APPROVED", "ARCHIVED"];

function normalizeScope(value) {
  const scope = String(value || "PERSONAL").trim().toUpperCase();
  return VALID_SCOPES.includes(scope) ? scope : "PERSONAL";
}

function normalizeStatus(value) {
  const status = String(value || "DRAFT").trim().toUpperCase();
  return VALID_STATUSES.includes(status) ? status : "DRAFT";
}

router.get("/rubric-repository", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM rubric_repository
      ORDER BY updated_at DESC, id DESC
    `);

    return res.json({ rubrics: result.rows });
  } catch (err) {
    console.error("GET /api/rubric-repository failed:", err);
    return res.status(500).json({ error: "Failed to load rubric repository" });
  }
});

router.get("/rubric-repository/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Valid rubric id is required" });
  }

  try {
    const result = await pool.query(
      `
        SELECT *
        FROM rubric_repository
        WHERE id = $1
      `,
      [id]
    );

    return res.json({ rubric: result.rows[0] || null });
  } catch (err) {
    console.error("GET /api/rubric-repository/:id failed:", err);
    return res.status(500).json({ error: "Failed to load repository rubric" });
  }
});

router.post("/rubric-repository", async (req, res) => {
  const title = String(req.body.title || "").trim();
  const scope = normalizeScope(req.body.scope);
  const status = normalizeStatus(req.body.status);
  const department = String(req.body.department || "").trim();
  const course = String(req.body.course || "").trim();
  const grade = String(req.body.grade || "").trim();
  const subject = String(req.body.subject || "").trim();
  const levelCount = Number(req.body.level_count || req.body.levelCount || 4);
  const criteria = Array.isArray(req.body.criteria) ? req.body.criteria : [];
  const createdBy = String(req.body.created_by || req.body.createdBy || "").trim();
  const approvedBy = String(req.body.approved_by || req.body.approvedBy || "").trim();
  const parentRubricId = req.body.parent_rubric_id ? Number(req.body.parent_rubric_id) : null;
  const version = String(req.body.version || "1.0").trim();

  if (!title) {
    return res.status(400).json({ error: "Rubric title is required" });
  }

  if (![4, 5, 6].includes(levelCount)) {
    return res.status(400).json({ error: "Performance levels must be 4, 5, or 6" });
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO rubric_repository (
          title,
          scope,
          status,
          department,
          course,
          grade,
          subject,
          level_count,
          criteria_json,
          created_by,
          approved_by,
          parent_rubric_id,
          version,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, NOW()
        )
        RETURNING *
      `,
      [
        title,
        scope,
        status,
        department,
        course,
        grade,
        subject,
        levelCount,
        JSON.stringify(criteria),
        createdBy,
        approvedBy,
        parentRubricId,
        version,
      ]
    );

    return res.json({ success: true, rubric: result.rows[0] });
  } catch (err) {
    console.error("POST /api/rubric-repository failed:", err);
    return res.status(500).json({ error: "Failed to create repository rubric" });
  }
});

router.post("/rubric-repository/:id/copy", async (req, res) => {
  const id = Number(req.params.id);
  const scope = normalizeScope(req.body.scope || "PERSONAL");
  const status = normalizeStatus(req.body.status || "DRAFT");
  const createdBy = String(req.body.created_by || req.body.createdBy || "").trim();

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "Valid rubric id is required" });
  }

  try {
    const sourceResult = await pool.query(
      `
        SELECT *
        FROM rubric_repository
        WHERE id = $1
      `,
      [id]
    );

    const source = sourceResult.rows[0];

    if (!source) {
      return res.status(404).json({ error: "Source rubric not found" });
    }

    const result = await pool.query(
      `
        INSERT INTO rubric_repository (
          title,
          scope,
          status,
          department,
          course,
          grade,
          subject,
          level_count,
          criteria_json,
          created_by,
          approved_by,
          parent_rubric_id,
          version,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, '', $11, '1.0', NOW()
        )
        RETURNING *
      `,
      [
        `${source.title} Copy`,
        scope,
        status,
        source.department || "",
        source.course || "",
        source.grade || "",
        source.subject || "",
        source.level_count || 4,
        JSON.stringify(source.criteria_json || []),
        createdBy || source.created_by || "",
        source.id,
      ]
    );

    return res.json({ success: true, rubric: result.rows[0] });
  } catch (err) {
    console.error("POST /api/rubric-repository/:id/copy failed:", err);
    return res.status(500).json({ error: "Failed to copy repository rubric" });
  }
});

module.exports = router;
