import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../AuthContext.jsx"

function SectionCard({ children }) {
  return (
    <section
      style={{
        background: "#ffffff",
        padding: "24px",
        borderRadius: "12px",
        border: "1px solid #dbe2ea",
      }}
    >
      {children}
    </section>
  )
}

function StatCard({ label, value, helper }) {
  return (
    <div
      style={{
        border: "1px solid #d7dce5",
        borderRadius: "12px",
        padding: "18px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          fontSize: "0.82rem",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#6b7280",
          marginBottom: "10px",
        }}
      >
        {label}
      </div>

      <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>{value}</div>

      <div
        style={{
          marginTop: "10px",
          fontSize: "0.95rem",
          lineHeight: 1.4,
          color: "#4b5563",
        }}
      >
        {helper}
      </div>
    </div>
  )
}

function DetailItem({ label, value }) {
  return (
    <div
      style={{
        border: "1px solid #d7dce5",
        borderRadius: "10px",
        padding: "14px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          fontSize: "0.82rem",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#6b7280",
          marginBottom: "8px",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{value}</div>
    </div>
  )
}

function ProgressTrack({ value }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0))

  return (
    <div
      style={{
        height: "16px",
        background: "#e5e7eb",
        borderRadius: "999px",
        overflow: "hidden",
      }}
      aria-label={`Progress ${safeValue.toFixed(1)} percent`}
    >
      <div
        style={{
          width: `${safeValue}%`,
          height: "16px",
          background: "#334155",
        }}
      />
    </div>
  )
}

function NoticeBox({ children, type = "info" }) {
  const borderColor = type === "error" ? "#d1a1a1" : "#cfd8e3"
  const background = type === "error" ? "#fff8f8" : "#f8fafc"

  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: "12px",
        padding: "14px 16px",
        background,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  )
}

function ActionButton({ children, onClick, quiet = false, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: "10px",
        border: "1px solid #d7dce5",
        background: quiet ? "#ffffff" : "#f3f4f6",
        font: "inherit",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  )
}

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
          <p
            style={{
              margin: "6px 0 0 0",
              fontSize: "0.95rem",
              lineHeight: 1.5,
              color: "#4b5563",
            }}
          >
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
    <div
      style={{
        border: "1px solid #d7dce5",
        borderRadius: "12px",
        padding: "14px",
        background: "#ffffff",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: "10px" }}>{title}</div>
      {children}
    </div>
  )
}

function getAssignmentCourseId(assignment) {
  return assignment.class_id ?? assignment.course_id ?? assignment.courseId ?? ""
}

function formatAverage(value) {
  if (value === null || value === undefined) return "—"
  if (Number.isNaN(Number(value))) return "—"
  return `${Number(value).toFixed(1)}%`
}

