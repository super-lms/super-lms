const express = require('express');
const JSZip = require('jszip');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { authenticateJWT, requireRole } = require('../../middleware/auth');

const fail = (message, status) => Object.assign(new Error(message), { status });
function safeName(value) {
  const clean = String(value || '').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_')
    .replace(/^\.+|[. ]+$/g, '').trim();
  let name = '';
  // Keep combined folder/file components within filesystem limits even for Chinese names.
  for (const character of clean) {
    if (Buffer.byteLength(name + character, 'utf8') > 80) break;
    name += character;
  }
  return name || 'Untitled';
}
function attachmentName(file) {
  const original = path.basename(String(file.original_name || 'file').replaceAll('\\', '/'));
  const extension = path.extname(original).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 20);
  return `${file.id}_${safeName(path.basename(original, path.extname(original)))}${extension}`;
}
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
function createAssignmentBatchDownloadRouter(pool, { uploadDir, ensureAttachments = async () => {}, maxBytes = 250 * 1024 * 1024 } = {}) {
  const router = express.Router();
  router.get('/:assignmentId/batch-download', authenticateJWT, requireRole('admin', 'teacher'), async (req, res) => {
    try {
      const assignmentId = Number(req.params.assignmentId), kind = req.query.kind || 'all';
      if (!Number.isSafeInteger(assignmentId) || assignmentId <= 0 || !['written', 'attachments', 'all'].includes(kind))
        throw fail('Choose a valid assignment and download type.', 400);
      const assignment = (await pool.query(`SELECT a.id,a.title,a.class_id,a.cohort_id FROM assignments a
        JOIN courses c ON c.id=a.class_id WHERE a.id=$1
        AND (c.school_id IS NULL OR c.school_id IS NOT DISTINCT FROM
          (SELECT NULLIF(to_jsonb(u)->>'school_id','')::INTEGER FROM users u WHERE u.id=$2))`, [assignmentId, req.user.id])).rows[0];
      if (!assignment) throw fail('Assignment not available.', 404);
      const requestedSectionId = req.query.sectionId;
      if (assignment.cohort_id && requestedSectionId && requestedSectionId !== 'all' && Number(requestedSectionId) !== Number(assignment.cohort_id)) throw fail('This assignment belongs to a different cohort.',400);
      const sectionId = assignment.cohort_id ? String(assignment.cohort_id) : (requestedSectionId || String(assignment.class_id));
      if (sectionId !== 'all' && (!/^\d+$/.test(sectionId) || Number(sectionId) <= 0)) throw fail('Choose a valid class section.', 400);
      // Check every selected section before loading any student work, including all-sections downloads.
      const sections = (await pool.query(`SELECT c.id,c.title,
        ($3='admin' OR c.teacher_id=$2 OR EXISTS(SELECT 1 FROM course_teachers ct
          WHERE ct.course_id IN(c.id,COALESCE(c.master_course_id,c.id)) AND ct.teacher_id=$2)
          OR EXISTS(SELECT 1 FROM courses master WHERE master.id=c.master_course_id AND master.teacher_id=$2)) AS allowed
        FROM courses c WHERE COALESCE(c.master_course_id,c.id)=$1
          AND ($4::INTEGER IS NULL OR c.id=$4)
          AND (c.school_id IS NULL OR c.school_id IS NOT DISTINCT FROM
            (SELECT NULLIF(to_jsonb(u)->>'school_id','')::INTEGER FROM users u WHERE u.id=$2))
        ORDER BY c.title,c.id`, [assignment.class_id, req.user.id, req.user.role, sectionId === 'all' ? null : Number(sectionId)])).rows;
      if (!sections.length) throw fail('This class section does not belong to the assignment.', 400);
      if (sections.some(section => !section.allowed)) throw fail('Choose a class you teach. Only administrators can download other teachers’ classes.', 403);
      const roster = { students: (await pool.query(`SELECT ce.student_user_id,
        STRING_AGG(DISTINCT c.title, ', ' ORDER BY c.title) AS section_title
        FROM class_enrollments ce JOIN courses c ON c.id=ce.class_id
        WHERE ce.class_id=ANY($1::INTEGER[]) GROUP BY ce.student_user_id`,
      [sections.map(section => section.id)])).rows };
      const students = (await pool.query(`SELECT u.id AS student_user_id,CONCAT(u.first_name,' ',u.last_name) AS student_name,
        s.content FROM users u LEFT JOIN LATERAL (
          SELECT sub.content FROM submissions sub WHERE sub.assignment_id=$1
            AND (sub.student_id=u.id OR (sub.student_id IS NULL AND LOWER(sub.student_email)=LOWER(u.email)))
            AND NULLIF(TRIM(sub.content),'') IS NOT NULL
          ORDER BY CASE WHEN sub.student_id=u.id THEN 0 ELSE 1 END,sub.id DESC LIMIT 1
        ) s ON TRUE WHERE u.id=ANY($2::INTEGER[]) ORDER BY u.first_name,u.last_name,u.id`,
      [assignmentId, roster.students.map(s => s.student_user_id)])).rows;
      const zip = new JSZip(), scope = sectionId === 'all' ? 'All sections' : sections[0].title;
      const root = `${safeName(scope)} - ${safeName(assignment.title)} - ${kind}`;
      let totalBytes = 0;
      function add(name, bytes) {
        totalBytes += Buffer.byteLength(bytes);
        if (totalBytes > maxBytes) throw fail('This batch exceeds 250 MB. Choose an individual class or download written responses and attachments separately.', 413);
        zip.file(`${root}/${name}`, bytes);
      }
      const studentMap = new Map(students.map(s => [s.student_user_id, s]));
      const sectionMap = new Map(roster.students.map(s => [s.student_user_id, s.section_title]));
      const counts = new Map(students.map(s => [s.student_user_id, { written: '', files: 0, missing: [] }]));
      const folder = s => `${safeName(s.student_name)}_${s.student_user_id}`;
      if (kind !== 'attachments') for (const student of students) if (String(student.content || '').trim()) {
        const filename = `${folder(student)}/Written response.txt`;
        const text = ['\uFEFFAssignment: ' + assignment.title, 'Student: ' + student.student_name,
          'Class: ' + (sectionMap.get(student.student_user_id) || scope), '', 'Student Written Response', '', student.content].join('\n');
        add(filename, text); counts.get(student.student_user_id).written = filename;
      }
      if (kind !== 'written') {
        await ensureAttachments();
        const files = (await pool.query(`SELECT sa.id,sa.original_name,sa.stored_name,sa.size_bytes,u.id AS student_user_id
          FROM submission_attachments sa LEFT JOIN submissions sub ON sub.id=sa.submission_id
          JOIN users u ON (sub.student_id=u.id OR (sub.student_id IS NULL AND LOWER(sa.student_email)=LOWER(u.email)))
          WHERE COALESCE(sa.assignment_id,sub.assignment_id)=$1 AND u.id=ANY($2::INTEGER[])
          ORDER BY u.id,sa.id`, [assignmentId, roster.students.map(s => s.student_user_id)])).rows;
        for (const file of files) {
          const student = studentMap.get(file.student_user_id);
          if (!student) continue;
          if (Number(file.size_bytes) + totalBytes > maxBytes) throw fail('This batch exceeds 250 MB. Choose an individual class or download written responses and attachments separately.', 413);
          const record = (await pool.query('SELECT file_data FROM submission_attachments WHERE id=$1', [file.id])).rows[0];
          let bytes = record?.file_data;
          if (!Buffer.isBuffer(bytes) && uploadDir && file.stored_name && path.basename(file.stored_name) === file.stored_name && !file.stored_name.includes('\\')) {
            try { bytes = await fs.readFile(path.join(uploadDir, file.stored_name)); }
            catch (error) { if (error.code !== 'ENOENT') throw error; }
          }
          if (!Buffer.isBuffer(bytes)) { counts.get(file.student_user_id).missing.push(file.original_name); continue; }
          add(`${folder(student)}/Attachments/${attachmentName(file)}`, bytes);
          counts.get(file.student_user_id).files++;
        }
      }
      const manifest = [['Student', 'Class', 'Written response file', 'Downloaded attachments', 'Unavailable attachments'],
        ...students.map(s => { const c = counts.get(s.student_user_id); return [s.student_name, sectionMap.get(s.student_user_id) || scope,
          kind === 'attachments' ? 'Not requested' : c.written || 'No written response', c.files, c.missing.join('; ')]; })];
      add('Submission list.csv', '\uFEFF' + manifest.map(row => row.map(csvCell).join(',')).join('\r\n'));
      add('Read me.txt', `Assignment: ${assignment.title}\nClass: ${scope}\nDownloaded: ${new Date().toISOString()} (UTC)\n\nEach student has a named folder. Written responses are UTF-8 text files. Attachments retain their original file types.\nSubmission list.csv lists every enrolled student and any unavailable attachments. No placeholder files are created for missing work.\nWritten responses use the most recent non-empty response for each student; attachments include all uploaded files for this assignment.\n`);
      res.set('Cache-Control', 'private, no-store'); res.type('application/zip'); res.attachment(`${root}.zip`);
      await pipeline(zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true, compression: 'STORE' }), res);
    } catch (error) {
      if (res.headersSent) { res.destroy(error); return; }
      if (!error.status) console.error('Batch download:', error.message);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to prepare this download. Please try again.' });
    }
  });
  return router;
}
module.exports = { createAssignmentBatchDownloadRouter, safeName, attachmentName, csvCell };
