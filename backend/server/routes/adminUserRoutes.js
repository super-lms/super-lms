const express = require("express");
const pool = require("../db");
const { authenticateJWT, requireRole } = require("../../middleware/auth");

const router = express.Router();

const ALLOWED_ROLES = new Set([
  "admin",
  "teacher",
  "student",
  "observer",
  "parent",
]);

const DELETABLE_ROLES = new Set([
  "student",
  "observer",
  "parent",
]);

router.put("/:userId", authenticateJWT, requireRole("admin"), async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const role = String(req.body.role || "").trim().toLowerCase();
    const parentEmail = String(req.body.parent_email || "").trim().toLowerCase();
    const studentId = String(req.body.student_id || "").trim();

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "Valid userId is required",
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        error: "User name is required",
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "User email is required",
      });
    }

    if (!ALLOWED_ROLES.has(role)) {
      return res.status(400).json({
        success: false,
        error: "Invalid user role",
      });
    }

    const existingUserResult = await pool.query(
      `
      SELECT id
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (existingUserResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const duplicateEmailResult = await pool.query(
      `
      SELECT id
      FROM users
      WHERE LOWER(email) = $1
        AND id <> $2
      LIMIT 1
      `,
      [email, userId]
    );

    if (duplicateEmailResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: "Another user already uses this email address",
      });
    }

    const nameParts = name.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || "User";
    const lastName = nameParts.slice(1).join(" ") || "User";
    const fullName = `${firstName} ${lastName}`.trim();

    const updatedResult = await pool.query(
      `
      UPDATE users
      SET name = $1,
          first_name = $2,
          last_name = $3,
          email = $4,
          role = $5,
          parent_email = $6,
          student_id = $7
      WHERE id = $8
      RETURNING
        id,
        name,
        first_name,
        last_name,
        email,
        role,
        parent_email,
        student_id,
        created_at
      `,
      [
        fullName,
        firstName,
        lastName,
        email,
        role,
        parentEmail || null,
        studentId || null,
        userId,
      ]
    );

    return res.json({
      success: true,
      user: updatedResult.rows[0],
    });
  } catch (error) {
    console.error("PUT /api/users/:userId failed:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        error: "Another user already uses this email address",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to update user",
    });
  }
});

router.delete(
  "/:userId",
  authenticateJWT,
  requireRole("admin"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const userId = Number(req.params.userId);

      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Valid userId is required",
        });
      }

      await client.query("BEGIN");

      const userResult = await client.query(
        `
        SELECT
          id,
          name,
          first_name,
          last_name,
          email,
          role,
          student_id
        FROM users
        WHERE id = $1
        FOR UPDATE
        `,
        [userId]
      );

      if (userResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      const user = userResult.rows[0];
      const role = String(user.role || "").trim().toLowerCase();

      if (role === "admin") {
        await client.query("ROLLBACK");

        return res.status(403).json({
          success: false,
          error: "Administrator accounts cannot be deleted",
        });
      }

      if (role === "teacher") {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          error:
            "Teacher accounts cannot be deleted while instructional records may depend on them. Reassign their courses and academic records first.",
        });
      }

      if (!DELETABLE_ROLES.has(role)) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          error: "This user role cannot be deleted",
        });
      }

      if (role === "student") {
        await client.query(
          `
          DELETE FROM class_enrollments
          WHERE student_user_id = $1
          `,
          [userId]
        );

        await client.query(
          `
          DELETE FROM class_grades
          WHERE student_user_id = $1
          `,
          [userId]
        );

        await client.query(
          `
          DELETE FROM rubric_scores
          WHERE student_user_id = $1
          `,
          [userId]
        );

        const studentEmail = String(user.email || "").trim().toLowerCase();
        const studentId = String(user.student_id || "").trim();

        await client.query(
          `
          DELETE FROM master_students
          WHERE
            (
              $1 <> ''
              AND LOWER(COALESCE(student_email, '')) = $1
            )
            OR
            (
              $2 <> ''
              AND COALESCE(student_id, '') = $2
            )
          `,
          [studentEmail, studentId]
        );
      }

      const deletedResult = await client.query(
        `
        DELETE FROM users
        WHERE id = $1
        RETURNING
          id,
          name,
          first_name,
          last_name,
          email,
          role,
          student_id
        `,
        [userId]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "User deleted successfully",
        user: deletedResult.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("DELETE /api/users/:userId failed:", error);

      return res.status(500).json({
        success: false,
        error: "Failed to delete user",
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
