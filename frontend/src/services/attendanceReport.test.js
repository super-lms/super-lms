import test from 'node:test';
import assert from 'node:assert/strict';
import {attendanceRange,attendanceRows,attendancePrintHtml} from './attendanceReport.js';
test('school terms and semesters use supplied inclusive boundaries',()=>{
 assert.deepEqual(attendanceRange('Term 2',''),{start:'2026-11-09',end:'2027-01-15'});
 assert.deepEqual(attendanceRange('Semester 2',''),{start:'2027-01-18',end:'2027-06-30'});
 assert.deepEqual(attendanceRange('Term 1',''),{start:'2026-09-01',end:'2026-11-06'});
 assert.deepEqual(attendanceRange('Term 3',''),{start:'2027-01-18',end:'2027-04-15'});
 assert.deepEqual(attendanceRange('Term 4',''),{start:'2027-04-16',end:'2027-06-30'});
});
test('weekly spans year boundary and monthly spans leap February',()=>{
 assert.deepEqual(attendanceRange('Weekly','2027-01-03'),{start:'2026-12-28',end:'2027-01-03'});
 assert.deepEqual(attendanceRange('Monthly','2028-02-10'),{start:'2028-02-01',end:'2028-02-29'});
});
test('only saved sessions count, missing records are not absences; individual selection and print escaping',()=>{
 const data={class:{title:'<script>'},start:'2026-09-01',end:'2026-09-30',students:[{student_name:'A&B',student_email:'A@X'},{student_name:'B',student_email:'B@X'}],sessions:[{date:'2026-09-01'},{date:'2026-09-02'}],records:[{student_email:'a@x',date:'2026-09-01',status:'Absent',note:'<test>'}]};
 const rows=attendanceRows(data,'a@x');assert.equal(rows.length,1);assert.deepEqual(rows[0].counts,{Present:0,Absent:1,Late:0,Excused:0,Unrecorded:1});
 const html=attendancePrintHtml(data,rows,'Monthly');assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;test&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('Daily attendance'));
 assert.equal(attendanceRows({...data,sessions:[]})[0].counts.Absent,0);
});
