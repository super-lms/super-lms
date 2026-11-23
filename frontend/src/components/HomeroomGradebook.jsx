import {useEffect,useState} from 'react';
import authFetch from '../services/authFetch';
import StudentGradeCalculation from './gradebook/StudentGradeCalculation.jsx';
export default function HomeroomGradebook(){
 const [courses,setCourses]=useState([]),[grade,setGrade]=useState(null),[id,setId]=useState(''),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[student,setStudent]=useState('');
 useEffect(()=>{let active=true;authFetch('/api/homeroom/course-gradebooks').then(async r=>{const d=await r.json();if(active&&r.ok){setCourses(d.courses);setGrade(d.grade);}}).catch(()=>{});return()=>{active=false;};},[]);
 useEffect(()=>{let active=true;setData(null);setError('');setStudent('');if(!id)return;setBusy(true);authFetch(`/api/homeroom/course-gradebooks/${id}`).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(active)setData(d);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[id]);
 if(!grade)return null;
 return <section className="panel"><h2>Grade {grade} — Course gradebooks / 课程成绩册</h2><p>Read-only assignment marks and course standing for students in your assigned grade.</p>
 <label>Choose course / 选择课程 <select value={id} onChange={e=>setId(e.target.value)}><option value="">Choose a course…</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
 {busy&&<p role="status">Loading gradebook…</p>}{error&&<p role="alert">{error}</p>}
 {data&&<><div style={{overflowX:'auto',marginTop:16}}><table><thead><tr><th>Student / 学生</th>{data.assignments.map(a=><th key={a.id}>{a.title}<br/>{a.category_name} · {a.subcategory_name}</th>)}<th>Current mark</th></tr></thead><tbody>{data.students.map(s=><tr key={s.student_user_id}><th><button type="button" onClick={()=>setStudent(String(s.student_user_id))}>{s.student_name}</button></th>{data.assignments.map(a=>{const mark=s.assignment_scores.find(m=>Number(m.assignment_id)===Number(a.id));return <td key={a.id}>{!mark?'N/A':mark.rubric_selection?.excused?'EX':mark.score==null?'—':`${mark.score}%`}{mark?.rubric_selection?.notSubmitted&&<small> · Not submitted</small>}</td>;})}<td>{s.current_percent==null?'Not graded':`${s.current_percent}%`}</td></tr>)}</tbody></table></div><p>Select a student's name to see the grade calculation. Blank marks are ungraded; EX is excused.</p>{student&&<StudentGradeCalculation student={data.students.find(s=>String(s.student_user_id)===student)} groups={data.assessment_groups}/>}</>}
 </section>;
}
