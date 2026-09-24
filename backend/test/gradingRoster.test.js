const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGradingRoster } = require('../server/gradingRoster');

function fixture(sectionRows, studentRows = []) {
  const calls = [];
  return { calls, async query(sql, params) {
    calls.push({ sql, params });
    return { rows: calls.length === 1 ? sectionRows : studentRows };
  } };
}
test('all sections resolves linked course IDs and preserves section labels', async () => {
  const pool = fixture([{ id: 11 }, { id: 12 }, { id: 13 }], [{ student_user_id: 101, section_title: 'ELSL 11A, ELSL 11B' }]);
  const result = await loadGradingRoster(pool, 11, 'all');
  assert.deepEqual(pool.calls[0].params, [11, null]);
  assert.deepEqual(pool.calls[1].params, [[11, 12, 13]]);
  assert.match(pool.calls[0].sql, /COALESCE\(master_course_id, id\) = \$1/);
  assert.match(pool.calls[1].sql, /GROUP BY ce.student_user_id/);
  assert.equal(result.sectionId, 'all');
  assert.deepEqual(result.students, [{ student_user_id: 101, section_title: 'ELSL 11A, ELSL 11B' }]);
});
test('individual and default rosters stay restricted to one section', async () => {
  for (const [selection, expected] of [['12', 12], [undefined, 11]]) {
    const pool = fixture([{ id: expected }]);
    const result = await loadGradingRoster(pool, 11, selection);
    assert.deepEqual(pool.calls[0].params, [11, expected]);
    assert.deepEqual(pool.calls[1].params, [[expected]]);
    assert.equal(result.sectionId, expected);
    assert.deepEqual(result.students, []);
  }
});
test('unrelated sections and invalid section IDs are rejected', async () => {
  const pool = fixture([]);
  await assert.rejects(loadGradingRoster(pool, 11, '99'), { status: 400 });
  assert.equal(pool.calls.length, 1);
  for (const invalid of ['bad', '-1', '1.5']) {
    const invalidPool = fixture([]);
    await assert.rejects(loadGradingRoster(invalidPool, 11, invalid), { status: 400 });
    assert.equal(invalidPool.calls.length, 0);
  }
});
