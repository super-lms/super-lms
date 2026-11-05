const express = require('express');
const multer = require('multer');
const { authenticateJWT, requireRole } = require('../../middleware/auth');
const { createFeedbackFiles, MAX_FEEDBACK_FILE_BYTES } = require('../feedbackFiles');
function createFeedbackFileRouter(pool) {
  const router = express.Router();
  const files = createFeedbackFiles(pool);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FEEDBACK_FILE_BYTES, files: 1, fields: 2 } });
  router.use(authenticateJWT, requireRole('admin', 'teacher', 'student'), (req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  const wrap = fn => async (req, res) => { try { await fn(req, res); } catch (error) {
    if (!error.status) console.error('Feedback files:', error.message);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Could not load or save feedback files. Please retry.' });
  }};
  router.get('/assignments/:assignmentId', wrap(async (req, res) => {
    res.json({ files: await files.list(req.user, Number(req.params.assignmentId), { studentEmail: req.query.student_email }) });
  }));
  router.post('/assignments/:assignmentId', requireRole('admin', 'teacher'), (req, res, next) => {
    upload.single('file')(req, res, error => error ? res.status(400).json({ error: 'Choose one file up to 10 MB.' }) : next());
  }, wrap(async (req, res) => {
    res.status(201).json({ file: await files.attach(req.user, Number(req.params.assignmentId), { studentEmail: req.body.student_email }, req.file) });
  }));
  router.get('/files/:fileId', wrap(async (req, res) => {
    const file = await files.download(req.user, Number(req.params.fileId));
    res.set('X-Content-Type-Options', 'nosniff');
    res.attachment(file.original_name).type('application/octet-stream').send(file.file_data);
  }));
  return router;
}
module.exports = { createFeedbackFileRouter };
