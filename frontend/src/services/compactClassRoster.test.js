import test from 'node:test';
import assert from 'node:assert/strict';
import { compactRosterHtml, multipleRostersHtml } from './compactClassRoster.js';
test('roster print uses A4 with selected names and IDs and escapes untrusted content',()=>{
 const html=compactRosterHtml({title:'PE <10B>'},[{name:'Amy <script>alert(1)</script> 林',student_id:'100248',email:'private@test'}]);
 assert.match(html,/@page\{size:A4 portrait;margin:10mm\}/);
 assert.match(html,/Amy &lt;script&gt;alert\(1\)&lt;\/script&gt; 林/);
 assert.match(html,/100248/);assert.doesNotMatch(html,/private@test|<script>/);
});
test('large class uses two panels and every student appears exactly once',()=>{
 const students=Array.from({length:60},(_,i)=>({name:`Student ${i}`,student_id:`ID${i}END`}));
 const html=compactRosterHtml({title:'Large class'},students);
 assert.equal((html.match(/<table>/g)||[]).length,2);
 for(const student of students)assert.equal(html.split(student.student_id).length-1,1);
 assert.match(html,/Total students: 60/);
});
test('multiple roster print starts each selected class on a separate PDF page',()=>{
 const html=multipleRostersHtml([
  {course:{title:'Accounting 11A',master_course_id:1},students:[{name:'Wendy',student_id:'A1'}]},
  {course:{title:'Accounting 11B',master_course_id:1},students:[{name:'Amy',student_id:'B1'}]},
 ]);
 assert.match(html,/\.roster-page\{break-after:page;page-break-after:always/);
 assert.equal((html.match(/class="roster-page"/g)||[]).length,2);
 assert.match(html,/Accounting 11A Class Roster/);
 assert.match(html,/Accounting 11B Class Roster/);
 assert.match(html,/Cohort/);
});
