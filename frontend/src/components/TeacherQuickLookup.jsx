import { useMemo, useRef, useState } from 'react'
import { lookupStudents, quickLookupGradebookPath } from '../services/teacherQuickLookup.js'

export default function TeacherQuickLookup({students,courses,teacherId,onOpen}) {
  const searchRef = useRef(null)
  const storageKey = `super-lms-teacher-lookup:${teacherId}`
  const [query,setQuery] = useState(() => {try {return sessionStorage.getItem(storageKey) || ''} catch {return ''}})
  const matches = useMemo(() => lookupStudents(students,courses,query),[students,courses,query])
  function update(value) {setQuery(value);try {sessionStorage.setItem(storageKey,value)} catch { /* Search remains usable without browser storage. */ }}
  return <section className="panel" aria-labelledby="teacher-quick-lookup-title">
    <h2 id="teacher-quick-lookup-title" style={{marginTop:0}}>Quick Look Up</h2>
    <p>Find a student by name or email across your cohort classes, then open their editable gradebook.</p>
    <label className="form-label" htmlFor="teacher-student-lookup">Student name or email</label>
    <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:10}}>
      <input ref={searchRef} id="teacher-student-lookup" type="search" className="form-input" autoComplete="off" maxLength={120} value={query} onChange={event => update(event.target.value)} placeholder="Type a first name, last name, Chinese name, or email…" style={{width:'100%',maxWidth:640}} />
      {query.length > 0 ? <button type="button" onClick={() => {update('');searchRef.current?.focus()}} style={{padding:'10px 14px',border:'1px solid #64748b',borderRadius:8,background:'#fff',color:'#1e40af',font:'inherit',fontWeight:700,cursor:'pointer'}}>Clear search</button> : null}
    </div>
    {query.trim() && <>
      <p role="status">{matches.length ? `${matches.length} matching student ${matches.length === 1 ? 'class' : 'classes'}. Choose the cohort class to open.` : 'No matching students in your assigned classes. Try another name or email.'}</p>
      <div style={{display:'grid',gap:8,maxHeight:380,overflowY:'auto'}}>
        {matches.map(student => <button key={`${student.id || student.email}:${student.classId}`} type="button" onClick={() => onOpen(quickLookupGradebookPath(student))} style={{padding:14,border:'1px solid #cbd5e1',borderRadius:10,background:'#fff',textAlign:'left',font:'inherit',cursor:'pointer',display:'flex',gap:12,justifyContent:'space-between',alignItems:'center',flexWrap:'wrap'}}>
          <span><strong>{student.name}</strong><span style={{display:'block',fontSize:14,color:'#4b5563'}}>{student.email}</span><span style={{display:'block',marginTop:4}}>{student.courseTitle}</span></span>
          <span style={{fontWeight:700}}>Open Gradebook →</span>
        </button>)}
      </div>
    </>}
  </section>
}
