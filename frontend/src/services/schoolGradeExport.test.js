import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import {gradeExportTables,makeGradeWorkbook,schoolGradePrintHtml} from './schoolGradeExport.js'
const snapshot={schoolYear:'2026-2027',generatedAt:'2026-10-24T03:00:00Z',sheets:[{course:{id:1,title:'CTS / 学习 [10A]'},period:{label:'Semester 1',start:'2026-09-01',end:'2027-01-15'},undated_assignments:0,assignments:[{id:7,title:'<script>alert(1)</script>',points_possible:10,reporting_date:'2026-10-01'}],students:[{student_user_id:2,student_name:'=SUM(A1:A2)',student_id:'000123',student_email:'a@test',calculated_mark:0,graded_count:1,assignment_count:1,unlinked_graded_count:1,marks:[{assignment_id:7,score:0,points_earned:0,points_possible:10,feedback:'老师评语'}]},{student_user_id:3,student_name:'未评分',student_id:'000124',student_email:'b@test',calculated_mark:null,graded_count:0,assignment_count:1,unlinked_graded_count:0,marks:[{assignment_id:7,score:null,points_earned:null,points_possible:10,feedback:''}]}]}]}
test('Excel preserves leading-zero student IDs, Chinese text, blank marks and numeric zeros in both formats',()=>{
 for(const format of ['xlsx','xls']){
  const book=makeGradeWorkbook(snapshot,XLSX,format)
  const data=XLSX.write(book,{type:'buffer',bookType:format==='xls'?'biff8':'xlsx'})
  const roundtrip=XLSX.read(data,{type:'buffer'})
  assert.equal(roundtrip.SheetNames.length,4)
  const rows=XLSX.utils.sheet_to_json(roundtrip.Sheets['Student Summary'],{header:1,defval:null})
  assert.equal(rows[1][6],'000123');assert.equal(rows[1][8],0);assert.equal(rows[2][8],null)
  assert.equal(rows[2][5],'未评分');assert.equal(roundtrip.Sheets['Student Summary'].F2.t,'s');assert.equal(roundtrip.Sheets['Student Summary'].F2.f,undefined)
 }
})
test('sheet names remain unique and safe for duplicate long course names',()=>{
 const long={...snapshot,sheets:Array.from({length:3},()=>({...snapshot.sheets[0],course:{id:1,title:'A'.repeat(70)}}))}
 const tables=gradeExportTables(long)
 assert.equal(new Set(tables.map(t=>t.name.toLowerCase())).size,tables.length)
 assert.ok(tables.every(t=>t.name.length<=31&&!/[\\/?*\[\]:]/.test(t.name)))
})
test('legacy Excel column limit fails explicitly instead of dropping assignments',()=>{
 const wide={...snapshot,sheets:[{...snapshot.sheets[0],assignments:Array.from({length:260},(_,id)=>({id,title:'Work'})),students:[]}]}
 assert.throws(()=>makeGradeWorkbook(wide,XLSX,'xls'),/format limits/)
 assert.equal(makeGradeWorkbook(wide,XLSX,'xlsx').SheetNames.length,4)
})
test('print report escapes record content and separates courses into six-assignment landscape panels',()=>{
 const html=schoolGradePrintHtml(snapshot)
 assert.ok(html.includes('&lt;script&gt;'))
 assert.ok(!html.includes('<script>alert'))
 assert.match(html,/A4 landscape/);assert.match(html,/break-before:page/)
 assert.match(html,/000123/);assert.match(html,/>0%<\/td>/);assert.match(html,/>—<\/td>/)
 const wide={...snapshot,sheets:[{...snapshot.sheets[0],assignments:Array.from({length:7},(_,id)=>({id,title:'Work',points_possible:10})),students:[]}]}
 assert.match(schoolGradePrintHtml(wide),/Part 2 of 2/)
})
