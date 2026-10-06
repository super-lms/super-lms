import { forwardRef, useImperativeHandle, useState, useRef } from 'react';
import { dateField, ieRows, iePrintHtml, localReportDate } from '../services/ieReport.js';

const input = {width:'100%',boxSizing:'border-box',padding:8,border:'1px solid #cbd5e1',borderRadius:6,font:'inherit'};
const cell = {padding:8,border:'1px solid #d1d5db',verticalAlign:'top'};
const IEReportSingle = forwardRef(function IEReport({ data, onMessage }, ref) {
  const student = data.students?.[0];
  const [meta, setMeta] = useState({date:localReportDate(),name:student?.student_name || '',email:student?.student_email || '',grade:student?.student_grade || '',className:student?.student_class || '',term:'',course:data.course_title || ''});
  const [rows, setRows] = useState(() => ieRows(student?.assignments));
  function update(id, field, value) {setRows(current => current.map(r => r.id === id ? {...r,[field]:value} : r));}
  function html() {
    if (!rows.some(r => r.included)) throw new Error(`Select at least one assignment for ${meta.name}.`);
    if (!meta.date || !meta.name || !meta.email || !meta.grade || !meta.className) throw new Error(`Complete date, name, email, grade, and class for ${meta.name}.`);
    return iePrintHtml(meta, rows);
  }
  function print() {
    if (!rows.some(r => r.included)) return onMessage('Select at least one assignment for the IE report.');
    if (!meta.date || !meta.name || !meta.email || !meta.grade || !meta.className) return onMessage('Complete the report date, student name, email, grade, and class before printing.');
    const popup = window.open('', '_blank', 'width=1200,height=800');
    if (!popup) return onMessage('Allow pop-ups for the LMS site to print the IE report.');
    popup.document.write(iePrintHtml(meta, rows)); popup.document.close();
    popup.focus(); popup.setTimeout(() => popup.print(), 300);
  }
  useImperativeHandle(ref, () => ({print, html}));
  if (!student) return <p>No student found. Select a student and generate the report again.</p>;
  return <section style={{background:'#fff',padding:24,border:'1px solid #ddd',borderRadius:12,marginTop:24}}>
    <h2>IE — Insufficient Evidence</h2>
    <p>Choose the assignments for this term, then complete the final due dates and directions. Assignments that are not submitted or have a score below 50% are selected automatically; you can change the selection. Changes here affect this printed report only. Keep this page open until you print or save the PDF; edits are not saved to the LMS.</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16,marginBottom:20}}>
      {[['date','Date','date'],['term','Term','text'],['name','Student name','text'],['email','Email','email'],['grade','Grade','text'],['className','Class (e.g. 10A)','text']].map(([key,label,type]) => <label key={key}>{label}<input aria-label={label} type={type} value={meta[key]} onChange={e=>setMeta({...meta,[key]:e.target.value})} style={input}/></label>)}
    </div>
    <div style={{display:'flex',gap:12,marginBottom:12}}><button onClick={()=>setRows(rows.map(r=>({...r,included:true})))}>Include all</button><button onClick={()=>setRows(rows.map(r=>({...r,included:false})))}>Clear selection</button><button onClick={print}>Print IE / Save PDF</button></div>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:1000}}><thead><tr>{['Include','Assignment Title','Original Assignment Date','Submitted / Not submitted','Score if submitted','Final Due Date','Directions to Student'].map(label=><th key={label} style={cell}>{label}</th>)}</tr></thead><tbody>
    {rows.map((r,i)=><tr key={r.id}>
      <td style={cell}><input type="checkbox" aria-label={`Include assignment ${i+1}`} checked={r.included} onChange={e=>update(r.id,'included',e.target.checked)}/></td>
      <td style={cell}><input aria-label={`Assignment ${i+1} title`} value={r.title} onChange={e=>update(r.id,'title',e.target.value)} style={input}/></td>
      <td style={cell}><input aria-label={`Assignment ${i+1} original date`} type="date" value={dateField(r.originalDate)} onChange={e=>update(r.id,'originalDate',e.target.value)} style={input}/></td>
      <td style={cell}><select aria-label={`Assignment ${i+1} submission status`} value={String(r.submitted)} onChange={e=>update(r.id,'submitted',e.target.value==='true')} style={input}><option value="true">Submitted</option><option value="false">Not submitted</option></select></td>
      <td style={cell}><input aria-label={`Assignment ${i+1} score`} disabled={!r.submitted} value={r.submitted?r.score:''} onChange={e=>update(r.id,'score',e.target.value)} placeholder={r.submitted?'Not graded':''} style={input}/></td>
      <td style={cell}><input aria-label={`Assignment ${i+1} final due date`} type="date" value={r.finalDate} onChange={e=>update(r.id,'finalDate',e.target.value)} style={input}/></td>
      <td style={cell}><textarea aria-label={`Assignment ${i+1} directions`} value={r.directions} onChange={e=>update(r.id,'directions',e.target.value)} rows={3} style={{...input,minWidth:200}}/></td>
    </tr>)}
    {!rows.length && <tr><td colSpan={7} style={cell}>No assignments match the selected category and level.</td></tr>}
    </tbody></table></div>
    <p>Original assignment date uses the assignment’s available-from date, or creation date when available. Check it before printing. Scores from the gradebook are percentages.</p>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'36px',marginTop:48}}>{['Student','Parent','Homeroom Teacher','BC Teacher'].map(label=><div key={label} style={{borderTop:'1px solid #333',paddingTop:8}}>{label} Signature</div>)}</div>
  </section>;
});

