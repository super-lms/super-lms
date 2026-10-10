import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import authFetch from '../services/authFetch';
import {groupCoursesByMaster} from '../services/courseSections';
export default function AdminRiskAlerts(){
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [teacher,setTeacher]=useState(''),[course,setCourse]=useState(''),[section,setSection]=useState(''),[status,setStatus]=useState('');
 async function load(){setLoading(true);setError('');try{const res=await authFetch('/api/admin/risk-alerts');const body=await res.json();if(!res.ok)throw Error(body.error);setData(body);}catch(e){setError(e.message||'Unable to load alerts.');}finally{setLoading(false);}}
 useEffect(()=>{load();},[]);
 const courses=(data?.courses||[]).filter(c=>!teacher||(c.teacher_ids||[]).some(id=>String(id)===teacher));
 const groups=groupCoursesByMaster(courses);
 const chosen=groups.find(g=>g.key===course);
 const classes=course?(chosen?.sections||[]):courses;
 const ids=new Set(classes.filter(c=>!section||String(c.id)===section).map(c=>Number(c.id)));
 const rows=(data?.students||[]).filter(r=>ids.has(Number(r.class_id))&&(!status||r.label===status));
 const count=new Set(rows.map(r=>r.student_id)).size;
 const selectStyle={padding:'8px',minWidth:'180px',maxWidth:'100%'};
 return <section style={{marginTop:24,padding:20,border:'1px solid #d7d7d7',borderRadius:14,background:'white'}}>
  <h2>Student Risk Alerts</h2><p>Current weighted course marks across your school. Below 50%: Failing; 50–59.99%: At risk; 60–66.99%: Watch closely. Unmarked work is not counted as zero.</p>
  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
   <label>Teacher<br/><select style={selectStyle} value={teacher} onChange={e=>{setTeacher(e.target.value);setCourse('');setSection('');}}><option value="">All teachers</option>{(data?.teachers||[]).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
   <label>Course<br/><select style={selectStyle} value={course} onChange={e=>{setCourse(e.target.value);setSection('');}}><option value="">All courses</option>{groups.map(g=><option key={g.key} value={g.key}>{g.masterTitle}</option>)}</select></label>
   <label>Class<br/><select style={selectStyle} value={section} onChange={e=>setSection(e.target.value)}><option value="">All classes</option>{classes.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
   <label>Status<br/><select style={selectStyle} value={status} onChange={e=>setStatus(e.target.value)}><option value="">All support statuses</option>{['Failing','At risk','Watch closely'].map(s=><option key={s}>{s}</option>)}</select></label>
   <button onClick={load} disabled={loading}>{loading?'Loading…':'Refresh alerts'}</button>
  </div>
  {error?<p role="alert">{error}</p>:loading?<p role="status">Loading student risk alerts…</p>:<><p role="status"><strong>{count} students needing attention</strong> · {rows.length} course alerts</p>{!rows.length?<p>No course marks below the selected threshold found. Students with no marked work do not have a calculated course mark yet.</p>:<div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr>{['Student','Course / class','Mark','Status','Review'].map(s=><th key={s} style={{padding:10}}>{s}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={`${r.student_id}:${r.class_id}`}><td style={{padding:10}}>{r.studentName}</td><td>{r.courseTitle}</td><td>{r.value.toFixed(1)}%</td><td><strong>{r.label}</strong></td><td><Link to={`/admin/gradebooks?classId=${r.class_id}`}>Open Gradebook</Link></td></tr>)}</tbody></table></div>}</>}
 </section>;
}
