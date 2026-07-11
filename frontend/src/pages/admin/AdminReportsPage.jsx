import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import authFetch from "../../services/authFetch"

export default function AdminReportsPage() {
  const [courses, setCourses] = useState([])
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState("loading")
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function loadReportData() {
      try {
        setStatus("loading")
        const [coursesResponse, usersResponse] = await Promise.all([
          authFetch("/api/courses"),
          authFetch("/api/users"),
        ])

        const coursesData = await coursesResponse.json()
        const usersData = await usersResponse.json()

        if (!coursesResponse.ok) throw new Error(coursesData.error || "Failed to load courses")
        if (!usersResponse.ok) throw new Error(usersData.error || "Failed to load users")

        if (isMounted) {
          setCourses(Array.isArray(coursesData) ? coursesData : [])
          setUsers(Array.isArray(usersData) ? usersData : [])
          setStatus("ready")
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load reports")
          setStatus("error")
        }
      }
    }

    loadReportData()

    return () => {
      isMounted = false
    }
  }, [])

  const summary = useMemo(() => {
    const students = users.filter((user) => String(user.role || "").toLowerCase() === "student")
    const faculty = users.filter((user) => {
      const role = String(user.role || "").toLowerCase()
      return role === "teacher" || courses.some((course) => Number(course.teacher_id) === Number(user.id))
    })
    const activeCourses = courses.filter((course) => Number(course.student_count || 0) > 0)
    const studentSeats = courses.reduce((sum, course) => sum + Number(course.student_count || 0), 0)

    return {
      students: students.length,
      faculty: faculty.length,
      courses: courses.length,
      activeCourses: activeCourses.length,
      studentSeats,
    }
  }, [courses, users])

  const reportCards = [
    {
      title: "Course Reports",
      description: "Open course-level report tools for student progress, comments, and class reporting.",
      status: "Available now",
      to: "/admin/courses",
    },
    {
      title: "Student Reports",
      description: "Use the Master Student Directory as the starting point for student-specific review.",
      status: "Available now",
      to: "/admin/students",
    },
    {
      title: "Gradebook Reports",
      description: "Review class gradebooks, averages, and student grade standing across active courses.",
      status: "Available now",
      to: "/admin/gradebooks",
    },
    {
      title: "Faculty Reports",
      description: "Review teacher course loads and total student seats by faculty member.",
      status: "Available now",
      to: "/admin/teachers",
    },
    {
      title: "Attendance Reports",
      description: "Course attendance reporting is available from individual course workspaces.",
      status: "Course-level",
      to: "/admin/courses",
    },
    {
      title: "Export Center",
      description: "Future home for downloadable school-wide reporting packages.",
      status: "Planned",
      to: "",
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: "22px" }}>
        <h1 style={{ margin: 0, fontSize: "28px" }}>School Reports</h1>
        <p style={{ margin: "8px 0 0", fontSize: "16px", color: "#4b5563", lineHeight: 1.6 }}>
          Administrative reporting hub built from existing live school data.
        </p>
      </div>

      {status === "error" && (
        <div style={{ background: "white", border: "1px solid #b91c1c", borderRadius: "14px", padding: "18px" }}>
          <strong>Unable to load reports.</strong>
          <div style={{ marginTop: "8px", color: "#7f1d1d" }}>{error}</div>
        </div>
      )}

      {status !== "error" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "14px",
              marginBottom: "18px",
            }}
          >
            <SummaryCard label="Courses" value={summary.courses} />
            <SummaryCard label="Active Courses" value={summary.activeCourses} />
            <SummaryCard label="Faculty" value={summary.faculty} />
            <SummaryCard label="Students" value={summary.students} />
            <SummaryCard label="Student Seats" value={summary.studentSeats} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "16px",
            }}
          >
            {reportCards.map((card) => (
              <ReportCard key={card.title} card={card} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div style={{ background: "white", border: "1px solid #d7d7d7", borderRadius: "12px", padding: "16px" }}>
      <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "26px", fontWeight: 800 }}>{value}</div>
    </div>
  )
}

function ReportCard({ card }) {
  const content = (
    <div
      style={{
        background: "white",
        border: "1px solid #d7d7d7",
        borderRadius: "14px",
        padding: "18px",
        minHeight: "150px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
        <h2 style={{ margin: 0, fontSize: "20px" }}>{card.title}</h2>
        <span
          style={{
            height: "fit-content",
            border: "1px solid #cbd5e1",
            borderRadius: "999px",
            padding: "5px 10px",
            fontSize: "13px",
            fontWeight: 800,
            background: "#f8fafc",
            whiteSpace: "nowrap",
          }}
        >
          {card.status}
        </span>
      </div>

      <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.55 }}>{card.description}</p>

      <div style={{ marginTop: "18px", fontWeight: 800 }}>
        {card.to ? "Open report area →" : "Coming later"}
      </div>
    </div>
  )

  if (!card.to) {
    return content
  }

  return (
    <Link to={card.to} style={{ color: "inherit", textDecoration: "none" }}>
      {content}
    </Link>
  )
}
