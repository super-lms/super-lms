import { useEffect, useMemo, useState } from 'react';
import authFetch from '../services/authFetch';
import { COMPETENCIES_SURVEY_ID, buildSurveyReportRows, buildSurveyPrintHtml,
  formatSurveyDate, surveyAnswerLines } from '../services/surveyReports';
import './SurveyReflectionReports.css';

async function getJson(url) {
  const response = await authFetch(url);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Unable to load reports. Please try again.');
  return body;
}

export default function SurveyReflectionReports({ courses = [], initialCourseId = '', isAdmin, onBack }) {
  const [surveys, setSurveys] = useState([]), [surveyId, setSurveyId] = useState('');
  const [data, setData] = useState(null), [courseId, setCourseId] = useState(initialCourseId || 'whole-school');
  const [roster, setRoster] = useState(null), [rosterError, setRosterError] = useState('');
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [rosterLoading, setRosterLoading] = useState(false);
  const [search, setSearch] = useState(''), [reportedClass, setReportedClass] = useState(''), [status, setStatus] = useState('all');
  const [studentFilter, setStudentFilter] = useState('');
  const [selectedKey, setSelectedKey] = useState(''), [attemptId, setAttemptId] = useState('');
  const [reload, setReload] = useState(0), [printError, setPrintError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setLoading(true); setError(''); setData(null);
    getJson('/api/surveys/reports').then(body => {
      if (!active) return;
      const list = body.surveys || [];
      setSurveys(list);
      setSurveyId(previous => list.some(s => s.id === previous) ? previous :
        list.find(s => s.id === COMPETENCIES_SURVEY_ID)?.id || '');
      setLoading(false);
    }).catch(e => { if (active) { setError(e.message); setLoading(false); } });
    return () => { active = false; };
  }, [isAdmin, reload]);

  useEffect(() => {
    if (!isAdmin || !surveyId) return;
    let active = true;
    setLoading(true); setError(''); setData(null); setSelectedKey(''); setAttemptId('');
    getJson(`/api/surveys/reports/${encodeURIComponent(surveyId)}`).then(body => {
      if (active) { setData(body); setLoading(false); }
    }).catch(e => { if (active) { setError(e.message); setLoading(false); } });
    return () => { active = false; };
  }, [isAdmin, surveyId, reload]);

  useEffect(() => {
    setRoster(null); setRosterError(''); setSelectedKey(''); setAttemptId('');
    if (!isAdmin || !courseId) { setRosterLoading(false); return; }
    let active = true;
    setRosterLoading(true);
    getJson(courseId === 'whole-school' ? '/api/surveys/report-students' : `/api/classes/${encodeURIComponent(courseId)}/report-students`).then(body => {
      if (active) { setRoster(body.students || []); setRosterLoading(false); }
    }).catch(e => { if (active) { setRosterError(e.message); setRosterLoading(false); } });
    return () => { active = false; };
  }, [isAdmin, courseId, reload]);

  const rows = useMemo(() => buildSurveyReportRows(data?.responses || [], courseId ? roster || [] : null, courseId === 'whole-school'), [data, roster, courseId]);
  const classes = useMemo(() => [...new Set(rows.map(row => row.latest?.student.class).filter(Boolean))].sort(), [rows]);
  const filteredRows = useMemo(() => rows.filter(row => {
    const query = search.trim().toLowerCase();
    return (!studentFilter || row.key === studentFilter) && (!query || `${row.name} ${row.email} ${row.latest?.student.chineseName || ''}`.toLowerCase().includes(query)) &&
      (!reportedClass || row.latest?.student.class === reportedClass) && (status === 'all' || row.status === status);
  }), [rows, search, reportedClass, status, studentFilter]);
  const selectedRow = filteredRows.find(row => row.key === selectedKey);
  const selectedResponse = selectedRow?.responses.find(response => response.id === attemptId) || selectedRow?.latest;
  const printable = filteredRows.map(row => row.latest).filter(response => response?.readable);
  const ready = data && !loading && !rosterLoading && !rosterError && !error;
  const submittedCount = filteredRows.filter(row => row.latest).length;

  function resetSelection() { setSelectedKey(''); setAttemptId(''); setPrintError(''); }
  function printReports(responses) {
    setPrintError('');
    try {
      const html = buildSurveyPrintHtml(data.survey, responses);
      const printWindow = window.open('', '_blank');
      if (!printWindow) throw new Error('Allow popups for Super-LMS, then try Print / Save PDF again.');
      printWindow.opener = null;
      printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
      printWindow.focus(); printWindow.print();
    } catch (e) { setPrintError(e.message); }
  }
  if (!isAdmin) return <div className="reflection-reports"><h1>Competencies Self-Reflection</h1>
    <p role="alert">Survey reports are available to school administrators.</p><button onClick={onBack}>Back to other reports</button></div>;

  return <div className="reflection-reports">
    <div className="reflection-toolbar"><button onClick={onBack}>Back to other reports</button>
      <button onClick={() => { resetSelection(); setReload(n => n + 1); }}>Refresh submissions</button></div>
    <h1>Competencies Self-Reflection</h1>
    <p>View saved student responses and print individual or class reports. In the print dialog, choose <strong>Save as PDF</strong> to save a PDF.</p>
    <div className="reflection-filters">
      <label>Survey<select aria-label="Survey" value={surveyId} onChange={e => { resetSelection(); setData(null); setSurveyId(e.target.value); setStudentFilter(''); }}>
        <option value="">Select a survey</option>{surveys.map(survey => <option key={survey.id} value={survey.id}>{survey.title} ({survey.response_count} submissions)</option>)}
      </select></label>
      <label>Student list<select aria-label="Student list" value={courseId} onChange={e => { resetSelection(); setCourseId(e.target.value); setReportedClass(''); setStatus('all'); setStudentFilter(''); }}>
        <option value="whole-school">Whole school — all students</option><option value="">All submitted students</option>{courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
      </select></label>
      {!courseId && <label>Reported class<select aria-label="Reported class" value={reportedClass} onChange={e => { resetSelection(); setReportedClass(e.target.value); }}>
        <option value="">All reported classes</option>{classes.map(name => <option key={name}>{name}</option>)}
      </select></label>}
      <label>Student<select aria-label="Student" value={studentFilter} onChange={e => {
        resetSelection(); setStudentFilter(e.target.value); setSearch(''); setStatus('all'); setReportedClass(''); setSelectedKey(e.target.value);
      }}><option value="">All students in selected list</option>{rows.map(row => <option key={row.key} value={row.key}>{row.name}{row.email ? ` — ${row.email}` : ''}</option>)}</select></label>
      <label>Student name or email<input aria-label="Student name or email" value={search} onChange={e => { resetSelection(); setSearch(e.target.value); }} placeholder="Find a student" /></label>
      <label>Submission status<select aria-label="Submission status" value={status} onChange={e => { resetSelection(); setStatus(e.target.value); }}>
        <option value="all">All statuses</option><option value="submitted">Submitted</option><option value="pending" disabled={!courseId}>No matched submission</option>
      </select></label>
    </div>
    <p className="reflection-note">The whole-school list includes all student accounts plus survey respondents whose emails are not in the directory. Existing cohort lists are still available. Students without a matched submission are included. Matching uses the email students supplied; this public survey does not verify identity. Reports use each submission’s saved questions. For repeat submissions, the latest is selected by default and earlier submissions remain available.</p>
    {loading && <p role="status">Loading survey reports…</p>}
    {rosterLoading && <p role="status">Loading student list…</p>}
    {(error || rosterError || printError) && <p role="alert" className="reflection-error">{error || rosterError || printError}</p>}
    {!loading && !surveyId && <p role="status">Select a survey to view its reports. No survey is automatically substituted if the Competencies Self-Reflection survey is unavailable.</p>}
    {ready && <>
      <div className="reflection-toolbar"><p role="status">{submittedCount} students with submissions{courseId ? ` · ${filteredRows.length - submittedCount} without a matched submission` : ''} · {printable.length} printable reports</p>
        <button disabled={!printable.length} onClick={() => printReports(printable)}>Print / Save PDF — filtered students ({printable.length})</button></div>
      {submittedCount > printable.length && <p role="alert">Some saved submissions cannot be read and are excluded from batch printing. Open each affected record for details.</p>}
      {!filteredRows.length ? <p>No students match these filters.</p> : <div className="reflection-table-scroll"><table>
        <thead><tr><th>Student</th><th>Reported class</th><th>Status</th><th>Latest submission</th><th>Reports</th></tr></thead>
        <tbody>{filteredRows.map(row => <tr key={row.key}>
          <td><strong>{row.name}</strong><br />{row.email || 'No roster email'}</td><td>{row.latest?.student.class || '—'}</td>
          <td>{row.latest ? 'Submitted' : 'No matched submission'}{row.latest && !row.latest.readable ? ' — needs review' : ''}</td>
          <td>{row.latest ? formatSurveyDate(row.latest.created) : '—'}</td>
          <td>{row.latest ? <><button onClick={() => { setSelectedKey(row.key); setAttemptId(row.latest.id); setPrintError(''); }}>View report</button>
            <span> {row.responses.length} submission{row.responses.length === 1 ? '' : 's'}</span></> : 'No submitted report'}</td>
        </tr>)}</tbody>
      </table></div>}
      {selectedResponse && <div className="reflection-preview" aria-label="Student self-reflection report">
        <div className="reflection-toolbar"><label>Submission<select aria-label="Submission" value={selectedResponse.id} onChange={e => setAttemptId(e.target.value)}>
          {selectedRow.responses.map((response, i) => <option key={response.id} value={response.id}>{i === 0 ? 'Latest — ' : ''}{formatSurveyDate(response.created)} — {response.id.slice(0, 8)}</option>)}
        </select></label><button disabled={!selectedResponse.readable} onClick={() => printReports([selectedResponse])}>Print / Save PDF — this student</button></div>
        {!selectedResponse.readable ? <p role="alert">This stored response could not be fully read. Ask an administrator to review response {selectedResponse.id}. No answers have been changed.</p> : <article>
          <h2>{data.survey.title}</h2><h3>{selectedResponse.student.name} {selectedResponse.student.chineseName}</h3>
          <p>{selectedResponse.student.email}<br />Grade {selectedResponse.student.grade} · Class {selectedResponse.student.class}<br />Submitted {formatSurveyDate(selectedResponse.created)}</p>
          {selectedResponse.questions.map((question, i) => <section key={question.id}><h4>{i + 1}. {question.title}</h4>
            {surveyAnswerLines(question, selectedResponse.answers[question.id]).map((line, j) => <p className="reflection-answer" key={j}>{line}</p>)}</section>)}
          <p className="reflection-note">Response ID: {selectedResponse.id}. Student self-reflection; details supplied by the respondent.</p>
        </article>}
      </div>}
    </>}
  </div>;
}
