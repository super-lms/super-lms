import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../AuthContext.jsx"

function SectionHeader({ title, subtitle, action }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "12px",
        flexWrap: "wrap",
        marginBottom: "16px",
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>{title}</h2>
        {subtitle ? (
          <p style={{ margin: "6px 0 0 0", fontSize: "0.95rem", lineHeight: 1.5, color: "#4b5563" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action || null}
    </div>
  )
}

function DetailCard({ title, children }) {
  return (
    <div style={detailCardStyle}>
      <div style={{ fontWeight: 800, marginBottom: "10px" }}>{title}</div>
      {children}
    </div>
  )
}

function NoticeBox({ children, type = "info" }) {
  const borderColor = type === "error" ? "#d1a1a1" : "#cfd8e3"
  const background = type === "error" ? "#fff8f8" : "#f8fafc"

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: "12px", padding: "14px 16px", background, lineHeight: 1.5 }}>
      {children}
    </div>
  )
}

function ActionButton({ children, onClick, type = "button", quiet = false, disabled = false }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={buttonStyle(quiet, disabled)}>
      {children}
    </button>
  )
}

function formatAverage(value) {
  if (value === null || value === undefined) return "—"
  if (Number.isNaN(Number(value))) return "—"
  return `${Number(value).toFixed(1)}%`
}

function formatDueDate(value) {
  if (!value) return "No due date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toLocaleDateString()
}

function getProficiencyLabel(value) {
  if (value === null || value === undefined) return "Not available yet"

  const numericValue = Number(value)

  if (Number.isNaN(numericValue)) return "Not available yet"
  if (numericValue >= 86) return "Extending"
  if (numericValue >= 73) return "Proficient"
  if (numericValue >= 60) return "Developing"
  if (numericValue >= 50) return "Emerging"

  return "Beginning"
}

function getParentMessage(value) {
  const label = getProficiencyLabel(value)

  if (label === "Extending") {
    return "Your child is demonstrating strong understanding and application of course concepts."
  }

  if (label === "Proficient") {
    return "Your child is meeting important course expectations and can continue improving by reviewing feedback."
  }

  if (label === "Developing") {
    return "Your child is building the required skills. Reviewing feedback and completing current work will help."
  }

  if (label === "Emerging") {
    return "Your child is beginning to show evidence of learning and may need support with current assignments."
  }

  return "Once graded evidence is available, your child's current standing will appear here."
}

