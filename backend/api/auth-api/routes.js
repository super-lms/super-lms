const express = require("express");
const router = express.Router();
const pool = require("../../server/db");

// LOGIN BY EMAIL
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        error: "Email is required",
      });
    }

    const result = await pool.query(
      `
      SELECT id, name, email, role
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    return res.json({
      user: result.rows[0],
    });
  } catch (error) {
    console.error("POST /api/auth/login failed:", error);
    return res.status(500).json({
      error: "Login failed",
    });
  }
});

module.exports = router;
