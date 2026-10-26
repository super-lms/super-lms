import {useEffect,useMemo,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useAuth} from '../AuthContext.jsx'
import authFetch from '../services/authFetch'
import './FitnessTrackerPage.css'
import {printFitnessCards} from '../services/fitnessCards.js'
const weekdays=['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const groupName=i=>`Group ${'ABCD'[i]}`
const defaults=[{name:'Back + Chest',instructions:''},{name:'Arms',instructions:''},{name:'Shoulders',instructions:''},{name:'Legs',instructions:''}]
async function api(path,options){
 const response=await authFetch(`/api/fitness${path}`,options&&{method:options.method,headers:{'Content-Type':'application/json'},body:JSON.stringify(options.body)})
 const data=await response.json();if(!response.ok)throw Error(data.error||'Could not load the fitness tracker.');return data
}
function WorkoutCard({student,unit,course}){
 const group=student.group_index
 return <article className="fitness-card">
  <p className="fitness-eyebrow">PE • {course?.title}</p><h2>{student.name}</h2><h3>{unit.title}</h3>
  <p>{unit.start_date} to {unit.end_date} · {group==null?'Choose your rotation group':groupName(group)}</p>
  {group!=null?<ol>{unit.weekdays.map((day,i)=>{const station=unit.stations[(group+i)%4];return <li key={day}><strong>{weekdays[day]}: {station.name}</strong>{station.instructions&&<p className="fitness-instructions">{station.instructions}</p>}</li>})}</ol>:<p>Choose a starting group in the Student Portal. Your teacher can also record your choice.</p>}
  <p className="fitness-card-foot">Repeat this rotation each week during the unit. Your teacher confirms completed workouts.</p>
 </article>
}
export default function FitnessTrackerPage(){
 const {user}=useAuth(),navigate=useNavigate(),studentMode=user?.role==='student'
 const [courses,setCourses]=useState([]),[courseId,setCourseId]=useState(''),[units,setUnits]=useState([]),[unitId,setUnitId]=useState('')
 const [data,setData]=useState(null),[date,setDate]=useState(''),[today,setToday]=useState(''),[dirty,setDirty]=useState({}),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[refresh,setRefresh]=useState(0)
 const [creating,setCreating]=useState(false),[draft,setDraft]=useState({title:'Fitness Unit',start_date:'',end_date:'',weekdays:[1,2,3,4],stations:defaults})
 const hasChanges=Object.keys(dirty).length>0
 const discard=()=>!hasChanges||window.confirm('You have unsaved completion checks. Discard them?')
 useEffect(()=>{let active=true;api('/courses').then(r=>{if(!active)return;setCourses(r.courses);setToday(r.today);setDate(r.today);setDraft(d=>({...d,start_date:r.today}));if(r.courses.length===1)setCourseId(String(r.courses[0].id))}).catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false));return()=>{active=false}},[])
 useEffect(()=>{
  let active=true;setUnits([]);setUnitId('');setData(null);setDirty({});if(!courseId)return
  setLoading(true);setError('');api(`/courses/${courseId}/units`).then(r=>{if(!active)return;setUnits(r.units);const current=r.units.find(u=>u.start_date<=today&&u.end_date>=today);if(r.units.length)setUnitId(String((current||r.units[0]).id))}).catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false));return()=>{active=false}
 },[courseId,today])
 useEffect(()=>{
  let active=true;setData(null);setDirty({});setMessage('');if(!unitId)return
  setLoading(true);setError('');api(`/units/${unitId}`).then(r=>{if(active){setData(r);setToday(r.today)}}).catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false));return()=>{active=false}
 },[unitId,refresh])
 useEffect(()=>{
  if(!hasChanges)return
  const unload=e=>{e.preventDefault();e.returnValue=''}
  const leave=e=>{const a=e.target.closest?.('a[href]');if(a&&!a.getAttribute('href').startsWith('#')&&!window.confirm('Discard unsaved fitness checks and leave this page?')){e.preventDefault();e.stopPropagation()}}
  window.addEventListener('beforeunload',unload);document.addEventListener('click',leave,true)
  return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',leave,true)}
 },[hasChanges])
 const unit=data?.unit,roster=data?.students||[],records=data?.records||[]
 const course=courses.find(c=>String(c.id)===courseId)
 const day=data?.calendar.find(d=>d.date===date)
 const saved=useMemo(()=>new Map((data?.records||[]).filter(r=>r.date===date).map(r=>[r.student_id,r.completed])),[data,date])
 const completed=id=>Object.hasOwn(dirty,id)?dirty[id]:saved.get(id)===true
 const dayStudents=roster.filter(s=>s.group_index!=null)
 const canCheck=Boolean(day&&date<=today)
 function check(id,value){setMessage('');setDirty(previous=>{const next={...previous};if(value===(saved.get(id)===true))delete next[id];else next[id]=value;return next})}
 async function saveDay(){
  try{setBusy(true);setError('');await api(`/units/${unitId}/day`,{method:'PUT',body:{date,revision:unit.revision,records:Object.entries(dirty).map(([id,value])=>({student_id:Number(id),completed:value}))}});setDirty({});const updated=await api(`/units/${unitId}`);setData(updated);setMessage(`Saved completion checks for ${date}.`)}catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function chooseGroup(person,index){
  if(!discard())return
  try{setBusy(true);setError('');await api(`/units/${unitId}/group`,{method:'PUT',body:{student_id:person.id,group_index:Number(index),revision:unit.revision}});setDirty({});setData(await api(`/units/${unitId}`));setMessage('Rotation group saved.')}catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function createUnit(e){
  e.preventDefault();try{setBusy(true);setError('');const r=await api(`/courses/${courseId}/units`,{method:'POST',body:draft});const list=await api(`/courses/${courseId}/units`);setUnits(list.units);setUnitId(String(r.id));setCreating(false)}catch(e){setError(e.message)}finally{setBusy(false)}
 }
 function changeCourse(value){if(discard()){setCourseId(value);setCreating(false);setError('')}}
 function changeUnit(value){if(discard()){setUnitId(value);setCreating(false);setError('')}}
 return <div className="fitness-tracker">
  <header className="fitness-toolbar"><div><p className="fitness-eyebrow">Physical Education</p><h1>Fitness Unit Tracker</h1><p>Choose a group. Follow the four-day rotation. Teacher confirms completion.</p></div><button type="button" onClick={()=>{if(discard())navigate(studentMode?'/student':user?.role==='admin'?'/admin':'/dashboard')}}>Return to dashboard</button></header>
  {error&&<div className="fitness-error" role="alert">{error} {unitId&&<button disabled={busy} onClick={()=>{if(discard()){setDirty({});setRefresh(r=>r+1)}}}>Reload unit</button>}</div>}
  {message&&<p role="status" className="fitness-success">{message}</p>}
  <section className="fitness-panel fitness-controls">
   <label>PE class<select value={courseId} disabled={busy||loading} onChange={e=>changeCourse(e.target.value)}><option value="">Select class</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title} · Class {c.id}</option>)}</select></label>
   <label>Fitness unit<select value={unitId} disabled={busy||loading||!courseId} onChange={e=>changeUnit(e.target.value)}><option value="">Select unit</option>{units.map(u=><option key={u.id} value={u.id}>{u.title} ({u.start_date} – {u.end_date})</option>)}</select></label>
   {!studentMode&&<button disabled={!courseId||busy||loading} onClick={()=>{if(discard()){setDirty({});setCreating(!creating)}}}>{creating?'Close setup':'Create fitness unit'}</button>}
  </section>
  {loading&&<p role="status">Loading fitness tracker…</p>}
  {!loading&&!courses.length&&<p>{studentMode?'Your teacher has not set up a fitness unit in your classes yet.':'No assigned classes are available.'}</p>}
  {!loading&&courseId&&!units.length&&!creating&&<p>{studentMode?'No fitness unit is available for this class.':'Create a fitness unit for this class to begin. Existing grades and attendance are separate.'}</p>}
  {creating&&<form className="fitness-panel" onSubmit={createUnit}><h2>Set up the rotation</h2><p>Four groups visit each station once per week. Students choose their first teaching-day station. This schedule repeats for the unit dates.</p>
   <div className="fitness-controls"><label>Unit name<input required maxLength={120} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label>Start date<input required type="date" value={draft.start_date} onChange={e=>setDraft({...draft,start_date:e.target.value})}/></label><label>End date<input required type="date" min={draft.start_date} value={draft.end_date} onChange={e=>setDraft({...draft,end_date:e.target.value})}/></label></div>
   <fieldset><legend>Four PE days</legend><div className="fitness-controls">{weekdays.slice(1).map((name,i)=><label className="fitness-inline" key={name}><input type="checkbox" checked={draft.weekdays.includes(i+1)} onChange={e=>setDraft({...draft,weekdays:e.target.checked?[...draft.weekdays,i+1].sort((a,b)=>a-b):draft.weekdays.filter(d=>d!==i+1)})}/>{name}</label>)}</div></fieldset>
   <div className="fitness-stations">{draft.stations.map((s,i)=><div key={i}><label>Station {i+1}<input required maxLength={80} value={s.name} onChange={e=>setDraft({...draft,stations:draft.stations.map((v,n)=>n===i?{...v,name:e.target.value}:v)})}/></label><label>Workout instructions (optional)<textarea maxLength={1000} placeholder="Exercises, sets, repetitions, or class instructions" value={s.instructions} onChange={e=>setDraft({...draft,stations:draft.stations.map((v,n)=>n===i?{...v,instructions:e.target.value}:v)})}/></label></div>)}</div>
   <p>Check the dates and stations before creating the unit. Once created, its schedule stays fixed so past records keep their meaning.</p><button className="fitness-primary" disabled={busy||draft.weekdays.length!==4}>{busy?'Creating…':'Create unit'}</button>
  </form>}
  {unit&&!creating&&<>
   <section className="fitness-panel"><div className="fitness-toolbar"><div><h2>{unit.title}</h2><p>{unit.start_date} to {unit.end_date} · All dates use China time</p></div><button disabled={!roster.length} onClick={()=>{try{printFitnessCards({unit,students:roster,course})}catch(e){setError(e.message)}}}>Print / Save workout cards as PDF</button></div>
    <div className="fitness-table-wrap"><table><caption>Weekly group rotation — repeats each week</caption><thead><tr><th>Group</th>{unit.weekdays.map(d=><th key={d}>{weekdays[d]}</th>)}</tr></thead><tbody>{[0,1,2,3].map(g=><tr key={g}><th>{groupName(g)}</th>{unit.weekdays.map((d,i)=><td key={d}>{unit.stations[(g+i)%4].name}</td>)}</tr>)}</tbody></table></div>
   </section>
   {studentMode?roster.map(person=><section key={person.id} className="fitness-panel"><h2>Your workout card</h2><p>Choose the group whose first teaching-day station you want. After your teacher confirms a completed workout, your group stays fixed for this unit.</p><div className="fitness-stations">{[0,1,2,3].map(g=><button disabled={busy||person.group_locked||today>unit.end_date} aria-pressed={person.group_index===g} key={g} onClick={()=>chooseGroup(person,g)}>{groupName(g)} · {unit.stations[g].name}{person.group_index===g?' ✓':''}<small>{data.group_counts?.[g]??0} students in this group</small></button>)}</div>
     {person.group_index!=null&&<><WorkoutCard student={person} unit={unit} course={course}/><p className="fitness-today"><strong>Today ({today}): </strong>{data.calendar.find(d=>d.date===today)?`${unit.stations[data.calendar.find(d=>d.date===today).stations[person.group_index]].name} — ${records.some(r=>r.date===today&&r.completed)?'Teacher confirmed complete':'Awaiting teacher check'}`:'No workout scheduled in this unit today.'}</p></>}
     <h3>Completion history</h3>{records.length?<ul>{records.map(r=><li key={r.date}>{r.date} · {unit.stations[r.station_index].name} · {r.completed?'Teacher confirmed complete':'Not checked complete'}</li>)}</ul>:<p>No workouts checked yet.</p>}
    </section>):<>
    <section className="fitness-panel"><h2>Daily completion checklist</h2><div className="fitness-controls"><label>Workout date<input type="date" value={date} max={today} min={unit.start_date} disabled={busy} onChange={e=>{if(discard()){setDate(e.target.value);setDirty({});setMessage('')}}}/></label><p>{date}: {dayStudents.filter(s=>completed(s.id)).length} / {dayStudents.length} grouped students checked complete</p></div>
     {roster.length>dayStudents.length&&<p><strong>{roster.length-dayStudents.length} students still need a rotation group.</strong> Record their choice in the list below before checking workouts.</p>}
     {!day?<p>No PE session scheduled on this date. Choose one of the four teaching days within the unit dates.</p>:!canCheck?<p>Future dates can be viewed but cannot be checked complete.</p>:null}
     {day&&<div className="fitness-stations">{unit.stations.map((station,index)=>{const people=dayStudents.filter(s=>day.stations[s.group_index]===index);return <section className="fitness-station" key={index}><h3>{station.name}</h3><p>{people.filter(s=>completed(s.id)).length} / {people.length} complete</p>{station.instructions&&<p className="fitness-instructions">{station.instructions}</p>}
      <button disabled={busy||!canCheck||!people.length} onClick={()=>people.forEach(s=>check(s.id,true))}>Check all at this station</button>
      {people.map(s=><label className="fitness-student-check" key={s.id}><input type="checkbox" disabled={busy||!canCheck} checked={completed(s.id)} onChange={e=>check(s.id,e.target.checked)}/><span>{s.name}<small>{groupName(s.group_index)} · ID {s.id}{saved.has(s.id)?' · Recorded':''}</small></span></label>)}{!people.length&&<p>No students in this station today.</p>}
     </section>})}</div>}
     <div className="fitness-save"><span>{hasChanges?`${Object.keys(dirty).length} unsaved changes`:'All completion checks saved'}</span><button className="fitness-primary" disabled={!hasChanges||busy||!canCheck} onClick={saveDay}>{busy?'Saving…':'Save daily checks'}</button></div><p>Only the teacher checks completion. An unchecked box means “not checked complete”; it does not record an absence or change a grade.</p>
    </section>
    <section className="fitness-panel"><h2>Student groups & unit progress</h2><p>Students choose their starting group in the Student Portal. You can also enter their choice here. Groups lock after a completed workout. Counts below include teacher-confirmed workouts across the whole unit.</p>
     <div className="fitness-table-wrap"><table><thead><tr><th>Student</th><th>Rotation group</th>{unit.stations.map((s,i)=><th key={i}>{s.name}</th>)}<th>Total</th></tr></thead><tbody>{roster.map(s=>{const done=records.filter(r=>r.student_id===s.id&&r.completed);return <tr key={s.id}><th>{s.name}<small>ID {s.id}</small></th><td><select aria-label={`Rotation group for ${s.name}, ID ${s.id}`} value={s.group_index??''} disabled={busy||s.group_locked} onChange={e=>chooseGroup(s,e.target.value)}><option value="" disabled>Choose group</option>{[0,1,2,3].map(g=><option key={g} value={g}>{groupName(g)} ({roster.filter(p=>p.group_index===g).length} students)</option>)}</select>{s.group_locked&&<small>Group fixed</small>}</td>{unit.stations.map((_,i)=><td key={i}>{done.filter(r=>r.station_index===i).length}</td>)}<td>{done.length}</td></tr>})}</tbody></table></div>{!roster.length&&<p>No students are enrolled in this class.</p>}
    </section>
   </>}
   
  </>}
 </div>
}
