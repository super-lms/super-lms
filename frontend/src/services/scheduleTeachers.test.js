import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleTeacherLabel } from './scheduleTeachers.js';

test('shows primary and co-teacher using existing timetable names', () => {
  assert.equal(scheduleTeacherLabel({ teacher_names: ['David Brecht', 'Carrie Fang'] }), 'Dr. B / Dr. Carrie');
});
test('retains single teacher and legacy response support', () => {
  assert.equal(scheduleTeacherLabel({ teacher_names: ['David Brecht'] }), 'Dr. B');
  assert.equal(scheduleTeacherLabel({ teacher_name: 'David Brecht' }), 'Dr. B');
  assert.equal(scheduleTeacherLabel({ teacher_names: [] }), 'Teacher TBA');
});
test('keeps unfamiliar names and ignores empty entries', () => {
  assert.equal(scheduleTeacherLabel({ teacher_names: ['Jane Smith', '', 'Alex Lee'] }), 'Jane Smith / Alex Lee');
});
