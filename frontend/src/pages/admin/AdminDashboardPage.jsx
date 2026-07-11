import { useNavigate } from "react-router-dom"

export default function AdminDashboardPage() {
  const navigate = useNavigate()

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: "28px" }}>
        Administrator Dashboard
      </h1>

      <p style={{ fontSize: "16px", color: "#4b5563", maxWidth: "900px", lineHeight: 1.6 }}>
        This is the school-wide control centre for SUPER LMS. It will manage courses,
        teachers, students, gradebooks, reports, analytics, and school configuration.
      </p>

      <div style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <AdminCard title="Courses" value="School-wide" onClick={() => navigate("/admin/courses")} />
        <AdminCard title="Teachers" value="Faculty view" onClick={() => navigate("/admin/teachers")} />
        <AdminCard title="Students" value="Master directory" onClick={() => navigate("/admin/students")} />
        <AdminCard title="Gradebooks" value="Cross-course" onClick={() => navigate("/admin/gradebooks")} />
        <AdminCard title="Reports" value="School reporting" onClick={() => navigate("/admin/reports")} />
        <AdminCard title="Analytics" value="Pilot readiness" onClick={() => navigate("/admin/analytics")} />
      </div>
    </div>
  )
}

function AdminCard({ title, value, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ background: "white", border: "1px solid #d7d7d7", borderRadius: "14px", padding: "18px", textAlign: "left", cursor: "pointer" }}>
      <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "8px" }}>{title}</div>
      <div style={{ fontSize: "22px", fontWeight: 800, color: "#111827" }}>{value}</div>
    </button>
  )
}
