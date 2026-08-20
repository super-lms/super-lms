import { useEffect, useState } from "react"
import { useAuth } from "../AuthContext.jsx"
import authFetch from "../services/authFetch"

export default function EmergencyAssignmentImportPage() {
  const { user } = useAuth()
  const [sourceCourses, setSourceCourses] = useState([])
  const [targetCourses, setTargetCourses] = useState([])
  const [sourceCourseId, setSourceCourseId] = useState("")
  const [targetCourseId, setTargetCourseId] = useState("")
  const [preview, setPreview] = useState([])
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([
      authFetch("/api/emergency-assignment/courses").then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d.courses || [] }),
      authFetch(`/api/teachers/${user.id}/dashboard`).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d.courses || [] }),
    ]).then(([source, target]) => { setSourceCourses(source); setTargetCourses(target) }).catch((error) => setMessage(error.message || "Could not load classes."))
  }, [user.id])

  async function previewImport() {
    if (!sourceCourseId) return setMessage("Choose an Emergency Assignment class first.")
    setBusy(true); setMessage("")
    try {
      const response = await authFetch(`/api/emergency-assignment/courses/${sourceCourseId}/submissions`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setPreview(data.submissions || [])
      setMessage(`${(data.submissions || []).length} submission(s) ready to review.`)
    } catch (error) { setMessage(error.message || "Preview failed.") } finally { setBusy(false) }
  }

  async function runImport() {
    if (!sourceCourseId || !targetCourseId) return setMessage("Choose both the source and destination classes.")
    if (!window.confirm("Import these submissions into SUPER LMS? Existing imports will be skipped.")) return
    setBusy(true); setMessage("")
    try {
      const response = await authFetch("/api/emergency-assignment/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceCourseId, targetCourseId }) })
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
      <p>Choose the Emergency Assignment class, preview its submissions, then choose the SUPER LMS class that should receive them. The connection runs securely between the two servers.</p>
      <label>Emergency Assignment class</label>
      <select style={field} value={sourceCourseId} onChange={(e) => { setSourceCourseId(e.target.value); setPreview([]) }}>
        <option value="">Choose source class</option>
        {sourceCourses.map((course) => <option key={course.id} value={course.id}>{course.teacher_name} — {course.course_name} ({course.submission_count})</option>)}
      </select>
      <button style={button} disabled={busy} onClick={previewImport}>{busy ? "Working..." : "Preview submissions"}</button>
    </div>
    {preview.length > 0 && <div style={box}>
      <h2>Ready to import ({preview.length})</h2>
      {preview.slice(0, 20).map((item) => <p key={item.id}><strong>{item.assignment_title}</strong> — {item.student_name} — {item.original_file_name}</p>)}
      {preview.length > 20 && <p>And {preview.length - 20} more…</p>}
      <label>Destination SUPER LMS class</label>
      <select style={field} value={targetCourseId} onChange={(e) => setTargetCourseId(e.target.value)}>
        <option value="">Choose destination class</option>
        {targetCourses.map((course) => <option key={course.id} value={course.id}>{course.title || course.course_name}</option>)}
      </select>
      <button style={button} disabled={busy} onClick={runImport}>{busy ? "Importing..." : "Import from Emergency Assignment"}</button>
    </div>}
    {message && <div style={box}>{message}</div>}
  </div>
}
