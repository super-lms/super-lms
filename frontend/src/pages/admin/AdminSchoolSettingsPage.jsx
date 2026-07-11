import { useEffect, useMemo, useState } from "react"
import authFetch from "../../services/authFetch"

export default function AdminSchoolSettingsPage() {
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

        if (!coursesResponse.ok) throw new Error(coursesData.error || "Failed to load courses")
        if (!usersResponse.ok) throw new Error(usersData.error || "Failed to load users")

        if (!mounted) return

        setCourses(Array.isArray(coursesData) ? coursesData : [])
        setUsers(Array.isArray(usersData) ? usersData : [])
        setStatus("ready")
      } catch (err) {
        if (!mounted) return
        setError(err.message || "Failed to load school settings")
        setStatus("error")
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  const settingsSummary = useMemo(() => {
    const admins = users.filter((user) => String(user.role || "").toLowerCase() === "admin")
    const teachers = users.filter((user) => String(user.role || "").toLowerCase() === "teacher")
    const students = users.filter((user) => String(user.role || "").toLowerCase() === "student")
    const parents = users.filter((user) => String(user.role || "").toLowerCase() === "parent")
    const observers = users.filter((user) => String(user.role || "").toLowerCase() === "observer")

    return {
      admins: admins.length,
      teachers: teachers.length,
      students: students.length,
      parents: parents.length,
      observers: observers.length,
      courses: courses.length,
    }
  }, [courses, users])

  if (status === "error") {
    return (
      <div style={{ background: "white", border: "1px solid #b91c1c", borderRadius: "14px", padding: "18px" }}>
        <strong>Unable to load school settings.</strong>
        <div style={{ marginTop: "8px", color: "#7f1d1d" }}>{error}</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: "22px" }}>
        <h1 style={{ margin: 0, fontSize: "28px" }}>School Settings</h1>
        <p style={{ margin: "8px 0 0", fontSize: "16px", color: "#4b5563", lineHeight: 1.6 }}>
          Safe administrative overview of school configuration. Editable settings can be added here after the core pilot workflows are stable.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
          marginBottom: "18px",
        }}
      >
        <SummaryCard label="Courses" value={settingsSummary.courses} />
        <SummaryCard label="Admins" value={settingsSummary.admins} />
        <SummaryCard label="Teachers" value={settingsSummary.teachers} />
        <SummaryCard label="Students" value={settingsSummary.students} />
        <SummaryCard label="Parents" value={settingsSummary.parents} />
        <SummaryCard label="Observers" value={settingsSummary.observers} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "16px",
        }}
      >
        <SettingsPanel
          title="School Identity"
          rows={[
            ["School", "CBC Wenzhou"],
            ["Program", "BC Offshore School"],
            ["System", "SUPER LMS"],
            ["Pilot Focus", "August whole-school readiness"],
          ]}
        />

        <SettingsPanel
          title="User Roles"
          rows={[
            ["Admin", "Full school workspace"],
            ["Teacher", "Courses, assignments, grading, reports"],
            ["Student", "Dashboard, lessons, assignments, submissions"],
            ["Observer", "Homeroom observer portal"],
            ["Parent", "Parent dashboard"],
          ]}
        />

        <SettingsPanel
          title="Current Configuration"
          rows={[
            ["Data Source", "Live PostgreSQL-backed API"],
            ["Courses API", "/api/courses"],
            ["Users API", "/api/users"],
            ["Gradebooks API", "/api/classes/:classId/gradebook"],
            ["Status", status === "loading" ? "Loading..." : "Operational"],
          ]}
        />

        <SettingsPanel
          title="Future Editable Settings"
          rows={[
            ["Terms / Semesters", "Planned"],
            ["School Year", "Planned"],
            ["Grading Defaults", "Planned"],
            ["Report Templates", "Planned"],
            ["Attendance Defaults", "Planned"],
          ]}
        />
      </div>
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

function SettingsPanel({ title, rows }) {
  return (
    <div style={{ background: "white", border: "1px solid #d7d7d7", borderRadius: "14px", padding: "18px" }}>
      <h2 style={{ marginTop: 0, fontSize: "20px" }}>{title}</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {rows.map(([label, value]) => (
          <div
            key={label}
            style={{
              display: "grid",
              gridTemplateColumns: "140px 1fr",
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
