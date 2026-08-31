const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { authenticateJWT, requireRole } = require("../../middleware/auth");
const router = express.Router();
const pool = require("../../server/db");

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-lms-development-secret-change-before-production";
const JWT_EXPIRES_IN = "8h";
const RESET_CODE_EXPIRES_MINUTES = 30;
const RECOVERY_CODE_COUNT = 8;
const RESET_CODE_REQUIRED_PASSWORD = "PASSWORD_RESET_CODE_REQUIRED";
const recoveryAttempts = new Map();
let loginAnalyticsTableReady;
let loginAnalyticsPausedUntil = 0;

const PLACEHOLDER_PASSWORDS = new Set([
  "TEMP_PASSWORD_NEEDS_RESET",
  "ADMIN_PENDING_PASSWORD",
  "OBSERVER_PENDING_PASSWORD",
  "STUDENT_PENDING_PASSWORD",
  "TEACHER_PENDING_PASSWORD",
  "MASTER_DIRECTORY_PENDING_PASSWORD",
]);

async function ensurePasswordRecoveryTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_recovery_codes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_recovery_audit (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      request_ip TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function ensureLoginAnalyticsTable() {
  if (!loginAnalyticsTableReady) {
    loginAnalyticsTableReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS login_events (
          id BIGSERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          user_name TEXT NOT NULL DEFAULT '',
          user_email TEXT NOT NULL DEFAULT '',
          role TEXT NOT NULL DEFAULT '',
          observer_relationship TEXT NOT NULL DEFAULT '',
          logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS login_events_logged_in_at_idx
        ON login_events (logged_in_at DESC)
      `);
    })().catch((error) => {
      loginAnalyticsTableReady = undefined;
      throw error;
    });
  }

  return loginAnalyticsTableReady;
}

function recordSuccessfulLogin(user) {
  if (Date.now() < loginAnalyticsPausedUntil) {
    return;
  }

  const analyticsWrite = (async () => {
    await ensureLoginAnalyticsTable();
    await pool.query(
      `
      INSERT INTO login_events (
        user_id,
        user_name,
        user_email,
        role,
        observer_relationship
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        user.id,
        String(user.name || user.email || "").trim(),
        String(user.email || "").trim().toLowerCase(),
        String(user.role || "").trim().toLowerCase(),
        String(user.observer_relationship || "").trim().toLowerCase(),
      ]
    );
  })();

  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Login analytics timed out")), 3000);
  });

  Promise.race([analyticsWrite, timeout]).catch((analyticsError) => {
    loginAnalyticsPausedUntil = Date.now() + 5 * 60 * 1000;
    console.error("Unable to record successful login:", analyticsError);
  });
}

function hashRecoveryValue(value) {
  // People commonly type a displayed XXXX-XXXX-XXXX code with spaces,
  // without dashes, or with a phone-generated Unicode dash. Recovery codes
  // are alphanumeric, so normalize away formatting before hashing.
  const normalizedValue = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return crypto
    .createHmac("sha256", JWT_SECRET)
    .update(normalizedValue)
    .digest("hex");
}

