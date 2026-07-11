const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { authenticateJWT, requireRole } = require("../../middleware/auth");
const router = express.Router();
const pool = require("../../server/db");

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-lms-development-secret-change-before-production";
const JWT_EXPIRES_IN = "8h";

const PLACEHOLDER_PASSWORDS = new Set([
  "TEMP_PASSWORD_NEEDS_RESET",
  "OBSERVER_PENDING_PASSWORD",
  "STUDENT_PENDING_PASSWORD",
  "TEACHER_PENDING_PASSWORD",
  "MASTER_DIRECTORY_PENDING_PASSWORD",
]);

function isPlaceholderPasswordHash(passwordHash) {
  return PLACEHOLDER_PASSWORDS.has(String(passwordHash || "").trim());
}

function buildSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    role: user.role,
    must_change_password: Boolean(user.must_change_password),
  };
}

// LOGIN BY EMAIL + PASSWORD
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: "Password is required",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        CONCAT(first_name, ' ', last_name) AS name,
        first_name,
        last_name,
        email,
        role,
        password_hash,
        COALESCE(must_change_password, false) AS must_change_password
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    if (isPlaceholderPasswordHash(user.password_hash)) {
      return res.status(403).json({
        success: false,
        error: "Password setup required",
        code: "PASSWORD_SETUP_REQUIRED",
        next_action: "SETUP_PASSWORD",
        user: buildSafeUser({
          ...user,
          must_change_password: true,
        }),
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash || "");

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRES_IN,
      }
    );

    return res.json({
      success: true,
      user: buildSafeUser(user),
      token,
      expires_in: JWT_EXPIRES_IN,
      next_action: user.must_change_password ? "CHANGE_PASSWORD" : "ENTER_APP",
    });
  } catch (error) {
    console.error("POST /api/auth/login failed:", error);
    return res.status(500).json({
      success: false,
      error: "Login failed",
    });
  }
});

// SET UP FIRST PASSWORD FOR PLACEHOLDER ACCOUNTS
router.post("/setup-password", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: "Password is required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        CONCAT(first_name, ' ', last_name) AS name,
        first_name,
        last_name,
        email,
        role,
        password_hash,
        COALESCE(must_change_password, false) AS must_change_password
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const user = result.rows[0];

    if (!isPlaceholderPasswordHash(user.password_hash)) {
      return res.status(409).json({
        success: false,
        error: "Password has already been set",
        code: "PASSWORD_ALREADY_SET",
        next_action: "LOGIN",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `
      UPDATE users
      SET password_hash = $1,
          must_change_password = false
      WHERE id = $2
      `,
      [passwordHash, user.id]
    );

    return res.json({
      success: true,
      message: "Password created successfully.",
      next_action: "LOGIN",
    });
  } catch (error) {
    console.error("POST /api/auth/setup-password failed:", error);
    return res.status(500).json({
      success: false,
      error: "Password setup failed",
    });
  }
});


// ADMIN RESET PASSWORD TO ROLE-SPECIFIC PENDING STATE
router.post("/admin-reset-password", authenticateJWT, requireRole("admin"), async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    const result = await pool.query(
      `
      SELECT id, email, role
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const user = result.rows[0];
    const role = String(user.role || "").trim().toLowerCase();

    const pendingPasswordByRole = {
      admin: "ADMIN_PENDING_PASSWORD",
      teacher: "TEACHER_PENDING_PASSWORD",
      student: "STUDENT_PENDING_PASSWORD",
      observer: "OBSERVER_PENDING_PASSWORD",
      parent: "OBSERVER_PENDING_PASSWORD",
    };

    const pendingPassword = pendingPasswordByRole[role];

    if (!pendingPassword) {
      return res.status(400).json({
        success: false,
        error: "Unsupported user role for password reset",
        role: user.role,
      });
    }

    await pool.query(
      `
      UPDATE users
      SET password_hash = $1,
          must_change_password = true
      WHERE id = $2
      `,
      [pendingPassword, user.id]
    );

    return res.json({
      success: true,
      message: "Password reset successfully.",
      next_login: "PASSWORD_SETUP_REQUIRED",
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error("POST /api/auth/admin-reset-password failed:", error);
    return res.status(500).json({
      success: false,
      error: "Password reset failed",
    });
  }
});


// USER CHANGE PASSWORD
router.post("/change-password", authenticateJWT, async (req, res) => {
  try {
    const email = String(req.user?.email || "").trim().toLowerCase();
    const currentPassword = String(req.body.current_password || "");
    const newPassword = String(req.body.new_password || "");

    if (!email) {
      return res.status(401).json({
        success: false,
        error: "Authenticated user email is required",
      });
    }

    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        error: "Current password is required",
      });
    }

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        error: "New password is required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: "New password must be at least 8 characters",
      });
    }

    const result = await pool.query(
      `
      SELECT id, email, role, password_hash
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or current password",
      });
    }

    const user = result.rows[0];

    if (isPlaceholderPasswordHash(user.password_hash)) {
      return res.status(403).json({
        success: false,
        error: "Password setup required before password change",
        code: "PASSWORD_SETUP_REQUIRED",
        next_action: "SETUP_PASSWORD",
      });
    }

    const currentPasswordMatches = await bcrypt.compare(currentPassword, user.password_hash || "");

    if (!currentPasswordMatches) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or current password",
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `
      UPDATE users
      SET password_hash = $1,
          must_change_password = false
      WHERE id = $2
      `,
      [newPasswordHash, user.id]
    );

    return res.json({
      success: true,
      message: "Password changed successfully.",
      next_action: "LOGIN",
    });
  } catch (error) {
    console.error("POST /api/auth/change-password failed:", error);
    return res.status(500).json({
      success: false,
      error: "Password change failed",
    });
  }
});


// AUTHENTICATED SESSION CHECK
router.get("/session", authenticateJWT, (req, res) => {
  return res.json({
    success: true,
    authenticated: true,
    user: req.user,
  });
});

module.exports = router;
