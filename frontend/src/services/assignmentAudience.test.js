import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentsForAudience } from './assignmentAudience.js';
const assignments = [
  { id: 1, class_id: 94, cohort_id: null },
  { id: 2, class_id: 94, cohort_id: 94 },
  { id: 3, class_id: 94, cohort_id: 95 },
  { id: 4, class_id: 94, cohort_id: 96 },
  { id: 5, class_id: 94, cohort_id: 159 },
  { id: 6, class_id: 99, cohort_id: null },
];
test('root and linked admin cohort views show shared work plus their own assignment', () => {
  for (const id of [94,95,96,159]) {
    const expected = assignments.find(a => a.cohort_id === id).id;
    assert.deepEqual(assignmentsForAudience(assignments,{id,master_course_id:id===94?null:94}).map(a=>a.id),[1,expected]);
    assert.deepEqual(assignmentsForAudience(assignments,{id:94},String(id)).map(a=>a.id),[1,expected]);
  }
});
test('combined master view requires explicit all selection', () => {
  assert.deepEqual(assignmentsForAudience(assignments,{id:94},'all').map(a=>a.id),[1,2,3,4,5]);
});
test('cohort counts replace global totals and stale unrelated counts are ignored', () => {
  const rows=assignmentsForAudience([{...assignments[0],submission_count:100}],{id:94},94,[{id:1,submission_count:4,graded_count:3,ungraded_count:1}]);
  assert.equal(rows[0].submission_count,4);
  assert.equal(assignmentsForAudience([{...assignments[0],submission_count:100}],{id:94})[0].submission_count,0);
});