const IEReport = forwardRef(function IEReports({data,onMessage}, ref) {
  const eligible = (data.students || []).filter(student => ieRows(student.assignments).some(row => row.included));
  const [selected, setSelected] = useState(() => new Set(eligible.map(s => s.student_user_id)));
  const reportRefs = useRef({});
  function print() {
    const students=eligible.filter(s=>selected.has(s.student_user_id));
    if(!students.length) return onMessage('Select at least one student meeting the IE criteria.');
    let documents;
    try { documents=students.map(s=>reportRefs.current[s.student_user_id].html()); }
    catch(error) {return onMessage(error.message);}
    const popup=window.open('', '_blank', 'width=1200,height=800');
    if(!popup) return onMessage('Allow pop-ups for the LMS site to print IE reports.');
    const head=documents[0].split('<body>')[0];
    const bodies=documents.map(doc=>doc.split('<body>')[1].split('</body>')[0].replace(/<button class="print"[^>]*>.*?<\/button>/,'')).map(body=>`<section class="ie-student">${body}</section>`).join('');
    popup.document.write(`${head}<body><style>.ie-student + .ie-student {break-before:page;}</style><button class="print" onclick="window.print()">Print / Save as PDF</button>${bodies}</body></html>`);
    popup.document.close();popup.focus();popup.setTimeout(()=>popup.print(),300);
  }
  useImperativeHandle(ref,()=>({print}));
  return <section style={{marginTop:24}}><h2>Students meeting IE criteria</h2>
    <p>Students with at least one assignment not submitted or scored below 50% are listed below. Choose one student or a batch. Each printed student report starts on a new page.</p>
    <div style={{display:'flex',gap:12,marginBottom:16}}><button onClick={()=>setSelected(new Set(eligible.map(s=>s.student_user_id)))}>Select all IE students</button><button onClick={()=>setSelected(new Set())}>Clear students</button><button onClick={print}>Print selected IE reports / Save PDF</button></div>
    {!eligible.length && <p>No students meet the IE criteria for the selected course, category, and level.</p>}
    {eligible.map(student=><div key={student.student_user_id}><label><input type="checkbox" checked={selected.has(student.student_user_id)} onChange={e=>setSelected(current=>{const next=new Set(current);if(e.target.checked)next.add(student.student_user_id);else next.delete(student.student_user_id);return next;})}/> Include {student.student_name} ({student.student_email})</label>
    <div hidden={!selected.has(student.student_user_id)}><IEReportSingle ref={node=>{if(node) reportRefs.current[student.student_user_id]=node;}} data={{...data,students:[student]}} onMessage={onMessage}/></div></div>)}
  </section>;
});
export default IEReport;