export default function ParentDashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState("")
  const [children, setChildren] = useState([])
  const [courses, setCourses] = useState([])
  const [assignments, setAssignments] = useState([])
  const [selectedChildEmail, setSelectedChildEmail] = useState("")
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [submissionStateByAssignmentId, setSubmissionStateByAssignmentId] = useState({})

  useEffect(() => {
    let isMounted = true

    async function loadParentDashboard() {
      const parentEmail = String(user?.email || "").trim().toLowerCase()

      if (!parentEmail) {
        if (!isMounted) return
        setErrorText("Parent email is missing from the current session.")
        setLoading(false)
        return
      }

      try {
        const [usersResponse, coursesResponse, assignmentsResponse] = await Promise.all([
          fetch("http://localhost:3000/api/users"),
          fetch("http://localhost:3000/api/classes"),
          fetch("http://localhost:3000/api/assignments"),
        ])

        if (!usersResponse.ok || !coursesResponse.ok || !assignmentsResponse.ok) {
          throw new Error("Could not load parent dashboard data.")
        }

        const [usersData, coursesData, assignmentsData] = await Promise.all([
          usersResponse.json(),
          coursesResponse.json(),
          assignmentsResponse.json(),
        ])

        const safeUsers = Array.isArray(usersData) ? usersData : []
        const safeCourses = Array.isArray(coursesData) ? coursesData : []
        const safeAssignments = Array.isArray(assignmentsData) ? assignmentsData : []

        const linkedChildren = safeUsers.filter((candidate) => {
          return (
            String(candidate.role || "").toLowerCase() === "student" &&
            String(candidate.parent_email || "").trim().toLowerCase() === parentEmail
          )
        })

        const visibleCourses = []

        for (const course of safeCourses) {
          const rosterResponse = await fetch(`http://localhost:3000/api/class-roster/${course.id}`)

          if (!rosterResponse.ok) continue

          const rosterData = await rosterResponse.json()
          const rosterStudents = Array.isArray(rosterData.students) ? rosterData.students : []

          const hasChild = rosterStudents.some((student) => {
            return linkedChildren.some((child) => {
              return String(child.email || "").trim().toLowerCase() === String(student.email || "").trim().toLowerCase()
            })
          })

          if (hasChild) {
            visibleCourses.push(course)
          }
        }

        if (!isMounted) return

        setChildren(linkedChildren)
        setCourses(visibleCourses)
        setAssignments(safeAssignments)
        setErrorText("")
        setLoading(false)

        if (linkedChildren.length > 0) {
          setSelectedChildEmail((current) => {
            const stillVisible = linkedChildren.some((child) => String(child.email) === String(current))
            return stillVisible ? current : String(linkedChildren[0].email)
          })
        }

        if (visibleCourses.length > 0) {
          setSelectedCourseId((current) => {
            const stillVisible = visibleCourses.some((course) => String(course.id) === String(current))
            return stillVisible ? current : String(visibleCourses[0].id)
          })
        }
      } catch (err) {
        console.error("Error loading parent dashboard:", err)

        if (!isMounted) return

        setChildren([])
        setCourses([])
        setAssignments([])
        setErrorText("Could not load parent dashboard data.")
        setLoading(false)
      }
    }

    loadParentDashboard()

    return () => {
      isMounted = false
    }
  }, [user?.email])

  const selectedCourse = useMemo(() => {
    return courses.find((course) => String(course.id) === String(selectedCourseId)) || null
  }, [courses, selectedCourseId])

  const selectedChild = useMemo(() => {
    return children.find((child) => String(child.email) === String(selectedChildEmail)) || null
  }, [children, selectedChildEmail])

  const visibleAssignments = useMemo(() => {
    if (!selectedCourseId) return []
    return assignments.filter((assignment) => String(assignment.class_id ?? assignment.course_id ?? "") === String(selectedCourseId))
  }, [assignments, selectedCourseId])

  useEffect(() => {
    let isCancelled = false

    async function loadChildSubmissionStatuses() {
      const studentEmail = String(selectedChildEmail || "").trim().toLowerCase()

      if (!studentEmail || visibleAssignments.length === 0) return

      const needingStatus = visibleAssignments.filter((assignment) => {
        return !submissionStateByAssignmentId[String(assignment.id)]
      })

      if (needingStatus.length === 0) return

      try {
        const results = await Promise.all(
          needingStatus.map(async (assignment) => {
            const assignmentId = String(assignment.id)
            const response = await fetch(
              `http://localhost:3000/api/assignments/${assignmentId}/student-submission?student_email=${encodeURIComponent(studentEmail)}`
            )
            const data = await response.json()

            if (!response.ok) return { assignmentId, failed: true }

            return { assignmentId, data, failed: false }
          })
        )

        if (isCancelled) return

        setSubmissionStateByAssignmentId((current) => {
          const next = { ...current }

          results.forEach((result) => {
            if (!result.failed && result.data) {
              next[result.assignmentId] = result.data
            }
          })

          return next
        })
      } catch (err) {
        console.error("Error loading child submission statuses:", err)
      }
    }

    loadChildSubmissionStatuses()

    return () => {
      isCancelled = true
    }
  }, [selectedChildEmail, visibleAssignments, submissionStateByAssignmentId])

  const gradedScores = useMemo(() => {
    return visibleAssignments
      .map((assignment) => submissionStateByAssignmentId[String(assignment.id)]?.submission?.score)
      .filter((score) => score !== null && score !== undefined && !Number.isNaN(Number(score)))
      .map((score) => Number(score))
  }, [visibleAssignments, submissionStateByAssignmentId])

  const currentStanding = useMemo(() => {
    if (gradedScores.length === 0) return null
    const total = gradedScores.reduce((sum, value) => sum + value, 0)
    return total / gradedScores.length
  }, [gradedScores])

  const submittedCount = useMemo(() => {
    return visibleAssignments.filter((assignment) => {
      return submissionStateByAssignmentId[String(assignment.id)]?.submission_status === "submitted"
    }).length
  }, [visibleAssignments, submissionStateByAssignmentId])

  const missingAssignments = useMemo(() => {
    return visibleAssignments.filter((assignment) => {
      return submissionStateByAssignmentId[String(assignment.id)]?.submission_status !== "submitted"
    })
  }, [visibleAssignments, submissionStateByAssignmentId])

  const latestResultAssignment = useMemo(() => {
    return visibleAssignments.find((assignment) => {
      const score = submissionStateByAssignmentId[String(assignment.id)]?.submission?.score
      return score !== null && score !== undefined && !Number.isNaN(Number(score))
    }) || null
  }, [visibleAssignments, submissionStateByAssignmentId])

  const latestResultState = latestResultAssignment
    ? submissionStateByAssignmentId[String(latestResultAssignment.id)] || null
    : null

  const progressPercent = visibleAssignments.length > 0
    ? Math.round((submittedCount / visibleAssignments.length) * 100)
    : 0

  function handleLogout() {
    logout()
    navigate("/login")
  }

  if (loading) {
    return (
      <div className="content-area">
        <section className="panel">
          <p>Loading parent dashboard...</p>
        </section>
      </div>
    )
  }

  return (
    <>
      <div className="topbar">
        <h1>Parent Portal</h1>
        <p className="topbar-subtitle">
          Welcome{user?.name ? `, ${user.name}` : ""}. Review your child's course standing, assignments, feedback, and next steps.
        </p>
      </div>

      <div className="content-area">
        <section className="panel">
          <SectionHeader
            title="Parent Session"
            subtitle="Use this page to monitor course progress and support learning conversations at home."
            action={<ActionButton onClick={handleLogout}>Logout</ActionButton>}
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" }}>
            <DetailCard title="Parent Name">
              <div>{user?.name || "Parent"}</div>
            </DetailCard>

            <DetailCard title="Email">
              <div>{user?.email || "—"}</div>
            </DetailCard>

            <DetailCard title="Role">
              <div>{user?.role || "parent"}</div>
            </DetailCard>
          </div>
        </section>

        {errorText ? (
          <section className="panel">
            <NoticeBox type="error">{errorText}</NoticeBox>
          </section>
        ) : null}

        <section className="panel">
          <SectionHeader
            title={`${selectedChild?.name || "Child"} — ${getProficiencyLabel(currentStanding)}`}
            subtitle="A parent-friendly snapshot based on graded evidence returned by the teacher."
          />

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.7fr) minmax(0, 1.3fr)", gap: "14px" }}>
            <DetailCard title="Current Standing">
              <div style={{ fontSize: "2.4rem", fontWeight: 800 }}>{formatAverage(currentStanding)}</div>
              <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                Current standing from returned evidence.
              </div>
            </DetailCard>

            <DetailCard title="What This Means">
              <div style={{ lineHeight: 1.6 }}>{getParentMessage(currentStanding)}</div>
            </DetailCard>
          </div>
        </section>

        <section className="panel">
          <SectionHeader title="Child & Course" subtitle="Choose the child and course you want to view." />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" }}>
            <div>
              <label style={labelStyle}>Child</label>
              <select value={selectedChildEmail} onChange={(event) => setSelectedChildEmail(event.target.value)} style={inputStyle}>
                <option value="">Select Child</option>
                {children.map((child) => (
                  <option key={child.id} value={child.email}>
                    {child.name} — {child.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Course</label>
              <select value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)} style={inputStyle}>
                <option value="">Select Course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title || course.class_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="panel">
          <SectionHeader title="Latest Result" subtitle="The most recent graded evidence currently visible." />

          {!latestResultAssignment ? (
            <NoticeBox>No graded result is available yet.</NoticeBox>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" }}>
              <DetailCard title={latestResultAssignment.title || "Assignment"}>
                <div style={{ fontSize: "2rem", fontWeight: 800 }}>
                  {formatAverage(latestResultState?.submission?.score)}
                </div>
              </DetailCard>

              <DetailCard title="KDU Evidence">
                <div style={{ lineHeight: 1.7 }}>
                  KNOW: {latestResultState?.submission?.rubric_selection?.KNOW ?? "—"}<br />
                  DO: {latestResultState?.submission?.rubric_selection?.DO ?? "—"}<br />
                  UNDERSTAND: {latestResultState?.submission?.rubric_selection?.UNDERSTAND ?? "—"}
                </div>
              </DetailCard>

              <DetailCard title="Teacher Feedback">
                <div style={{ lineHeight: 1.6 }}>
                  {latestResultState?.submission?.feedback || "No teacher feedback yet."}
                </div>
              </DetailCard>
            </div>
          )}
        </section>

        <section className="panel">
          <SectionHeader title="Missing Work" subtitle="Assignments that still need attention." />

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.6fr) minmax(0, 1.4fr)", gap: "14px" }}>
            <DetailCard title="Assignments Missing">
              <div style={{ fontSize: "2.4rem", fontWeight: 800 }}>{missingAssignments.length}</div>
              <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                {missingAssignments.length === 0
                  ? "Great job. Your child is currently caught up."
                  : "These assignments still need to be submitted."}
              </div>
            </DetailCard>

            <DetailCard title="What To Watch">
              {missingAssignments.length === 0 ? (
                <div style={{ lineHeight: 1.6 }}>No missing assignments are currently visible.</div>
              ) : (
                <div style={{ display: "grid", gap: "8px" }}>
                  {missingAssignments.slice(0, 5).map((assignment) => (
                    <div key={assignment.id} style={{ lineHeight: 1.5 }}>
                      <strong>{assignment.title || "Untitled Assignment"}</strong>
                      <div style={{ color: "#4b5563" }}>Due: {formatDueDate(assignment.due_date)}</div>
                    </div>
                  ))}
                </div>
              )}
            </DetailCard>
          </div>
        </section>

        <section className="panel">
          <SectionHeader title="Upcoming Due Dates" subtitle="Upcoming assignments in the selected course." />

          {visibleAssignments.length === 0 ? (
            <NoticeBox>No assignments are currently visible.</NoticeBox>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" }}>
              {visibleAssignments.slice(0, 3).map((assignment) => (
                <DetailCard key={assignment.id} title={assignment.title || "Untitled Assignment"}>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>
                    Due: {formatDueDate(assignment.due_date)}
                  </div>
                  <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                    {assignment.description || "Assignment details will appear here."}
                  </div>
                </DetailCard>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <SectionHeader title="Course Progress" subtitle="A simple view of submitted work." />

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.7fr) minmax(0, 1.3fr)", gap: "14px" }}>
            <DetailCard title="Progress">
              <div style={{ fontSize: "2.4rem", fontWeight: 800 }}>{progressPercent}%</div>
              <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                {submittedCount} of {visibleAssignments.length} visible assignments submitted.
              </div>
            </DetailCard>

            <DetailCard title="Completion Tracker">
              <div
                aria-label={`Course progress ${progressPercent}%`}
                style={{
                  border: "1px solid #d7dce5",
                  borderRadius: "999px",
                  padding: "4px",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(0, Math.min(progressPercent, 100))}%`,
                    minWidth: progressPercent > 0 ? "24px" : "0",
                    height: "22px",
                    borderRadius: "999px",
                    background: "#111827",
                  }}
                />
              </div>
            </DetailCard>
          </div>
        </section>

        <section className="panel">
          <SectionHeader title="Teacher Announcements" subtitle="Course messages and reminders." />

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 1.2fr)", gap: "14px" }}>
            <DetailCard title={selectedCourse?.title || selectedCourse?.class_name || "Selected Course"}>
              <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>
                Welcome to the parent dashboard.
              </div>
              <div style={{ marginTop: "8px", color: "#4b5563", lineHeight: 1.6 }}>
                Use this page to support learning conversations at home.
              </div>
            </DetailCard>

            <DetailCard title="Reminders">
              <div style={{ lineHeight: 1.7 }}>
                • Review teacher feedback with your child.<br />
                • Watch for missing work and upcoming due dates.<br />
                • Contact the teacher if support is needed.
              </div>
            </DetailCard>
          </div>
        </section>
      </div>
    </>
  )
}

const detailCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "14px",
  background: "#ffffff",
}

function buttonStyle(quiet, disabled) {
  return {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #d7dce5",
    background: quiet ? "#ffffff" : "#f3f4f6",
    font: "inherit",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  }
}

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  fontSize: "16px",
  fontWeight: "600",
}

const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "10px",
  border: "1px solid #b7c4d6",
  fontSize: "16px",
  boxSizing: "border-box",
  background: "#ffffff",
}
