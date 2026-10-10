const test=require('node:test');
const assert=require('node:assert/strict');
const {calculateCourseRisk}=require('../server/dashboardRisk');
test('risk uses weighted course marks, latest scores, shared content and exact section roster',()=>{
 const courses=[{id:2,master_course_id:1,title:'CTS 10B'},{id:3,master_course_id:1,title:'CTS 10C'}];
 const students=[{id:10,email:'a@test',name:'A',class_id:2},{id:11,email:'b@test',name:'B',class_id:3},{id:12,email:'c@test',name:'C',class_id:2}];
 const work=[{id:1,class_id:1,subcategory_id:1,course_weight_percent:80},{id:2,class_id:1,subcategory_id:2,course_weight_percent:20}];
 const scores=[{student_id:10,assignment_id:1,class_id:1,score:100},{student_id:10,assignment_id:1,class_id:1,score:30},{student_id:10,assignment_id:2,class_id:1,score:100},{student_id:11,assignment_id:1,class_id:1,score:50},{student_id:12,assignment_id:1,class_id:1,score:null}];
 const risk=calculateCourseRisk(courses,students,work,scores);
 assert.equal(risk.student_count,2);assert.equal(risk.students[0].value,44);assert.equal(risk.students[0].label,'Failing');assert.equal(risk.students[0].courseTitle,'CTS 10B');assert.equal(risk.students[1].label,'At risk');
});
test('zero is failing, 67 is excluded and students count once across courses',()=>{
 const courses=[{id:1,title:'A'},{id:2,title:'B'}];const students=[{id:10,email:'a',class_id:1},{id:10,email:'a',class_id:2},{id:11,email:'b',class_id:1}];
 const risk=calculateCourseRisk(courses,students,[{id:1,class_id:1},{id:2,class_id:2}],[{student_id:10,assignment_id:1,class_id:1,score:0},{student_id:10,assignment_id:2,class_id:2,score:40},{student_id:11,assignment_id:1,class_id:1,score:67}]);
 assert.equal(risk.student_count,1);assert.equal(risk.students.length,2);assert.equal(risk.students[0].value,0);
});
