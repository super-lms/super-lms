import { useEffect, useMemo, useState } from "react"
import { useAuth } from "../AuthContext.jsx"
import authFetch from "../services/authFetch"

export default function EmergencyAssignmentImportPage() {
  const { user } = useAuth()
  const [sourceCourses, setSourceCourses] = useState([])
  const [targetCourses, setTargetCourses] = useState([])
  const [sourceTeacherEmail, setSourceTeacherEmail] = useState("")
  const [sourceCourseId, setSourceCourseId] = useState("")
  const [targetCourseId, setTargetCourseId] = useState("")
  const [preview, setPreview] = useState([])
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState([])
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([
      authFetch("/api/emergency-assignment/courses").then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d.courses || [] }),
      authFetch(`/api/teachers/${user.id}/dashboard`).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d.courses || [] }),
    ]).then(([source, target]) => { setSourceCourses(source); setTargetCourses(target) }).catch((error) => setMessage(error.message || "Could not load classes."))
  }, [user.id])

  const sourceTeachers = useMemo(() => {
    const teachers = new Map()
    sourceCourses.forEach((course) => {
      const email = String(course.teacher_email || "").trim().toLowerCase()
      if (email && !teachers.has(email)) teachers.set(email, course.teacher_name || email)
    })
    return Array.from(teachers, ([email, name]) => ({ email, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [sourceCourses])

  const teacherCourses = useMemo(() => sourceCourses.filter((course) =>
    String(course.teacher_email || "").trim().toLowerCase() === sourceTeacherEmail
  ), [sourceCourses, sourceTeacherEmail])

  useEffect(() => {
    if (sourceTeachers.length === 1) setSourceTeacherEmail(sourceTeachers[0].email)
  }, [sourceTeachers])

  async function previewImport() {
    if (!sourceCourseId) return setMessage("Choose an Emergency Assignment class first.")
    setBusy(true); setMessage("")
    try {
      const response = await authFetch(`/api/emergency-assignment/courses/${sourceCourseId}/submissions`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      const submissions = data.submissions || []
      setPreview(submissions)
      setSelectedSubmissionIds(submissions.map((item) => Number(item.id)))
      setMessage(`${submissions.length} submission(s) ready to review.`)
    } catch (error) { setMessage(error.message || "Preview failed.") } finally { setBusy(false) }
  }

  async function runImport() {
    if (!sourceCourseId || !targetCourseId) return setMessage("Choose both the source and destination classes.")
    if (!selectedSubmissionIds.length) return setMessage("Choose at least one submission to import.")
    if (!window.confirm(`Import ${selectedSubmissionIds.length} selected submission(s) into SUPER LMS? Existing imports will be skipped.`)) return
    setBusy(true); setMessage("")
    try {
      const response = await authFetch("/api/emergency-assignment/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceCourseId, targetCourseId, submissionIds: selectedSubmissionIds }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setMessage(`Import complete: ${data.imported} added, ${data.skipped} already imported or skipped.`)
    } catch (error) { setMessage(error.message || "Import failed.") } finally { setBusy(false) }
  }

  const box = { background: "white", border: "1px solid #ddd", borderRadius: 12, padding: 20, marginBottom: 18 }
  const field = { width: "100%", padding: 12, margin: "8px 0 16px", boxSizing: "border-box" }
  const button = { padding: "12px 18px", marginRight: 10, cursor: busy ? "not-allowed" : "pointer" }

  return <div style={{ maxWidth: 900, margin: "0 auto" }}>
    <div style={box}>
      <h1>Import from Emergency Assignment</h1>
      <p>Choose the Emergency Assignment teacher and class, preview its submissions, then choose the SUPER LMS class that should receive them. The connection runs securely between the two servers.</p>
      <label>Emergency Assignment teacher</label>
      <select style={field} value={sourceTeacherEmail} onChange={(e) => { setSourceTeacherEmail(e.target.value); setSourceCourseId(""); setPreview([]); setSelectedSubmissionIds([]) }}>
        <option value="">Choose teacher</option>
        {sourceTeachers.map((teacher) => <option key={teacher.email} value={teacher.email}>{teacher.name}</option>)}
      </select>
      <label>Emergency Assignment class</label>
      <select style={field} value={sourceCourseId} disabled={!sourceTeacherEmail} onChange={(e) => { setSourceCourseId(e.target.value); setPreview([]); setSelectedSubmissionIds([]) }}>
        <option value="">{sourceTeacherEmail ? "Choose class" : "Choose a teacher first"}</option>
        {teacherCourses.map((course) => <option key={course.id} value={course.id}>{course.course_name} ({course.submission_count} submission{course.submission_count === 1 ? "" : "s"})</option>)}
      </select>
      <button style={button} disabled={busy} onClick={previewImport}>{busy ? "Working..." : "Preview submissions"}</button>
    </div>
    {preview.length > 0 && <div style={box}>
      <h2>Choose submissions ({selectedSubmissionIds.length} of {preview.length} selected)</h2>
      <div style={{ marginBottom: 12 }}>
        <button type="button" style={button} disabled={busy || selectedSubmissionIds.length === preview.length} onClick={() => setSelectedSubmissionIds(preview.map((item) => Number(item.id)))}>Select all</button>
        <button type="button" style={button} disabled={busy || selectedSubmissionIds.length === 0} onClick={() => setSelectedSubmissionIds([])}>Clear all</button>
      </div>
      <div style={{ border: "1px solid #ddd", borderRadius: 8, maxHeight: 420, overflowY: "auto", marginBottom: 18 }}>
        {preview.map((item) => {
          const itemId = Number(item.id)
          const checked = selectedSubmissionIds.includes(itemId)
          return <label key={item.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 12, borderBottom: "1px solid #eee", cursor: "pointer" }}>
            <input type="checkbox" checked={checked} onChange={() => setSelectedSubmissionIds((current) => checked ? current.filter((id) => id !== itemId) : [...current, itemId])} />
            <span><strong>{item.assignment_title}</strong><br />{item.student_name} — {item.original_file_name}</span>
          </label>
        })}
      </div>
      <label>Destination SUPER LMS class</label>
      <select style={field} value={targetCourseId} onChange={(e) => setTargetCourseId(e.target.value)}>
        <option value="">Choose destination class</option>
        {targetCourses.map((course) => <option key={course.id} value={course.id}>{course.title || course.course_name}</option>)}
      </select>
      <button style={button} disabled={busy || selectedSubmissionIds.length === 0} onClick={runImport}>{busy ? "Importing..." : `Import ${selectedSubmissionIds.length} selected submission${selectedSubmissionIds.length === 1 ? "" : "s"}`}</button>
    </div>}
    {message && <div style={box}>{message}</div>}
  </div>
}
