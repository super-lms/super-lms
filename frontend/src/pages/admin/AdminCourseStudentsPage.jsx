import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import authFetch from "../../services/authFetch"

const emptyEnrollForm = {
  name: "",
  email: "",
  student_id: "",
  parent_email: "",
}

export default function AdminCourseStudentsPage() {
  const { courseId } = useParams()

  const [course, setCourse] = useState(null)
  const [students, setStudents] = useState([])
  const [searchText, setSearchText] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [enrollForm, setEnrollForm] = useState(emptyEnrollForm)
  const [enrollMessage, setEnrollMessage] = useState("")
  const [enrollError, setEnrollError] = useState("")
  const [enrolling, setEnrolling] = useState(false)

  async function loadStudents() {
    try {
      setLoading(true)
      setError("")

      const response = await authFetch(`/api/admin/courses/${courseId}/students`)
      const data = await response.json()

      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || "Failed to load course students")
      }

      setCourse(data?.course || null)
      setStudents(Array.isArray(data?.students) ? data.students : [])
    } catch (err) {
      setError(err.message || "Failed to load course students")
      setCourse(null)
      setStudents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isCancelled = false

    async function loadSafely() {
      if (isCancelled) return
      await loadStudents()
    }

    loadSafely()

    return () => {
      isCancelled = true
    }
  }, [courseId])

  function updateEnrollForm(field, value) {
    setEnrollForm((current) => ({
      ...current,
      [field]: value,
    }))
    setEnrollMessage("")
    setEnrollError("")
  }

  async function handleEnrollStudent(event) {
    event.preventDefault()

    const cleanStudent = {
      name: String(enrollForm.name || "").trim(),
      email: String(enrollForm.email || "").trim().toLowerCase(),
      student_id: String(enrollForm.student_id || "").trim(),
      parent_email: String(enrollForm.parent_email || "").trim().toLowerCase(),
    }

    if (!cleanStudent.name) {
      setEnrollError("Student name is required.")
      return
    }

    if (!cleanStudent.email) {
      setEnrollError("Student email is required.")
      return
    }

    try {
      setEnrolling(true)
      setEnrollMessage("")
      setEnrollError("")

      const response = await authFetch(`/api/class-roster/${courseId}/students`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanStudent),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data?.error || "Failed to enroll student")
      }

      setEnrollForm(emptyEnrollForm)
      setEnrollMessage(data?.message || "Student enrolled successfully.")
      await loadStudents()
    } catch (err) {
      setEnrollError(err.message || "Failed to enroll student.")
    } finally {
      setEnrolling(false)
    }
  }

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

          <form onSubmit={handleEnrollStudent} style={formBoxStyle}>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "22px", color: "#111827" }}>
              Enroll Student in This Course
            </h2>

            <p style={{ margin: "0 0 16px 0", color: "#4b5563", lineHeight: 1.5 }}>
              Add an existing student or create/enroll a student directly into this course roster.
            </p>

            <div style={formGridStyle}>
              <div>
                <label style={searchLabelStyle}>Student Name</label>
                <input
                  value={enrollForm.name}
                  onChange={(event) => updateEnrollForm("name", event.target.value)}
                  placeholder="Example: David Fang"
                  disabled={enrolling}
                  style={searchInputStyle}
                />
              </div>

              <div>
                <label style={searchLabelStyle}>Student Email</label>
                <input
                  type="email"
                  value={enrollForm.email}
                  onChange={(event) => updateEnrollForm("email", event.target.value)}
                  placeholder="student@school.ca"
                  disabled={enrolling}
                  style={searchInputStyle}
                />
              </div>

              <div>
                <label style={searchLabelStyle}>Student ID</label>
                <input
                  value={enrollForm.student_id}
                  onChange={(event) => updateEnrollForm("student_id", event.target.value)}
                  placeholder="Optional student ID"
                  disabled={enrolling}
                  style={searchInputStyle}
                />
              </div>

              <div>
                <label style={searchLabelStyle}>Parent Email</label>
                <input
                  type="email"
                  value={enrollForm.parent_email}
                  onChange={(event) => updateEnrollForm("parent_email", event.target.value)}
                  placeholder="Optional parent email"
                  disabled={enrolling}
                  style={searchInputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: "16px" }}>
              <button type="submit" disabled={enrolling} style={primaryButtonStyle}>
                {enrolling ? "Enrolling Student..." : "Enroll Student"}
              </button>
            </div>

            {enrollMessage ? <div style={noticeStyle}>{enrollMessage}</div> : null}
            {enrollError ? <div style={errorStyle}>{enrollError}</div> : null}
          </form>

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

const formBoxStyle = {
  marginTop: "18px",
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "14px",
  padding: "18px",
}

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "14px",
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

const primaryButtonStyle = {
  border: "1px solid #111827",
  background: "#111827",
  color: "white",
  borderRadius: "10px",
  padding: "11px 16px",
  fontSize: "15px",
  fontWeight: 800,
  cursor: "pointer",
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
