import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import authFetch from "../../services/authFetch"

export default function AdminSystemPage() {
  const [courses, setCourses] = useState([])
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState("loading")
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const [coursesResponse, usersResponse] = await Promise.all([
          authFetch("/api/courses"),
          authFetch("/api/users"),
        ])

        const coursesData = await coursesResponse.json()
        const usersData = await usersResponse.json()

        if (!coursesResponse.ok) throw new Error(coursesData.error || "Courses API failed")
        if (!usersResponse.ok) throw new Error(usersData.error || "Users API failed")

        if (!mounted) return

        setCourses(Array.isArray(coursesData) ? coursesData : [])
        setUsers(Array.isArray(usersData) ? usersData : [])
        setStatus("ready")
      } catch (err) {
        if (!mounted) return
        setError(err.message || "System check failed")
        setStatus("error")
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  const system = useMemo(() => {
    const roleCounts = users.reduce((counts, user) => {
      const role = String(user.role || "unknown").toLowerCase()
      counts[role] = (counts[role] || 0) + 1
      return counts
    }, {})

    const activeCourses = courses.filter((course) => Number(course.student_count || 0) > 0)
    const studentSeats = courses.reduce((sum, course) => sum + Number(course.student_count || 0), 0)

    return {
      users: users.length,
      courses: courses.length,
      activeCourses: activeCourses.length,
      studentSeats,
      admins: roleCounts.admin || 0,
      teachers: roleCounts.teacher || 0,
      students: roleCounts.student || 0,
      observers: roleCounts.observer || 0,
      parents: roleCounts.parent || 0,
    }
  }, [courses, users])

  const apiStatus = status === "ready" ? "Operational" : status === "loading" ? "Checking..." : "Needs Attention"

  return (
    <div>
      <div style={{ marginBottom: "22px" }}>
        <h1 style={{ margin: 0, fontSize: "28px" }}>System Administration</h1>
        <p style={{ margin: "8px 0 0", fontSize: "16px", color: "#4b5563", lineHeight: 1.6 }}>
          LMS operational control center for system health, user administration, and pilot readiness.
        </p>
      </div>

      {status === "error" && (
        <div style={{ background: "white", border: "1px solid #b91c1c", borderRadius: "14px", padding: "18px", marginBottom: "18px" }}>
          <strong>System check failed.</strong>
          <div style={{ marginTop: "8px", color: "#7f1d1d" }}>{error}</div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
          marginBottom: "18px",
        }}
      >
        <SummaryCard label="API Status" value={apiStatus} small />
        <SummaryCard label="Users" value={system.users} />
        <SummaryCard label="Courses" value={system.courses} />
        <SummaryCard label="Active Courses" value={system.activeCourses} />
        <SummaryCard label="Student Seats" value={system.studentSeats} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px",
        }}
      >
        <Panel
          title="System Health"
          rows={[
            ["Frontend", "Operational"],
            ["Backend API", apiStatus],
            ["Database Data", status === "ready" ? "Reachable through API" : "Checking"],
            ["Environment", API_BASE.includes("localhost") ? "Localhost development" : "Deployed API"],
          ]}
        />

        <Panel
          title="User Administration"
          rows={[
            ["Admins", system.admins],
            ["Teachers", system.teachers],
            ["Students", system.students],
            ["Observers", system.observers],
            ["Parents", system.parents],
          ]}
        />

        <Panel
          title="Database Overview"
          rows={[
            ["Users Loaded", system.users],
            ["Courses Loaded", system.courses],
            ["Active Courses", system.activeCourses],
            ["Student Seats", system.studentSeats],
          ]}
        />

        <div style={{ background: "white", border: "1px solid #d7d7d7", borderRadius: "14px", padding: "18px" }}>
          <h2 style={{ marginTop: 0, fontSize: "20px" }}>Administration Links</h2>
          <LinkRow to="/admin/teachers" label="Faculty Directory" />
          <LinkRow to="/admin/students" label="Master Student Directory" />
          <LinkRow to="/admin/courses" label="Course Management" />
          <LinkRow to="/admin/gradebooks" label="School Gradebooks" />
          <LinkRow to="/admin/reports" label="School Reports" />
        </div>

        <Panel
          title="Pilot Readiness"
          rows={[
            ["Admin Workspace", "Complete V1"],
            ["Teacher Workspace", "Operational"],
            ["Student Workspace", "Operational"],
            ["Observer Workspace", "Operational"],
            ["Next Focus", "Pilot workflow testing"],
          ]}
        />

        <Panel
          title="Maintenance"
          rows={[
            ["Backups", "Manual checkpoints in use"],
            ["Schema Changes", "Avoid unless required"],
            ["Deployment", "Build before push"],
            ["Regression Rule", "One objective at a time"],
          ]}
        />
      </div>
    </div>
  )
}

function SummaryCard({ label, value, small = false }) {
  return (
    <div style={{ background: "white", border: "1px solid #d7d7d7", borderRadius: "12px", padding: "16px" }}>
      <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: small ? "20px" : "26px", fontWeight: 800, lineHeight: 1.25 }}>{value}</div>
    </div>
  )
}

function Panel({ title, rows }) {
  return (
    <div style={{ background: "white", border: "1px solid #d7d7d7", borderRadius: "14px", padding: "18px" }}>
      <h2 style={{ marginTop: 0, fontSize: "20px" }}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {rows.map(([label, value]) => (
          <div
            key={label}
            style={{
              display: "grid",
              gridTemplateColumns: "150px 1fr",
              gap: "12px",
              borderBottom: "1px solid #e5e7eb",
              paddingBottom: "8px",
            }}
          >
            <div style={{ fontWeight: 800 }}>{label}</div>
            <div style={{ color: "#374151" }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LinkRow({ to, label }) {
  return (
    <Link
      to={to}
      style={{
        display: "block",
        color: "#111827",
        textDecoration: "none",
        fontWeight: 800,
        borderBottom: "1px solid #e5e7eb",
        padding: "10px 0",
      }}
    >
      {label} →
    </Link>
  )
}
