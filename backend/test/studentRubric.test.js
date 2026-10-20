const test = require('node:test');
const assert = require('node:assert/strict');
const { createStudentRubricHandler } = require('../server/routes/studentRubricRoutes');
async function run({ id = '12', assignment = { class_id: 3, cohort_id: 7, is_published: true }, available = true, enrolled = true, rubric = { title: 'Essay', level_count: 4, criteria_json: [{ name: 'Ideas', weight: 60 }] } } = {}) {
  const queries = [];
  const pool = { query: async (sql, values) => {
    queries.push({ sql, values });
    return { rows: sql.includes('FROM assignments') ? (assignment ? [assignment] : []) : (rubric ? [rubric] : []) };
  } };
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  const handler = createStudentRubricHandler({ pool,
    assignmentIsAvailableToStudents: () => available,
    studentHasLiveCourseAccess: async (student, course, cohort) => {
      assert.deepEqual([student, course, cohort], [9, 3, 7]); return enrolled;
    } });
  await handler({ params: { assignmentId: id }, user: { id: 9 } }, res);
  return { res, queries };
}
test('student can read published rubric weights before any submission exists', async () => {
  const { res, queries } = await run(); assert.equal(res.code, 200);
  assert.equal(res.body.rubric.criteria_json[0].weight, 60);
  assert.equal(queries.length, 2); assert.ok(!queries[1].sql.includes('submission'));
});
test('draft or future assignment does not expose rubric', async () => {
  const { res, queries } = await run({ available: false }); assert.equal(res.code, 403); assert.equal(queries.length, 1);
});
test('unenrolled or wrong cohort student cannot read rubric', async () => {
  const { res, queries } = await run({ enrolled: false }); assert.equal(res.code, 403); assert.equal(queries.length, 1);
});
test('no rubric returns null for an accessible assignment', async () => { const { res } = await run({ rubric: null }); assert.deepEqual(res.body, { rubric: null }); });
test('missing assignment returns 404', async () => { const { res } = await run({ assignment: null }); assert.equal(res.code, 404); });
test('invalid ID is rejected before querying', async () => { const { res, queries } = await run({ id: '1.5' }); assert.equal(res.code, 400); assert.equal(queries.length, 0); });
