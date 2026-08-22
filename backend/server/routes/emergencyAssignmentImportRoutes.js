const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pool = require("../db");
const { authenticateJWT, requireRole } = require("../../middleware/auth");

const router = express.Router();

function sourceConfig() {
  const baseUrl = String(process.env.EMERGENCY_ASSIGNMENT_API_URL || "").replace(/\/$/, "");
  const apiKey = String(process.env.EMERGENCY_ASSIGNMENT_API_KEY || "");
  if (!baseUrl || !apiKey) throw new Error("Emergency Assignment integration is not configured.");
  return { baseUrl, apiKey };
}

async function sourceFetch(req, pathname) {
  const { baseUrl, apiKey } = sourceConfig();
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: {
      "x-emergency-api-key": apiKey,
      "x-emergency-teacher-email": String(req.user?.email || "").toLowerCase(),
      "x-emergency-requester-role": String(req.user?.role || "teacher").toLowerCase(),
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    let message = `Emergency Assignment returned ${response.status}`;
    try { message = (await response.json()).message || message; } catch (_error) {}
    throw new Error(message);
  }
  return response;
}

async function ensureImportTable(client = pool) {
  await client.query(`CREATE TABLE IF NOT EXISTS emergency_assignment_imports (id SERIAL PRIMARY KEY, source_submission_id INTEGER UNIQUE NOT NULL, target_submission_id INTEGER NOT NULL, imported_by INTEGER, imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
}

router.get("/emergency-assignment/courses", authenticateJWT, requireRole("admin", "teacher"), async (req, res) => {
  try {
    const response = await sourceFetch(req, "/api/integration/courses");
    return res.json(await response.json());
  } catch (error) { return res.status(502).json({ error: error.message }); }
});

router.get("/emergency-assignment/courses/:courseId/submissions", authenticateJWT, requireRole("admin", "teacher"), async (req, res) => {
  try {
    const response = await sourceFetch(req, `/api/integration/courses/${Number(req.params.courseId)}/submissions`);
    return res.json(await response.json());
  } catch (error) { return res.status(502).json({ error: error.message }); }
});

router.post("/emergency-assignment/import", authenticateJWT, requireRole("admin", "teacher"), async (req, res) => {
  const sourceCourseId = Number(req.body.sourceCourseId);
  const targetCourseId = Number(req.body.targetCourseId);
  const requestedSubmissionIds = Array.isArray(req.body.submissionIds)
    ? [...new Set(req.body.submissionIds.map(Number).filter(Number.isInteger).filter((id) => id > 0))]
    : null;
  if (!sourceCourseId || !targetCourseId) return res.status(400).json({ error: "Source and destination classes are required." });
  if (requestedSubmissionIds && !requestedSubmissionIds.length) return res.status(400).json({ error: "Choose at least one submission to import." });

  const target = await pool.query(`SELECT id, teacher_id FROM courses WHERE id = $1 LIMIT 1`, [targetCourseId]);
  if (!target.rows.length) return res.status(404).json({ error: "Destination class not found." });
  if (String(req.user.role).toLowerCase() !== "admin" && Number(target.rows[0].teacher_id) !== Number(req.user.id)) return res.status(403).json({ error: "You can only import into your own class." });

  try {
    const sourceResponse = await sourceFetch(req, `/api/integration/courses/${sourceCourseId}/submissions`);
    const sourceData = await sourceResponse.json();
    const availableSubmissions = Array.isArray(sourceData.submissions) ? sourceData.submissions : [];
    const requestedIdSet = requestedSubmissionIds ? new Set(requestedSubmissionIds) : null;
    const submissions = requestedIdSet
      ? availableSubmissions.filter((item) => requestedIdSet.has(Number(item.id)))
      : availableSubmissions;
    if (requestedIdSet && submissions.length !== requestedIdSet.size) return res.status(400).json({ error: "One or more selected submissions are not available in this class." });
    const client = await pool.connect();
    const uploadDir = process.env.RAILWAY_VOLUME_MOUNT_PATH ? path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH) : path.join(__dirname, "..", "uploads");
    fs.mkdirSync(uploadDir, { recursive: true });
    let imported = 0; let skipped = 0;

    try {
      await client.query("BEGIN");
      await ensureImportTable(client);
      for (const item of submissions) {
        const existing = await client.query(`SELECT id FROM emergency_assignment_imports WHERE source_submission_id = $1`, [item.id]);
        if (existing.rows.length) { skipped += 1; continue; }

        const studentEmail = String(item.student_email || "").trim().toLowerCase();
        const studentName = String(item.student_name || studentEmail).trim();
        if (!studentEmail) { skipped += 1; continue; }
        let student = await client.query(`SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`, [studentEmail]);
        let studentId = student.rows[0]?.id;
        if (!studentId) {
          const parts = studentName.split(/\s+/); const firstName = parts.shift() || "Student"; const lastName = parts.join(" ") || "User";
          student = await client.query(`INSERT INTO users (name, first_name, last_name, email, role, password_hash) VALUES ($1, $2, $3, $4, 'student', 'TEMP_PASSWORD_NEEDS_RESET') RETURNING id`, [studentName, firstName, lastName, studentEmail]);
          studentId = student.rows[0].id;
        }
        await client.query(`INSERT INTO class_enrollments (class_id, student_user_id) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM class_enrollments WHERE class_id = $1 AND student_user_id = $2)`, [targetCourseId, studentId]);

        const title = String(item.assignment_title || "Emergency Assignment").trim();
        let assignment = await client.query(`SELECT id FROM assignments WHERE class_id = $1 AND LOWER(title) = LOWER($2) LIMIT 1`, [targetCourseId, title]);
        if (!assignment.rows.length) assignment = await client.query(`INSERT INTO assignments (class_id, teacher_id, title, description, is_published) VALUES ($1, $2, $3, $4, TRUE) RETURNING id`, [targetCourseId, target.rows[0].teacher_id || req.user.id, title, "Imported from Emergency Assignment"]);
        const assignmentId = assignment.rows[0].id;

        const fileResponse = await sourceFetch(req, `/api/integration/submissions/${item.id}/file`);
        const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
        const extension = path.extname(String(item.original_file_name || ""));
        const storedName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
        fs.writeFileSync(path.join(uploadDir, storedName), fileBuffer);
        const submission = await client.query(`INSERT INTO submissions (assignment_id, student_id, teacher_id, course_id, assignment_title, original_file_name, stored_file_name, file_path, student_name, student_email, content, feedback) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'','') RETURNING id`, [assignmentId, studentId, target.rows[0].teacher_id || req.user.id, targetCourseId, title, item.original_file_name, storedName, `/uploads/${storedName}`, studentName, studentEmail]);
        await client.query(`INSERT INTO submission_attachments (submission_id, assignment_id, student_email, original_name, stored_name, file_path, mime_type, size_bytes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [submission.rows[0].id, assignmentId, studentEmail, item.original_file_name, storedName, `/uploads/${storedName}`, fileResponse.headers.get("content-type") || "application/octet-stream", fileBuffer.length]);
        await client.query(`INSERT INTO emergency_assignment_imports (source_submission_id, target_submission_id, imported_by) VALUES ($1,$2,$3)`, [item.id, submission.rows[0].id, req.user.id]);
        imported += 1;
      }
      await client.query("COMMIT");
      return res.json({ success: true, imported, skipped, total: submissions.length });
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  } catch (error) {
    console.error("Emergency Assignment import failed:", error);
    return res.status(502).json({ error: error.message || "Import failed." });
  }
});

module.exports = router;
