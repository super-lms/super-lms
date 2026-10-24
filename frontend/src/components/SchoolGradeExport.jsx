import {useEffect,useState} from 'react'
import * as XLSX from 'xlsx'
import authFetch from '../services/authFetch'
import {riskCourseGroups} from '../services/riskCourseGroups.js'
import {makeGradeWorkbook,schoolGradePrintHtml,timestamp} from '../services/schoolGradeExport.js'
const field={padding:10,border:'1px solid #cbd5e1',borderRadius:8,font:'inherit',maxWidth:'100%'}
const button={...field,background:'#fff',cursor:'pointer',fontWeight:700}
function semesterDates(year){return [{label:'Semester 1',start:`${year}-09-01`,end:`${Number(year)+1}-01-15`},{label:'Semester 2',start:`${Number(year)+1}-01-18`,end:`${Number(year)+1}-06-30`}]}
export default function SchoolGradeExport(){
 const today=new Date(),defaultYear=today.getMonth()<7?today.getFullYear()-1:today.getFullYear()
 const [courses,setCourses]=useState([]),[selected,setSelected]=useState([]),[year,setYear]=useState(String(defaultYear)),[semester,setSemester]=useState('Semester 1'),[periods,setPeriods]=useState(()=>semesterDates(defaultYear)),[format,setFormat]=useState('xlsx'),[snapshot,setSnapshot]=useState(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('')
 async function load(){setLoading(true);setError('');try{const res=await authFetch('/api/admin/grade-export/courses');const data=await res.json();if(!res.ok)throw Error(data.error||'Could not load courses.');setCourses(data.courses||[])}catch(e){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{load()},[])
 const groups=riskCourseGroups(courses)
 function change(){setSnapshot(null);setError('')}
 function toggle(ids,checked){change();setSelected(old=>checked?[...new Set([...old,...ids])]:old.filter(id=>!ids.includes(id)))}
 async function generate(){setBusy(true);setError('');setSnapshot(null);try{const res=await authFetch('/api/admin/grade-export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({courseIds:selected,schoolYear:`${year}-${Number(year)+1}`,periods:periods.filter(p=>semester==='Both semesters'||p.label===semester)})});const data=await res.json();if(!res.ok)throw Error(data.error||'Report failed.');setSnapshot(data)}catch(e){setError(e.message)}finally{setBusy(false)}}
 function excel(){try{XLSX.writeFile(makeGradeWorkbook(snapshot,XLSX,format),`SUPER-LMS_Grades_${snapshot.schoolYear}_${snapshot.generatedAt.slice(0,10)}.${format}`,{bookType:format==='xls'?'biff8':'xlsx'})}catch(e){setError(e.message)}}
 function print(){const blob=new Blob([schoolGradePrintHtml(snapshot)],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob);const opened=window.open(url,'_blank');if(!opened)setError('Please allow the report tab to open, then try Print / Save PDF again.');setTimeout(()=>URL.revokeObjectURL(url),60000)}
 return <section aria-labelledby="school-grade-export-title" style={{background:'white',border:'1px solid #cbd5e1',borderRadius:14,padding:20,marginBottom:22}}>
  <h2 id="school-grade-export-title" style={{marginTop:0}}>Whole School Grade Report</h2>
  <p>Select all courses, master courses with all cohorts, or individual classes. Generate a snapshot, then save a PDF or multi-sheet Excel workbook.</p>
  {loading?<p role="status">Loading school courses…</p>:<>
  <fieldset disabled={busy} style={{border:0,padding:0,margin:0}}><legend>Report selection</legend>
   <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBlock:12}}>
    <label>School year starting <input type="number" min="2000" max="2100" style={{...field,width:100}} value={year} onChange={e=>{change();setYear(e.target.value);if(/^\d{4}$/.test(e.target.value))setPeriods(semesterDates(e.target.value))}}/> – {Number(year)+1}</label>
    <label>Semester <select style={field} value={semester} onChange={e=>{change();setSemester(e.target.value)}}>{['Semester 1','Semester 2','Both semesters'].map(s=><option key={s}>{s}</option>)}</select></label>
   </div>
   <p>Confirm semester dates before generating. Dates below are editable; assignment due dates determine the semester, falling back to availability or creation dates in Beijing time. This uses the current enrollment roster and marks recorded now.</p>
   {periods.filter(p=>semester==='Both semesters'||p.label===semester).map(p=><div key={p.label} style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',marginBottom:10}}><strong>{p.label}</strong>{['start','end'].map(key=><label key={key}>{key==='start'?'Start':'End'} <input type="date" style={field} value={p[key]} onChange={e=>{change();setPeriods(old=>old.map(row=>row.label===p.label?{...row,[key]:e.target.value}:row))}}/></label>)}</div>)}
   <div style={{display:'flex',gap:10,marginBlock:12}}><button type="button" style={button} onClick={()=>{change();setSelected(courses.map(c=>c.id))}}>Select all courses</button><button type="button" style={button} onClick={()=>{change();setSelected([])}}>Clear selection</button><span role="status">{selected.length} classes selected</span></div>
   <div style={{maxHeight:320,overflowY:'auto',border:'1px solid #e2e8f0',padding:12,borderRadius:8}}>{groups.map(g=>{const ids=g.sections.map(c=>c.id),all=ids.every(id=>selected.includes(id));return <fieldset key={g.key} style={{border:'1px solid #e2e8f0',marginBottom:10,padding:10}}><legend><label><input type="checkbox" checked={all} onChange={e=>toggle(ids,e.target.checked)}/> <strong>{g.masterTitle}</strong>{g.isMaster?' — Master course / all cohorts':''} ({ids.filter(id=>selected.includes(id)).length}/{ids.length})</label></legend>{g.sections.map(c=><label key={c.id} style={{display:'block',padding:5}}><input type="checkbox" checked={selected.includes(c.id)} onChange={e=>toggle([c.id],e.target.checked)}/> {c.title} {c.is_live===false?'(not live)':''}</label>)}</fieldset>})}{!groups.length&&<p>No courses available for your school.</p>}</div>
   <button type="button" style={{...button,marginTop:14}} disabled={!selected.length||busy||!/^\d{4}$/.test(year)} onClick={generate}>{busy?'Generating complete report…':'Generate Selected Grade Report'}</button>
  </fieldset>
  </>}
  {error&&<p role="alert" style={{color:'#991b1b'}}>{error} {loading===false&&!courses.length&&<button type="button" onClick={load}>Retry loading courses</button>}</p>}
  {snapshot&&<div style={{marginTop:18,padding:14,background:'#f0f7fa',borderRadius:8}}><h3>Report ready</h3><p>School year {snapshot.schoolYear} · {snapshot.sheets.length} course / semester sections · {new Set(snapshot.sheets.flatMap(s=>s.students.map(r=>r.student_user_id))).size} students · Generated {timestamp(snapshot)}</p><p>Unmarked work stays blank. Undated assignments are included for reference but excluded from semester grades. Excel includes a summary, student grades, all assignment marks and feedback, plus a sheet for each class and semester.</p><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button type="button" style={button} onClick={print}>Print / Save PDF</button><label>Excel format <select value={format} style={field} onChange={e=>setFormat(e.target.value)}><option value="xlsx">.xlsx (recommended)</option><option value="xls">.xls (legacy)</option></select></label><button type="button" style={button} onClick={excel}>Export Excel</button></div><p>Save the files outside the LMS server. This is a readable grade snapshot, not a complete database or student-upload backup. No automated storage, archiving or deletion is enabled.</p></div>}
 </section>
}
