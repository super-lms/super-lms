import { useEffect, useMemo, useState } from "react"
import { useAuth } from "../AuthContext.jsx"

function toArray(value) {
  return Array.isArray(value) ? value : []
}

function getTeacherName(teacher) {
  if (!teacher) return "Teacher"
  return (
    teacher.name ||
    `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim() ||
    teacher.full_name ||
    "Teacher"
  )
}

function getCourseTitle(course) {
  return (
    course.title ||
    course.name ||
    course.course_title ||
    `Course ${course.id || ""}`.trim()
  )
}

function getStudentName(student) {
  return (
    student.name ||
    student.student_name ||
    `${student.first_name || ""} ${student.last_name || ""}`.trim() ||
    `Student ${student.id || student.student_user_id || ""}`.trim()
  )
}

function getStudentEmail(student) {
  return student.email || student.student_email || "—"
}

function getStudentId(student) {
  return student.id || student.student_user_id || ""
}

function getGradeValue(grade) {
  return grade.grade ?? grade.score ?? grade.percentage ?? "—"
}

function getLetterGrade(value) {
  const numeric = Number(value)

  if (Number.isNaN(numeric)) return "—"
  if (numeric >= 86) return "A"
  if (numeric >= 73) return "B"
  if (numeric >= 67) return "C+"
  if (numeric >= 60) return "C"
  if (numeric >= 50) return "C-"
  return "I / F"
}

function getNumericGrade(value) {
  const numeric = Number(value)
  return Number.isNaN(numeric) ? null : numeric
}

function formatAverage(value) {
  const numeric = Number(value)
  return Number.isNaN(numeric) ? "—" : `${numeric.toFixed(1)}%`
}

function getAtRiskLabel(value) {
  const numeric = getNumericGrade(value)

  if (numeric === null) return "Needs review"
  if (numeric < 50) return "Critical support"
  if (numeric < 60) return "At risk"
  if (numeric < 67) return "Watch closely"
  return "On track"
}

function getCourseMeta(course) {
  const parts = []

  if (course.term_name) parts.push(course.term_name)
  if (course.school_name) parts.push(course.school_name)

  return parts.length > 0 ? parts.join(" • ") : "Course information available"
}

const shellCardStyle = {
  border: "1px solid #d0d7de",
  borderRadius: "16px",
  background: "#ffffff",
  boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
}

function SectionHeading({ title, subtitle, actionLabel, onAction, actionActive = false }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "12px",
        marginBottom: "16px",
        flexWrap: "wrap",
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>{title}</h2>
        {subtitle ? (
          <p
            style={{
              margin: "6px 0 0 0",
              fontSize: "0.95rem",
              lineHeight: 1.4,
              color: "#4b5563",
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          disabled={actionActive}
          aria-busy={actionActive}
          style={{
            border: "1px solid #d0d7de",
            borderRadius: "10px",
            background: "#ffffff",
            padding: "10px 14px",
            font: "inherit",
            fontWeight: 700,
            cursor: actionActive ? "progress" : "pointer",
            whiteSpace: "nowrap",
            opacity: actionActive ? 0.7 : 1,
            transform: actionActive ? "scale(0.98)" : "scale(1)",
            transition: "opacity 120ms ease, transform 120ms ease",
          }}
          onMouseEnter={(event) => {
            if (actionActive) return
            event.currentTarget.style.background = "#f9fafb"
            event.currentTarget.style.borderColor = "#cbd5e1"
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = "#ffffff"
            event.currentTarget.style.borderColor = "#d0d7de"
          }}
        >
          {actionActive ? "Opening..." : actionLabel}
        </button>
      ) : null}
    </div>
  )
}

function SummaryCard({ eyebrow, value, title, detail }) {
  return (
    <div
      style={{
        ...shellCardStyle,
        padding: "18px",
        minHeight: "140px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontSize: "0.82rem",
          fontWeight: 800,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "#4b5563",
          marginBottom: "10px",
        }}
      >
        {eyebrow}
      </div>

      <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>{value}</div>

      <div style={{ marginTop: "12px" }}>
        <div style={{ fontWeight: 700, marginBottom: "4px" }}>{title}</div>
        <div style={{ fontSize: "0.95rem", color: "#4b5563", lineHeight: 1.4 }}>{detail}</div>
      </div>
    </div>
  )
}

function DashboardActionCard({ title, description, meta, onClick, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active}
      aria-busy={active}
      title={title}
      style={{
        width: "100%",
        textAlign: "left",
        ...shellCardStyle,
        padding: "16px",
        cursor: active ? "progress" : "pointer",
        font: "inherit",
        display: "grid",
        gap: "8px",
        opacity: active ? 0.7 : 1,
        transform: active ? "scale(0.985)" : "scale(1)",
        transition: "opacity 120ms ease, transform 120ms ease",
      }}
      onMouseEnter={(event) => {
        if (active) return
        event.currentTarget.style.background = "#f9fafb"
        event.currentTarget.style.borderColor = "#cbd5e1"
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = "#ffffff"
        event.currentTarget.style.borderColor = "#d0d7de"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 800 }}>
          {active ? `${title}...` : title}
        </div>
        <div style={{ fontWeight: 700 }} aria-hidden="true">
          {active ? "…" : "→"}
        </div>
      </div>

      <div style={{ fontSize: "0.95rem", lineHeight: 1.5, color: "#374151" }}>{description}</div>

      {meta ? (
        <div
          style={{
            fontSize: "0.9rem",
            color: "#6b7280",
            borderTop: "1px solid #eceff3",
            paddingTop: "10px",
          }}
        >
          {meta}
        </div>
      ) : null}
    </button>
  )
}

function ChecklistItem({ title, detail }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        background: "#ffffff",
        padding: "12px 14px",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: "4px" }}>{title}</div>
      <div style={{ fontSize: "0.95rem", color: "#4b5563", lineHeight: 1.4 }}>{detail}</div>
    </div>
  )
}

function SnapshotItem({ title, lines }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        background: "#ffffff",
        padding: "14px",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: "8px" }}>{title}</div>
      <div style={{ display: "grid", gap: "6px" }}>
        {lines.map((line, index) => (
          <div key={index} style={{ fontSize: "0.95rem", color: "#4b5563", lineHeight: 1.4 }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}

function getKduCellLabel(value) {
  const numeric = Number(value)

  if (Number.isNaN(numeric)) return "—"

  return numeric.toFixed(1)
}

function getKduCellDescriptor(value) {
  const numeric = Number(value)

  if (Number.isNaN(numeric)) return "No evidence"
  if (numeric >= 5.5) return "Extending"
  if (numeric >= 4) return "Proficient"
  if (numeric >= 2.5) return "Developing"
  return "Emerging"
}

function KduClassHeatmapPanel({ rows, onOpenGradebook, active, onOpenStudent }) {
  const safeRows = toArray(rows).slice(0, 10)

  return (
    <section className="panel" style={shellCardStyle}>
      <SectionHeading
        title="KDU Class Heatmap"
        subtitle="A quick visual scan of KNOW, DO, and UNDERSTAND evidence by student."
        actionLabel="Open Gradebook"
        onAction={onOpenGradebook}
        actionActive={active}
      />

      {safeRows.length === 0 ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            padding: "14px",
            background: "#ffffff",
            fontWeight: 700,
          }}
        >
          No KDU heatmap evidence available yet.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={heatmapThStyle}>Student</th>
                <th style={heatmapThStyle}>KNOW</th>
                <th style={heatmapThStyle}>DO</th>
                <th style={heatmapThStyle}>UNDERSTAND</th>
              </tr>
            </thead>
            <tbody>
              {safeRows.map((row, index) => (
                <tr
                  key={`${row.student_email || row.student_name}-${index}`}
                  style={{
                    cursor: "pointer",
                  }}
                  onClick={() => onOpenStudent(row)}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background = "#f9fafb"
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = "#ffffff"
                  }}
                >
                  <td style={heatmapStudentTdStyle}>
                    <div style={{ fontWeight: 900 }}>{row.student_name || "Student"}</div>
                    <div style={{ fontSize: "0.85rem", color: "#4b5563", marginTop: "4px" }}>
                      {row.course_title || "Course"}
                    </div>
                    <div
                      style={{
                        marginTop: "8px",
                        fontSize: "0.8rem",
                        fontWeight: 800,
                        color: "#4b5563",
                      }}
                    >
                      Click to open gradebook →
                    </div>
                  </td>

                  {["KNOW", "DO", "UNDERSTAND"].map((bucket) => (
                    <td key={bucket} style={heatmapTdStyle}>
                      <div style={heatmapScoreBoxStyle}>
                        <div style={{ fontSize: "1.35rem", fontWeight: 900 }}>
                          {getKduCellLabel(row[bucket])}
                        </div>
                        <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#4b5563" }}>
                          {getKduCellDescriptor(row[bucket])}
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > safeRows.length ? (
        <div style={{ marginTop: "10px", color: "#4b5563", fontWeight: 700 }}>
          Showing first {safeRows.length} of {rows.length} heatmap rows.
        </div>
      ) : null}
    </section>
  )
}

function AtRiskAlertsPanel({ alerts, students, onOpenGradebook, active }) {
  return (
    <section className="panel" style={shellCardStyle}>
      <SectionHeading
        title="Student Risk Alerts"
        subtitle="Demo-ready teacher signals generated from current grade evidence."
        actionLabel="Open Gradebook"
        onAction={onOpenGradebook}
        actionActive={active}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)",
          gap: "16px",
          alignItems: "start",
        }}
      >
        <div
          style={{
            border: "2px solid #111",
            borderRadius: "14px",
            padding: "16px",
            background: "#ffffff",
          }}
        >
          <div style={{ fontSize: "2rem", fontWeight: 900, lineHeight: 1 }}>
            {students.length}
          </div>
          <div style={{ marginTop: "8px", fontWeight: 800 }}>
            Students needing attention
          </div>
          <div style={{ marginTop: "8px", color: "#4b5563", lineHeight: 1.45 }}>
            This uses available grade records and flags low or concerning evidence for the teacher.
          </div>
        </div>

        <div style={{ display: "grid", gap: "10px" }}>
          {alerts.length === 0 && students.length === 0 ? (
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "14px",
                background: "#ffffff",
                fontWeight: 700,
              }}
            >
              No at-risk signals detected from the currently loaded grade records.
            </div>
          ) : null}

          {alerts.map((alert, index) => (
            <div
              key={`alert-${index}`}
              style={{
                border: "1px solid #d0d7de",
                borderRadius: "12px",
                padding: "14px",
                background: "#ffffff",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: "6px" }}>{alert.title}</div>
              <div style={{ color: "#4b5563", lineHeight: 1.45 }}>{alert.detail}</div>
            </div>
          ))}

          {students.map((student, index) => (
            <div
              key={`${student.studentName}-${student.courseTitle}-${index}`}
              style={{
                border: "1px solid #d0d7de",
                borderRadius: "12px",
                padding: "14px",
                background: "#ffffff",
                display: "grid",
                gap: "6px",
              }}
            >
              <div style={{ fontWeight: 900 }}>{student.studentName}</div>
              <div style={{ color: "#374151" }}>{student.courseTitle}</div>
              <div style={{ fontWeight: 800 }}>
                {student.label}: {formatAverage(student.value)}
              </div>
              <div style={{ color: "#4b5563", lineHeight: 1.45 }}>
                Suggested action: check recent assignment evidence and consider a quick support note.
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const teacherId = user?.id
  const apiUrl = teacherId
    ? `http://localhost:3000/api/teachers/${teacherId}/dashboard`
    : ""

  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState("")
  const [resettingDemo, setResettingDemo] = useState(false)
  const [loadingRoute, setLoadingRoute] = useState("")

  async function loadDashboard(showLoading = true) {
    if (!teacherId) {
      setErrorText("No logged-in teacher found.")
      if (showLoading) {
        setLoading(false)
      }
      return
    }

    try {
      if (showLoading) {
        setLoading(true)
      }

      setErrorText("")

      const response = await fetch(apiUrl)

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const data = await response.json()
      setDashboardData(data)
    } catch (error) {
      setErrorText(error.message || "Could not load dashboard data.")
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    loadDashboard(true)
  }, [teacherId, apiUrl])

  const teacher = dashboardData?.teacher || {}
  const courses = useMemo(() => toArray(dashboardData?.courses), [dashboardData])
  const students = useMemo(() => toArray(dashboardData?.students), [dashboardData])
  const grades = useMemo(() => toArray(dashboardData?.grades), [dashboardData])
  const kduHeatmap = useMemo(() => toArray(dashboardData?.kdu_heatmap), [dashboardData])

  const recentCourses = useMemo(() => courses.slice(0, 4), [courses])
  const recentStudents = useMemo(() => students.slice(0, 4), [students])
  const recentGrades = useMemo(() => grades.slice(0, 6), [grades])

  const gradeNumbers = useMemo(() => {
    return grades
      .map((grade) => getNumericGrade(getGradeValue(grade)))
      .filter((value) => value !== null)
  }, [grades])

  const averageGrade = useMemo(() => {
    if (gradeNumbers.length === 0) return null
    const total = gradeNumbers.reduce((sum, value) => sum + value, 0)
    return total / gradeNumbers.length
  }, [gradeNumbers])

  const topCourseName = useMemo(() => {
    if (courses.length === 0) return "No courses assigned yet"
    return getCourseTitle(courses[0])
  }, [courses])

  const latestStudentName = useMemo(() => {
    if (students.length === 0) return "No enrolled students visible yet"
    return getStudentName(students[0])
  }, [students])

  const averageLetter = useMemo(() => {
    if (averageGrade === null) return "—"
    return getLetterGrade(averageGrade)
  }, [averageGrade])

  const gradeCoverageText = useMemo(() => {
    if (grades.length === 0) return "No grade records loaded yet"
    if (averageGrade === null) return `${grades.length} grade records loaded`
    return `${grades.length} grade records • Average ${formatAverage(averageGrade)}`
  }, [grades.length, averageGrade])

  const atRiskSummary = useMemo(() => {
    const lowGradeMap = new Map()

    grades.forEach((grade) => {
      const numericValue = getNumericGrade(getGradeValue(grade))

      if (numericValue === null || numericValue >= 67) {
        return
      }

      const studentName = grade.student_name || "Unnamed student"
      const courseTitle = grade.course_title || "Course"
      const key = `${studentName}::${courseTitle}`
      const existing = lowGradeMap.get(key)

      if (!existing || numericValue < existing.value) {
        lowGradeMap.set(key, {
          studentName,
          courseTitle,
          value: numericValue,
          label: getAtRiskLabel(numericValue),
        })
      }
    })

    const lowGradeStudents = Array.from(lowGradeMap.values())
      .sort((a, b) => a.value - b.value)
      .slice(0, 6)

    const alerts = []

    if (lowGradeStudents.length > 0) {
      alerts.push({
        title: `${lowGradeStudents.length} student signal${lowGradeStudents.length === 1 ? "" : "s"} need attention`,
        detail: "These students have at least one current grade record below the safe proficiency range.",
      })
    }

    if (averageGrade !== null && averageGrade < 67) {
      alerts.push({
        title: "Class average is below the target range",
        detail: `Current loaded average is ${formatAverage(averageGrade)}. This is a useful dashboard prompt before opening the gradebook.`,
      })
    }

    if (grades.length === 0) {
      alerts.push({
        title: "No grade records loaded yet",
        detail: "Once grading evidence exists, this panel will show students who may need support.",
      })
    }

    return {
      alerts,
      students: lowGradeStudents,
    }
  }, [grades, averageGrade])

  const primaryEnrolledStudentPath = useMemo(() => {
    if (students.length === 0) {
      return "/enrolled-students"
    }

    const primaryStudentId = getStudentId(students[0])

    if (!primaryStudentId) {
      return "/enrolled-students"
    }

    return `/enrolled-students/${primaryStudentId}`
  }, [students])

  const primaryGradebookPath = useMemo(() => {
    if (courses.length === 0) {
      return "/gradebook"
    }

    const primaryCourseId = courses[0]?.id

    if (!primaryCourseId) {
      return "/gradebook"
    }

    return `/gradebook?classId=${primaryCourseId}`
  }, [courses])

  const dashboardChecklist = useMemo(() => {
    return [
      {
        title: "Courses ready",
        detail: `${courses.length} ${courses.length === 1 ? "course is" : "courses are"} available for teaching.`,
      },
      {
        title: "Enrolled students loaded",
        detail: `${students.length} ${students.length === 1 ? "student is" : "students are"} visible in enrolled student data.`,
      },
      {
        title: "Grading data available",
        detail:
          averageGrade !== null
            ? `${grades.length} records are loaded with an overall average of ${formatAverage(averageGrade)}.`
            : `${grades.length} grade records are loaded. Numeric averaging is not available yet.`,
      },
      {
        title: "Demo path ready",
        detail: "You can move from dashboard to assignments, gradebook, courses, and enrolled students without changing workflows.",
      },
    ]
  }, [courses.length, students.length, grades.length, averageGrade])

  async function resetDemoData() {
    try {
      setResettingDemo(true)
      setErrorText("")

      const response = await fetch("http://localhost:3000/api/demo/reset", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error(`Reset failed with status ${response.status}`)
      }

      await loadDashboard(false)
    } catch (error) {
      setErrorText(error.message || "Could not reset demo data.")
    } finally {
      setResettingDemo(false)
    }
  }

  function goTo(path) {
    if (loadingRoute) return
    setLoadingRoute(path)

    window.setTimeout(() => {
      window.location.href = path
    }, 120)
  }

  if (loading) {
    return (
      <>
        <div className="topbar">
          <h1>Teacher Dashboard</h1>
        </div>

        <div className="content-area">
          <div className="panel">
            <p>Loading dashboard...</p>
          </div>
        </div>
      </>
    )
  }

  if (errorText) {
    return (
      <>
        <div className="topbar">
          <h1>Teacher Dashboard</h1>
        </div>

        <div className="content-area">
          <div className="panel">
            <h2>Connection Error</h2>
            <p>{errorText}</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="topbar">
        <h1>Teacher Dashboard</h1>
        <p className="topbar-subtitle">
          Welcome back, {getTeacherName(teacher)}. Here is a clear view of your teaching workspace.
        </p>
        <button
          type="button"
          onClick={resetDemoData}
          disabled={resettingDemo || Boolean(loadingRoute)}
          style={{
            marginTop: "12px",
            border: "1px solid #d0d7de",
            borderRadius: "10px",
            background: "#ffffff",
            padding: "10px 14px",
            font: "inherit",
            fontWeight: 700,
            cursor: resettingDemo || loadingRoute ? "default" : "pointer",
            opacity: resettingDemo || loadingRoute ? 0.7 : 1,
          }}
        >
          {resettingDemo ? "Resetting Demo..." : "Reset Demo Data"}
        </button>
      </div>

      <div className="content-area" style={{ display: "grid", gap: "24px" }}>
        <section
          className="panel"
          style={{
            ...shellCardStyle,
            padding: "0",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(320px, 1fr)",
            }}
          >
            <div
              style={{
                padding: "24px",
                borderRight: "1px solid #e5e7eb",
                display: "grid",
                gap: "20px",
                background: "#ffffff",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "#4b5563",
                    marginBottom: "10px",
                  }}
                >
                  Home
                </div>

                <h2 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800, lineHeight: 1.2 }}>
                  {getTeacherName(teacher)}
                </h2>

                <p
                  style={{
                    margin: "10px 0 0 0",
                    fontSize: "1rem",
                    lineHeight: 1.6,
                    color: "#4b5563",
                    maxWidth: "760px",
                  }}
                >
                  This dashboard keeps the teacher demo focused: start from today’s status, move
                  into assignments and grading, and quickly confirm courses, enrolled students, and
                  recent performance data.
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: "16px",
                }}
              >
                <SummaryCard
                  eyebrow="Courses"
                  value={courses.length}
                  title="Active teaching load"
                  detail={topCourseName}
                />
                <SummaryCard
                  eyebrow="Enrolled Students"
                  value={students.length}
                  title="Enrollment visibility"
                  detail={latestStudentName}
                />
                <SummaryCard
                  eyebrow="Grade Records"
                  value={grades.length}
                  title="Assessment data"
                  detail={gradeCoverageText}
                />
                <SummaryCard
                  eyebrow="Current Letter"
                  value={averageLetter}
                  title="Overall standing"
                  detail="Calculated from available numeric grades"
                />
              </div>

              <div
                style={{
                  ...shellCardStyle,
                  background: "#f8fafc",
                  padding: "18px",
                }}
              >
                <SectionHeading
                  title="Your Classes"
                  subtitle="Classes assigned to this teacher account."
                />

                {courses.length === 0 ? (
                  <p style={{ marginTop: 0 }}>No classes assigned yet.</p>
                ) : (
                  <div style={{ display: "grid", gap: "12px", marginBottom: "18px" }}>
                    {courses.map((course) => (
                      <div
                        key={course.id}
                        style={{
                          border: "1px solid #d0d7de",
                          borderRadius: "12px",
                          background: "#ffffff",
                          padding: "14px",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 900, fontSize: "1rem" }}>
                            {getCourseTitle(course)}
                          </div>
                          <div style={{ fontSize: "0.9rem", color: "#4b5563", marginTop: "4px" }}>
                            Course ID: {course.id || "—"}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => goTo(`/assignments?classId=${course.id}`)}
                            style={{
                              border: "1px solid #d0d7de",
                              borderRadius: "10px",
                              background: "#ffffff",
                              padding: "10px 12px",
                              font: "inherit",
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            Assignments
                          </button>

                          <button
                            type="button"
                            onClick={() => goTo(`/gradebook?classId=${course.id}`)}
                            style={{
                              border: "1px solid #d0d7de",
                              borderRadius: "10px",
                              background: "#ffffff",
                              padding: "10px 12px",
                              font: "inherit",
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            Gradebook
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <SectionHeading
                  title="Continue your day"
                  subtitle="Use the shortest demo-friendly path from dashboard to classroom actions."
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: "16px",
                  }}
                >
                  <DashboardActionCard
                    title="Assignments"
                    description="Open assignment tools, review current work, and continue with the teacher-facing workflow."
                    meta="Best demo path for showing classroom organization"
                    onClick={() => goTo(`/assignments?classId=${course.id}`)}
                    active={loadingRoute === "/assignments"}
                  />

                  <DashboardActionCard
                    title="Gradebook"
                    description="Jump into grading and land in the teacher's current class instead of a generic gradebook start page."
                    meta={
                      courses.length > 0
                        ? `Direct target: ${getCourseTitle(courses[0])}`
                        : "No class target available yet"
                    }
                    onClick={() => goTo(primaryGradebookPath)}
                    active={loadingRoute === primaryGradebookPath}
                  />

                  <DashboardActionCard
                    title="Courses"
                    description="Review course structure and confirm the teacher’s assigned classes."
                    meta={`${courses.length} ${courses.length === 1 ? "course" : "courses"} available`}
                    onClick={() => goTo("/courses")}
                    active={loadingRoute === "/courses"}
                  />

                  <DashboardActionCard
                    title="Enrolled Students"
                    description="Open enrolled student records and land on a real student target instead of a generic list page."
                    meta={
                      students.length > 0
                        ? `Direct target: ${getStudentName(students[0])}`
                        : "No student target available yet"
                    }
                    onClick={() => goTo(primaryEnrolledStudentPath)}
                    active={loadingRoute === primaryEnrolledStudentPath}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "24px",
                background: "#fbfbfc",
                display: "grid",
                gap: "18px",
                alignContent: "start",
              }}
            >
              <div
                style={{
                  ...shellCardStyle,
                  padding: "16px",
                }}
              >
                <SectionHeading
                  title="Teacher account"
                  subtitle="Current signed-in profile and platform status"
                />

                <div
                  style={{
                    display: "grid",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#6b7280" }}>
                      Name
                    </div>
                    <div style={{ fontWeight: 800, marginTop: "4px" }}>{getTeacherName(teacher)}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#6b7280" }}>
                      Email
                    </div>
                    <div style={{ marginTop: "4px" }}>{teacher.email || "—"}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#6b7280" }}>
                      Role
                    </div>
                    <div style={{ marginTop: "4px" }}>{teacher.role || "teacher"}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#6b7280" }}>
                      Teacher ID
                    </div>
                    <div style={{ marginTop: "4px" }}>{teacher.id || "—"}</div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  ...shellCardStyle,
                  padding: "16px",
                }}
              >
                <SectionHeading
                  title="Today at a glance"
                  subtitle="A simple status board for a polished teacher homepage"
                />

                <div style={{ display: "grid", gap: "10px" }}>
                  {dashboardChecklist.map((item, index) => (
                    <ChecklistItem key={index} title={item.title} detail={item.detail} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <AtRiskAlertsPanel
          alerts={atRiskSummary.alerts}
          students={atRiskSummary.students}
          onOpenGradebook={() => goTo(primaryGradebookPath)}
          active={loadingRoute === primaryGradebookPath}
        />

        <KduClassHeatmapPanel
          rows={kduHeatmap}
          onOpenGradebook={() => goTo(primaryGradebookPath)}
          active={loadingRoute === primaryGradebookPath}
          onOpenStudent={(student) => {
            if (courses.length > 0 && courses[0]?.id) {
              goTo(`/gradebook?classId=${courses[0].id}`)
              return
            }

            goTo(primaryGradebookPath)
          }}
        />

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "24px",
          }}
        >
          <section className="panel" style={shellCardStyle}>
            <SectionHeading
              title="Courses Snapshot"
              subtitle="A cleaner course overview, similar to the teacher home experience"
              actionLabel="Open Courses"
              onAction={() => goTo("/courses")}
              actionActive={loadingRoute === "/courses"}
            />

            {recentCourses.length === 0 ? (
              <p>No courses found.</p>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {recentCourses.map((course, index) => (
                  <SnapshotItem
                    key={course.id || index}
                    title={getCourseTitle(course)}
                    lines={[
                      `Course ID: ${course.id || "—"}`,
                      `Details: ${getCourseMeta(course)}`,
                    ]}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="panel" style={shellCardStyle}>
            <SectionHeading
              title="Enrolled Students Snapshot"
              subtitle="Quick visibility into enrolled student records for the current teacher account"
              actionLabel="Open Enrolled Students"
              onAction={() => goTo(primaryEnrolledStudentPath)}
              actionActive={loadingRoute === primaryEnrolledStudentPath}
            />

            {recentStudents.length === 0 ? (
              <p>No enrolled students found.</p>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {recentStudents.map((student, index) => (
                  <SnapshotItem
                    key={student.id || student.student_user_id || index}
                    title={getStudentName(student)}
                    lines={[
                      `Student ID: ${getStudentId(student) || "—"}`,
                      `Email: ${getStudentEmail(student)}`,
                      `Role: ${student.role || "student"}`,
                    ]}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="panel" style={shellCardStyle}>
            <SectionHeading
              title="Recent Grade Records"
              subtitle="Fast evidence that grading data is flowing into the teacher view"
              actionLabel="Open Gradebook"
              onAction={() => goTo(primaryGradebookPath)}
              actionActive={loadingRoute === primaryGradebookPath}
            />

            {recentGrades.length === 0 ? (
              <p>No grades found.</p>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {recentGrades.map((grade, index) => {
                  const numeric = getNumericGrade(getGradeValue(grade))

                  return (
                    <SnapshotItem
                      key={grade.id || index}
                      title={grade.student_name || "—"}
                      lines={[
                        `Course: ${grade.course_title || "—"}`,
                        `Grade ID: ${grade.id || "—"}`,
                        `Value: ${getGradeValue(grade)}`,
                        `Letter: ${numeric !== null ? getLetterGrade(numeric) : "—"}`,
                      ]}
                    />
                  )
                })}
              </div>
            )}
          </section>
        </section>

        <section className="panel" style={shellCardStyle}>
          <SectionHeading
            title="All Courses"
            subtitle="Courses assigned to this teacher"
            actionLabel="Go to Courses"
            onAction={() => goTo("/courses")}
            actionActive={loadingRoute === "/courses"}
          />

          {courses.length === 0 ? (
            <p>No courses found.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Course ID</th>
                    <th>Title</th>
                    <th>Term</th>
                    <th>School</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course, index) => (
                    <tr key={course.id || index}>
                      <td>{course.id || "—"}</td>
                      <td>{getCourseTitle(course)}</td>
                      <td>{course.term_name || "—"}</td>
                      <td>{course.school_name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel" style={shellCardStyle}>
          <SectionHeading
            title="All Enrolled Students"
            subtitle="Students enrolled in this teacher's classes"
            actionLabel="Go to Enrolled Students"
            onAction={() => goTo(primaryEnrolledStudentPath)}
            actionActive={loadingRoute === primaryEnrolledStudentPath}
          />

          {students.length === 0 ? (
            <p>No enrolled students found.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, index) => (
                    <tr key={student.id || student.student_user_id || index}>
                      <td>{getStudentId(student) || "—"}</td>
                      <td>{getStudentName(student)}</td>
                      <td>{getStudentEmail(student)}</td>
                      <td>{student.role || "student"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel" style={shellCardStyle}>
          <SectionHeading
            title="All Grade Records"
            subtitle="Current grade records"
            actionLabel="Go to Gradebook"
            onAction={() => goTo(primaryGradebookPath)}
            actionActive={loadingRoute === primaryGradebookPath}
          />

          {grades.length === 0 ? (
            <p>No grades found.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Grade ID</th>
                    <th>Class ID</th>
                    <th>Student</th>
                    <th>Email</th>
                    <th>Course</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((grade, index) => (
                    <tr key={grade.id || index}>
                      <td>{grade.id || "—"}</td>
                      <td>{grade.class_id || "—"}</td>
                      <td>{grade.student_name || "—"}</td>
                      <td>{grade.student_email || "—"}</td>
                      <td>{grade.course_title || "—"}</td>
                      <td>{getGradeValue(grade)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}

const heatmapThStyle = {
  textAlign: "left",
  padding: "12px",
  borderBottom: "2px solid #111",
  fontSize: "0.9rem",
  fontWeight: 900,
};

const heatmapStudentTdStyle = {
  padding: "12px",
  borderBottom: "1px solid #e5e7eb",
  verticalAlign: "top",
  minWidth: "190px",
};

const heatmapTdStyle = {
  padding: "10px",
  borderBottom: "1px solid #e5e7eb",
  verticalAlign: "top",
};

const heatmapScoreBoxStyle = {
  border: "1px solid #d0d7de",
  borderRadius: "12px",
  padding: "10px",
  background: "#ffffff",
  minWidth: "110px",
  textAlign: "center",
};
