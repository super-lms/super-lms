import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import API_BASE from "../../apiBase"

export default function AdminCourseStudentsPage() {
  const { courseId } = useParams()

  const [course, setCourse] = useState(null)
  const [students, setStudents] = useState([])
  const [searchText, setSearchText] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isCancelled = false

    async function loadStudents() {
      try {
        setLoading(true)
        setError("")

        const response = await fetch(`${API_BASE}/api/admin/courses/${courseId}/students`)
        const data = await response.json()

        if (!response.ok || data?.success === false) {
          throw new Error(data?.error || "Failed to load course students")
        }

        if (!isCancelled) {
          setCourse(data?.course || null)
          setStudents(Array.isArray(data?.students) ? data.students : [])
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || "Failed to load course students")
          setCourse(null)
          setStudents([])
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadStudents()

    return () => {
      isCancelled = true
    }
  }, [courseId])

  const filteredStudents = useMemo(() => {
    const query = searchText.trim().toLowerCase()

    if (!query) return students

    return students.filter((student) => {
      const name = String(student?.student_name || "").toLowerCase()
      const email = String(student?.student_email || "").toLowerCase()

      return name.includes(query) || email.includes(query)
    })
  }, [students, searchText])

  const courseTitle = course?.title || `Course ${courseId}`

  return (
    <div>
      <Link to={`/admin/courses/${encodeURIComponent(String(courseId))}`} style={backLinkStyle}>
        ← Back to Course Workspace
      </Link>

      <div style={heroStyle}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#6b7280", marginBottom: "8px" }}>
          Administrator Course Workspace
        </div>

        <h1 style={{ margin: 0, fontSize: "30px", color: "#111827" }}>
          Students
        </h1>

        <p style={{ margin: "10px 0 0 0", color: "#4b5563", fontSize: "16px", lineHeight: 1.5 }}>
          {courseTitle}
        </p>
      </div>

      {loading ? <div style={noticeStyle}>Loading students...</div> : null}

      {error ? <div style={errorStyle}>{error}</div> : null}

      {!loading && !error ? (
        <>
          <div style={summaryGridStyle}>
            <div style={summaryCardStyle}>
              <div style={summaryLabelStyle}>Enrolled Students</div>
              <div style={summaryValueStyle}>{students.length}</div>
            </div>

            <div style={summaryCardStyle}>
              <div style={summaryLabelStyle}>Visible Students</div>
              <div style={summaryValueStyle}>{filteredStudents.length}</div>
            </div>
          </div>

          <div style={searchBoxStyle}>
            <label style={searchLabelStyle}>Search students</label>
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search by name or email"
              style={searchInputStyle}
            />
          </div>

          {filteredStudents.length === 0 ? (
            <div style={noticeStyle}>No students found for this course.</div>
          ) : (
            <div style={studentListStyle}>
              {filteredStudents.map((student) => (
                <div key={student.id || student.student_email} style={studentCardStyle}>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#111827" }}>
                    {student.student_name || "Unnamed Student"}
                  </div>

                  <div style={{ marginTop: "6px", color: "#4b5563", fontSize: "14px" }}>
                    {student.student_email || "No email"}
                  </div>

                  <div style={metaStyle}>
                    Student User ID: {student.student_user_id || student.id || "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

const backLinkStyle = {
  display: "inline-block",
  marginBottom: "18px",
  color: "#111827",
  textDecoration: "none",
  fontWeight: 700,
}

const heroStyle = {
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "16px",
  padding: "24px",
}

const noticeStyle = {
  marginTop: "18px",
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "12px",
  padding: "14px",
  color: "#374151",
}

const errorStyle = {
  ...noticeStyle,
  border: "1px solid #d1a1a1",
  background: "#fff8f8",
  color: "#7f1d1d",
}

const summaryGridStyle = {
  marginTop: "20px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "14px",
}

const summaryCardStyle = {
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "14px",
  padding: "18px",
}

const summaryLabelStyle = {
  fontSize: "13px",
  fontWeight: 800,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
}

const summaryValueStyle = {
  marginTop: "8px",
  fontSize: "30px",
  fontWeight: 900,
  color: "#111827",
}

const searchBoxStyle = {
  marginTop: "18px",
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "14px",
  padding: "18px",
}

const searchLabelStyle = {
  display: "block",
  fontSize: "14px",
  fontWeight: 800,
  color: "#374151",
  marginBottom: "8px",
}

const searchInputStyle = {
  width: "100%",
  maxWidth: "520px",
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  padding: "11px 12px",
  fontSize: "16px",
  boxSizing: "border-box",
}

const studentListStyle = {
  marginTop: "18px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "14px",
}

const studentCardStyle = {
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "14px",
  padding: "18px",
}

const metaStyle = {
  marginTop: "12px",
  fontSize: "13px",
  color: "#6b7280",
}