export default function StudentProgressPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [courses, setCourses] = useState([])
  const [assignments, setAssignments] = useState([])
  const [submissionStateByAssignmentId, setSubmissionStateByAssignmentId] = useState({})
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState("")

  useEffect(() => {
    let isMounted = true

    async function loadStudentProgress() {
      const studentEmail = String(user?.email || "").trim().toLowerCase()

      if (!studentEmail) {
        if (!isMounted) return
        setCourses([])
        setAssignments([])
        setErrorText("Student email is missing from the current session.")
        setLoading(false)
        return
      }

      try {
        const [coursesResponse, assignmentsResponse, enrolledStudentsResponse] =
          await Promise.all([
            fetch("http://localhost:3000/api/courses"),
            fetch("http://localhost:3000/api/assignments"),
            fetch("http://localhost:3000/api/enrolled-students"),
          ])

        if (
          !coursesResponse.ok ||
          !assignmentsResponse.ok ||
          !enrolledStudentsResponse.ok
        ) {
          throw new Error("Could not load progress data.")
        }

        const [coursesData, assignmentsData, enrolledStudentsData] =
          await Promise.all([
            coursesResponse.json(),
            assignmentsResponse.json(),
            enrolledStudentsResponse.json(),
          ])

        if (!isMounted) return

        const safeCourses = Array.isArray(coursesData) ? coursesData : []
        const safeAssignments = Array.isArray(assignmentsData) ? assignmentsData : []
        const safeEnrolledStudents = Array.isArray(enrolledStudentsData)
          ? enrolledStudentsData
          : []

        const visibleCourseIds = new Set(
          safeEnrolledStudents
            .filter((student) => {
              const enrolledStudentEmail = String(student.student_email || "")
                .trim()
                .toLowerCase()
              return enrolledStudentEmail === studentEmail
            })
            .map((student) => String(student.class_id || ""))
            .filter((classId) => classId !== "")
        )

        const visibleCourses = safeCourses.filter((course) =>
          visibleCourseIds.has(String(course.id))
        )

        const visibleAssignments = safeAssignments.filter((assignment) =>
          visibleCourseIds.has(String(getAssignmentCourseId(assignment)))
        )

        setCourses(visibleCourses)
        setAssignments(visibleAssignments)
        setErrorText("")
      } catch (err) {
        console.error("Error loading student progress page:", err)

        if (!isMounted) return

        setCourses([])
        setAssignments([])
        setErrorText("Could not load progress data.")
      } finally {
        if (!isMounted) return
        setLoading(false)
      }
    }

    loadStudentProgress()

    return () => {
      isMounted = false
    }
  }, [user?.email])

  useEffect(() => {
    let isCancelled = false

    async function loadSubmissionStatuses() {
      const studentEmail = String(user?.email || "").trim().toLowerCase()

      if (!studentEmail) {
        return
      }

      if (!Array.isArray(assignments) || assignments.length === 0) {
        return
      }

      try {
        const results = await Promise.all(
          assignments.map(async (assignment) => {
            const assignmentId = String(assignment.id)
            const response = await fetch(
              `http://localhost:3000/api/assignments/${assignmentId}/student-submission?student_email=${encodeURIComponent(studentEmail)}`
            )
            const data = await response.json()

            if (!response.ok) {
              return {
                assignmentId,
                failed: true,
              }
            }

            return {
              assignmentId,
              data,
              failed: false,
            }
          })
        )

        if (isCancelled) {
          return
        }

        const next = {}

        results.forEach((result) => {
          if (!result.failed && result.data) {
            next[result.assignmentId] = result.data
          }
        })

        setSubmissionStateByAssignmentId(next)
      } catch (err) {
        console.error("Error loading student submission progress:", err)
      }
    }

    loadSubmissionStatuses()

    return () => {
      isCancelled = true
    }
  }, [assignments, user?.email])

  const courseProgressCards = useMemo(() => {
    return courses.map((course) => {
      const courseAssignments = assignments.filter(
        (assignment) => String(getAssignmentCourseId(assignment)) === String(course.id)
      )

      const totalAssignments = courseAssignments.length

      const submittedAssignments = courseAssignments.filter((assignment) => {
        const submissionState = submissionStateByAssignmentId[String(assignment.id)]
        return submissionState?.submission_status === "submitted"
      })

      const gradedAssignments = courseAssignments.filter((assignment) => {
        const submissionState = submissionStateByAssignmentId[String(assignment.id)]
        const score = submissionState?.submission?.score
        return score !== null && score !== undefined && !Number.isNaN(Number(score))
      })

      const missingCount = Math.max(totalAssignments - submittedAssignments.length, 0)

      const gradedScores = gradedAssignments.map((assignment) => {
        const submissionState = submissionStateByAssignmentId[String(assignment.id)]
        return Number(submissionState?.submission?.score)
      })

      const average =
        gradedScores.length > 0
          ? gradedScores.reduce((sum, score) => sum + score, 0) / gradedScores.length
          : null

      const completionPercent =
        totalAssignments > 0 ? (submittedAssignments.length / totalAssignments) * 100 : 0

      return {
        id: course.id,
        title: course.title || "Untitled Course",
        description: course.description || "",
        totalAssignments,
        submittedCount: submittedAssignments.length,
        missingCount,
        gradedCount: gradedAssignments.length,
        average,
        completionPercent,
      }
    })
  }, [courses, assignments, submissionStateByAssignmentId])

  const overallStats = useMemo(() => {
    const totalCourses = courseProgressCards.length
    const totalAssignments = courseProgressCards.reduce(
      (sum, course) => sum + course.totalAssignments,
      0
    )
    const submittedCount = courseProgressCards.reduce(
      (sum, course) => sum + course.submittedCount,
      0
    )
    const missingCount = courseProgressCards.reduce(
      (sum, course) => sum + course.missingCount,
      0
    )
    const gradedCount = courseProgressCards.reduce(
      (sum, course) => sum + course.gradedCount,
      0
    )

    const allAverages = courseProgressCards
      .map((course) => course.average)
      .filter((value) => value !== null && value !== undefined && !Number.isNaN(Number(value)))

    const overallAverage =
      allAverages.length > 0
        ? allAverages.reduce((sum, value) => sum + Number(value), 0) / allAverages.length
        : null

    return {
      totalCourses,
      totalAssignments,
      submittedCount,
      missingCount,
      gradedCount,
      overallAverage,
    }
  }, [courseProgressCards])

  function handleLogout() {
    logout()
    navigate("/login")
  }

  if (loading) {
    return (
      <div className="content-area">
        <section className="panel">
          <p>Loading progress...</p>
        </section>
      </div>
    )
  }

  return (
    <>
      <div className="topbar">
        <h1>My Progress</h1>
        <p className="topbar-subtitle">
          Welcome{user?.name ? `, ${user.name}` : ""}. Track completion, grading, and average results across your courses.
        </p>
      </div>

      <div className="content-area">
        <section className="panel">
          <SectionHeader
            title="Student Progress Tools"
            subtitle="Move between the main student pages without relying on the browser back button."
            action={
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <ActionButton quiet onClick={() => navigate("/student")}>
                  Dashboard
                </ActionButton>
                <ActionButton quiet onClick={() => navigate("/student-reports")}>
                  Reports
                </ActionButton>
                <ActionButton onClick={handleLogout}>Logout</ActionButton>
              </div>
            }
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "14px",
            }}
          >
            <DetailCard title="Student Name">
              <div>{user?.name || "Student"}</div>
            </DetailCard>

            <DetailCard title="Email">
              <div>{user?.email || "—"}</div>
            </DetailCard>

            <DetailCard title="Courses Visible">
              <div>{courses.length}</div>
            </DetailCard>
          </div>
        </section>

        {errorText ? (
          <section className="panel">
            <NoticeBox type="error">{errorText}</NoticeBox>
          </section>
        ) : null}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            gap: "16px",
          }}
        >
          <StatCard
            label="Courses"
            value={overallStats.totalCourses}
            helper="Courses currently visible on your progress page."
          />
          <StatCard
            label="Assignments"
            value={overallStats.totalAssignments}
            helper="Assignments counted across your visible courses."
          />
          <StatCard
            label="Submitted"
            value={overallStats.submittedCount}
            helper="Assignments you have submitted so far."
          />
          <StatCard
            label="Missing"
            value={overallStats.missingCount}
            helper="Assignments still not submitted."
          />
          <StatCard
            label="Graded"
            value={overallStats.gradedCount}
            helper="Assignments that already have a score."
          />
          <StatCard
            label="Average"
            value={formatAverage(overallStats.overallAverage)}
            helper="Average across graded work currently shown."
          />
        </section>

        {courseProgressCards.length === 0 ? (
          <section className="panel">
            <SectionCard>
              <p style={{ margin: 0, color: "#666" }}>No courses available.</p>
            </SectionCard>
          </section>
        ) : (
          <div style={{ display: "grid", gap: "20px" }}>
            {courseProgressCards.map((course) => (
              <SectionCard key={course.id}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "20px",
                    flexWrap: "wrap",
                    marginBottom: "18px",
                  }}
                >
                  <div>
                    <h2 style={{ marginTop: 0, marginBottom: "8px", fontSize: "28px" }}>
                      {course.title}
                    </h2>
                    <p style={{ margin: 0, color: "#666", fontSize: "16px", lineHeight: 1.5 }}>
                      {course.description || "Course progress summary for this class."}
                    </p>
                  </div>

                  <div
                    style={{
                      minWidth: "170px",
                      textAlign: "right",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "#6b7280",
                        marginBottom: "6px",
                      }}
                    >
                      Completion
                    </div>
                    <div style={{ fontSize: "32px", fontWeight: 800, color: "#1e293b" }}>
                      {course.completionPercent.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <div style={{ marginBottom: "8px", fontWeight: 700, color: "#374151" }}>
                    Submission Completion
                  </div>
                  <ProgressTrack value={course.completionPercent} />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                    gap: "12px",
                  }}
                >
                  <DetailItem label="Assignments" value={course.totalAssignments} />
                  <DetailItem label="Submitted" value={course.submittedCount} />
                  <DetailItem label="Missing" value={course.missingCount} />
                  <DetailItem label="Graded" value={course.gradedCount} />
                  <DetailItem label="Average" value={formatAverage(course.average)} />
                </div>
              </SectionCard>
            ))}
          </div>
        )}
      </div>
    </>
  )
}