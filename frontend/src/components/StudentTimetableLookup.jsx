import {useEffect,useState} from 'react';
import authFetch from '../services/authFetch';
import './StudentTimetableLookup.css';
export default function StudentTimetableLookup(){
 const [query,setQuery]=useState(''),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;setData(null);setError('');if(query.trim().length<2){setBusy(false);return;}setBusy(true);const timer=setTimeout(async()=>{try{const r=await authFetch(`/api/student-timetable-lookup?q=${encodeURIComponent(query.trim())}`);const d=await r.json();if(!r.ok)throw Error(d.error);if(active)setData(d);}catch(e){if(active)setError(e.message);}finally{if(active)setBusy(false);}},300);return()=>{active=false;clearTimeout(timer);};},[query]);
 return <section className="panel student-timetable-lookup"><h2>Student Timetable Lookup / 学生课表查询</h2><label>Student name or email / 学生姓名或邮箱<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Type at least two characters" autoComplete="off" /></label>
 <p className="timetable-note">2026–2027 · Semester 1 · Course, teacher and room from the supplied master schedule.</p>
 {busy&&<p role="status">Looking up timetable…</p>}{error&&<p role="alert">{error}</p>}
 {data?.students?.length===0&&<p>No matching students in your permitted roster.</p>}
 {data?.students?.map(s=><div key={s.id} className="timetable-result"><strong>{s.name||s.email}</strong> <small>{s.email}</small><div className="timetable-blocks">{s.blocks.map(b=><div key={b.block} className="timetable-block"><strong>Block {b.block}</strong>{b.courses.length?b.courses.map((c,i)=><div key={i}><b>{c.course}</b><br/>{c.teacher}<br/>Room {c.room}</div>):<div>No matched course</div>}</div>)}</div>{s.unmatched.length>0&&<p className="timetable-note">Not mapped in this semester’s schedule: {s.unmatched.join(', ')}. Check enrolment or schedule details.</p>}</div>)}
 </section>;
}
