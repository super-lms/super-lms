const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { Pool } = require('pg');
const { createStudentReportHandler } = require('../server/studentCourseReport');
const bin = process.env.POSTGRES_TEST_BIN;

test('personal report executes real PostgreSQL queries with cohort isolation, zero marks and unchanged teacher results', { skip: !bin }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'student-report-test-'));
  let pool, started = false;
  const pg = (cmd, args) => {
    const result = spawnSync(path.join(bin, cmd), args, { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  };
  const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  try {
    pg('initdb', ['-D', path.join(dir, 'data'), '-A', 'trust', '-U', 'test', '--no-locale']);
    pg('pg_ctl', ['-D', path.join(dir, 'data'), '-l', path.join(dir, 'server.log'), '-o', `-k ${dir} -h '' -p 58437`, '-w', 'start']);
    started = true;
    pool = new Pool({ host: dir, port: 58437, user: 'test', database: 'postgres' });
    await pool.query(`
      CREATE TABLE users(id INTEGER PRIMARY KEY,first_name TEXT,last_name TEXT,email TEXT,student_id TEXT,parent_email TEXT);
      CREATE TABLE courses(id INTEGER PRIMARY KEY,title TEXT,master_course_id INTEGER,master_title TEXT,section_code TEXT,is_live BOOLEAN);
      CREATE TABLE class_enrollments(class_id INTEGER,student_user_id INTEGER);
      CREATE TABLE course_categories(id INTEGER PRIMARY KEY,name TEXT,weight_percent NUMERIC);
      CREATE TABLE category_subcategories(id INTEGER PRIMARY KEY,name TEXT,course_category_id INTEGER,weight_percent_of_parent NUMERIC);
      CREATE TABLE assignments(id INTEGER PRIMARY KEY,class_id INTEGER,cohort_id INTEGER,subcategory_id INTEGER,title TEXT,due_date DATE,available_from DATE,created_at DATE);
      CREATE TABLE submissions(id INTEGER PRIMARY KEY,assignment_id INTEGER,student_id INTEGER,student_email TEXT,score NUMERIC,grade TEXT,feedback TEXT,rubric_selection JSONB,content TEXT);
      CREATE TABLE submission_attachments(submission_id INTEGER);
      INSERT INTO users VALUES(7,'Own','Student','me@example.invalid','001007',''),(8,'Other','Student','other@example.invalid','001008','');
      INSERT INTO courses VALUES(1,'Shared course',NULL,'','',TRUE),(12,'Shared course 10A',1,'Shared course','A',TRUE),(13,'Shared course 10B',1,'Shared course','B',TRUE),(14,'Not live',1,'Shared course','C',FALSE);
      INSERT INTO class_enrollments VALUES(12,7),(12,8),(14,7);
      INSERT INTO course_categories VALUES(1,'Knowledge',60),(2,'Skills',40);
      INSERT INTO category_subcategories VALUES(1,'Evidence',1,100),(2,'Evidence',2,100);
      INSERT INTO assignments VALUES(3,1,NULL,1,'Zero mark','2026-09-01',NULL,NULL),(4,1,12,2,'Returned work','2026-09-02',NULL,NULL),(5,1,12,2,'Not graded','2026-09-03',NULL,NULL),(6,1,13,2,'Other cohort','2026-09-04',NULL,NULL);
      INSERT INTO submissions VALUES(1,3,7,'me@example.invalid',0,NULL,'',NULL,'work'),(2,4,7,'me@example.invalid',80,NULL,'',NULL,'work'),(3,3,8,'other@example.invalid',100,NULL,'private feedback',NULL,'other work');
    `);
    const source = fs.readFileSync(path.join(__dirname, '../server/app.js'), 'utf8');
    const start = source.indexOf('async function generateCourseReport(req, res) {');
    const end = source.indexOf('\napp.get("/api/reports/:courseId"', start);
    const generateReport = vm.runInNewContext('(' + source.slice(start, end).trim() + ')', { pool, console });
    const studentHandler = createStudentReportHandler({ pool, generateReport });
    const req = { user: { id: 7, role: 'student', email: 'me@example.invalid' }, params: { studentEmail: 'me@example.invalid', courseId: '12' }, query: { reportScope: 'class', studentEmail: 'other@example.invalid' } };
    const personal = response(); await studentHandler(req, personal);
    assert.equal(personal.code, 200);
    assert.equal(personal.body.students.length, 1);
    assert.equal(personal.body.students[0].student_email, 'me@example.invalid');
    assert.deepEqual(Array.from(personal.body.students[0].assignments, row => row.assignment_id), [3, 4, 5]);
    assert.deepEqual(Array.from(personal.body.students[0].assignments, row => row.score), [0, 80, '']);
    assert.equal(personal.body.students[0].current_grade, 32);
    const teacher = response(); await generateReport({ params: { courseId: '12' }, query: { studentEmail: 'me@example.invalid' } }, teacher);
    assert.deepEqual(JSON.parse(JSON.stringify(personal.body)), JSON.parse(JSON.stringify(teacher.body)));
    for (const courseId of ['13', '14']) {
      const denied = response(); await studentHandler({ ...req, params: { ...req.params, courseId } }, denied);
      assert.equal(denied.code, 403);
    }
    assert.equal((await pool.query('SELECT score FROM submissions WHERE id=1')).rows[0].score, '0');
    assert.equal((await pool.query('SELECT COUNT(*) FROM submissions')).rows[0].count, '3');
  } finally {
    if (pool) await pool.end();
    if (started) pg('pg_ctl', ['-D', path.join(dir, 'data'), '-m', 'immediate', '-w', 'stop']);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
