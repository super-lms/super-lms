export function dateField(value) {
  return String(value || '').slice(0, 10);
}
export function localReportDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function meetsIECriteria(assignment) {
  if (!assignment.submitted) return true;
  const value = String(assignment.score ?? '').trim().replace(/%$/, '').trim();
  return value !== '' && Number.isFinite(Number(value)) && Number(value) < 40;
}
export function ieRows(assignments = []) {
  return assignments.map((a, index) => ({...a, id: a.assignment_id ?? `assignment-${index}`}))
    .filter(meetsIECriteria)
    .map(a => ({
      id: a.id, included: true, title: a.assignment_title || '',
      originalDate: dateField(a.original_assignment_date), submitted: Boolean(a.submitted),
      score: a.submitted ? `${String(a.score).replace(/%$/, '')}%` : '',
      finalDate: '', directions: '',
    }));
}
function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function iePrintHtml(meta, rows) {
  const selected = rows.filter(r => r.included && meetsIECriteria(r));
  return `<!doctype html><html><head><meta charset="utf-8"><title>IE — ${escape(meta.name)}</title><style>
  @page { size: A4 landscape; margin: 14mm; } body {font:12px Arial,sans-serif;color:#111;} h1 {font-size:23px;} .details {display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:18px 0;} table {width:100%;border-collapse:collapse;table-layout:fixed;} th,td {border:1px solid #555;padding:9px;text-align:left;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap;} th {background:#eee;} thead {display:table-header-group;} tr {break-inside:avoid;} .signatures {display:grid;grid-template-columns:1fr 1fr;gap:30px 45px;margin-top:42px;break-inside:avoid;} .signature {border-top:1px solid #111;padding-top:7px;} .directions {width:27%;} .title {width:22%;} .number {width:5%;} @media print {body {margin:0;} .print {display:none;}}
  </style></head><body><button class="print" onclick="window.print()">Print / Save as PDF</button><h1>IE — Insufficient Evidence</h1><p>${escape(meta.course)}${meta.term ? ` · ${escape(meta.term)}` : ''}</p><div class="details">${[['Date',meta.date],['Student name',meta.name],['Email',meta.email],['Grade',meta.grade],['Class',meta.className]].map(([label,v])=>`<div><strong>${label}:</strong> ${escape(v)}</div>`).join('')}</div><table><thead><tr><th class="number">No.</th><th class="title">Assignment Title</th><th>Original Assignment Date</th><th>Submitted / Not submitted</th><th>Score if submitted</th><th>Final Due Date</th><th class="directions">Directions to Student</th></tr></thead><tbody>${selected.map((r,i)=>`<tr>${[i+1,r.title,r.originalDate,r.submitted?'Submitted':'Not submitted',r.submitted ? r.score : "",r.finalDate,r.directions].map(v=>`<td>${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="signatures">${['Student','Parent','Homeroom Teacher','BC Teacher'].map(label=>`<div class="signature">${label} Signature</div>`).join('')}</div></body></html>`;
}
