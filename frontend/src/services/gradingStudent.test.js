import test from 'node:test';
import assert from 'node:assert/strict';
import {findGradingStudent} from './gradingStudent.js';
test('grading deep links select the stable student ID before email and never another student',()=>{
 const rows=[{student_user_id:1,student_email:'one@example.com'},{student_user_id:2,student_email:'NEW@example.com'}];
 assert.equal(findGradingStudent(rows,'2','old@example.com'),rows[1]);
 assert.equal(findGradingStudent(rows,'',' new@EXAMPLE.com '),rows[1]);
 assert.equal(findGradingStudent(rows,'3','one@example.com'),null);
 assert.equal(findGradingStudent(rows,'','missing@example.com'),null);
});
