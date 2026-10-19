const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function compactRosterHtml(course, students) {
  const panels=students.length>42?2:1, rows=Math.max(1,Math.ceil(students.length/panels));
  const height=Math.min(24,Math.floor(600/(rows+1))), font=Math.min(11,height/(panels===2?2.2:1.6));
  const tables=Array.from({length:panels},(_,panel)=>`<table><colgroup><col style="width:6%"><col style="width:17%"><col style="width:49%"><col style="width:28%"></colgroup><thead><tr><th>#</th><th>Student ID</th><th>Student name</th><th>Notes</th></tr></thead><tbody>${students.slice(panel*rows,(panel+1)*rows).map((student,index)=>`<tr><td>${panel*rows+index+1}</td><td>${escape(student.student_id)}</td><td>${escape(student.name || [student.first_name,student.last_name].filter(Boolean).join(' ') || student.email || 'Unnamed student')}</td><td></td></tr>`).join('')}</tbody></table>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(course.title)} Class Roster</title><style>@page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0}h1{font-size:15pt;margin:0 0 5pt}p{font-size:10pt;margin:0 0 8pt}.tables{display:grid;grid-template-columns:repeat(${panels},minmax(0,1fr));gap:4mm;align-items:start}table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:${font}pt}th,td{border:0.5pt solid #aaa;padding:2pt 3pt;text-align:left;overflow-wrap:anywhere}th{background:#eee}tbody tr{height:${height}pt;break-inside:avoid}button{padding:8px;margin-bottom:15px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Print / Save PDF</button><h1>${escape(course.title)} Class Roster</h1><p>Total students: ${students.length} &nbsp;&nbsp; Date: ____________________</p><div class="tables">${tables}</div></body></html>`;
}
export function printCompactClassRoster(course, students) {
  const popup=window.open('','_blank');
  if(!popup)throw new Error('Please allow pop-ups to print the class roster.');
  popup.document.open();popup.document.write(compactRosterHtml(course,students));popup.document.close();
  popup.focus();popup.setTimeout(()=>{if(!popup.closed)popup.print();},300);
}
