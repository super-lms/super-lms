import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../AuthContext.jsx"
import API_BASE from "../apiBase"

function toArray(value) {
  return Array.isArray(value) ? value : []
}

function Card({ children, onClick, active = false }) {
  const Tag = onClick ? "button" : "div"

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{
        border: active ? "2px solid #111827" : "1px solid #d7dce5",
        borderRadius: "16px",
        padding: "16px",
        background: "#ffffff",
        textAlign: "left",
        font: "inherit",
        cursor: onClick ? "pointer" : "default",
        boxShadow: "0 1px 2px rgba(16, 24, 40, 0.05)",
        width: "100%",
      }}
    >
      {children}
    </Tag>
  )
}

function MetricCard({ title, value }) {
  return (
    <Card>
      <div style={{ fontWeight: 800, marginBottom: "8px" }}>{title}</div>
      <div style={{ fontSize: "2rem", fontWeight: 900 }}>{value}</div>
    </Card>
  )
}

function InfoLine({ label, value }) {
  return (
    <div style={{ marginBottom: "6px" }}>
      <strong>{label}:</strong> {value || "-"}
    </div>
  )
}

export default function ObserverPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [observerData, setObserverData] = useState({
    observer: null,
    students: [],
    submissions: [],
  })

  const [selectedStudentEmail, setSelectedStudentEmail] = useState("")
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [viewMode, setViewMode] = useState("students")

  function handleLogout() {
    logout()
    navigate("/login", { replace: true })
  }

  useEffect(() => {
    async function loadObserverData() {
      if (!user?.email) {
        setError("No observer email found.")
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError("")

        const response = await fetch(
          `${API_BASE}/api/observers/${encodeURIComponent(user.email)}/dashboard`
        )

        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error((data && data.error) || "Failed to load observer dashboard")
        }

        setObserverData({
          observer: data?.observer || null,
          students: toArray(data?.students),
          submissions: toArray(data?.submissions),
        })
      } catch (err) {
        setError(err.message || "Failed to load observer dashboard")
      } finally {
        setLoading(false)
      }
    }

    loadObserverData()
  }, [user?.email])

  const uniqueStudents = useMemo(() => {
    const map = new Map()

    observerData.students.forEach((student) => {
      const email = String(student.student_email || "").trim().toLowerCase()
      if (!email) return

      if (!map.has(email)) {
        map.set(email, {
          student_name: student.student_name || email,
          student_email: email,
          student_id: student.student_id || "",
        })
      }
    })

    return Array.from(map.values()).sort((a, b) =>
      String(a.student_name || "").localeCompare(String(b.student_name || ""))
    )
  }, [observerData.students])

  const selectedStudent = useMemo(() => {
    return uniqueStudents.find((student) => student.student_email === selectedStudentEmail) || null
  }, [uniqueStudents, selectedStudentEmail])

  const coursesForSelectedStudent = useMemo(() => {
    const map = new Map()

    observerData.students.forEach((student) => {
      const email = String(student.student_email || "").trim().toLowerCase()
      if (email !== selectedStudentEmail) return

      const classId = String(student.class_id || "")
      if (!classId) return

      map.set(classId, {
        class_id: classId,
        class_name: student.class_name || `Course ${classId}`,
      })
    })

    return Array.from(map.values()).sort((a, b) =>
      String(a.class_name || "").localeCompare(String(b.class_name || ""))
    )
  }, [observerData.students, selectedStudentEmail])

  const selectedCourse = useMemo(() => {
    return coursesForSelectedStudent.find((course) => String(course.class_id) === String(selectedCourseId)) || null
  }, [coursesForSelectedStudent, selectedCourseId])

  const courseSubmissions = useMemo(() => {
    return observerData.submissions.filter((submission) => {
      return (
        String(submission.student_email || "").trim().toLowerCase() === selectedStudentEmail &&
        String(submission.class_id || "") === String(selectedCourseId)
      )
    })
  }, [observerData.submissions, selectedStudentEmail, selectedCourseId])

  const gradedSubmissions = courseSubmissions.filter((submission) => {
    return submission.score !== null && submission.score !== undefined && submission.score !== ""
  })

  const missingSubmissions = courseSubmissions.filter((submission) => {
    return submission.score === null || submission.score === undefined || submission.score === ""
  })

  const averageScore =
    gradedSubmissions.length > 0
      ? Math.round(
          gradedSubmissions.reduce((sum, submission) => sum + Number(submission.score || 0), 0) /
            gradedSubmissions.length
        )
      : null

  function openStudent(student) {
    setSelectedStudentEmail(student.student_email)
    setSelectedCourseId("")
    setViewMode("courses")
  }

  function openCourse(course) {
    setSelectedCourseId(course.class_id)
    setViewMode("progress")
  }

  function backToStudents() {
    setViewMode("students")
    setSelectedStudentEmail("")
    setSelectedCourseId("")
  }

  function backToCourses() {
    setViewMode("courses")
    setSelectedCourseId("")
  }

  return (
    <div className="page">
      <div style={topBarStyle}>
        <div>
          <h1 style={{ marginBottom: "6px" }}>Observer Portal</h1>
          <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.5 }}>
            Select a student, choose a course, then review progress and evidence.
          </p>
        </div>

        <button type="button" onClick={handleLogout} style={logoutButtonStyle}>
          Logout
        </button>
      </div>

      {loading ? <p>Loading observer portal...</p> : null}
      {error ? <p style={{ color: "#991b1b" }}>{error}</p> : null}

      {!loading && !error && viewMode === "students" ? (
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>My Students</h2>

          {uniqueStudents.length === 0 ? (
            <p>No linked students found. Ask the school office to link students to this observer email.</p>
          ) : (
            <div style={cardGridStyle}>
              {uniqueStudents.map((student) => (
                <Card key={student.student_email} onClick={() => openStudent(student)}>
                  <div style={{ fontSize: "1.2rem", fontWeight: 900 }}>{student.student_name}</div>
                  <div style={{ marginTop: "6px", color: "#4b5563" }}>{student.student_email}</div>
                  <div style={{ marginTop: "12px", fontWeight: 800 }}>Open Student →</div>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!loading && !error && viewMode === "courses" && selectedStudent ? (
        <section style={sectionStyle}>
          <button type="button" onClick={backToStudents} style={backButtonStyle}>
            ← Back to Students
          </button>

          <h2 style={sectionTitleStyle}>{selectedStudent.student_name}</h2>
          <p style={{ marginTop: 0, color: "#4b5563" }}>
            Choose a course to view progress, assignments, grades, feedback, and missing work.
          </p>

          {coursesForSelectedStudent.length === 0 ? (
            <p>No courses found for this student.</p>
          ) : (
            <div style={cardGridStyle}>
              {coursesForSelectedStudent.map((course) => (
                <Card key={course.class_id} onClick={() => openCourse(course)}>
                  <div style={{ fontSize: "1.2rem", fontWeight: 900 }}>{course.class_name}</div>
                  <div style={{ marginTop: "8px", color: "#4b5563" }}>
                    Course progress and learning evidence.
                  </div>
                  <div style={{ marginTop: "12px", fontWeight: 800 }}>Open Course →</div>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!loading && !error && viewMode === "progress" && selectedStudent && selectedCourse ? (
        <div style={{ display: "grid", gap: "18px" }}>
          <section style={sectionStyle}>
            <button type="button" onClick={backToCourses} style={backButtonStyle}>
              ← Back to Courses
            </button>

            <h2 style={sectionTitleStyle}>{selectedCourse.class_name}</h2>
            <p style={{ marginTop: 0, color: "#4b5563" }}>
              Progress view for {selectedStudent.student_name}.
            </p>

            <div style={metricGridStyle}>
              <MetricCard title="Visible Assignments" value={courseSubmissions.length} />
              <MetricCard title="Missing / Needs Attention" value={missingSubmissions.length} />
              <MetricCard title="Average Score" value={averageScore === null ? "N/A" : `${averageScore}%`} />
            </div>
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Missing Work / Needs Attention</h2>

            {missingSubmissions.length === 0 ? (
              <p>No missing or ungraded work found for this course.</p>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {missingSubmissions.map((submission) => (
                  <Card key={`missing-${submission.id}`}>
                    <div style={{ fontWeight: 900 }}>{submission.assignment_title || "Assignment"}</div>
                    <InfoLine label="Status" value="Missing, ungraded, or needs teacher attention" />
                    <InfoLine label="Feedback" value={submission.feedback || "No feedback yet"} />
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Student Work, Grades, Feedback, and Attachments</h2>

            {courseSubmissions.length === 0 ? (
              <p>No assignments or submissions found for this course.</p>
            ) : (
              <div style={{ display: "grid", gap: "14px" }}>
                {courseSubmissions.map((submission) => (
                  <Card key={submission.id}>
                    <div style={{ fontSize: "1.1rem", fontWeight: 900, marginBottom: "8px" }}>
                      {submission.assignment_title || "Assignment"}
                    </div>

                    <div style={{ marginTop: "8px", marginBottom: "8px", lineHeight: 1.5 }}>
                      {submission.content || "No text submission"}
                    </div>

                    <InfoLine
                      label="Score"
                      value={
                        submission.score !== null && submission.score !== undefined && submission.score !== ""
                          ? String(submission.score)
                          : "Not graded"
                      }
                    />
                    <InfoLine label="Grade" value={submission.grade || "Not graded"} />
                    <InfoLine label="Feedback" value={submission.feedback || "No feedback yet"} />

                    {toArray(submission.files).length > 0 ? (
                      <div style={{ marginTop: "10px" }}>
                        <strong>Attachments:</strong>
                        <div style={{ display: "grid", gap: "6px", marginTop: "6px" }}>
                          {submission.files.map((file) => (
                            <a
                              key={file.id}
                              href={`${API_BASE}${file.file_path}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: "#111827",
                                textDecoration: "underline",
                                fontWeight: 700,
                              }}
                            >
                              {file.file_name || "Attached file"}
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}

const topBarStyle = {
  marginBottom: "24px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
}

const sectionStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "18px",
  padding: "18px",
  background: "#f8fafc",
}

const sectionTitleStyle = {
  marginTop: 0,
  marginBottom: "14px",
  fontSize: "1.35rem",
}

const cardGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "14px",
}

const metricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
}

const logoutButtonStyle = {
  border: "1px solid #111",
  background: "#ffffff",
  color: "#111",
  borderRadius: "10px",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: "1rem",
}

const backButtonStyle = {
  border: "1px solid #111827",
  borderRadius: "10px",
  background: "#ffffff",
  padding: "10px 14px",
  font: "inherit",
  fontWeight: 800,
  cursor: "pointer",
  marginBottom: "14px",
}
