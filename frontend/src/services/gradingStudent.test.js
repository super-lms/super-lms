import test from 'node:test';
import assert from 'node:assert/strict';
import {findGradingStudent, firstStudentAwaitingGrade} from './gradingStudent.js';
test('grading deep links select the stable student ID before email and never another student',()=>{
 const rows=[{student_user_id:1,student_email:'one@example.com'},{student_user_id:2,student_email:'NEW@example.com'}];
 assert.equal(findGradingStudent(rows,'2','old@example.com'),rows[1]);
 assert.equal(findGradingStudent(rows,'',' new@EXAMPLE.com '),rows[1]);
 assert.equal(findGradingStudent(rows,'3','one@example.com'),null);
 assert.equal(findGradingStudent(rows,'','missing@example.com'),null);
});

test('initial grading opens the first submitted ungraded student, skipping missing work and genuine zero marks',()=>{
 const rows=[
  {student_email:'missing',submission_status:'None',score:null},
  {student_email:'zero',submission_status:'Submitted',score:0},
  {student_email:'rubric',submission_status:'Submitted',score:null,rubric_selection:{DO:3}},
  {student_email:'waiting',submission_status:'Submitted',score:null},
  {student_email:'later',submission_status:'Submitted',score:null}
 ];
 assert.equal(firstStudentAwaitingGrade(rows,{}),rows[3]);
 assert.equal(firstStudentAwaitingGrade(rows,{submission_required:false}),rows[0]);
 assert.equal(firstStudentAwaitingGrade(rows.slice(0,3),{}),rows[0]);
 assert.equal(firstStudentAwaitingGrade([],{}),null);
});
