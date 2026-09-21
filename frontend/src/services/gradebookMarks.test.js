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
