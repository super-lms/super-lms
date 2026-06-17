const express = require("express");

function rawMarkToKduLevel(earnedPoints, maxPoints) {
  const earned = Number(earnedPoints);
  const max = Number(maxPoints);

  if (!Number.isFinite(earned) || !Number.isFinite(max) || max <= 0) {
    return null;
  }

  if (earned <= 0) {
    return 1;
  }

  const convertedLevel = (earned / max) * 6;
  const clampedLevel = Math.max(1, Math.min(6, convertedLevel));

  return Number(clampedLevel.toFixed(2));
}

function weightedAverage(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const safeItems = items.filter(
    (item) =>
      Number.isFinite(Number(item.score)) &&
      Number.isFinite(Number(item.weight)) &&
      Number(item.weight) > 0
  );

  if (safeItems.length === 0) {
    return null;
  }

  const totalWeight = safeItems.reduce((sum, item) => sum + Number(item.weight), 0);

  if (totalWeight <= 0) {
    return null;
  }

  const total = safeItems.reduce(
    (sum, item) => sum + Number(item.score) * Number(item.weight),
    0
  );

  return Number((total / totalWeight).toFixed(2));
}

function createAssignmentSectionRoutes(pool) {
  const router = express.Router();

  async function ensureExamSectionTables() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS assignment_sections (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER REFERENCES assignments(id) ON DELETE CASCADE,
        section_name TEXT NOT NULL,
        competency_bucket TEXT NOT NULL CHECK (competency_bucket IN ('KNOW', 'DO', 'UNDERSTAND')),
        max_points NUMERIC NOT NULL DEFAULT 0,
        section_weight NUMERIC NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_section_scores (
        id SERIAL PRIMARY KEY,
        student_email TEXT NOT NULL,
        assignment_section_id INTEGER REFERENCES assignment_sections(id) ON DELETE CASCADE,
        earned_points NUMERIC,
        converted_competency_level NUMERIC,
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (student_email, assignment_section_id)
      )
    `);
  }

  router.get("/assignments/:assignmentId/sections", async (req, res) => {
    try {
      await ensureExamSectionTables();

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

      const sectionsResult = await pool.query(
        `
        SELECT
          id,
          assignment_id,
          section_name,
          competency_bucket,
          max_points,
          section_weight,
          sort_order,
          created_at
        FROM assignment_sections
        WHERE assignment_id = $1
        ORDER BY sort_order ASC, id ASC
        `,
        [assignmentId]
      );

      return res.json({
        success: true,
        assignment: assignmentResult.rows[0],
        sections: sectionsResult.rows.map((section) => ({
          ...section,
          max_points: Number(section.max_points),
          section_weight: Number(section.section_weight),
        })),
      });
    } catch (err) {
      console.error("GET /api/assignments/:assignmentId/sections failed:", err);
      return res.status(500).json({ error: "Failed to load assignment sections" });
    }
  });

  router.put("/assignments/:assignmentId/sections", async (req, res) => {
    try {
      await ensureExamSectionTables();

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

      await pool.query("BEGIN");

      await pool.query(
        `
        DELETE FROM assignment_sections
        WHERE assignment_id = $1
        `,
        [assignmentId]
      );

      const savedSections = [];

      for (let index = 0; index < sections.length; index += 1) {
        const section = sections[index];

        const sectionName = String(section.section_name || section.name || "").trim();
        const competencyBucket = String(
          section.competency_bucket || section.bucket || ""
        )
          .trim()
          .toUpperCase();
        const maxPoints = Number(section.max_points ?? section.out_of ?? section.outOf);
        const sectionWeight = Number(section.section_weight ?? section.weight ?? 1);
        const sortOrder = Number(section.sort_order ?? index + 1);

        if (!sectionName) {
          throw new Error("Every section needs a section_name");
        }

        if (!["KNOW", "DO", "UNDERSTAND"].includes(competencyBucket)) {
          throw new Error("Every section needs competency_bucket: KNOW, DO, or UNDERSTAND");
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
          RETURNING *
          `,
          [
            assignmentId,
            sectionName,
            competencyBucket,
            maxPoints,
            Number.isFinite(sectionWeight) && sectionWeight > 0 ? sectionWeight : 1,
            Number.isFinite(sortOrder) ? sortOrder : index + 1,
          ]
        );

        savedSections.push(insertedResult.rows[0]);
      }

      await pool.query("COMMIT");

      return res.json({
        success: true,
        assignment: assignmentResult.rows[0],
        sections: savedSections.map((section) => ({
          ...section,
          max_points: Number(section.max_points),
          section_weight: Number(section.section_weight),
        })),
      });
    } catch (err) {
      await pool.query("ROLLBACK").catch(() => {});
      console.error("PUT /api/assignments/:assignmentId/sections failed:", err);
      return res.status(500).json({
        error: err.message || "Failed to save assignment sections",
      });
    }
  });

  router.get("/assignments/:assignmentId/section-scores", async (req, res) => {
    try {
      await ensureExamSectionTables();

      const assignmentId = Number(req.params.assignmentId);

      if (!assignmentId) {
        return res.status(400).json({ error: "Valid assignmentId is required" });
      }

      const assignmentResult = await pool.query(
        `
        SELECT id, class_id, title
        FROM assignments
        WHERE id = $1
        LIMIT 1
        `,
        [assignmentId]
      );

      if (assignmentResult.rows.length === 0) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      const assignment = assignmentResult.rows[0];

      const studentsResult = await pool.query(
        `
        SELECT
          u.id AS student_user_id,
          u.name AS student_name,
          LOWER(u.email) AS student_email
        FROM class_enrollments ce
        JOIN users u
          ON u.id = ce.student_user_id
        WHERE ce.class_id = $1
        ORDER BY u.name ASC, u.email ASC
        `,
        [assignment.class_id]
      );

      const sectionsResult = await pool.query(
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

      const scoresResult = await pool.query(
        `
        SELECT
          sss.id,
          LOWER(sss.student_email) AS student_email,
          sss.assignment_section_id,
          sss.earned_points,
          sss.converted_competency_level,
          sss.updated_at
        FROM student_section_scores sss
        JOIN assignment_sections assignment_section
          ON assignment_section.id = sss.assignment_section_id
        WHERE assignment_section.assignment_id = $1
        `,
        [assignmentId]
      );

      return res.json({
        success: true,
        assignment,
        students: studentsResult.rows,
        sections: sectionsResult.rows.map((section) => ({
          ...section,
          max_points: Number(section.max_points),
          section_weight: Number(section.section_weight),
        })),
        scores: scoresResult.rows.map((score) => ({
          ...score,
          earned_points:
            score.earned_points === null || score.earned_points === undefined
              ? null
              : Number(score.earned_points),
          converted_competency_level:
            score.converted_competency_level === null ||
            score.converted_competency_level === undefined
              ? null
              : Number(score.converted_competency_level),
        })),
      });
    } catch (err) {
      console.error("GET /api/assignments/:assignmentId/section-scores failed:", err);
      return res.status(500).json({ error: "Failed to load section scores" });
    }
  });

  router.post("/assignments/:assignmentId/section-scores", async (req, res) => {
    try {
      await ensureExamSectionTables();

      const assignmentId = Number(req.params.assignmentId);
      const studentEmail = String(req.body.student_email || "").trim().toLowerCase();
      const scores = Array.isArray(req.body.scores) ? req.body.scores : [];

      if (!assignmentId) {
        return res.status(400).json({ error: "Valid assignmentId is required" });
      }

      if (!studentEmail) {
        return res.status(400).json({ error: "student_email is required" });
      }

      const assignmentResult = await pool.query(
        `
        SELECT id, class_id, title
        FROM assignments
        WHERE id = $1
        LIMIT 1
        `,
        [assignmentId]
      );

      if (assignmentResult.rows.length === 0) {
        return res.status(404).json({ error: "Assignment not found" });
      }

      const sectionsResult = await pool.query(
        `
        SELECT
          id,
          section_name,
          competency_bucket,
          max_points,
          section_weight
        FROM assignment_sections
        WHERE assignment_id = $1
        ORDER BY sort_order ASC, id ASC
        `,
        [assignmentId]
      );

      const sectionsById = new Map(
        sectionsResult.rows.map((section) => [Number(section.id), section])
      );

      if (sectionsById.size === 0) {
        return res.status(400).json({
          error: "Create assignment sections before saving raw marks",
        });
      }

      await pool.query("BEGIN");

      for (const score of scores) {
        const sectionId = Number(score.assignment_section_id);
        const section = sectionsById.get(sectionId);

        if (!section) {
          continue;
        }

        const earnedPoints =
          score.earned_points === "" ||
          score.earned_points === null ||
          score.earned_points === undefined
            ? null
            : Number(score.earned_points);

        const convertedLevel =
          earnedPoints === null ? null : rawMarkToKduLevel(earnedPoints, section.max_points);

        await pool.query(
          `
          INSERT INTO student_section_scores (
            student_email,
            assignment_section_id,
            earned_points,
            converted_competency_level,
            updated_at
          )
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (student_email, assignment_section_id)
          DO UPDATE
          SET earned_points = EXCLUDED.earned_points,
              converted_competency_level = EXCLUDED.converted_competency_level,
              updated_at = NOW()
          `,
          [studentEmail, sectionId, earnedPoints, convertedLevel]
        );
      }

      const savedScoresResult = await pool.query(
        `
        SELECT
          assignment_section.id AS assignment_section_id,
          assignment_section.section_name,
          assignment_section.competency_bucket,
          assignment_section.max_points,
          assignment_section.section_weight,
          student_score.earned_points,
          student_score.converted_competency_level
        FROM assignment_sections assignment_section
        LEFT JOIN student_section_scores student_score
          ON student_score.assignment_section_id = assignment_section.id
          AND LOWER(student_score.student_email) = $2
        WHERE assignment_section.assignment_id = $1
        ORDER BY assignment_section.sort_order ASC, assignment_section.id ASC
        `,
        [assignmentId, studentEmail]
      );

      const buckets = {
        KNOW: [],
        DO: [],
        UNDERSTAND: [],
      };

      for (const row of savedScoresResult.rows) {
        const convertedLevel =
          row.converted_competency_level === null ||
          row.converted_competency_level === undefined
            ? null
            : Number(row.converted_competency_level);

        if (convertedLevel === null || !Number.isFinite(convertedLevel)) {
          continue;
        }

        const bucket = String(row.competency_bucket || "").toUpperCase();
        const weight = Number(row.section_weight || 1);

        if (buckets[bucket]) {
          buckets[bucket].push({
            score: convertedLevel,
            weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
          });
        }
      }

      const rubricSelection = {
        DO: weightedAverage(buckets.DO),
        KNOW: weightedAverage(buckets.KNOW),
        UNDERSTAND: weightedAverage(buckets.UNDERSTAND),
      };

      const weightedScore =
        Number(rubricSelection.DO || 0) * 0.5 +
        Number(rubricSelection.KNOW || 0) * 0.25 +
        Number(rubricSelection.UNDERSTAND || 0) * 0.25;

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

      const existingSubmissionResult = await pool.query(
        `
        SELECT id
        FROM submissions
        WHERE assignment_id = $1
          AND LOWER(student_email) = $2
        LIMIT 1
        `,
        [assignmentId, studentEmail]
      );

      let submissionResult;

      if (existingSubmissionResult.rows.length > 0) {
        submissionResult = await pool.query(
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
            "Raw section marks converted to KDU scores.",
            rubricSelection,
            existingSubmissionResult.rows[0].id,
          ]
        );
      } else {
        submissionResult = await pool.query(
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
            "Teacher-entered raw section marks converted to KDU.",
            percentScore,
            `${percentScore}%`,
            "Raw section marks converted to KDU scores.",
            rubricSelection,
          ]
        );
      }

      await pool.query("COMMIT");

      return res.json({
        success: true,
        assignment_id: assignmentId,
        student_email: studentEmail,
        section_scores: savedScoresResult.rows.map((row) => ({
          ...row,
          max_points: Number(row.max_points),
          section_weight: Number(row.section_weight),
          earned_points:
            row.earned_points === null || row.earned_points === undefined
              ? null
              : Number(row.earned_points),
          converted_competency_level:
            row.converted_competency_level === null ||
            row.converted_competency_level === undefined
              ? null
              : Number(row.converted_competency_level),
        })),
        rubric_selection: rubricSelection,
        weighted_score: Number(weightedScore.toFixed(2)),
        percent_score: percentScore,
        submission: submissionResult.rows[0],
      });
    } catch (err) {
      await pool.query("ROLLBACK").catch(() => {});
      console.error("POST /api/assignments/:assignmentId/section-scores failed:", err);
      return res.status(500).json({
        error: err.message || "Failed to save section scores",
      });
    }
  });

  router.ensureExamSectionTables = ensureExamSectionTables;

  return router;
}

module.exports = createAssignmentSectionRoutes;
