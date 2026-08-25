const express = require("express");
const crypto = require("crypto");
const pool = require("../db");
const { authenticateJWT, requireRole } = require("../../middleware/auth");

const router = express.Router();

function encryptionKey() {
  const material = String(process.env.DINGTALK_SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET || "");
  if (!material) throw new Error("Server encryption is not configured.");
  return crypto.createHash("sha256").update(material).digest();
}

function seal(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value || ""), "utf8"), cipher.final()]);
  return `enc:v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${encrypted.toString("base64")}`;
}

function open(value) {
  const text = String(value || "");
  if (!text.startsWith("enc:v1:")) return text;
  const [, , ivText, tagText, encryptedText] = text.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64"));
  decipher.setAuthTag(Buffer.from(tagText, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64")), decipher.final()]).toString("utf8");
}

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dingtalk_class_settings (
      course_id INTEGER PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
      webhook_url TEXT NOT NULL,
      signing_secret TEXT DEFAULT '',
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function authorizedCourse(req, courseId) {
  const result = await pool.query("SELECT id, teacher_id, COALESCE(class_name, title, course_name, 'Class ' || id::text) AS name FROM courses WHERE id = $1 LIMIT 1", [courseId]);
  if (!result.rows.length) return null;
  const course = result.rows[0];
  if (String(req.user.role).toLowerCase() !== "admin" && Number(course.teacher_id) !== Number(req.user.id)) return false;
  return course;
}

function validateWebhook(value) {
  const url = new URL(String(value || "").trim());
  if (url.protocol !== "https:" || !/(^|\.)dingtalk\.com$/i.test(url.hostname)) throw new Error("Use the HTTPS webhook copied from DingTalk.");
  return url;
}

function signedWebhook(webhookUrl, secret) {
  const url = validateWebhook(webhookUrl);
  const cleanSecret = String(secret || "").trim();
  if (!cleanSecret) return url.toString();
  const timestamp = Date.now();
  const sign = crypto.createHmac("sha256", cleanSecret).update(`${timestamp}\n${cleanSecret}`).digest("base64");
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", sign);
  return url.toString();
}

router.get("/courses/:courseId/dingtalk", authenticateJWT, requireRole("admin", "teacher"), async (req, res) => {
  try {
    await ensureTable();
    const course = await authorizedCourse(req, Number(req.params.courseId));
    if (course === null) return res.status(404).json({ error: "Class not found." });
    if (course === false) return res.status(403).json({ error: "You can only manage your own class." });
    const result = await pool.query("SELECT webhook_url, signing_secret, updated_at FROM dingtalk_class_settings WHERE course_id = $1", [course.id]);
    const setting = result.rows[0];
    const webhookUrl = setting ? open(setting.webhook_url) : "";
    return res.json({ configured: Boolean(setting), hasSecret: Boolean(setting?.signing_secret), webhookHint: setting ? `••••${webhookUrl.slice(-8)}` : "", updatedAt: setting?.updated_at || null });
  } catch (error) {
    console.error("Load DingTalk settings failed:", error);
    return res.status(400).json({ error: error.message || "Could not load DingTalk settings." });
  }
});

router.put("/courses/:courseId/dingtalk", authenticateJWT, requireRole("admin", "teacher"), async (req, res) => {
  try {
    await ensureTable();
    const course = await authorizedCourse(req, Number(req.params.courseId));
    if (course === null) return res.status(404).json({ error: "Class not found." });
    if (course === false) return res.status(403).json({ error: "You can only manage your own class." });
    const webhookUrl = validateWebhook(req.body.webhookUrl).toString();
    const signingSecret = String(req.body.signingSecret || "").trim();
    await pool.query(`INSERT INTO dingtalk_class_settings (course_id, webhook_url, signing_secret, updated_by, updated_at) VALUES ($1,$2,$3,$4,NOW()) ON CONFLICT (course_id) DO UPDATE SET webhook_url=EXCLUDED.webhook_url, signing_secret=EXCLUDED.signing_secret, updated_by=EXCLUDED.updated_by, updated_at=NOW()`, [course.id, seal(webhookUrl), signingSecret ? seal(signingSecret) : "", req.user.id]);
    return res.json({ success: true, configured: true, hasSecret: Boolean(signingSecret) });
  } catch (error) {
    console.error("Save DingTalk settings failed:", error);
    return res.status(400).json({ error: error.message || "Could not save DingTalk settings." });
  }
});

router.post("/assignments/:assignmentId/send-to-dingtalk", authenticateJWT, requireRole("admin", "teacher"), async (req, res) => {
  try {
    await ensureTable();
    const assignmentResult = await pool.query(`SELECT a.id,a.title,a.description,a.due_date,a.class_id,c.teacher_id,COALESCE(c.class_name,c.title,c.course_name,'Class ' || c.id::text) AS class_name FROM assignments a JOIN courses c ON c.id=a.class_id WHERE a.id=$1 LIMIT 1`, [Number(req.params.assignmentId)]);
    if (!assignmentResult.rows.length) return res.status(404).json({ error: "Assignment not found." });
    const assignment = assignmentResult.rows[0];
    const sectionId = Number(req.body.sectionId || assignment.class_id);
    const sectionResult = await pool.query(
      `SELECT c.id, c.title AS class_name
       FROM courses c
       WHERE c.id = $1 AND COALESCE(c.master_course_id, c.id) = $2 LIMIT 1`,
      [sectionId, assignment.class_id]
    );
    if (!sectionResult.rows.length) return res.status(400).json({ error: "Selected section does not belong to this assignment's course." });
    const accessResult = await pool.query(
      `SELECT 1 FROM courses c
       LEFT JOIN course_teachers ct ON ct.course_id = c.id AND ct.teacher_id = $2
       WHERE c.id = $1 AND (c.teacher_id = $2 OR ct.teacher_id = $2) LIMIT 1`,
      [sectionId, Number(req.user.id)]
    );
    if (String(req.user.role).toLowerCase() !== "admin" && !accessResult.rows.length) return res.status(403).json({ error: "You can only send assignments from your own section." });
    const settingResult = await pool.query("SELECT webhook_url, signing_secret FROM dingtalk_class_settings WHERE course_id=$1", [sectionId]);
    if (!settingResult.rows.length) return res.status(400).json({ error: "Connect this class to its DingTalk group first." });
    const portalUrl = String(process.env.EMERGENCY_ASSIGNMENT_STUDENT_URL || "https://emergency-assignment-upload-production.up.railway.app").replace(/\/$/, "");
    const due = assignment.due_date ? String(assignment.due_date).slice(0, 10) : "No due date";
    const description = String(assignment.description || "No additional instructions.").trim();
    const markdown = `### ${assignment.title}\n\n**Class:** ${sectionResult.rows[0].class_name}\n\n**Due:** ${due}\n\n${description}\n\n[Open Emergency Assignment to submit](${portalUrl})`;
    const response = await fetch(signedWebhook(open(settingResult.rows[0].webhook_url), open(settingResult.rows[0].signing_secret)), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ msgtype: "markdown", markdown: { title: assignment.title, text: markdown }, at: { isAtAll: false } }), signal: AbortSignal.timeout(15000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || Number(data.errcode || 0) !== 0) throw new Error(data.errmsg || `DingTalk returned ${response.status}.`);
    return res.json({ success: true, message: `Sent “${assignment.title}” to the DingTalk group.` });
  } catch (error) {
    console.error("Send to DingTalk failed:", error);
    return res.status(400).json({ error: error.message || "Could not send to DingTalk." });
  }
});

module.exports = router;
