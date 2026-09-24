import test from 'node:test';
import assert from 'node:assert/strict';
import { gradebookPath, speedGradingPath, speedGradingSections } from './gradebookNavigation.js';

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

// A shared assignment must open a different roster for each selected section.
test('speed grading preserves the selected section for a shared assignment', () => {
  assert.equal(speedGradingPath(100, '11'), '/assignments/100/grade?sectionId=11');
  assert.equal(speedGradingPath(100, '12'), '/assignments/100/grade?sectionId=12');
  assert.equal(speedGradingPath(100, '13'), '/assignments/100/grade?sectionId=13');
});
test('speed grading retains the default route when no section is provided', () => {
  assert.equal(speedGradingPath(100, ''), '/assignments/100/grade');
});

test('speed grader offers only sections belonging to the shared assignment', () => {
  const courses = [
    { id: 13, master_course_id: 11, title: 'ELSL 11C' },
    { id: 20, title: 'Chemistry 11A' },
    { id: 11, title: 'ELSL 11A' },
    { id: 12, master_course_id: 11, title: 'ELSL 11B' },
  ];
  assert.deepEqual(speedGradingSections(courses, 11).map(c => c.id), [11, 12, 13]);
  assert.deepEqual(speedGradingSections(courses, null), []);
  assert.deepEqual(speedGradingSections(courses, 20).map(c => c.id), [20]);
});
