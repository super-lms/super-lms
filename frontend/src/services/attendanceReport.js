export const schoolPeriods = [
  ['Term 1','2026-09-01','2026-11-06'],['Term 2','2026-11-09','2027-01-15'],
  ['Term 3','2027-01-18','2027-04-15'],['Term 4','2027-04-16','2027-06-30'],
  ['Semester 1','2026-09-01','2027-01-15'],['Semester 2','2027-01-18','2027-06-30']
];
export function attendanceRange(period, anchor) {
  const preset = schoolPeriods.find(p=>p[0]===period);
  if(preset) return {start:preset[1],end:preset[2]};
  const date = new Date(`${anchor}T12:00:00Z`);
  if(Number.isNaN(date.getTime())) return {start:'',end:''};
  const iso=d=>d.toISOString().slice(0,10);
  if(period==='Monthly') return {start:iso(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1))),end:iso(new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)))};
  date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));
  const start=iso(date);date.setUTCDate(date.getUTCDate()+6);return {start,end:iso(date)};
}
export function attendanceRows(data, email='') {
  const index=new Map((data.records||[]).map(r=>[`${String(r.student_email).toLowerCase()}|${r.date}`,r]));
  return (data.students||[]).filter(s=>!email||s.student_email?.toLowerCase()===email.toLowerCase()).map(s=>{
    const entries=(data.sessions||[]).map(session=>{const r=index.get(`${s.student_email.toLowerCase()}|${session.date}`);return {date:session.date,status:r?.status||'Unrecorded',note:r?.note||''};});
    const counts=Object.fromEntries(['Present','Absent','Late','Excused','Unrecorded'].map(status=>[status,entries.filter(r=>r.status===status).length]));
    return {...s,entries,counts};
  });
}
export function attendancePrintHtml(data, rows, period) {
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statuses=['Present','Absent','Late','Excused','Unrecorded'];
  return `<!doctype html><html><head><title>Attendance report</title><style>@page{size:A4 landscape;margin:12mm}body{font:12px Arial;color:#111}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #999;padding:7px;text-align:left}thead{display:table-header-group}tr{break-inside:avoid}h1{font-size:22px}.detail{break-before:page}button{padding:10px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Print / Save PDF</button><h1>Attendance report — ${esc(data.class.title)}</h1><p>${esc(period)}: ${esc(data.start)} to ${esc(data.end)}</p><p>Current class roster. Only saved attendance sessions are counted; unrecorded entries are not absences.</p><table><thead><tr><th>Student</th><th>Email</th>${statuses.map(s=>`<th>${s}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.student_name)}</td><td>${esc(r.student_email)}</td>${statuses.map(s=>`<td>${r.counts[s]}</td>`).join('')}</tr>`).join('')}</tbody></table>${rows.length===1?`<h2>Daily attendance</h2><table><thead><tr><th>Date</th><th>Status</th><th>Notes</th></tr></thead><tbody>${rows[0].entries.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.status)}</td><td>${esc(r.note)}</td></tr>`).join('')}</tbody></table>`:''}${!data.sessions.length?'<p>No attendance sessions were saved in this period.</p>':''}</body></html>`;
}
