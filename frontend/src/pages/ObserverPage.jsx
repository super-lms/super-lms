import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../AuthContext.jsx"
import API_BASE from "../apiBase"

function DetailCard({ title, children }) {
  return (
    <div
      style={{
        border: "1px solid #d7dce5",
        borderRadius: "14px",
        padding: "16px",
        background: "#ffffff",
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: "12px", fontSize: "1.15rem" }}>{title}</h2>
      {children}
    </div>
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
  const [selectedCourseId, setSelectedCourseId] = useState("all")

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

        const students = Array.isArray(data?.students) ? data.students : []

        setObserverData({
          observer: data?.observer || null,
          students,
          submissions: Array.isArray(data?.submissions) ? data.submissions : [],
        })

        if (!selectedStudentEmail && students.length > 0) {
          setSelectedStudentEmail(String(students[0].student_email || "").toLowerCase())
        }
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

  useEffect(() => {
    if (selectedCourseId === "all") return

    const courseStillAvailable = coursesForSelectedStudent.some((course) => {
      return String(course.class_id) === String(selectedCourseId)
    })

    if (!courseStillAvailable) {
      setSelectedCourseId("all")
    }
  }, [coursesForSelectedStudent, selectedCourseId])

  const filteredSubmissions = useMemo(() => {
    return observerData.submissions.filter((submission) => {
      const studentMatches =
        !selectedStudentEmail ||
        String(submission.student_email || "").trim().toLowerCase() === selectedStudentEmail

      const courseMatches =
        selectedCourseId === "all" ||
        String(submission.class_id || "") === String(selectedCourseId)

      return studentMatches && courseMatches
    })
  }, [observerData.submissions, selectedStudentEmail, selectedCourseId])

  const gradedSubmissions = filteredSubmissions.filter((submission) => {
    return submission.score !== null && submission.score !== undefined && submission.score !== ""
  })

  const ungradedSubmissions = filteredSubmissions.filter((submission) => {
    return submission.score === null || submission.score === undefined || submission.score === ""
  })

  const averageScore = gradedSubmissions.length > 0
    ? Math.round(
        gradedSubmissions.reduce((sum, submission) => sum + Number(submission.score || 0), 0) /
          gradedSubmissions.length
      )
    : null

  return (
    <div className="page">
      <div style={topBarStyle}>
        <div>
          <h1 style={{ marginBottom: "6px" }}>Homeroom Observer Portal</h1>
          <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.5 }}>
            Monitor linked students, courses, assignments, grades, feedback, and attachments.
          </p>
        </div>

        <button type="button" onClick={handleLogout} style={logoutButtonStyle}>
          Logout
        </button>
      </div>

      {loading ? <p>Loading homeroom observer dashboard...</p> : null}
      {error ? <p style={{ color: "#991b1b" }}>{error}</p> : null}

      {!loading && !error ? (
        <div style={{ display: "grid", gap: "18px" }}>
          <DetailCard title="Observer Information">
            <InfoLine label="Name" value={observerData.observer?.name || user?.name || "Observer"} />
            <InfoLine label="Email" value={observerData.observer?.email || user?.email || ""} />
            <InfoLine label="Role" value={observerData.observer?.role || user?.role || "observer"} />
          </DetailCard>

          <DetailCard title="Student & Course Filters">
            {uniqueStudents.length === 0 ? (
              <p style={{ margin: 0 }}>
                No linked students found. Ask the school office to link students to this observer email.
              </p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "14px" }}>
                <div>
                  <label style={labelStyle}>Student</label>
                  <select
                    value={selectedStudentEmail}
                    onChange={(event) => {
                      setSelectedStudentEmail(event.target.value)
                      setSelectedCourseId("all")
                    }}
                    style={inputStyle}
                  >
                    {uniqueStudents.map((student) => (
                      <option key={student.student_email} value={student.student_email}>
                        {student.student_name} — {student.student_email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Course</label>
                  <select
                    value={selectedCourseId}
                    onChange={(event) => setSelectedCourseId(event.target.value)}
                    style={inputStyle}
                  >
                    <option value="all">All Courses</option>
                    {coursesForSelectedStudent.map((course) => (
                      <option key={course.class_id} value={course.class_id}>
                        {course.class_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </DetailCard>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px" }}>
            <DetailCard title="Linked Students">
              <div style={metricStyle}>{uniqueStudents.length}</div>
            </DetailCard>

            <DetailCard title="Courses">
              <div style={metricStyle}>{coursesForSelectedStudent.length}</div>
            </DetailCard>

            <DetailCard title="Visible Assignments">
              <div style={metricStyle}>{filteredSubmissions.length}</div>
            </DetailCard>

            <DetailCard title="Average Score">
              <div style={metricStyle}>{averageScore === null ? "N/A" : `${averageScore}%`}</div>
            </DetailCard>
          </div>

          <DetailCard title="Selected Student Summary">
            {selectedStudent ? (
              <div style={{ lineHeight: 1.6 }}>
                <InfoLine label="Student" value={selectedStudent.student_name} />
                <InfoLine label="Student Email" value={selectedStudent.student_email} />
                <InfoLine label="Student ID" value={selectedStudent.student_id || "Not set"} />
                <InfoLine label="Missing / Needs Attention" value={String(ungradedSubmissions.length)} />
              </div>
            ) : (
              <p style={{ margin: 0 }}>No student selected.</p>
            )}
          </DetailCard>

          <DetailCard title="Missing Work / Needs Attention">
            {ungradedSubmissions.length === 0 ? (
              <p style={{ margin: 0 }}>No missing or ungraded work found for the current filters.</p>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {ungradedSubmissions.map((submission) => (
                  <div
                    key={`missing-${submission.id}`}
                    style={{
                      border: "1px solid #d7dce5",
                      borderRadius: "12px",
                      padding: "12px",
                      background: "#f9fafb",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>
                      {submission.assignment_title || "Assignment"}
                    </div>
                    <InfoLine label="Student" value={submission.student_name} />
                    <InfoLine label="Course" value={submission.class_name} />
                    <InfoLine label="Status" value="Missing, ungraded, or needs teacher attention" />
                    <InfoLine label="Feedback" value={submission.feedback || "No feedback yet"} />
                  </div>
                ))}
              </div>
            )}
          </DetailCard>

          <DetailCard title="Student Work, Grades, Feedback, and Attachments">
            {filteredSubmissions.length === 0 ? (
              <p style={{ margin: 0 }}>No assignments or submissions found for the current filters.</p>
            ) : (
              <div style={{ display: "grid", gap: "14px" }}>
                {filteredSubmissions.map((submission) => (
                  <div
                    key={submission.id}
                    style={{
                      border: "1px solid #d7dce5",
                      borderRadius: "12px",
                      padding: "14px",
                      background: "#f9fafb",
                    }}
                  >
                    <div style={{ fontWeight: 900, marginBottom: "6px" }}>
                      {submission.assignment_title || "Assignment"}
                    </div>

                    <InfoLine label="Student" value={submission.student_name} />
                    <InfoLine label="Course" value={submission.class_name} />

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

                    {Array.isArray(submission.files) && submission.files.length > 0 ? (
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
                  </div>
                ))}
              </div>
            )}
          </DetailCard>
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

const labelStyle = {
  display: "block",
  fontWeight: 800,
  marginBottom: "6px",
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  fontSize: "1rem",
}

const metricStyle = {
  fontSize: "2rem",
  fontWeight: 900,
}
