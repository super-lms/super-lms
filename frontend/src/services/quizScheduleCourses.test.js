import {test} from 'node:test';
import assert from 'node:assert/strict';
import {quizScheduleCourses} from './quizScheduleCourses.js';
test('class schedules include enrolled root A and child B/C/D, excluding other courses',()=>{
 const classes=[{id:1,title:'Social Studies 10A',master_course_id:null},{id:2,master_course_id:1},{id:3,master_course_id:1},{id:4,master_course_id:1},{id:5,master_course_id:9}];
 assert.deepEqual(quizScheduleCourses(classes,1).map(c=>c.id),[1,2,3,4]);
});
