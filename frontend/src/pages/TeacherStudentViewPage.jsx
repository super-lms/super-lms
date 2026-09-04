import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Eye, LogOut, BookOpen, ClipboardList, FileText } from "lucide-react"
import { useAuth } from "../AuthContext.jsx"
import authFetch from "../services/authFetch"
import API_BASE from "../apiBase"
import { FormattedText } from "../components/RichText.jsx"
import CourseModulesView from "../components/CourseModulesView.jsx"

const cardStyle = {
  background: "#fff",
  border: "1px solid #d9e0ea",
  borderRadius: "14px",
  padding: "18px",
}

export default function TeacherStudentViewPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedCourseId = searchParams.get("courseId") || ""
  const [courses, setCourses] = useState([])
  const [students, setStudents] = useState([])
  const [courseId, setCourseId] = useState("")
  const [studentEmail, setStudentEmail] = useState("")
  const [dashboard, setDashboard] = useState(null)
  const [modules, setModules] = useState([])
  const [classResources, setClassResources] = useState([])
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
        const requestedCourse = nextCourses.find((course) =>
          [course.id, course.master_course_id, course.content_course_id]
            .filter(Boolean)
            .some((id) => String(id) === String(requestedCourseId))
        )
        const initialCourse = requestedCourse || nextCourses[0]
        setCourseId(initialCourse?.id ? String(initialCourse.id) : "")
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not open Student View")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadTeacherData()
    return () => { cancelled = true }
  }, [user?.id, requestedCourseId])

  const courseStudents = useMemo(() => {
    return students.filter((student) =>
      String(student.class_id) === String(courseId) ||
      String(student.master_course_id || "") === String(courseId)
    )
  }, [students, courseId])

  const selectedCourse = courses.find((course) => String(course.id) === String(courseId))
  const contentCourseId = selectedCourse?.content_course_id || selectedCourse?.master_course_id || courseId

  useEffect(() => {
    setStudentEmail(courseStudents[0]?.email || "")
    setDashboard(null)
  }, [courseId, courseStudents])

  useEffect(() => {
    let cancelled = false
    if (!contentCourseId) {
      setClassResources([])
      return undefined
    }
    authFetch(`/api/courses/${contentCourseId}/resources`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || "Could not load class resources")
        if (!cancelled) setClassResources(Array.isArray(data.resources) ? data.resources : [])
      })
      .catch((err) => { if (!cancelled) setError(err.message || "Could not load class resources") })
    return () => { cancelled = true }
  }, [contentCourseId])

  useEffect(() => {
    if (!courseId || !studentEmail) return
    let cancelled = false
    async function loadPreview() {
      try {
        setLoading(true)
        setError("")
        const [response, modulesResponse] = await Promise.all([
          authFetch(`/api/students/${encodeURIComponent(studentEmail)}/courses/${courseId}/dashboard`),
          authFetch(`/api/courses/${contentCourseId}/modules`),
        ])
        const [data, modulesData] = await Promise.all([
          response.json().catch(() => ({})),
          modulesResponse.json().catch(() => ([])),
        ])
        if (!response.ok) throw new Error(data.error || "Could not load this student preview")
        if (!modulesResponse.ok) throw new Error(modulesData.error || "Could not load module preview")
        if (!cancelled) {
          setDashboard(data)
          setModules((modulesData || []).filter((module) => module.is_published))
        }
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
  }, [courseId, contentCourseId, studentEmail])

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
              <select value={courseId} onChange={(event) => {
                const nextCourseId = event.target.value
                setCourseId(nextCourseId)
                navigate(`/student-view?courseId=${encodeURIComponent(nextCourseId)}`, { replace: true })
              }} style={{ display: "block", width: "100%", marginTop: "8px", padding: "11px", borderRadius: "8px" }}>
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
              {dashboard.course?.description && <FormattedText value={dashboard.course.description} style={{ marginTop: "14px" }} />}
            </section>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "18px" }}>
              <section style={cardStyle}>
                <h2 style={{ display: "flex", gap: "9px", alignItems: "center" }}><FileText size={22} /> Lessons</h2>
                {lessons.length === 0 ? <p>No lessons posted yet.</p> : lessons.map((lesson) => {
                  const lessonFiles = Array.isArray(lesson.files) ? lesson.files : []
                  return (
                    <article key={lesson.id} style={{ borderTop: "1px solid #e2e8f0", padding: "14px 0" }}>
                      <strong>{lesson.title}</strong>
                      {lesson.content && <FormattedText value={lesson.content} style={{ color: "#475569", marginTop: "8px" }} />}
                      {lessonFiles.length > 0 && (
                        <div style={{ marginTop: "12px" }}>
                          <div style={{ fontWeight: 800, marginBottom: "8px" }}>Lesson Resources</div>
                          <ul style={{ margin: 0, paddingLeft: "20px" }}>
                            {lessonFiles.map((file) => (
                              <li key={file.id || file.file_path || file.original_name} style={{ marginBottom: "7px" }}>
                                <a href={`${API_BASE}${file.file_path}`} target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", fontWeight: 700 }}>
                                  {file.original_name || file.filename || "Download resource"}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </article>
                  )
                })}
              </section>

              <section style={cardStyle}>
                <h2 style={{ display: "flex", gap: "9px", alignItems: "center" }}><ClipboardList size={22} /> Assignments</h2>
                {assignments.length === 0 ? <p>No assignments posted yet.</p> : assignments.map((assignment) => (
                  <article key={assignment.id} style={{ borderTop: "1px solid #e2e8f0", padding: "14px 0" }}>
                    <strong>{assignment.title || assignment.name}</strong>
                    {assignment.description && <FormattedText value={assignment.description} style={{ color: "#475569", marginTop: "8px" }} />}
                    <p style={{ marginBottom: 0, color: "#475569" }}>{assignment.due_date ? `Due: ${new Date(assignment.due_date).toLocaleDateString()}` : "No due date"}</p>
                  </article>
                ))}
              </section>
            </div>

            <section style={{ ...cardStyle, marginTop: "18px" }}>
              <h2>Class Resources</h2>
              {classResources.length === 0 ? <p>No general class resources have been posted yet.</p> : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {classResources.map((resource) => (
                    <div key={resource.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "12px 14px", border: "1px solid #d9e0ea", borderRadius: "10px", flexWrap: "wrap" }}>
                      <strong>{resource.original_name || "Class resource"}</strong>
                      <a href={`${API_BASE}${resource.file_path}`} download={resource.original_name || true} style={{ padding: "9px 12px", borderRadius: "8px", background: "#172033", color: "white", fontWeight: 800, textDecoration: "none" }}>
                        Download to Device
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={{ ...cardStyle, marginTop: "18px" }}>
              <h2>Course Modules</h2>
              <CourseModulesView modules={modules} />
            </section>

            <section style={{ ...cardStyle, marginTop: "18px", display: "flex", gap: "10px", alignItems: "center", color: "#475569" }}>
              <BookOpen size={22} /> This preview is read-only. Submission, upload, and grading controls are intentionally unavailable.
            </section>
          </>
        )}
      </main>
    </div>
  )
}
