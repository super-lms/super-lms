import test from 'node:test';
import assert from 'node:assert/strict';
import { gradebookPath } from './gradebookNavigation.js';

test('gradebook uses the open course instead of the remembered course', () => {
  assert.equal(gradebookPath('/courses', '?courseId=42', '13'), '/gradebook?classId=42');
  assert.equal(gradebookPath('/courses/42/attendance', '', '13'), '/gradebook?classId=42');
});
test('section roster takes precedence over shared assignment content', () => {
  assert.equal(gradebookPath('/assignments', '?classId=10&sectionId=42', '13'), '/gradebook?classId=42');
});
test('gradebook retains explicit class and uses remembered class only without context', () => {
  assert.equal(gradebookPath('/gradebook', '?classId=42', '13'), '/gradebook?classId=42');
  assert.equal(gradebookPath('/dashboard', '', '42'), '/gradebook?classId=42');
  assert.equal(gradebookPath('/dashboard', ''), '/gradebook');
});
