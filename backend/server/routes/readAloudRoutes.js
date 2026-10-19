const express = require('express');
const multer = require('multer');
const {
  authenticateJWT,
  requireRole
} = require('../../middleware/auth');
const {
  compare,
  words,
  validateWav
} = require('../readAloudScoring');
const speech = require('../readAloudSpeech');
const fail = (message, status = 400) => Object.assign(Error(message), {
  status
});
function createReadAloudRouter(pool, deadlines, {
  studentHasLiveCourseAccess,
  assignmentIsAvailableToStudents,
  provider = speech,
  uploadAudio
}) {
  const router = express.Router(),
    staff = [authenticateJWT, requireRole('teacher', 'admin')];
  let ready;
  const ensure = () => ready || (ready = pool.query(`CREATE TABLE IF NOT EXISTS read_aloud_settings(assignment_id INTEGER PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,passage TEXT NOT NULL,max_attempts INTEGER NOT NULL DEFAULT 3 CHECK(max_attempts BETWEEN 1 AND 10));CREATE TABLE IF NOT EXISTS read_aloud_attempts(id SERIAL PRIMARY KEY,assignment_id INTEGER NOT NULL REFERENCES read_aloud_settings(assignment_id) ON DELETE CASCADE,student_id INTEGER NOT NULL REFERENCES users(id),audio BYTEA NOT NULL,seconds NUMERIC NOT NULL,passage TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'processing',processing_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),transcript TEXT,result JSONB,error TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),published_at TIMESTAMPTZ,published_by INTEGER REFERENCES users(id),published_percent NUMERIC,adjustment_reason TEXT);CREATE INDEX IF NOT EXISTS read_aloud_student_attempts ON read_aloud_attempts(assignment_id,student_id);`).catch(e => {
    ready = null;
    throw e;
  }));
  const handle = fn => async (req, res) => {
    try {
      await ensure();
      await fn(req, res);
    } catch (e) {
      if (!e.status) console.error('Read aloud request failed:', e.message);
      res.status(e.status || 500).json({
        error: e.status ? e.message : 'Unable to complete this read aloud request.'
      });
    }
  };
  async function access(req, client = pool) {
    const id = Number(req.params.assignmentId);
    if (!Number.isInteger(id) || id <= 0) throw fail('Choose an assignment.');
    const a = (await client.query('SELECT a.*,c.school_id FROM assignments a JOIN courses c ON c.id=a.class_id WHERE a.id=$1', [id])).rows[0];
    if (!a) throw fail('Assignment unavailable.', 404);
    if (req.user.role === 'student') {
      if (!assignmentIsAvailableToStudents(a) || !(await studentHasLiveCourseAccess(req.user.id, a.class_id, a.cohort_id))) throw fail('Assignment unavailable.', 403);
    } else {
      const allowed = await client.query(`SELECT c.id FROM courses c WHERE c.id=$1 AND (c.school_id IS NULL OR c.school_id IS NOT DISTINCT FROM (SELECT NULLIF(to_jsonb(u)->>'school_id','')::INTEGER FROM users u WHERE u.id=$2)) AND ($3='admin' OR c.teacher_id=$2 OR EXISTS(SELECT 1 FROM course_teachers ct WHERE ct.course_id IN(c.id,COALESCE(c.master_course_id,c.id)) AND ct.teacher_id=$2) OR EXISTS(SELECT 1 FROM courses section WHERE section.master_course_id=c.id AND (section.teacher_id=$2 OR EXISTS(SELECT 1 FROM course_teachers ct WHERE ct.course_id=section.id AND ct.teacher_id=$2))))`, [a.class_id, req.user.id, req.user.role]);
      if (!allowed.rows.length) throw fail('Assignment unavailable.', 403);
    }
    return a;
  }
  async function studentForTeacher(req, a, studentId, client = pool) {
    const allowed = await client.query(`SELECT u.id,u.email,COALESCE(u.name,u.email) AS name FROM users u JOIN class_enrollments ce ON ce.student_user_id=u.id JOIN courses c ON c.id=ce.class_id WHERE u.id=$1 AND u.role='student' AND (c.id=$2 OR c.master_course_id=$2) AND ($3='admin' OR c.teacher_id=$4 OR EXISTS(SELECT 1 FROM course_teachers ct WHERE ct.course_id IN(c.id,COALESCE(c.master_course_id,c.id)) AND ct.teacher_id=$4)) LIMIT 1`, [studentId, a.class_id, req.user.role, req.user.id]);
    if (!allowed.rows.length) throw fail('Student unavailable in your teaching classes.', 403);
    return allowed.rows[0];
  }
  router.get('/:assignmentId/read-aloud', authenticateJWT, requireRole('teacher', 'admin', 'student'), handle(async (req, res) => {
    const a = await access(req);
    const sectionId = req.query?.sectionId && req.query.sectionId !== 'all' ? Number(req.query.sectionId) : null;
    if (sectionId !== null && (!Number.isInteger(sectionId) || sectionId <= 0)) throw fail('Choose a valid class section.');
    const settings = (await pool.query('SELECT * FROM read_aloud_settings WHERE assignment_id=$1', [a.id])).rows[0] || null;
    let attempts = [];
    if (settings) {
      attempts = (await pool.query(`SELECT r.id,r.student_id,COALESCE(u.name,u.email) AS student_name,r.seconds,r.status,r.transcript,r.result,r.error,r.created_at,r.processing_started_at,r.published_at,r.published_percent,r.adjustment_reason FROM read_aloud_attempts r JOIN users u ON u.id=r.student_id WHERE r.assignment_id=$1 AND ($2='student' AND r.student_id=$3 OR $2='admin' OR $2='teacher' AND EXISTS(SELECT 1 FROM class_enrollments ce JOIN courses c ON c.id=ce.class_id WHERE ce.student_user_id=r.student_id AND (c.id=$4 OR c.master_course_id=$4) AND (c.teacher_id=$3 OR EXISTS(SELECT 1 FROM course_teachers ct WHERE ct.course_id IN(c.id,COALESCE(c.master_course_id,c.id)) AND ct.teacher_id=$3)))) AND ($5::INTEGER IS NULL OR EXISTS(SELECT 1 FROM class_enrollments selected JOIN courses selected_course ON selected_course.id=selected.class_id WHERE selected.student_user_id=r.student_id AND selected.class_id=$5 AND (selected_course.id=$4 OR selected_course.master_course_id=$4))) ORDER BY r.created_at DESC`, [a.id, req.user.role, req.user.id, a.class_id, sectionId])).rows;
    }
    res.set('Cache-Control', 'private, no-store');
    res.json({
      settings,
      attempts,
      serviceReady: provider.configured(),
      pointsPossible: Number(a.points_possible || 100)
    });
  }));
  router.put('/:assignmentId/read-aloud', ...staff, handle(async (req, res) => {
    const a = await access(req);
    const passage = String(req.body.passage || '').trim(),
      max = Number(req.body.maxAttempts);
    if (!words(passage).length || words(passage).length > 300 || passage.length > 6000) throw fail('Enter a passage of 1 to 300 words. Short passages work best within 3 minutes.');
    if (!Number.isInteger(max) || max < 1 || max > 10) throw fail('Allow 1 to 10 attempts.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM assignments WHERE id=$1 FOR UPDATE', [a.id]);
      const existing = (await client.query('SELECT passage FROM read_aloud_settings WHERE assignment_id=$1', [a.id])).rows[0];
      const attempted = (await client.query('SELECT id FROM read_aloud_attempts WHERE assignment_id=$1 LIMIT 1', [a.id])).rows.length;
      if (attempted && existing?.passage !== passage) throw fail('The passage is locked after the first attempt. Create a new assignment to change it.');
      if (!existing && (await client.query('SELECT id FROM submissions WHERE assignment_id=$1 LIMIT 1', [a.id])).rows.length) throw fail('Use a new assignment; this one already has submissions.');
      await client.query('INSERT INTO read_aloud_settings(assignment_id,passage,max_attempts) VALUES($1,$2,$3) ON CONFLICT(assignment_id) DO UPDATE SET passage=$2,max_attempts=$3', [a.id, passage, max]);
      await client.query("UPDATE assignments SET scoring_method='single_score_kdu' WHERE id=$1", [a.id]);
      await client.query('COMMIT');
      res.json({
        saved: true
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }));
  // Read Aloud work must use authenticated audio assessment, not generic text or file submissions.
  router.post(['/:assignmentId/student-submit', '/:assignmentId/student-attachments'], authenticateJWT, requireRole('admin', 'student'), async (req, res, next) => {
    if (req.user.role !== 'student') return next();
    try {
      await ensure();
      const settings = (await pool.query('SELECT assignment_id FROM read_aloud_settings WHERE assignment_id=$1', [Number(req.params.assignmentId)])).rows[0];
      if (settings) return res.status(409).json({
        error: 'Use the Read Aloud recorder or audio upload for this assignment.'
      });
      next();
    } catch (e) {
      res.status(500).json({
        error: 'Unable to check the assignment type.'
      });
    }
  });
  const upload = uploadAudio || multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 6000000,
      files: 1,
      fields: 0
    }
  }).single('audio');
  async function assess(id, audio, passage) {
    try {
      const spoken = await provider.transcribe(audio);
      const result = {
        ...compare(passage, spoken.transcript),
        confidence: spoken.confidence,
        needsReview: spoken.confidence === null || spoken.confidence < 0.8
      };
      await pool.query("UPDATE read_aloud_attempts SET status='assessed',transcript=$1,result=$2,error=NULL WHERE id=$3", [spoken.transcript, result, id]);
    } catch (e) {
      await pool.query("UPDATE read_aloud_attempts SET status='needs_review',error=$1 WHERE id=$2", [e.message, id]);
    }
  }
  const assessmentQueue = [];
  let workers = 0;
  function enqueueAssessment(id) {
    assessmentQueue.push(id);
    drain();
  }
  function drain() {
    while (workers < 1 && assessmentQueue.length) {
      const nextId = assessmentQueue.shift();
      workers++;
      void (async () => {
        const saved = (await pool.query('SELECT audio,passage FROM read_aloud_attempts WHERE id=$1', [nextId])).rows[0];
        if (saved) await assess(nextId, saved.audio, saved.passage);
      })().catch(e => console.error('Read aloud assessment save failed:', e.message)).finally(() => {
        workers--;
        drain();
      });
    }
  }
  router.post('/:assignmentId/read-aloud/attempts', authenticateJWT, requireRole('student'), handle(async (req, res) => {
    const a = await access(req);
    if (!provider.configured()) throw fail('Automatic assessment is not configured yet. Ask your teacher to contact the administrator.', 503);
    try {
      req.deadlineAcceptance = await deadlines.check(a.id, req.user.id);
    } catch (e) {
      if (e.code === 'PAST_DUE') await deadlines.notifyBlocked(a.id, req.user.id);
      throw e;
    }
    upload(req, res, async error => {
      if (error) return res.status(400).json({
        error: 'Choose one WAV recording up to 3 minutes and 6 MB.'
      });
      let client;
      try {
        if (!req.file) throw fail('Record or upload your reading first.');
        let seconds;
        try {
          seconds = validateWav(req.file.buffer);
        } catch (e) {
          throw fail(e.message);
        }
        req.deadlineAcceptance = await deadlines.check(a.id, req.user.id);
        client = await pool.connect();
        await client.query('BEGIN');
        await client.query('SELECT id FROM assignments WHERE id=$1 FOR UPDATE', [a.id]);
        const settings = (await client.query('SELECT * FROM read_aloud_settings WHERE assignment_id=$1', [a.id])).rows[0];
        if (!settings) throw fail('Read aloud is not enabled for this assignment.');
        const count = Number((await client.query('SELECT COUNT(*) AS count FROM read_aloud_attempts WHERE assignment_id=$1 AND student_id=$2', [a.id, req.user.id])).rows[0].count);
        if (count >= settings.max_attempts) throw fail('You have used all attempts. Ask your teacher for another attempt.', 409);
        const student = (await client.query('SELECT id,email,COALESCE(name,email) AS name FROM users WHERE id=$1', [req.user.id])).rows[0];
        let submission = (await client.query('SELECT id FROM submissions WHERE assignment_id=$1 AND student_id=$2 ORDER BY id DESC LIMIT 1 FOR UPDATE', [a.id, student.id])).rows[0];
        if (!submission) submission = (await client.query(`INSERT INTO submissions(assignment_id,assignment_title,course_id,teacher_id,student_id,student_name,student_email,original_file_name,stored_file_name,file_path,content) VALUES($1,$2,$3,$4,$5,$6,$7,'Read aloud recording','Read aloud recording','read-aloud',$8) RETURNING id`, [a.id, a.title, a.class_id, a.teacher_id, student.id, student.name, student.email, 'Read aloud recording submitted; awaiting teacher review.'])).rows[0];
        const attempt = (await client.query('INSERT INTO read_aloud_attempts(assignment_id,student_id,audio,seconds,passage) VALUES($1,$2,$3,$4,$5) RETURNING id', [a.id, student.id, req.file.buffer, seconds, settings.passage])).rows[0];
        await deadlines.record(req.deadlineAcceptance, a.id, student.id, submission.id, 'read-aloud', client);
        await client.query('COMMIT');
        client.release();
        client = null;
        res.status(202).json({
          saved: true,
          attemptId: attempt.id
        });
        enqueueAssessment(attempt.id);
      } catch (e) {
        if (client) {
          await client.query('ROLLBACK');
          client.release();
        }
        if (!e.status) console.error('Read aloud submit:', e.message);
        res.status(e.status || 500).json({
          error: e.status ? e.message : 'Unable to save this recording. Please check your attempt history before trying again.'
        });
      }
    });
  }));
  async function getAttempt(req) {
    const a = await access(req);
    const r = (await pool.query('SELECT * FROM read_aloud_attempts WHERE id=$1 AND assignment_id=$2', [Number(req.params.attemptId), a.id])).rows[0];
    if (!r) throw fail('Recording unavailable.', 404);
    if (req.user.role === 'student') {
      if (Number(r.student_id) !== Number(req.user.id)) throw fail('Recording unavailable.', 403);
    } else await studentForTeacher(req, a, r.student_id);
    return {
      a,
      r
    };
  }
  router.get('/:assignmentId/read-aloud/attempts/:attemptId/audio', authenticateJWT, requireRole('student', 'teacher', 'admin'), handle(async (req, res) => {
    const {
      r
    } = await getAttempt(req);
    res.set('Cache-Control', 'private, no-store');
    res.type('audio/wav').send(r.audio);
  }));
  router.post('/:assignmentId/read-aloud/attempts/:attemptId/retry', ...staff, handle(async (req, res) => {
    const {
      r
    } = await getAttempt(req);
    if (!provider.configured()) throw fail('Configure Azure Speech first.', 503);
    const updated = await pool.query("UPDATE read_aloud_attempts SET status='processing',processing_started_at=NOW(),error=NULL,result=NULL WHERE id=$1 AND (status<>'processing' OR processing_started_at<NOW()-INTERVAL '5 minutes') RETURNING id", [r.id]);
    if (!updated.rows.length) throw fail('This attempt is still processing.', 409);
    res.status(202).json({
      saved: true
    });
    enqueueAssessment(r.id);
  }));
  router.post('/:assignmentId/read-aloud/attempts/:attemptId/publish', ...staff, handle(async (req, res) => {
    const {
      a,
      r
    } = await getAttempt(req);
    const percent = req.body.percent == null ? r.result?.accuracy : Number(req.body.percent);
    if (typeof percent !== 'number' || !Number.isFinite(percent) || percent < 0 || percent > 100) throw fail('Enter a reviewed percentage from 0 to 100.');
    const reason = String(req.body.reason || '').trim();
    if ((r.status !== 'assessed' || r.result?.needsReview || percent !== r.result?.accuracy) && !reason) throw fail('Explain the reviewed or adjusted mark.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM assignments WHERE id=$1 FOR UPDATE', [a.id]);
      const student = await studentForTeacher(req, a, r.student_id, client);
      const submission = (await client.query('SELECT id FROM submissions WHERE assignment_id=$1 AND student_id=$2 ORDER BY id DESC LIMIT 1 FOR UPDATE', [a.id, student.id])).rows[0];
      if (!submission) throw fail('Student submission unavailable.', 404);
      const level = Number((percent / 100 * 6).toFixed(4)),
        rubric = {
          DO: level,
          KNOW: level,
          UNDERSTAND: level,
          directPercentage: true,
          overallScore: percent,
          pointsEarned: percent * Number(a.points_possible || 100) / 100,
          pointsPossible: Number(a.points_possible || 100),
          readAloudAttemptId: r.id
        };
      await client.query('UPDATE submissions SET score=$1,grade=$2,feedback=$3,rubric_selection=$4,content=$5 WHERE id=$6', [percent, `${percent}%`, `Reading accuracy: ${percent}%. ${reason || 'Teacher reviewed the automatic word comparison.'}`, rubric, r.transcript || 'Recording reviewed by teacher.', submission.id]);
      await client.query('UPDATE read_aloud_attempts SET published_at=NOW(),published_by=$1,published_percent=$2,adjustment_reason=$3 WHERE id=$4', [req.user.id, percent, reason, r.id]);
      await client.query('COMMIT');
      res.json({
        published: true
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }));
  return router;
}
module.exports = {
  createReadAloudRouter
};
