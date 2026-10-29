const {test}=require('node:test');const assert=require('node:assert/strict');const {gradebookSubmissionIndex,latestSubmissionByAssignment}=require('./gradebookSubmissions');
test('saved mark survives duplicate blank records and changed student email',()=>{
 const index=gradebookSubmissionIndex([{id:10,student_id:7,student_email:'old@example.com',assignment_id:3,score:84.21,rubric_selection:{pointsEarned:16}},{id:12,student_id:7,assignment_id:3,score:null},{id:11,student_id:7,assignment_id:3,score:89.47,rubric_selection:{pointsEarned:17}}]);
 const mark=index.get({student_user_id:7,student_email:'new@example.com'},3);assert.equal(mark.rubric_selection.pointsEarned,17);
 assert.equal(index.get({student_user_id:8,student_email:'old@example.com'},3),undefined);
});
test('zero remains a grade, latest marked record wins and legacy records normalize email',()=>{
 const index=gradebookSubmissionIndex([{id:1,student_id:2,assignment_id:3,score:100},{id:2,student_id:2,assignment_id:3,score:0},{id:4,assignment_id:3,student_email:' Legacy@Example.com ',score:50}]);
 assert.equal(index.get({student_user_id:2},3).score,0);assert.equal(index.get({student_user_id:9,student_email:'legacy@example.com'},3).score,50);
});
test('student dashboards keep the newest graded submission for each assignment',()=>{
 const selected=latestSubmissionByAssignment([{id:4,assignment_id:8,score:80},{id:7,assignment_id:8,score:null},{id:6,assignment_id:8,score:69},{id:9,assignment_id:9,score:75}]);
 assert.equal(selected['8'].id,6);assert.equal(selected['9'].id,9);
});