function generateRecoveryCode() {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const value = Array.from(
    { length: 12 },
    () => alphabet[crypto.randomInt(alphabet.length)]
  ).join("");
  return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}`;
}

function createMailTransport() {
  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host: String(process.env.SMTP_HOST || "smtp.gmail.com").trim(),
    port,
    secure: port === 465,
    auth: {
      user: String(process.env.SMTP_USER || "").trim(),
      pass: String(process.env.SMTP_PASS || "").replace(/\s+/g, ""),
    },
  });
}

// EMAIL A SINGLE-USE PASSWORD RESET LINK WITHOUT REVEALING WHETHER AN ACCOUNT EXISTS
router.post("/request-password-reset-email", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const firstTime = Boolean(req.body.first_time);
  const genericResponse = {
    success: true,
    message: firstTime
      ? "If that school email has an unactivated account, a first-time login link has been sent."
      : "If that school email has an account, a password reset link has been sent.",
  };

  try {
    if (!email || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "A valid school email is required" });
    }
    if (isRateLimited(req, `email-reset:${email}`)) {
      return res.status(429).json({ success: false, error: "Please wait 15 minutes before requesting another reset email." });
    }
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(503).json({ success: false, error: "Email password recovery is not configured yet." });
    }

    await ensurePasswordRecoveryTables();
    const userResult = await pool.query(
      `SELECT id, password_hash FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [email]
    );
    if (!userResult.rows.length) return res.json(genericResponse);
    if (firstTime && !isPlaceholderPasswordHash(userResult.rows[0].password_hash)) {
      return res.json(genericResponse);
    }

    const resetCode = crypto.randomBytes(32).toString("hex");
    await pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
      [userResult.rows[0].id]
    );
    await pool.query(
      `
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 minute'))
      `,
      [userResult.rows[0].id, hashRecoveryValue(resetCode), RESET_CODE_EXPIRES_MINUTES]
    );

    const frontendBase = String(
      process.env.PASSWORD_RESET_URL_BASE || "https://sparkling-passion-production-83e6.up.railway.app/login"
    ).trim();
    const resetUrl = new URL(frontendBase);
    resetUrl.searchParams.set("reset_email", email);
    resetUrl.searchParams.set("reset_code", resetCode);

    await createMailTransport().sendMail({
      from: String(process.env.SMTP_FROM || process.env.SMTP_USER).trim(),
      to: email,
      subject: firstTime ? "Set up your SUPER LMS account" : "SUPER LMS password reset",
      text: firstTime
        ? `Use this single-use link within ${RESET_CODE_EXPIRES_MINUTES} minutes to create your SUPER LMS password: ${resetUrl.toString()}`
        : `Use this single-use link within ${RESET_CODE_EXPIRES_MINUTES} minutes to reset your SUPER LMS password: ${resetUrl.toString()}`,
      html: firstTime
        ? `<p>Welcome to SUPER LMS.</p><p>Use the button below within ${RESET_CODE_EXPIRES_MINUTES} minutes to create your password.</p><p><a href="${resetUrl.toString()}">Create my SUPER LMS password</a></p><p>If you did not request this, you can ignore this email.</p>`
        : `<p>Use the button below within ${RESET_CODE_EXPIRES_MINUTES} minutes to reset your SUPER LMS password.</p><p><a href="${resetUrl.toString()}">Reset my SUPER LMS password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    });

    return res.json(genericResponse);
  } catch (error) {
    console.error("POST /api/auth/request-password-reset-email failed:", error);
    return res.status(500).json({ success: false, error: "Could not send the password reset email." });
  }
});

function isRateLimited(req, email) {
  const key = `${req.ip || "unknown"}:${email}`;
  const now = Date.now();
  const recent = (recoveryAttempts.get(key) || []).filter(
    (timestamp) => now - timestamp < 15 * 60 * 1000
  );
  recent.push(now);
  recoveryAttempts.set(key, recent);
  return recent.length > 5;
}

function clearRecoveryAttemptsForEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return;

  for (const key of recoveryAttempts.keys()) {
    const trackedEmail = String(key).slice(String(key).indexOf(":") + 1).toLowerCase();
    if (
      trackedEmail === normalizedEmail ||
      trackedEmail === `email-reset:${normalizedEmail}`
    ) {
      recoveryAttempts.delete(key);
    }
  }
}

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
    observer_relationship: user.observer_relationship || "",
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
        COALESCE(observer_relationship, '') AS observer_relationship,
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

    if (String(user.password_hash || "").trim() === RESET_CODE_REQUIRED_PASSWORD) {
      return res.status(403).json({
        success: false,
        error: "Password reset code required",
        code: "PASSWORD_RESET_CODE_REQUIRED",
        next_action: "COMPLETE_PASSWORD_RESET",
        user: buildSafeUser({ ...user, must_change_password: true }),
      });
    }

    if (isPlaceholderPasswordHash(user.password_hash)) {
      return res.status(403).json({
        success: false,
        error: "First-time account activation is required",
        code: "FIRST_TIME_ACTIVATION_REQUIRED",
        next_action: "REQUEST_FIRST_TIME_EMAIL",
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

    recordSuccessfulLogin(user);

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

// ADMIN LOGIN ANALYTICS
router.get(
  "/admin/login-analytics",
  authenticateJWT,
  requireRole("admin"),
  async (req, res) => {
    try {
      await ensureLoginAnalyticsTable();

      const result = await pool.query(`
        SELECT
          user_id,
          MAX(user_name) AS name,
          user_email AS email,
          CASE
            WHEN LOWER(role) = 'parent' OR LOWER(observer_relationship) = 'parent'
              THEN 'parent'
            WHEN LOWER(role) = 'observer'
              AND LOWER(observer_relationship) = 'chinese_homeroom_teacher'
              THEN 'chinese_homeroom_teacher'
            WHEN LOWER(role) = 'teacher'
              THEN 'bc_teacher'
            ELSE 'other'
          END AS category,
          COUNT(*)::INTEGER AS login_count,
          MAX(logged_in_at) AS last_login
        FROM login_events
        GROUP BY user_id, user_email, category
        ORDER BY last_login DESC
      `);

      const people = result.rows.filter((row) => row.category !== "other");
      const categories = ["parent", "chinese_homeroom_teacher", "bc_teacher"];
      const summary = Object.fromEntries(
        categories.map((category) => {
          const categoryPeople = people.filter((person) => person.category === category);
          return [
            category,
            {
              unique_users: categoryPeople.length,
              total_logins: categoryPeople.reduce(
                (total, person) => total + Number(person.login_count || 0),
                0
              ),
            },
          ];
        })
      );

      return res.json({ summary, people });
    } catch (error) {
      console.error("GET /api/auth/admin/login-analytics failed:", error);
      return res.status(500).json({ error: "Failed to load login analytics" });
    }
  }
);

// SET UP FIRST PASSWORD FOR PLACEHOLDER ACCOUNTS
router.post("/setup-password", (req, res) => {
  return res.status(410).json({
    success: false,
    error: "For security, first-time passwords must be created using the single-use email link.",
    code: "FIRST_TIME_EMAIL_REQUIRED",
  });
});

// COMPLETE AN ADMINISTRATOR-ISSUED PASSWORD RESET
router.post("/complete-password-reset", async (req, res) => {
  const client = await pool.connect();

  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const resetCode = String(req.body.reset_code || "").trim();
    const password = String(req.body.password || "");

    if (!email || !resetCode || !password) {
      return res.status(400).json({ success: false, error: "Email, reset code, and new password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
    }
    if (isRateLimited(req, email)) {
      return res.status(429).json({ success: false, error: "Too many recovery attempts. Please wait 15 minutes." });
    }

    await client.query("BEGIN");
    const result = await client.query(
      `
      SELECT prt.id AS reset_id, u.id AS user_id
      FROM password_reset_tokens prt
      JOIN users u ON u.id = prt.user_id
      WHERE LOWER(u.email) = $1
        AND prt.token_hash = $2
        AND prt.used_at IS NULL
        AND prt.expires_at > NOW()
      ORDER BY prt.created_at DESC
      LIMIT 1
      FOR UPDATE OF prt
      `,
      [email, hashRecoveryValue(resetCode)]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "Invalid or expired reset code" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await client.query(
      `UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2`,
      [passwordHash, result.rows[0].user_id]
    );
    await client.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [result.rows[0].reset_id]);
    await client.query(
      `INSERT INTO password_recovery_audit (user_id, event_type, request_ip) VALUES ($1, $2, $3)`,
      [result.rows[0].user_id, "admin_issued_reset_completed", req.ip || ""]
    );
    await client.query("COMMIT");

    return res.json({ success: true, message: "Password reset successfully. Please log in." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /api/auth/complete-password-reset failed:", error);
    return res.status(500).json({ success: false, error: "Password reset failed" });
  } finally {
    client.release();
  }
});


// ADMINISTRATOR-ISSUED ONE-TIME PASSWORD RESET CODE
router.post("/admin-reset-password", authenticateJWT, requireRole("admin"), async (req, res) => {
  const client = await pool.connect();

  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    const result = await client.query(
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

    if (Number(user.id) === Number(req.user.id)) {
      return res.status(400).json({
        success: false,
        error: "Use Administrator Emergency Recovery codes for your own account",
      });
    }

    if (!["admin", "teacher", "student", "observer", "parent"].includes(role)) {
      return res.status(400).json({
        success: false,
        error: "Unsupported user role for password reset",
        role: user.role,
      });
    }

    const resetCode = generateRecoveryCode();
    await client.query("BEGIN");
    await client.query(
      `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE user_id = $1 AND used_at IS NULL
      `,
      [user.id]
    );
    const insertedResetResult = await client.query(
      `
      INSERT INTO password_reset_tokens (user_id, token_hash, created_by_user_id, expires_at)
      VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 minute'))
      RETURNING expires_at
      `,
      [user.id, hashRecoveryValue(resetCode), req.user.id, RESET_CODE_EXPIRES_MINUTES]
    );
    await client.query(
      `UPDATE users SET password_hash = $1, must_change_password = true WHERE id = $2`,
      [RESET_CODE_REQUIRED_PASSWORD, user.id]
    );
    await client.query(
      `INSERT INTO password_recovery_audit (user_id, actor_user_id, event_type, request_ip) VALUES ($1, $2, $3, $4)`,
      [user.id, req.user.id, "admin_issued_reset_created", req.ip || ""]
    );
    await client.query("COMMIT");

    // A newly issued administrator code must remain usable even if earlier
    // failed attempts temporarily rate-limited this account. Older database
    // codes are invalidated above, so clearing only the in-memory attempt
    // history does not weaken the single-use reset flow.
    clearRecoveryAttemptsForEmail(email);

    return res.json({
      success: true,
      message: "One-time password reset code created.",
      reset_code: resetCode,
      expires_at: new Date(insertedResetResult.rows[0].expires_at).toISOString(),
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /api/auth/admin-reset-password failed:", error);
    return res.status(500).json({
      success: false,
      error: "Password reset failed",
    });
  } finally {
    client.release();
  }
});

// GENERATE ONE-TIME EMERGENCY CODES FOR THE SIGNED-IN ADMINISTRATOR
router.post("/admin-recovery-codes", authenticateJWT, requireRole("admin"), async (req, res) => {
  const client = await pool.connect();

  try {
    const currentPassword = String(req.body.current_password || "");
    if (!currentPassword) {
      return res.status(400).json({ success: false, error: "Current password is required" });
    }

    const userResult = await client.query(
      `SELECT id, password_hash FROM users WHERE id = $1 AND LOWER(role) = 'admin' LIMIT 1`,
      [req.user.id]
    );
    const user = userResult.rows[0];
    if (!user || isPlaceholderPasswordHash(user.password_hash)) {
      return res.status(401).json({ success: false, error: "Administrator verification failed" });
    }

    const matches = await bcrypt.compare(currentPassword, user.password_hash || "");
    if (!matches) {
      return res.status(401).json({ success: false, error: "Current password is incorrect" });
    }

    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
    await client.query("BEGIN");
    await client.query(`DELETE FROM admin_recovery_codes WHERE user_id = $1`, [user.id]);
    for (const code of codes) {
      await client.query(
        `INSERT INTO admin_recovery_codes (user_id, code_hash) VALUES ($1, $2)`,
        [user.id, hashRecoveryValue(code)]
      );
    }
    await client.query(
      `INSERT INTO password_recovery_audit (user_id, actor_user_id, event_type, request_ip) VALUES ($1, $2, $3, $4)`,
      [user.id, user.id, "admin_recovery_codes_generated", req.ip || ""]
    );
    await client.query("COMMIT");

    return res.json({
      success: true,
      recovery_codes: codes,
      message: "New emergency recovery codes created. Previous codes are now invalid.",
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /api/auth/admin-recovery-codes failed:", error);
    return res.status(500).json({ success: false, error: "Could not create recovery codes" });
  } finally {
    client.release();
  }
});

// RECOVER AN ADMINISTRATOR ACCOUNT WITH A SAVED ONE-TIME CODE
router.post("/recover-admin-password", async (req, res) => {
  const client = await pool.connect();

  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const recoveryCode = String(req.body.recovery_code || "").trim();
    const password = String(req.body.password || "");

    if (!email || !recoveryCode || !password) {
      return res.status(400).json({ success: false, error: "Email, recovery code, and new password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
    }
    if (isRateLimited(req, email)) {
      return res.status(429).json({ success: false, error: "Too many recovery attempts. Please wait 15 minutes." });
    }

    await client.query("BEGIN");
    const result = await client.query(
      `
      SELECT arc.id AS recovery_id, u.id AS user_id
      FROM admin_recovery_codes arc
      JOIN users u ON u.id = arc.user_id
      WHERE LOWER(u.email) = $1
        AND LOWER(u.role) = 'admin'
        AND arc.code_hash = $2
        AND arc.used_at IS NULL
      LIMIT 1
      FOR UPDATE OF arc
      `,
      [email, hashRecoveryValue(recoveryCode)]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "Invalid recovery details" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await client.query(
      `UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2`,
      [passwordHash, result.rows[0].user_id]
    );
    await client.query(`UPDATE admin_recovery_codes SET used_at = NOW() WHERE id = $1`, [result.rows[0].recovery_id]);
    await client.query(
      `INSERT INTO password_recovery_audit (user_id, event_type, request_ip) VALUES ($1, $2, $3)`,
      [result.rows[0].user_id, "admin_recovery_completed", req.ip || ""]
    );
    await client.query("COMMIT");

    return res.json({ success: true, message: "Administrator password reset successfully. Please log in." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("POST /api/auth/recover-admin-password failed:", error);
    return res.status(500).json({ success: false, error: "Administrator recovery failed" });
  } finally {
    client.release();
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
module.exports.ensurePasswordRecoveryTables = ensurePasswordRecoveryTables;
