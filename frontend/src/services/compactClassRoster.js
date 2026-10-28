const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function compactRosterHtml(course, students) {
  const showSections=students.some(student=>student.section_title && student.section_title !== course.title);
  const panels=students.length>42?2:1, rows=Math.max(1,Math.ceil(students.length/panels));
  const height=Math.min(24,Math.floor(600/(rows+1))), font=Math.min(11,height/(panels===2?2.2:1.6));
  const tables=Array.from({length:panels},(_,panel)=>`<table><colgroup><col style="width:6%"><col style="width:17%"><col style="width:49%"><col style="width:28%"></colgroup><thead><tr><th>#</th><th>Student ID</th><th>Student name</th><th>${showSections?'Cohort':'Notes'}</th></tr></thead><tbody>${students.slice(panel*rows,(panel+1)*rows).map((student,index)=>`<tr><td>${panel*rows+index+1}</td><td>${escape(student.student_id)}</td><td>${escape(student.name || [student.first_name,student.last_name].filter(Boolean).join(' ') || student.email || 'Unnamed student')}</td><td>${showSections?escape(student.section_title):''}</td></tr>`).join('')}</tbody></table>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(course.title)} Class Roster</title><style>@page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0}h1{font-size:15pt;margin:0 0 5pt}p{font-size:10pt;margin:0 0 8pt}.tables{display:grid;grid-template-columns:repeat(${panels},minmax(0,1fr));gap:4mm;align-items:start}table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:${font}pt}th,td{border:0.5pt solid #aaa;padding:2pt 3pt;text-align:left;overflow-wrap:anywhere}th{background:#eee}tbody tr{height:${height}pt;break-inside:avoid}button{padding:8px;margin-bottom:15px}@media print{button{display:none}}tbody tr:nth-child(even){background:#f1f3f5}tbody tr:nth-child(odd){background:#fff}tbody tr,tbody td{print-color-adjust:exact;-webkit-print-color-adjust:exact}</style></head><body><button onclick="window.print()">Print / Save PDF</button><h1>${escape(course.title)} Class Roster</h1><p>Total students: ${students.length} &nbsp;&nbsp; Date: ____________________</p><div class="tables">${tables}</div></body></html>`;
}
export function printCompactClassRoster(course, students) {
  const popup=window.open('','_blank');
  if(!popup)throw new Error('Please allow pop-ups to print the class roster.');
  popup.document.open();popup.document.write(compactRosterHtml(course,students));popup.document.close();
  popup.focus();popup.setTimeout(()=>{if(!popup.closed)popup.print();},300);
}

function rosterPageHtml(course, students) {
  const showSections=students.some(student=>student.section_title && student.section_title !== course.title);
  const panels=students.length>42?2:1, rows=Math.max(1,Math.ceil(students.length/panels));
  const height=Math.min(24,Math.floor(600/(rows+1))), font=Math.min(11,height/(panels===2?2.2:1.6));
  const tables=Array.from({length:panels},(_,panel)=>`<table style="font-size:${font}pt"><colgroup><col style="width:6%"><col style="width:17%"><col style="width:49%"><col style="width:28%"></colgroup><thead><tr><th>#</th><th>Student ID</th><th>Student name</th><th>${showSections?'Cohort':'Notes'}</th></tr></thead><tbody>${students.slice(panel*rows,(panel+1)*rows).map((student,index)=>`<tr style="height:${height}pt"><td>${panel*rows+index+1}</td><td>${escape(student.student_id)}</td><td>${escape(student.name || [student.first_name,student.last_name].filter(Boolean).join(' ') || student.email || 'Unnamed student')}</td><td>${showSections?escape(student.section_title):''}</td></tr>`).join('')}</tbody></table>`).join('');
  return `<section class="roster-page"><h1>${escape(course.title)} Class Roster</h1><p>${course.master_course_id?'Cohort':'Master Class'} &nbsp;&nbsp; Total students: ${students.length} &nbsp;&nbsp; Date: ____________________</p>${students.length?`<div class="tables panels-${panels}">${tables}</div>`:'<p>No students are currently enrolled.</p>'}</section>`;
}

export function multipleRostersHtml(rosters) {
  const pages=(Array.isArray(rosters)?rosters:[]).map(({course,students})=>rosterPageHtml(course,Array.isArray(students)?students:[])).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Selected Class Rosters</title><style>@page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0}.roster-page{break-after:page;page-break-after:always;min-height:270mm}.roster-page:last-child{break-after:auto;page-break-after:auto}h1{font-size:15pt;margin:0 0 5pt}p{font-size:10pt;margin:0 0 8pt}.tables{display:grid;gap:4mm;align-items:start}.panels-1{grid-template-columns:1fr}.panels-2{grid-template-columns:repeat(2,minmax(0,1fr))}table{width:100%;table-layout:fixed;border-collapse:collapse}th,td{border:.5pt solid #aaa;padding:2pt 3pt;text-align:left;overflow-wrap:anywhere}th{background:#eee}tbody tr{break-inside:avoid}button{padding:8px;margin-bottom:15px}@media print{button{display:none}}tbody tr:nth-child(even){background:#f1f3f5}tbody tr:nth-child(odd){background:#fff}tbody tr,tbody td{print-color-adjust:exact;-webkit-print-color-adjust:exact}</style></head><body><button onclick="window.print()">Print / Save PDF</button>${pages}</body></html>`;
}

export function printMultipleClassRosters(rosters) {
  if(!Array.isArray(rosters) || !rosters.length)throw new Error('Select at least one class or cohort to print.');
  const popup=window.open('','_blank');
  if(!popup)throw new Error('Please allow pop-ups to print the class rosters.');
  popup.document.open();popup.document.write(multipleRostersHtml(rosters));popup.document.close();
  popup.focus();popup.setTimeout(()=>{if(!popup.closed)popup.print();},300);
}
