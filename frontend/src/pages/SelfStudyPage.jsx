import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import authFetch from '../services/authFetch';
import { addStudyDays, beijingToday, ipadStatusLabel, studyDays, studyDateRange, loadStudyDateRange } from '../services/selfStudyCalendar.js';
import './SelfStudyPage.css';
const emptyDraft = date => ({ study_date: date, course_id: '', ipad_status: '', notes: '' });
const dayLabel = date => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
export default function SelfStudyPage() {
  const { user } = useAuth(), navigate = useNavigate();
  const canPost = ['admin', 'teacher'].includes(user?.role);
  const [date, setDate] = useState(beijingToday), [view, setView] = useState('week');
  const [endDate,setEndDate] = useState(()=>studyDays(beijingToday(),'week').at(-1));
  const [notices, setNotices] = useState([]), [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [refresh, setRefresh] = useState(0), [editing, setEditing] = useState(null), [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(() => emptyDraft(beijingToday())), [saving, setSaving] = useState(false), [formError, setFormError] = useState('');
  const formRef = useRef(null), days = view === 'range' ? studyDateRange(date,endDate) : studyDays(date, view), from = days[0], to = days.at(-1);
  function shiftDates(count) { setDate(addStudyDays(from,count)); if(view==='range')setEndDate(addStudyDays(to,count)); }
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    loadStudyDateRange(from,to,async(start,end)=>{
      const response=await authFetch(`/api/self-study/notices?from=${start}&to=${end}`,{signal:controller.signal});
      const data=await response.json();if(!response.ok)throw Error(data.error || 'Could not load self-study notices.');
      return data;
    }).then(entries=>{if(!controller.signal.aborted)setNotices(entries);})
      .catch(error=>{if(!controller.signal.aborted){setNotices([]);setError(error.message);}})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return () => controller.abort();
  }, [from, to, refresh]);
  useEffect(() => {
    if (!canPost) return;
    let active = true;
    authFetch('/api/self-study/courses').then(async response => {
      const data = await response.json(); if (!response.ok) throw Error(data.error || 'Could not load courses.');
      if (active) setCourses(data.courses || []);
    }).catch(error => { if (active) setFormError(error.message); });
    return () => { active = false; };
  }, [canPost]);
  useEffect(() => {
    const reload = () => setRefresh(current => current + 1);
    window.addEventListener('focus', reload); return () => window.removeEventListener('focus', reload);
  }, []);
  function openEditor(notice = null) {
    setEditing(notice?.id || null); setDraft(notice ? { study_date: notice.study_date, course_id: String(notice.course_id), ipad_status: notice.ipad_status, notes: notice.notes || '' } : emptyDraft(date));
    setFormError(''); setMessage(''); setEditorOpen(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }
  async function save(event) {
    event.preventDefault(); setSaving(true); setFormError('');
    try {
      const response = await authFetch(`/api/self-study/notices${editing ? `/${editing}` : ''}`, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const data = await response.json(); if (!response.ok) throw Error(data.error || 'Could not post notice.');
      setDate(draft.study_date); setEditorOpen(false); setMessage('Notice posted to the shared self-study calendar.'); setRefresh(current => current + 1);
    } catch (error) { setFormError(error.message); } finally { setSaving(false); }
  }
  async function cancel(notice) {
    if (!window.confirm(`Cancel the ${notice.course_title} self-study notice for ${notice.study_date}?`)) return;
    setSaving(true); setError('');
    try {
      const response = await authFetch(`/api/self-study/notices/${notice.id}/cancel`, { method: 'POST' });
      const data = await response.json(); if (!response.ok) throw Error(data.error || 'Could not cancel notice.');
      setMessage('Notice cancelled.'); setRefresh(current => current + 1);
    } catch (error) { setError(error.message); } finally { setSaving(false); }
  }
  return <main className="self-study-page">
    <header className="self-study-header">
      <div><h1>Self-study iPads</h1><p>Daily and weekly iPad plans from course teachers. Visible to all BC teachers, Chinese homeroom teachers, students and parents in your school.</p></div>
      <div className="self-study-actions"><button onClick={() => navigate(user?.role === 'parent' ? '/parent' : user?.role === 'observer' ? '/observer' : user?.role === 'student' ? '/student' : user?.role === 'admin' ? '/admin' : '/dashboard')}>Back to portal</button><button onClick={() => navigate(user?.role === 'admin' ? '/admin/calendar' : '/calendar')}>School Calendar</button>{canPost && <button className="self-study-primary" onClick={() => openEditor()}>Post iPad notice</button>}</div>
    </header>
    {message && <p role="status" className="self-study-success">{message}</p>}
    {error && <p role="alert" className="self-study-error">{error}</p>}
    {canPost && editorOpen && <form ref={formRef} onSubmit={save} className="self-study-editor">
      <h2>{editing ? 'Edit self-study notice' : 'Post self-study notice'}</h2>
      <p>Teacher: <strong>{editing ? notices.find(notice => notice.id === editing)?.teacher_name || user?.name || 'Teacher' : user?.name || 'You'}</strong></p>
      <div className="self-study-form-grid">
        <label>Date (Beijing time)<input type="date" required value={draft.study_date} onChange={event => setDraft(current => ({ ...current, study_date: event.target.value }))} /></label>
        <label>Course / class<select required value={draft.course_id} onChange={event => setDraft(current => ({ ...current, course_id: event.target.value }))}><option value="">Choose a course / class</option>{courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
        <label>iPad requirement<select required value={draft.ipad_status} onChange={event => setDraft(current => ({ ...current, ipad_status: event.target.value }))}><option value="">Choose requirement</option><option value="needed">Need iPad for Self Study · 自习需要 iPad</option><option value="not_needed">Do Not Need iPad for Self Study · 自习不需要 iPad</option></select></label>
      </div>
      <label>Optional note<textarea maxLength={1000} rows={3} value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="For example: Complete the online practice quiz." /></label>
      <p>Posting again for the same date and course updates your existing notice.</p>
      {formError && <p role="alert" className="self-study-error">{formError}</p>}
      <div className="self-study-actions"><button className="self-study-primary" disabled={saving || !courses.length}>{saving ? 'Saving…' : 'Post notice for everyone'}</button><button type="button" disabled={saving} onClick={() => setEditorOpen(false)}>Close</button></div>
      {!courses.length && <p>No teaching courses are available. Ask an administrator to check your course assignments.</p>}
    </form>}
    <section className="self-study-toolbar" aria-label="Calendar controls">
      <div className="self-study-actions"><button aria-pressed={view === 'day'} onClick={() => setView('day')}>Daily</button><button aria-pressed={view === 'week'} onClick={() => setView('week')}>Weekly</button></div>
      <div className="self-study-actions"><button disabled={!days.length} aria-label="Previous date range" onClick={()=>shiftDates(-days.length)}>← Previous</button>
        <label>Start date<input aria-label="Start date" type="date" value={view==='range'?date:from} onChange={event=>{const next=event.target.value;if(next){setDate(next);setEndDate(to&&to>=next?to:next);setView('range');}}}/></label>
        <label>End date<input aria-label="End date" type="date" min={view==='range'?date:from} value={view==='range'?endDate:to} onChange={event=>{if(event.target.value){setDate(from||date);setEndDate(event.target.value);setView('range');}}}/></label>
        <button disabled={!days.length} aria-label="Next date range" onClick={()=>shiftDates(days.length)}>Next →</button><button onClick={()=>{setDate(beijingToday());if(view==='range')setEndDate(beijingToday());}}>Today</button><button onClick={()=>setRefresh(current=>current+1)}>Refresh</button></div>

    </section>
    <p><strong>{days.length ? (from === to ? dayLabel(from) : `${dayLabel(from)} – ${dayLabel(to)}`) : 'Choose a valid date range'}</strong> · Beijing dates · Up to 31 days</p>
    <p>No notice does not mean “no iPad needed.” If any of your courses says an iPad is needed, bring it and follow your teachers’ instructions.</p>
    {loading ? <p role="status">Loading self-study notices…</p> : !error && <div className={`self-study-days ${view === 'day' ? 'self-study-daily' : ''}`}>
      {days.map(day => {
        const entries = notices.filter(notice => notice.study_date === day);
        return <section key={day} className="self-study-day"><h2>{dayLabel(day)}</h2>
          {!entries.length && <p className="self-study-empty">No notice posted · 尚无通知</p>}
          {entries.map(notice => <article key={notice.id} className={`self-study-notice ${notice.ipad_status === 'needed' ? 'ipad-needed' : 'ipad-not-needed'}`}>
            <strong>{ipadStatusLabel(notice.ipad_status)}</strong><div>{notice.ipad_status === 'needed' ? '自习需要 iPad' : '自习不需要 iPad'}</div>
            <h3>{notice.course_title}</h3><p>Teacher: {notice.teacher_name}</p>
            {notice.notes && <p className="self-study-note">{notice.notes}</p>}
            {canPost && notice.can_edit && <div className="self-study-actions"><button disabled={saving} onClick={() => openEditor(notice)}>Edit</button><button disabled={saving} onClick={() => cancel(notice)}>Cancel notice</button></div>}
          </article>)}
        </section>;
      })}
    </div>}
  </main>;
}
