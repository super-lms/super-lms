import test from 'node:test';
import assert from 'node:assert/strict';
import { compactRosterHtml } from './compactClassRoster.js';
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
