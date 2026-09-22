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

test('legacy direct marks recover from original percentage without guessing whole marks', () => {
  assert.equal(getEarnedPoints({ points_possible: 14 }, {
    score: 28.57, rubric_selection: { overallScore: 4 / 14 * 100, directPercentage: true },
  }), 4);
  assert.equal(getEarnedPoints({ points_possible: 14 }, { score: 28.57 }), 3.9998);
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
