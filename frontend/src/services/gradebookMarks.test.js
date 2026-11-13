import test from 'node:test';
import assert from 'node:assert/strict';
import { getEarnedPoints, getPointsPossible, pointsToPercentage } from './gradebookMarks.js';

test('14-point test converts earned points to percentage and back', () => {
  const assignment = { points_possible: '14' };
  assert.ok(Math.abs(pointsToPercentage('12', assignment) - 85.7142857143) < 1e-8);
  assert.equal(getEarnedPoints(assignment, { score: pointsToPercentage('12', assignment) }), 12);
  assert.equal(pointsToPercentage('14', assignment), 100);
  assert.equal(pointsToPercentage('0', assignment), 0);
  assert.equal(pointsToPercentage('3.5', assignment), 25);
});

test('blank and invalid marks cannot silently become zero or exceed total', () => {
  for (const value of ['', ' ', null, undefined, -1, 15, 'invalid', Infinity]) {
    assert.throws(() => pointsToPercentage(value, { points_possible: 14 }));
  }
  assert.equal(getEarnedPoints({ points_possible: 14 }, { score: null }), '');
  assert.equal(getEarnedPoints({ points_possible: 14 }, undefined), '');
  assert.equal(getEarnedPoints({ points_possible: 14 }, { score: 0 }), 0);
});

test('each assignment uses its own total and legacy assignments default to 100', () => {
  assert.equal(pointsToPercentage(12, { points_possible: 20 }), 60);
  assert.equal(getEarnedPoints({ points_possible: 20 }, { score: 60 }), 12);
  assert.equal(getPointsPossible({}), 100);
  assert.equal(pointsToPercentage(85, {}), 85);
});

test('persisted raw marks survive rounded percentage storage and repeated reloads', async () => {
  const { calculateRawMark } = await import('../../../backend/server/rawMark.js');
  const assignment = { points_possible: 14 };
  for (const entered of [0, 4, 3.998, 4.125, 14]) {
    let value = entered;
    for (let i = 0; i < 5; i++) {
      const saved = calculateRawMark(value, assignment.points_possible);
      const persisted = JSON.parse(JSON.stringify({
        score: Number(saved.percentage.toFixed(2)),
        rubric_selection: { pointsEarned: saved.pointsEarned, overallScore: saved.percentage },
      }));
      value = getEarnedPoints(assignment, persisted);
      assert.equal(value, entered);
    }
  }
  assert.equal(calculateRawMark(4, 14).percentage.toFixed(1), '28.6');
});

test('legacy direct marks recover whole points within stored percentage rounding', () => {
  assert.equal(getEarnedPoints({ points_possible: 14 }, {
    score: 28.57, rubric_selection: { overallScore: 4 / 14 * 100, directPercentage: true },
  }), 4);
  assert.equal(getEarnedPoints({ points_possible: 14 }, { score: 28.57 }), 4);
});

test('server validates raw marks including blanks and fractional marks', async () => {
  const { calculateRawMark } = await import('../../../backend/server/rawMark.js');
  for (const value of ['', ' ', null, undefined, true, [], -1, 15, 'invalid', Infinity]) {
    assert.throws(() => calculateRawMark(value, 14));
  }
  assert.equal(calculateRawMark('4.125', '14').pointsEarned, 4.125);
  assert.equal(calculateRawMark(0, 14).percentage, 0);
  assert.equal(calculateRawMark(14, 14).percentage, 100);
});

test('EX displays instead of zero or blank, exports as EX, and is case insensitive on entry', async () => {
  const { isExcusedMark, isExcusedEntry } = await import('./gradebookMarks.js');
  const mark = { score: null, rubric_selection: { excused: true } };
  assert.equal(isExcusedMark(mark), true);
  assert.equal(getEarnedPoints({ points_possible: 20 }, mark), 'EX');
  for (const value of ['EX', 'ex', ' Ex ']) assert.equal(isExcusedEntry(value), true);
  for (const value of ['', 0, '0', null, 'EXTRA']) assert.equal(isExcusedEntry(value), false);
  assert.equal(isExcusedMark({ score: 0 }), false);
});

test('column fill converts percentages to points while preserving EX and other columns', async () => {
  const { fillAssignmentPercentage } = await import('./gradebookMarks.js');
  const students = [
    { student_email: 'a', assignment_scores: [{ assignment_id: 1, score: 50 }] },
    { student_email: 'b', assignment_scores: [{ assignment_id: 1, score: null, rubric_selection: { excused: true } }] },
    { student_email: 'c', assignment_scores: [{ assignment_id: 1, score: 75 }] },
    { student_email: 'other-cohort', assignment_scores: [] },
  ];
  const drafts = { 'c:1': 'ex', 'a:2': '8' };
  const assignment = { id: 1, points_possible: 20 };
  assert.deepEqual(fillAssignmentPercentage(students, assignment, drafts, '80'), { 'a:1': '16' });
  assert.deepEqual(drafts, { 'c:1': 'ex', 'a:2': '8' });
  assert.deepEqual(fillAssignmentPercentage(students, assignment, drafts, '0'), { 'a:1': '0' });
  assert.deepEqual(fillAssignmentPercentage(students, { ...assignment, points_possible: 14 }, {}, '87.5'), { 'a:1': '12.25', 'c:1': '12.25' });
  for (const invalid of ['', ' ', undefined, null, -1, 101, 'EX', Infinity]) {
    assert.throws(() => fillAssignmentPercentage(students, assignment, {}, invalid), /percentage from 0 to 100/);
  }
});

test('SpeedGrader points remain unchanged in Gradebook despite rounded percentages', () => {
 const assignment={points_possible:14};
 for(const points of [0,4,3.9998,4.125,14]) {
  const score=Number((points/14*100).toFixed(2));
  assert.equal(getEarnedPoints(assignment,{score,rubric_selection:{pointsEarned:points}}),points);
 }
 assert.equal(getEarnedPoints(assignment,{score:28.57}),4);
 assert.equal(getEarnedPoints(assignment,{score:28.56}),3.9984);
 assert.equal(getEarnedPoints(assignment,{score:28.57,rubric_selection:{importedChecklistMark:4}}),4);
 assert.equal(getEarnedPoints(assignment,{score:28.57,rubric_selection:{overallScore:28.57}}),3.9998);
});
