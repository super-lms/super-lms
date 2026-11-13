import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assignmentProgress} from './assignmentProgress.js';
test('seven marked submissions with 64 missing students are not a completed class',()=>{
 const p=assignmentProgress({roster_count:71,submission_count:7,graded_count:7,ungraded_count:0,not_submitted_count:64});
 assert.equal(p.status,'In Progress');assert.equal(p.missing,64);
});
test('submitted work awaiting marks remains ready to grade',()=>{
 assert.equal(assignmentProgress({roster_count:71,submission_count:7,graded_count:0,ungraded_count:7}).status,'Ready to Grade');
});
test('complete requires the full assignment roster and zero is a recorded grade',()=>{
 assert.equal(assignmentProgress({roster_count:7,submission_count:7,graded_count:7}).status,'Completed');
 assert.equal(assignmentProgress({roster_count:7,submission_count:0,graded_count:0}).status,'No Submissions');
 assert.equal(assignmentProgress({roster_count:0}).status,'Roster Needed');
});
test('teacher-entered assignments need marks for every student rather than uploads',()=>{
 assert.equal(assignmentProgress({submission_required:false,roster_count:20,submission_count:7,graded_count:7}).status,'Ready to Grade');
 assert.equal(assignmentProgress({submission_required:false,roster_count:20,submission_count:20,graded_count:20}).status,'Completed');
});
