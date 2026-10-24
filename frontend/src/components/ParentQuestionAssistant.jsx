import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import authFetch from '../services/authFetch'
import API_BASE from '../apiBase'
import { beijingDateTime } from '../services/assignmentTime.js'
import { parentQuestions, questionIntent, courseItems, missingWork, upcomingWork, lowerMarkWork, numericScore } from '../services/parentQuestions.js'

const box = { border: '1px solid #cbd5e1', borderRadius: 12, padding: 12, background: '#fff', font: 'inherit' }
const button = { ...box, cursor: 'pointer', color: '#173c53', fontWeight: 700 }
const statusText = { Present: ['出勤','Present'], Absent: ['缺勤','Absent'], Late: ['迟到','Late'], Excused: ['已获准请假','Excused'] }

export default function ParentQuestionAssistant({ students, enrollments, observerEmail, language, onLanguageChange, onOpenCourse }) {
  const zh = language === 'zh'
  const navigate = useNavigate()
  const [child, setChild] = useState('')
  const [courseId, setCourseId] = useState('')
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const sequence = useRef(0)
  const activeChild = child || (students.length === 1 ? students[0].student_email : '')
  const courses = [...new Map(enrollments.filter(row => String(row.student_email || '').trim().toLowerCase() === activeChild)
    .filter(row => row.class_id).map(row => [String(row.class_id), row])).values()]
  const text = (cn, en) => zh ? cn : en
  useEffect(() => () => { sequence.current += 1 }, [])
  function clearAnswer() { sequence.current += 1; setResult(null); setError(''); setBusy(false) }
  async function ask(value) {
    setQuestion(value)
    const questionZh = /[\u3400-\u9fff]/.test(value)
    onLanguageChange(questionZh ? 'zh' : 'en')
    const text = (cn, en) => questionZh ? cn : en
    const id = ++sequence.current
    const intent = questionIntent(value)
    setResult(null); setError('')
    if (!intent) { setBusy(false); setError(text('暂时无法理解这个问题，请点选下方的问题，或一次只问一件事。','Please choose a suggested question, or ask about one topic at a time.')); return }
    if (intent === 'calendar') { setBusy(false); navigate('/calendar'); return }
    if (!activeChild) { setBusy(false); setError(text('请先选择您要查看的孩子。','Choose the child you want to ask about first.')); return }
    const selected = courseId ? courses.filter(row => String(row.class_id) === courseId) : courses
    if (!selected.length) { setBusy(false); setError(text('该孩子暂无可查看的课程，请联系学校。','No linked courses are available. Please contact the school.')); return }
    setBusy(true)
    try {
      const responses = await Promise.allSettled(selected.map(async course => {
        const path = `/api/observers/${encodeURIComponent(observerEmail)}/students/${encodeURIComponent(activeChild)}/courses/${course.class_id}`
        const response = await authFetch(`${path}/${intent === 'attendance' ? 'attendance' : 'dashboard'}`)
        if (!response.ok) throw new Error('load')
        return { course, data: await response.json() }
      }))
      if (id !== sequence.current) return
      const loaded = responses.filter(r => r.status === 'fulfilled').map(r => r.value)
      if (!loaded.length) throw new Error('load')
      const items = loaded.flatMap(({data,course}) => courseItems(data, course))
      let rows = []
      if (intent === 'missing') rows = missingWork(items)
      if (intent === 'upcoming') rows = upcomingWork(items)
      if (intent === 'work') rows = lowerMarkWork(items)
      if (intent === 'feedback') rows = items.filter(item => String(item.submission?.feedback || '').trim())
      if (intent === 'attendance') rows = loaded.flatMap(({ data, course }) => (data.records || []).map(record => ({...record, course}))).sort((a,b) => b.date.localeCompare(a.date))
      setResult({ intent, rows, loaded, partial: loaded.length < selected.length, checkedAt: new Date().toISOString(), child: students.find(s => s.student_email === activeChild)?.student_name || activeChild })
    } catch {
      if (id === sequence.current) setError(text('无法加载记录，请重试。暂时无法确认结果。','Records could not be loaded. Please retry; the answer is not yet known.'))
    } finally { if (id === sequence.current) setBusy(false) }
  }
  function open(course, section) { onOpenCourse(course, activeChild, section) }
  const itemCard = item => <article key={`${item.course.class_id}-${item.assignment.id}`} style={box}>
    <strong>{item.assignment.title}</strong><div>{item.course.class_name}</div>
    {item.assignment.due_date && <div>{text('截止：','Due: ')}{beijingDateTime(item.assignment.due_date).replace('T',' ')} {text('北京时间','Beijing time')}</div>}
    {numericScore(item) !== null && <div>{text('得分：','Score: ')}{numericScore(item)}%</div>}
    {item.submission?.feedback && <p style={{whiteSpace:'pre-wrap'}}>{text('教师原文评语：','Original teacher feedback: ')}{item.submission.feedback}</p>}
    {result.intent === 'work' && <>
      {item.submission?.content && <div style={{whiteSpace:'pre-wrap', maxHeight:240, overflow:'auto', marginBlock:12}}>{item.submission.content}</div>}
      {(item.submission?.files || []).map(file => {
        const path = String(file.file_path || '')
        // Only link file paths delivered by the authorized course endpoint.
        if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f]/.test(path)) return null
        return <p key={file.id}><a href={`${API_BASE}${path}`} target="_blank" rel="noreferrer">{text('查看学生作品：','View student work: ')}{file.file_name || text('附件','Attachment')}</a></p>
      })}
      {!item.submission?.content && !item.submission?.files?.length && <p>{text('此作业有成绩，但暂无可查看的学生作品附件或文本。','A mark is recorded, but no student work file or text is available.')}</p>}
    </>}
    <button type="button" style={button} onClick={() => open(item.course, 'observer-student-work')}>{text('打开该课程的作业','Open course work')} →</button>
  </article>
  return <section aria-labelledby="parent-question-title" style={{...box, padding:20, background:'#f0f7fa', marginBottom:20}}>
    <h2 id="parent-question-title" style={{marginTop:0}}>{text('家长问一问','Ask about your child')} <span style={{fontSize:14,fontWeight:400}}>中文 / English</span></h2>
    <p>{text('可输入中文或英文，也可点选问题。答案仅来自您所选孩子的可查看记录。','Type in Chinese or English, or tap a question. Answers use visible records for your selected child.')}</p>
    <div style={{display:'flex', flexWrap:'wrap', gap:12, marginBottom:12}}>
      <label>{text('孩子：','Child: ')}<select style={box} value={activeChild} onChange={e => {clearAnswer();setChild(e.target.value);setCourseId('')}}>
        <option value="">{text('请选择孩子','Choose a child')}</option>
        {students.map(s => <option key={s.student_email} value={s.student_email}>{s.student_name}</option>)}
      </select></label>
      <label>{text('范围：','Scope: ')}<select style={box} value={courseId} onChange={e => {clearAnswer();setCourseId(e.target.value)}}>
        <option value="">{text('所有关联课程','All linked courses')}</option>
        {courses.map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)}
      </select></label>
    </div>
    <form onSubmit={e => {e.preventDefault(); if (question.trim()) ask(question)}} style={{display:'flex',flexWrap:'wrap',gap:8}}>
      <label htmlFor="parent-question" style={{width:'100%'}}>{text('您想了解什么？','What would you like to know?')}</label>
      <input id="parent-question" value={question} maxLength={400} onChange={e => setQuestion(e.target.value)} placeholder={text('例如：我的女儿有多少作业没交？','For example: How many assignments is my child missing?')} style={{...box, flex:'1 1 240px', minWidth:0}} />
      <button style={button} disabled={busy || !question.trim()}>{busy ? text('查询中…','Checking…') : text('查询','Ask')}</button>
    </form>
    <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:12}}>{parentQuestions.map(q => <button key={q.id} type="button" disabled={busy} style={{...button, fontSize:14}} onClick={() => ask(q[zh ? 'zh' : 'en'])}>{q[zh ? 'zh' : 'en']}</button>)}</div>
    {busy && <p role="status">{text('正在查询所选孩子的记录…','Checking records for the selected child…')}</p>}
    {error && <p role="alert">{error}</p>}
    {result && <div role="region" aria-label={text('查询结果','Answer')} aria-live="polite" style={{marginTop:16}}>
      <h3>{result.child} · {text('查询结果','Answer')}</h3>
      {result.partial && <p role="alert">{text('部分课程加载失败，以下仅为已加载课程的结果，不能作为完整统计。','Some courses could not load. These results are incomplete.')}</p>}
      {result.intent === 'missing' && <p>{text(`已加载课程中有 ${result.rows.length} 份作业逾期未交。已提交待评分或待审核的作业不计入缺交。`,`There are ${result.rows.length} overdue, unsubmitted assignments in the loaded courses. Work awaiting marking or approval is excluded.`)}</p>}
      {result.intent === 'upcoming' && <p>{text(`未来七天有 ${result.rows.length} 份尚未提交的作业到期。`,`There are ${result.rows.length} unsubmitted assignments due in the next seven days.`)}</p>}
      {result.intent === 'work' && <p>{text('以下为已评分作业中分数最低的最多三份，供查看学习情况；不代表课程不及格。作品和教师评语保留原文。','Up to three lowest-mark graded assignments are shown. This does not mean the child is failing the course. Work and feedback remain in their original language.')}</p>}
      {result.intent === 'feedback' && <p>{text('以下为可查看的教师评语（原文）；现有记录不提供评语时间，未按最新排序。','Available teacher feedback is shown in its original language. Feedback timestamps are unavailable, so this is not a newest-first list.')}</p>}
      {['missing','upcoming','work','feedback'].includes(result.intent) && <div style={{display:'grid',gap:10}}>{result.rows.map(itemCard)}{!result.rows.length && <p>{text('没有符合此查询的记录。','No matching records are available.')}</p>}</div>}
      {result.intent === 'attendance' && <>
        <p>{text('范围：所选课程全部已记录日期。缺勤按“日期＋课程”计次，同一天多门课可能分别记录。无记录不表示出勤。','Scope: all recorded dates in the selected courses. Absences are counted per class and date; several classes may record the same day. No record does not mean present.')}</p>
        <p>{text('缺勤：','Absent: ')}{result.rows.filter(r => r.status === 'Absent').length} · {text('迟到：','Late: ')}{result.rows.filter(r => r.status === 'Late').length} · {text('请假：','Excused: ')}{result.rows.filter(r => r.status === 'Excused').length}</p>
        {!result.rows.length ? <p>{text('暂无考勤记录。','No attendance records are available.')}</p> : <div style={{maxHeight:360,overflow:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr>{[text('日期','Date'),text('课程','Course'),text('记录','Status')].map(t => <th key={t} scope="col">{t}</th>)}</tr></thead><tbody>{result.rows.map((r,i) => <tr key={`${r.course.class_id}-${r.date}-${i}`}><td>{r.date}</td><td>{r.course.class_name}</td><td>{statusText[r.status]?.[zh ? 0 : 1] || text('其他记录','Other record')}</td></tr>)}</tbody></table></div>}
      </>}
      {['grades','lessons'].includes(result.intent) && <div style={{display:'grid',gap:10}}>{result.loaded.map(({course,data}) => <article style={box} key={course.class_id}><strong>{course.class_name}</strong>
        {result.intent === 'grades' && <p>{text('当前加权成绩：','Current weighted standing: ')}{data.gradebook?.current_percent == null ? text('暂无成绩','Not available') : `${data.gradebook.current_percent}%`}</p>}
        <button type="button" style={button} onClick={() => open(course,result.intent === 'grades' ? 'observer-student-gradebook' : 'observer-student-lessons')}>{text('打开详情','Open details')} →</button>
      </article>)}</div>}
      <small>{text('查询时间：','Checked: ')}{beijingDateTime(result.checkedAt).replace('T',' ')} {text('北京时间','Beijing time')}</small>
    </div>}
  </section>
}
