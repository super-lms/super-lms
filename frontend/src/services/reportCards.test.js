import test from 'node:test';import assert from 'node:assert/strict';
import {reportCardHtml,reportMark,reportPeriods} from './reportCards.js';
test('report card printing escapes text, includes PEN attendance and comments, and starts each student on a new page',()=>{
 const course={title:'<script>bad</script>',calculated_mark:null,mark_override:'',com1:'Good\nwork',com2:'Keep going',graded_count:0,assignment_count:1,sessions:2,attendance:{Present:1,Absent:0,Late:0,Excused:0,Unrecorded:1}};
 const card={student_name:'A&B',pen:'012345678',student_id:'123456',student_email:'a@example.com',student_grade:'10',student_class:'10A',courses:[course]};
 const html=reportCardHtml([card,{...card,student_name:'Second'}],{config:{type:'Interim',start:'2026-09-01',end:'2026-11-06',gradeBasis:'period'},report_date:'2026-10-10'});
 assert.match(html,/012345678/);assert.match(html,/A&amp;B/);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/Not graded/);assert.match(html,/Unrecorded/);assert.equal((html.match(/<table>/g)||[]).length,2);assert.match(html,/Course and section/);assert.match(html,/<strong>Grade:/);assert.match(html,/<strong>Class:/);assert.equal((html.match(/class="card"/g)||[]).length,2);assert.match(html,/break-after:page/);
});
test('report mark overrides preserve zero and calendar contains the agreed year and semester boundaries',()=>{
 assert.equal(reportMark({mark_override:'0',calculated_mark:90}),0);assert.equal(reportMark({mark_override:'',calculated_mark:90}),90);
 assert.deepEqual(reportPeriods.find(p=>p[0]==='Full year'),['Full year','2026-09-01','2027-06-30']);
 assert.equal(reportPeriods.find(p=>p[0]==='Semester 1')[2],'2027-01-15');
});
