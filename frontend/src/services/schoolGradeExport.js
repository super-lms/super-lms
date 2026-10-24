import {beijingDateTime} from './assignmentTime.js'
export const exportNotes='Current enrollment roster; marks as recorded at export time. Semester grades use assignment due dates, falling back to availability/creation dates in Beijing time. Undated assignments are shown but excluded from semester grades. Unmarked work is blank, not zero. This readable report does not replace a complete LMS database and uploaded-file backup.'
export const timestamp=snapshot=>`${beijingDateTime(snapshot.generatedAt).replace('T',' ')} Beijing time`
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function gradeExportTables(snapshot) {
 const summary=[['SUPER-LMS School Grade Report'],['School year',snapshot.schoolYear],['Generated',timestamp(snapshot)],['Scope',exportNotes],[],['Sheet','Course / class','Semester','Start','End','Students','Assignments','Undated assignments']]
 const standing=[['Course / class','Course ID','Semester','Start','End','Student','Student ID','Email','Semester grade (%)','Graded assignments','Dated assignments','Marks without assessment weights']]
 const details=[['Course / class','Course ID','Semester','Student','Student ID','Email','Assignment','Assignment ID','Reporting date','Assessment pathway','Evidence tier','Course weight (%)','Points earned','Points possible','Score (%)','Teacher feedback','Included in semester grade']]
 const tables=[]
 snapshot.sheets.forEach((sheet,index)=>{
   const name=`${index+1} ${sheet.course.title} S${sheet.period.label.endsWith('1')?'1':'2'}`.replace(/[\\/?*\[\]:]/g,' ').slice(0,31).replace(/^'+|'+$/g,'')
   summary.push([name,sheet.course.title,sheet.period.label,sheet.period.start,sheet.period.end,sheet.students.length,sheet.assignments.length,sheet.undated_assignments])
   const matrix=[['Course / class',sheet.course.title],['School year',snapshot.schoolYear],['Semester',sheet.period.label,sheet.period.start,sheet.period.end],['Generated',timestamp(snapshot)],['Notes','Cells show points earned; totals are in the assignment headings. Blank = unmarked. Undated work is excluded from the semester grade.'],[],['Student','Student ID','Email','Semester grade (%)','Graded assignments',...sheet.assignments.map(a=>`${a.title} [#${a.id}] / ${Number(a.points_possible)>0?a.points_possible:100}${a.reporting_date?' · '+a.reporting_date:' · UNDATED'}`)]]
   sheet.students.forEach(student=>{
     standing.push([sheet.course.title,sheet.course.id,sheet.period.label,sheet.period.start,sheet.period.end,student.student_name,student.student_id,student.student_email,student.calculated_mark,student.graded_count,student.assignment_count,student.unlinked_graded_count])
     matrix.push([student.student_name,student.student_id,student.student_email,student.calculated_mark,student.graded_count,...student.marks.map(m=>m.points_earned)])
     student.marks.forEach((mark,i)=>{const a=sheet.assignments[i];details.push([sheet.course.title,sheet.course.id,sheet.period.label,student.student_name,student.student_id,student.student_email,a.title,a.id,a.reporting_date||'',a.category_name||'',a.subcategory_name||'',a.course_weight_percent==null?null:Number(a.course_weight_percent),mark.points_earned,mark.points_possible,mark.score,mark.feedback,Boolean(a.reporting_date)?'Yes':'No — undated'])})
   })
   tables.push({name,rows:matrix,headerRow:6})
 })
 return [{name:'Summary',rows:summary,headerRow:5},{name:'Student Summary',rows:standing,headerRow:0},{name:'All Marks',rows:details,headerRow:0},...tables]
}
export function makeGradeWorkbook(snapshot,XLSX,format='xlsx') {
 const tables=gradeExportTables(snapshot),workbook=XLSX.utils.book_new()
 for(const table of tables){
   const maxColumns=table.rows.reduce((max,row)=>Math.max(max,row.length),0)
   if(table.rows.length>(format==='xls'?65536:1048576)||maxColumns>(format==='xls'?256:16384))throw Error('This report exceeds the chosen Excel format limits. Use .xlsx or select fewer courses.')
   const sheet=XLSX.utils.aoa_to_sheet(table.rows)
   sheet['!cols']=Array.from({length:maxColumns},(_,i)=>({wch:i===0?30:i<3?24:18}))
   sheet['!autofilter']={ref:XLSX.utils.encode_range({r:table.headerRow,c:0},{r:Math.max(table.headerRow,table.rows.length-1),c:maxColumns-1})}
   XLSX.utils.book_append_sheet(workbook,sheet,table.name)
 }
 return workbook
}
export function schoolGradePrintHtml(snapshot) {
 const pages=snapshot.sheets.flatMap(sheet=>{
   const chunks=[];for(let i=0;i<Math.max(1,sheet.assignments.length);i+=6)chunks.push(sheet.assignments.slice(i,i+6))
   return chunks.map((assignments,page)=>`<section class="course"><h1>${esc(sheet.course.title)} — ${esc(sheet.period.label)}</h1><p>${esc(snapshot.schoolYear)} · ${esc(sheet.period.start)} to ${esc(sheet.period.end)} · Generated ${esc(timestamp(snapshot))}</p><p>Current roster · ${sheet.students.length} students · ${sheet.assignments.length} assignments · Part ${page+1} of ${chunks.length}. Cells show points earned. — = unmarked. Undated work is excluded from semester grades.</p>${sheet.students.some(s=>s.unlinked_graded_count>0)?'<p>Some marks have no assessment weight. The semester grade follows the existing report-card calculation: weighted assessment groups when available, otherwise the average of marked work.</p>':''}<table><thead><tr><th>Student / ID</th><th>Semester %</th>${assignments.map(a=>`<th>${esc(a.title)}<br>#${a.id} / ${esc(Number(a.points_possible)>0?a.points_possible:100)}<br>${esc(a.reporting_date||'UNDATED')}</th>`).join('')}</tr></thead><tbody>${sheet.students.map(student=>`<tr><td>${esc(student.student_name)}<br>${esc(student.student_id||student.student_email)}</td><td>${student.calculated_mark===null?'—':esc(student.calculated_mark)+'%'}</td>${assignments.map(a=>{const m=student.marks.find(m=>Number(m.assignment_id)===Number(a.id));return `<td>${m?.points_earned==null?'—':esc(m.points_earned)}</td>`}).join('')}</tr>`).join('')}</tbody></table>${!sheet.students.length?'<p>No students are currently enrolled in this class.</p>':''}</section>`)
 })
 return `<!doctype html><html><head><meta charset="utf-8"><title>School Grade Report ${esc(snapshot.schoolYear)}</title><style>@page{size:A4 landscape;margin:12mm}body{font:11px Arial,sans-serif;color:#111}h1{font-size:20px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #9ca3af;padding:6px;text-align:left;overflow-wrap:anywhere}th:first-child{width:22%}thead{display:table-header-group}tr{break-inside:avoid}.course{break-before:page}button{padding:12px}tbody tr:nth-child(even){background:#f3f4f6}@media print{button{display:none}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><button onclick="window.print()">Print / Save PDF</button><h1>SUPER-LMS — School Grade Report</h1><p>School year: ${esc(snapshot.schoolYear)} · Generated: ${esc(timestamp(snapshot))}</p><p>${esc(exportNotes)}</p><h2>Selected course / semester sections</h2><table><thead><tr><th>Course / class</th><th>Semester</th><th>Date range</th><th>Students</th><th>Assignments</th></tr></thead><tbody>${snapshot.sheets.map(s=>`<tr><td>${esc(s.course.title)}</td><td>${esc(s.period.label)}</td><td>${esc(s.period.start)} to ${esc(s.period.end)}</td><td>${s.students.length}</td><td>${s.assignments.length}</td></tr>`).join('')}</tbody></table>${pages.join('')}</body></html>`
}
