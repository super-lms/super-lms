const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createStudentReportHandler } = require('../server/studentCourseReport');

const request = () => ({ user: { id: 7, role: 'student', email: 'Me@example.invalid' }, params: { studentEmail: 'me@example.invalid', courseId: '12' }, query: {} });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('another identity, invalid identity, or unavailable class cannot reach report generation', async () => {
  for (const change of [req => { req.params.studentEmail = 'other@example.invalid'; }, req => { req.user.id = 0; }, req => { req.user.role = 'teacher'; }, req => { req.params.courseId = '1.5'; }]) {
    let queries = 0, generated = false;
    const req = request(), res = response(); change(req);
    await createStudentReportHandler({ pool: { query: async () => { queries++; return { rows: [] }; } }, generateReport: () => { generated = true; } })(req, res);
    assert.ok(res.statusCode === 403 || res.statusCode === 400);
    assert.equal(queries, 0); assert.equal(generated, false);
  }
  let generated = false;
  const res = response();
  await createStudentReportHandler({ pool: { query: async (sql, params) => { assert.match(sql, /c.is_live = TRUE/); assert.deepEqual(params, [7, 12]); return { rows: [] }; } }, generateReport: () => { generated = true; } })(request(), res);
  assert.equal(res.statusCode, 403); assert.equal(generated, false);
});

test('query-string class scope, another name, and another email cannot override the signed-in student', async () => {
  const req = request(), res = response();
  req.query = { reportScope: 'class', studentName: 'Other', studentEmail: 'other@example.invalid' };
  await createStudentReportHandler({ pool: { query: async () => ({ rows: [{}] }) }, generateReport: async actual => {
    assert.deepEqual(actual.studentReportFilters, { studentEmail: 'me@example.invalid', studentName: '', reportScope: 'student', categoryName: '', levelName: '' });
    assert.equal(actual.studentReportUserId, 7);
  } })(req, res);
});

test('student reports reuse unchanged teacher report calculations and perform reads only', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../server/app.js'), 'utf8');
  const start = source.indexOf('async function generateCourseReport(req, res) {');
  const end = source.indexOf('\napp.get("/api/reports/:courseId"', start);
  const own = { student_user_id: 7, student_name: '同学', student_email: 'me@example.invalid', student_id: '001007' };
  const other = { student_user_id: 8, student_name: 'Other', student_email: 'other@example.invalid' };
  const calls = [];
  const pool = { query: async (sql, params) => {
    calls.push({ sql, params });
    assert.match(sql.trim(), /^SELECT\b/);
    if (sql.includes('SELECT 1 FROM class_enrollments')) return { rows: [{}] };
    if (sql.includes('SELECT id, title AS course_title')) return { rows: [{ id: 12, course_title: 'Shared course 10A', master_course_id: 1 }] };
    if (sql.includes('student_user_id')) return { rows: params.length === 2 ? [own] : [own, other] };
    if (sql.includes('a.id AS assignment_id')) return { rows: [
      { assignment_id: 3, assignment_title: 'Zero mark', category_name: 'Knowledge', level_name: 'Evidence', calculated_weight_percent: 60 },
      { assignment_id: 4, assignment_title: 'Returned work', category_name: 'Skills', level_name: 'Evidence', calculated_weight_percent: 40 },
      { assignment_id: 5, assignment_title: 'Not graded', category_name: 'Skills', level_name: 'Evidence', calculated_weight_percent: 20 },
    ] };
    if (sql.includes('s.id AS submission_id')) return { rows: [
      { submission_id: 1, assignment_id: 3, student_id: 7, student_email: 'me@example.invalid', score: 0, has_submitted_content: true },
      { submission_id: 2, assignment_id: 4, student_id: 7, student_email: 'me@example.invalid', score: 80, has_submitted_content: true },
    ] };
    throw Error('Unexpected report query');
  } };
  const generateReport = vm.runInNewContext('(' + source.slice(start, end).trim() + ')', { pool, console });
  const teacherRes = response();
  await generateReport({ params: { courseId: '12' }, query: { studentEmail: 'me@example.invalid' } }, teacherRes);
  const studentRes = response();
  await createStudentReportHandler({ pool, generateReport })(request(), studentRes);
  // JSON crosses the VM boundary without prototype differences.
  assert.deepEqual(JSON.parse(JSON.stringify(studentRes.body)), JSON.parse(JSON.stringify(teacherRes.body)));
  assert.equal(studentRes.body.students.length, 1);
  assert.equal(studentRes.body.students[0].student_id, '001007');
  assert.deepEqual(Array.from(studentRes.body.students[0].assignments, row => row.score), [0, 80, '']);
  assert.equal(studentRes.body.students[0].current_grade, 32);
  assert.ok(calls.some(({ sql, params }) => sql.includes('AND u.id = $2') && params[1] === 7));
  assert.ok(calls.some(({ sql, params }) => sql.includes('AND (s.student_id = $2') && params[1] === 7 && params[2] === 'me@example.invalid'));
});

test('database failure yields an error rather than a successful empty report', async () => {
  const res = response();
  await createStudentReportHandler({ pool: { query: async () => { throw Error('unavailable'); } }, generateReport: () => assert.fail('must not run') })(request(), res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.students, undefined);
});
