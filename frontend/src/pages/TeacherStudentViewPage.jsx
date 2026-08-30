import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Eye, LogOut, BookOpen, ClipboardList, FileText } from "lucide-react"
import { useAuth } from "../AuthContext.jsx"
import authFetch from "../services/authFetch"

const cardStyle = {
  background: "#fff",
  border: "1px solid #d9e0ea",
  borderRadius: "14px",
  padding: "18px",
}

export default function TeacherStudentViewPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [students, setStudents] = useState([])
  const [courseId, setCourseId] = useState("")
  const [studentEmail, setStudentEmail] = useState("")
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    async function loadTeacherData() {
      try {
        setLoading(true)
        const response = await authFetch(`/api/teachers/${user?.id}/dashboard`)
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || "Could not open Student View")
        if (cancelled) return
        const nextCourses = Array.isArray(data.courses) ? data.courses : []
        setCourses(nextCourses)
        setStudents(Array.isArray(data.students) ? data.students : [])
        setCourseId(nextCourses[0]?.id ? String(nextCourses[0].id) : "")
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not open Student View")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadTeacherData()
    return () => { cancelled = true }
  }, [user?.id])

  const courseStudents = useMemo(() => {
    return students.filter((student) =>
      String(student.class_id) === String(courseId) ||
      String(student.master_course_id || "") === String(courseId)
    )
  }, [students, courseId])

  useEffect(() => {
    setStudentEmail(courseStudents[0]?.email || "")
    setDashboard(null)
  }, [courseId, courseStudents])

  useEffect(() => {
    if (!courseId || !studentEmail) return
    let cancelled = false
    async function loadPreview() {
      try {
        setLoading(true)
        setError("")
        const response = await authFetch(`/api/students/${encodeURIComponent(studentEmail)}/courses/${courseId}/dashboard`)
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || "Could not load this student preview")
        if (!cancelled) setDashboard(data)
      } catch (err) {
        if (!cancelled) {
          setDashboard(null)
          setError(err.message || "Could not load this student preview")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadPreview()
    return () => { cancelled = true }
  }, [courseId, studentEmail])

  const selectedStudent = courseStudents.find((student) => student.email === studentEmail)
  const assignments = Array.isArray(dashboard?.assignments) ? dashboard.assignments : []
  const lessons = Array.isArray(dashboard?.lessons) ? dashboard.lessons : []

  return (
    <div style={{ minHeight: "100vh", background: "#f4f7fb", fontFamily: "Arial, sans-serif" }}>
      <header style={{ background: "#172033", color: "white", padding: "18px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: 800, fontSize: "22px" }}><Eye size={24} /> Student View</div>
          <div style={{ marginTop: "5px", color: "#cbd5e1" }}>Read-only preview — students cannot be changed from this screen.</div>
        </div>
        <button onClick={() => navigate("/dashboard")} style={{ border: 0, borderRadius: "10px", padding: "12px 16px", fontWeight: 800, cursor: "pointer", display: "flex", gap: "8px", alignItems: "center" }}>
          <LogOut size={18} /> Exit Student View
        </button>
      </header>

      <main style={{ maxWidth: "1180px", margin: "0 auto", padding: "24px" }}>
        <section style={{ ...cardStyle, marginBottom: "18px" }}>
          <h1 style={{ marginTop: 0 }}>Preview a Student Course</h1>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" }}>
            <label style={{ fontWeight: 700 }}>Course
              <select value={courseId} onChange={(event) => setCourseId(event.target.value)} style={{ display: "block", width: "100%", marginTop: "8px", padding: "11px", borderRadius: "8px" }}>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.title || course.class_name}</option>)}
              </select>
            </label>
            <label style={{ fontWeight: 700 }}>Student
              <select value={studentEmail} onChange={(event) => setStudentEmail(event.target.value)} style={{ display: "block", width: "100%", marginTop: "8px", padding: "11px", borderRadius: "8px" }}>
                {courseStudents.map((student) => <option key={`${student.id}-${student.class_id}`} value={student.email}>{student.name || student.email}</option>)}
              </select>
            </label>
          </div>
        </section>

        {loading && <section style={cardStyle}>Loading student preview…</section>}
        {error && <section style={{ ...cardStyle, borderColor: "#ef4444", color: "#991b1b" }}>{error}</section>}
        {!loading && !error && courseStudents.length === 0 && <section style={cardStyle}>No students are enrolled in this course yet.</section>}

        {!loading && !error && dashboard && (
          <>
            <section style={{ ...cardStyle, marginBottom: "18px" }}>
              <div style={{ color: "#64748b", fontWeight: 700 }}>STUDENT PORTAL PREVIEW</div>
              <h2 style={{ fontSize: "30px", margin: "8px 0" }}>{dashboard.course?.title || "Course"}</h2>
              <p style={{ margin: 0, color: "#475569" }}>Viewing as {selectedStudent?.name || studentEmail}</p>
              {dashboard.course?.description && <p style={{ lineHeight: 1.6 }}>{dashboard.course.description}</p>}
            </section>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "18px" }}>
              <section style={cardStyle}>
                <h2 style={{ display: "flex", gap: "9px", alignItems: "center" }}><FileText size={22} /> Lessons</h2>
                {lessons.length === 0 ? <p>No lessons posted yet.</p> : lessons.map((lesson) => (
                  <article key={lesson.id} style={{ borderTop: "1px solid #e2e8f0", padding: "14px 0" }}>
                    <strong>{lesson.title}</strong>
                    {lesson.content && <p style={{ color: "#475569", lineHeight: 1.5 }}>{lesson.content}</p>}
                  </article>
                ))}
              </section>

              <section style={cardStyle}>
                <h2 style={{ display: "flex", gap: "9px", alignItems: "center" }}><ClipboardList size={22} /> Assignments</h2>
                {assignments.length === 0 ? <p>No assignments posted yet.</p> : assignments.map((assignment) => (
                  <article key={assignment.id} style={{ borderTop: "1px solid #e2e8f0", padding: "14px 0" }}>
                    <strong>{assignment.title || assignment.name}</strong>
                    <p style={{ marginBottom: 0, color: "#475569" }}>{assignment.due_date ? `Due: ${new Date(assignment.due_date).toLocaleDateString()}` : "No due date"}</p>
                  </article>
                ))}
              </section>
            </div>

            <section style={{ ...cardStyle, marginTop: "18px", display: "flex", gap: "10px", alignItems: "center", color: "#475569" }}>
              <BookOpen size={22} /> This preview is read-only. Submission, upload, and grading controls are intentionally unavailable.
            </section>
          </>
        )}
      </main>
    </div>
  )
}
