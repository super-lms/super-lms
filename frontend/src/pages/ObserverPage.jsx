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
  const [snapshotMessage, setSnapshotMessage] = useState("")
  const [observerData, setObserverData] = useState({
    observer: null,
    students: [],
    submissions: [],
  })

  const [selectedStudentEmail, setSelectedStudentEmail] = useState("")
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [viewMode, setViewMode] = useState("dashboard")

  const [homeroomRoster, setHomeroomRoster] = useState([])
  const [homeroomSearch, setHomeroomSearch] = useState("")
  const [homeroomGrade, setHomeroomGrade] = useState("")
  const [selectedHomeroomIds, setSelectedHomeroomIds] = useState([])
  const [homeroomLoading, setHomeroomLoading] = useState(false)
  const [homeroomSaving, setHomeroomSaving] = useState(false)
  const [homeroomMessage, setHomeroomMessage] = useState("")
  const [homeroomError, setHomeroomError] = useState("")

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

  async function refreshObserverDashboard() {
    if (!user?.email) return

    const response = await fetch(
      `${API_BASE}/api/observers/${encodeURIComponent(user.email)}/dashboard`
    )

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error((data && data.error) || "Failed to refresh observer dashboard")
    }

    setObserverData({
      observer: data?.observer || null,
      students: toArray(data?.students),
      submissions: toArray(data?.submissions),
    })
  }

  async function loadHomeroomRoster() {
    if (!user?.email) return

    try {
      setHomeroomLoading(true)
      setHomeroomError("")
      setHomeroomMessage("")

      const response = await fetch(
        `${API_BASE}/api/observers/${encodeURIComponent(user.email)}/grade-roster?current_grade=11`
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error((data && data.error) || "Failed to load homeroom roster")
      }

      const roster = toArray(data?.students)
      setHomeroomRoster(roster)
      setHomeroomGrade(String(data?.current_grade || "11"))
      setSelectedHomeroomIds(
        roster
          .filter((student) => student.already_linked)
          .map((student) => String(student.master_student_id))
      )
    } catch (err) {
      setHomeroomError(err.message || "Failed to load homeroom roster")
      setHomeroomRoster([])
      setSelectedHomeroomIds([])
    } finally {
      setHomeroomLoading(false)
    }
  }

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

  const allVisibleSubmissions = observerData.submissions

  const allGradedSubmissions = allVisibleSubmissions.filter((submission) => {
    return submission.score !== null && submission.score !== undefined && submission.score !== ""
  })

  const allMissingSubmissions = allVisibleSubmissions.filter((submission) => {
    return submission.score === null || submission.score === undefined || submission.score === ""
  })

  const allAverageScore =
    allGradedSubmissions.length > 0
      ? Math.round(
          allGradedSubmissions.reduce((sum, submission) => sum + Number(submission.score || 0), 0) /
            allGradedSubmissions.length
        )
      : null

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

  const attentionStudents = useMemo(() => {
    const map = new Map()

    allMissingSubmissions.forEach((submission) => {
      const email = String(submission.student_email || "").trim().toLowerCase()
      if (!email) return

      const current = map.get(email) || {
        student_name: submission.student_name || email,
        student_email: email,
        count: 0,
        courses: new Set(),
      }

      current.count += 1
      if (submission.class_name) current.courses.add(submission.class_name)
      map.set(email, current)
    })

    return Array.from(map.values()).sort((a, b) =>
      String(a.student_name || "").localeCompare(String(b.student_name || ""))
    )
  }, [allMissingSubmissions])

  const feedbackItems = useMemo(() => {
    return allVisibleSubmissions
      .filter((submission) => String(submission.feedback || "").trim().length > 0)
      .slice(0, 20)
  }, [allVisibleSubmissions])

  const recentActivity = allVisibleSubmissions.slice(0, 8)

  const filteredHomeroomRoster = useMemo(() => {
    const query = homeroomSearch.trim().toLowerCase()

    if (!query) return homeroomRoster

    return homeroomRoster.filter((student) => {
      const searchable = [
        student.display_name,
        student.student_email,
        student.student_id,
        student.pen,
        student.current_homeform,
      ]
        .join(" ")
        .toLowerCase()

      return searchable.includes(query)
    })
  }, [homeroomRoster, homeroomSearch])

  function buildStudentSnapshot() {
    const feedbackLines = courseSubmissions
      .filter((submission) => String(submission.feedback || "").trim().length > 0)
      .slice(0, 6)
      .map((submission) => {
        return `• ${submission.assignment_title || "Assignment"}: ${submission.feedback}`
      })

    const missingLines = missingSubmissions.slice(0, 8).map((submission) => {
      return `• ${submission.assignment_title || "Assignment"}`
    })

    return [
      "Student Progress Snapshot",
      "",
      `Student: ${selectedStudent?.student_name || "Student"}`,
      `Student Email: ${selectedStudent?.student_email || "N/A"}`,
      `Course: ${selectedCourse?.class_name || "Course"}`,
      "",
      `Visible Assignments: ${courseSubmissions.length}`,
      `Average Score: ${averageScore === null ? "N/A" : `${averageScore}%`}`,
      `Missing / Needs Attention: ${missingSubmissions.length}`,
      "",
      "Missing Work / Needs Attention:",
      missingLines.length > 0 ? missingLines.join("\n") : "No missing or ungraded work found for this course.",
      "",
      "Recent Teacher Feedback:",
      feedbackLines.length > 0 ? feedbackLines.join("\n") : "No teacher feedback is visible yet.",
      "",
      "Generated from SUPER LMS Observer Portal",
    ].join("\n")
  }

  async function copyStudentSnapshot() {
    const snapshot = buildStudentSnapshot()

    try {
      await navigator.clipboard.writeText(snapshot)
      setSnapshotMessage("Student snapshot copied to clipboard.")
    } catch {
      setSnapshotMessage("Copy was not available in this browser. Please use Email or Print instead.")
    }
  }

  async function emailStudentSnapshot() {
    const subject = `Student Progress Update - ${selectedStudent?.student_name || "Student"} - ${selectedCourse?.class_name || "Course"}`
    const body = [
      `Subject: ${subject}`,
      "",
      "Dear Parent,",
      "",
      "I hope you are doing well.",
      "",
      `Below is a progress update for ${selectedStudent?.student_name || "your child"} in ${selectedCourse?.class_name || "this course"}.`,
      "",
      "Course Summary",
      `- Visible Assignments: ${courseSubmissions.length}`,
      `- Average Score: ${averageScore === null ? "N/A" : `${averageScore}%`}`,
      `- Missing / Needs Attention: ${missingSubmissions.length}`,
      "",
      "Missing Work / Needs Attention",
      missingSubmissions.length > 0
        ? missingSubmissions.map((submission) => `- ${submission.assignment_title || "Assignment"}`).join("\n")
        : "No missing or ungraded work found for this course.",
      "",
      "Recent Teacher Feedback",
      courseSubmissions.filter((submission) => String(submission.feedback || "").trim().length > 0).length > 0
        ? courseSubmissions
            .filter((submission) => String(submission.feedback || "").trim().length > 0)
            .slice(0, 6)
            .map((submission) => `- ${submission.assignment_title || "Assignment"}: ${submission.feedback}`)
            .join("\n")
        : "No teacher feedback is visible yet.",
      "",
      "If you have any questions regarding your child's progress, please contact the course teacher or your Chinese Homeroom Teacher.",
      "",
      "Kind regards,",
      "",
      "CBC Wenzhou",
    ].join("\n")

    try {
      await navigator.clipboard.writeText(body)
      setSnapshotMessage("Email for Outlook copied. Open Outlook, create a new email, and paste.")
    } catch {
      setSnapshotMessage("Copy was not available in this browser. Please use Copy Student Snapshot instead.")
    }
  }

  function printStudentSnapshot() {
    const snapshot = buildStudentSnapshot()
    const printWindow = window.open("", "_blank", "width=900,height=700")

    if (!printWindow) {
      setSnapshotMessage("Print window was blocked. Please allow popups for this site and try again.")
      return
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Student Progress Snapshot</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 32px;
              color: #111827;
              line-height: 1.5;
            }
            h1 {
              margin-top: 0;
            }
            pre {
              white-space: pre-wrap;
              font-family: Arial, sans-serif;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <h1>SUPER LMS Student Progress Snapshot</h1>
          <pre>${snapshot.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    setSnapshotMessage("Print snapshot opened.")
  }

  function openStudent(student) {
    setSelectedStudentEmail(student.student_email)
    setSelectedCourseId("")
    setViewMode("courses")
    setSnapshotMessage("")
  }

  function openStudentByEmail(studentEmail) {
    const student = uniqueStudents.find((item) => item.student_email === studentEmail)
    if (student) openStudent(student)
  }

  function openCourse(course) {
    setSelectedCourseId(course.class_id)
    setViewMode("progress")
    setSnapshotMessage("")
  }

  function backToDashboard() {
    setViewMode("dashboard")
    setSelectedStudentEmail("")
    setSelectedCourseId("")
    setSnapshotMessage("")
  }

  function viewStudents() {
    setViewMode("students")
    setSelectedStudentEmail("")
    setSelectedCourseId("")
    setSnapshotMessage("")
  }

  function viewAttention() {
    setViewMode("attention")
    setSelectedStudentEmail("")
    setSelectedCourseId("")
    setSnapshotMessage("")
  }

  function viewFeedback() {
    setViewMode("feedback")
    setSelectedStudentEmail("")
    setSelectedCourseId("")
    setSnapshotMessage("")
  }

  function viewManageHomeroom() {
    setViewMode("manageHomeroom")
    setSelectedStudentEmail("")
    setSelectedCourseId("")
    setSnapshotMessage("")
    loadHomeroomRoster()
  }

  function toggleHomeroomStudent(masterStudentId) {
    const cleanId = String(masterStudentId)

    setSelectedHomeroomIds((current) => {
      if (current.includes(cleanId)) {
        return current.filter((id) => id !== cleanId)
      }

      return [...current, cleanId]
    })

    setHomeroomMessage("")
    setHomeroomError("")
  }

  async function saveHomeroomRoster() {
    if (!user?.email) return

    try {
      setHomeroomSaving(true)
      setHomeroomMessage("")
      setHomeroomError("")

      const response = await fetch(
        `${API_BASE}/api/observers/${encodeURIComponent(user.email)}/grade-roster-links`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            current_grade: Number(homeroomGrade || 11),
            masterStudentIds: selectedHomeroomIds.map(Number).filter(Boolean),
          }),
        }
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error((data && data.error) || "Failed to save homeroom")
      }

      setHomeroomMessage(`Homeroom saved. ${data?.linkedCount ?? selectedHomeroomIds.length} student(s) linked.`)
      await refreshObserverDashboard()
      await loadHomeroomRoster()
    } catch (err) {
      setHomeroomError(err.message || "Failed to save homeroom")
    } finally {
      setHomeroomSaving(false)
    }
  }

  function backToStudents() {
    setViewMode("students")
    setSelectedStudentEmail("")
    setSelectedCourseId("")
    setSnapshotMessage("")
  }

  function backToCourses() {
    setViewMode("courses")
    setSelectedCourseId("")
    setSnapshotMessage("")
  }

  return (
    <div className="page">
      <div style={topBarStyle}>
        <div>
          <h1 style={{ marginBottom: "6px" }}>Observer Portal</h1>
          <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.5 }}>
            Review linked students, course progress, teacher feedback, assignments, and learning evidence.
          </p>
        </div>

        <button type="button" onClick={handleLogout} style={logoutButtonStyle}>
          Logout
        </button>
      </div>

      {loading ? <p>Loading observer portal...</p> : null}
      {error ? <p style={{ color: "#991b1b" }}>{error}</p> : null}

      {!loading && !error && viewMode === "dashboard" ? (
        <div style={{ display: "grid", gap: "18px" }}>
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Observer Dashboard</h2>
            <p style={{ marginTop: 0, color: "#4b5563", lineHeight: 1.5 }}>
              Welcome back, {observerData.observer?.name || user?.email || "Observer"}.
            </p>

            <div style={metricGridStyle}>
              <MetricCard title="Linked Students" value={uniqueStudents.length} />
              <MetricCard title="Visible Assignments" value={allVisibleSubmissions.length} />
              <MetricCard title="Missing / Needs Attention" value={allMissingSubmissions.length} />
              <MetricCard title="Average Score" value={allAverageScore === null ? "N/A" : `${allAverageScore}%`} />
            </div>
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Quick Actions</h2>
            <div style={cardGridStyle}>
              <Card onClick={viewStudents}>
                <div style={{ fontSize: "1.15rem", fontWeight: 900 }}>View Students</div>
                <div style={{ marginTop: "8px", color: "#4b5563" }}>
                  Open the complete linked student list.
                </div>
                <div style={{ marginTop: "12px", fontWeight: 800 }}>Open Students →</div>
              </Card>

              <Card onClick={viewAttention}>
                <div style={{ fontSize: "1.15rem", fontWeight: 900 }}>Needs Attention</div>
                <div style={{ marginTop: "8px", color: "#4b5563" }}>
                  Show only students with missing, ungraded, or attention-needed work.
                </div>
                <div style={{ marginTop: "12px", fontWeight: 800 }}>Review {attentionStudents.length} Student{attentionStudents.length === 1 ? "" : "s"} →</div>
              </Card>

              <Card onClick={viewFeedback}>
                <div style={{ fontSize: "1.15rem", fontWeight: 900 }}>Recent Feedback</div>
                <div style={{ marginTop: "8px", color: "#4b5563" }}>
                  Review the latest teacher feedback across linked students.
                </div>
                <div style={{ marginTop: "12px", fontWeight: 800 }}>View Feedback →</div>
              </Card>

              <Card onClick={viewManageHomeroom}>
                <div style={{ fontSize: "1.15rem", fontWeight: 900 }}>Manage My Homeroom</div>
                <div style={{ marginTop: "8px", color: "#4b5563" }}>
                  Select students from the official Grade roster for your homeroom list.
                </div>
                <div style={{ marginTop: "12px", fontWeight: 800 }}>Open Homeroom →</div>
              </Card>
            </div>
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Recent Activity</h2>

            {recentActivity.length === 0 ? (
              <p>No recent student work or feedback is visible yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {recentActivity.map((submission) => (
                  <Card key={`activity-${submission.id}`}>
                    <div style={{ fontWeight: 900 }}>{submission.student_name || "Student"}</div>
                    <div style={{ marginTop: "4px", color: "#4b5563" }}>
                      {submission.class_name || "Course"} • {submission.assignment_title || "Assignment"}
                    </div>
                    <div style={{ marginTop: "6px" }}>
                      {submission.feedback ? `Feedback: ${submission.feedback}` : submission.content || "Student activity recorded."}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {!loading && !error && viewMode === "attention" ? (
        <section style={sectionStyle}>
          <button type="button" onClick={backToDashboard} style={backButtonStyle}>
            ← Back to Observer Dashboard
          </button>

          <h2 style={sectionTitleStyle}>Needs Attention</h2>

          {attentionStudents.length === 0 ? (
            <p>No students currently have missing or ungraded work.</p>
          ) : (
            <div style={cardGridStyle}>
              {attentionStudents.map((student) => (
                <Card key={student.student_email} onClick={() => openStudentByEmail(student.student_email)}>
                  <div style={{ fontSize: "1.2rem", fontWeight: 900 }}>{student.student_name}</div>
                  <div style={{ marginTop: "6px", color: "#4b5563" }}>
                    {student.count} item{student.count === 1 ? "" : "s"} need attention
                  </div>
                  <div style={{ marginTop: "6px", color: "#4b5563" }}>
                    {Array.from(student.courses).slice(0, 2).join(", ") || "Course details available"}
                  </div>
                  <div style={{ marginTop: "12px", fontWeight: 800 }}>Open Student →</div>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!loading && !error && viewMode === "feedback" ? (
        <section style={sectionStyle}>
          <button type="button" onClick={backToDashboard} style={backButtonStyle}>
            ← Back to Observer Dashboard
          </button>

          <h2 style={sectionTitleStyle}>Recent Feedback</h2>

          {feedbackItems.length === 0 ? (
            <p>No teacher feedback is visible yet.</p>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {feedbackItems.map((submission) => (
                <Card key={`feedback-${submission.id}`} onClick={() => openStudentByEmail(String(submission.student_email || "").trim().toLowerCase())}>
                  <div style={{ fontSize: "1.1rem", fontWeight: 900 }}>{submission.student_name || "Student"}</div>
                  <div style={{ marginTop: "4px", color: "#4b5563" }}>
                    {submission.class_name || "Course"} • {submission.assignment_title || "Assignment"}
                  </div>
                  <div style={{ marginTop: "8px", lineHeight: 1.5 }}>
                    {submission.feedback}
                  </div>
                  <div style={{ marginTop: "12px", fontWeight: 800 }}>Open Student →</div>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!loading && !error && viewMode === "manageHomeroom" ? (
        <section style={sectionStyle}>
          <button type="button" onClick={backToDashboard} style={backButtonStyle}>
            ← Back to Observer Dashboard
          </button>

          <h2 style={sectionTitleStyle}>Manage My Homeroom</h2>

          <p style={{ marginTop: 0, color: "#4b5563", lineHeight: 1.5 }}>
            Select students from the official Grade {homeroomGrade || "11"} roster. This updates your linked student list.
          </p>

          <div style={metricGridStyle}>
            <MetricCard title="Current Grade" value={homeroomGrade || "11"} />
            <MetricCard title="Roster Students" value={homeroomRoster.length} />
            <MetricCard title="Selected Students" value={selectedHomeroomIds.length} />
          </div>

          <div style={{ marginTop: "18px", marginBottom: "18px" }}>
            <label style={{ display: "block", fontWeight: 800, marginBottom: "8px" }}>
              Search Grade {homeroomGrade || "11"} Students
            </label>
            <input
              value={homeroomSearch}
              onChange={(event) => setHomeroomSearch(event.target.value)}
              placeholder="Search by name, email, student ID, PEN, or homeform..."
              style={searchInputStyle}
            />
          </div>

          {homeroomLoading ? <p>Loading homeroom roster...</p> : null}
          {homeroomError ? <p style={{ color: "#991b1b", fontWeight: 800 }}>{homeroomError}</p> : null}
          {homeroomMessage ? <p style={{ color: "#14532d", fontWeight: 800 }}>{homeroomMessage}</p> : null}

          {!homeroomLoading && filteredHomeroomRoster.length === 0 ? (
            <p>No roster students found.</p>
          ) : null}

          {!homeroomLoading && filteredHomeroomRoster.length > 0 ? (
            <div style={{ display: "grid", gap: "10px" }}>
              {filteredHomeroomRoster.map((student) => {
                const id = String(student.master_student_id)
                const checked = selectedHomeroomIds.includes(id)

                return (
                  <label key={id} style={checkboxCardStyle}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleHomeroomStudent(id)}
                      style={{ width: "18px", height: "18px", marginTop: "3px" }}
                    />

                    <div>
                      <div style={{ fontSize: "1.05rem", fontWeight: 900 }}>
                        {student.display_name || student.student_email || "Unnamed Student"}
                      </div>
                      <div style={{ marginTop: "4px", color: "#4b5563" }}>
                        {student.student_email || "No email"} {student.current_homeform ? `• ${student.current_homeform}` : ""}
                      </div>
                      <div style={{ marginTop: "4px", color: "#6b7280", fontSize: "0.9rem" }}>
                        Student ID: {student.student_id || "—"} • PEN: {student.pen || "—"}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          ) : null}

          <div style={{ marginTop: "18px" }}>
            <button
              type="button"
              onClick={saveHomeroomRoster}
              disabled={homeroomSaving || homeroomLoading}
              style={actionButtonStyle}
            >
              {homeroomSaving ? "Saving Homeroom..." : "Save My Homeroom"}
            </button>
          </div>
        </section>
      ) : null}

      {!loading && !error && viewMode === "students" ? (
        <section style={sectionStyle}>
          <button type="button" onClick={backToDashboard} style={backButtonStyle}>
            ← Back to Observer Dashboard
          </button>

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
            <h2 style={sectionTitleStyle}>Communication Tools</h2>
            <p style={{ marginTop: 0, color: "#4b5563", lineHeight: 1.5 }}>
              Create a quick student progress snapshot for parent communication.
            </p>

            <div style={buttonRowStyle}>
              <button type="button" onClick={copyStudentSnapshot} style={actionButtonStyle}>
                Copy Student Snapshot
              </button>
              <button type="button" onClick={emailStudentSnapshot} style={actionButtonStyle}>
                Copy Email for Outlook
              </button>
              <button type="button" onClick={printStudentSnapshot} style={actionButtonStyle}>
                Print Student Snapshot
              </button>
            </div>

            {snapshotMessage ? (
              <p style={{ marginBottom: 0, fontWeight: 800 }}>{snapshotMessage}</p>
            ) : null}
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

const buttonRowStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
}

const actionButtonStyle = {
  border: "1px solid #111827",
  background: "#111827",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
}

const searchInputStyle = {
  width: "100%",
  maxWidth: "620px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "11px 12px",
  fontSize: "16px",
  boxSizing: "border-box",
}

const checkboxCardStyle = {
  display: "flex",
  gap: "12px",
  alignItems: "flex-start",
  border: "1px solid #d7dce5",
  borderRadius: "14px",
  padding: "14px",
  background: "#ffffff",
  cursor: "pointer",
}

const logoutButtonStyle = {
  border: "1px solid #111",
  background: "#ffffff",
  color: "#111",
  borderRadius: "10px",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
}

const backButtonStyle = {
  border: "1px solid #111827",
  background: "#ffffff",
  color: "#111827",
  borderRadius: "10px",
  padding: "8px 12px",
  fontWeight: 800,
  cursor: "pointer",
  marginBottom: "14px",
}
