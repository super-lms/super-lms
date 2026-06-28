export default function AdminDashboardPage() {
  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: "28px" }}>
        Administrator Dashboard
      </h1>

      <p style={{ fontSize: "16px", color: "#4b5563", maxWidth: "900px", lineHeight: 1.6 }}>
        This is the school-wide control centre for SUPER LMS. It will manage courses,
        teachers, students, gradebooks, reports, analytics, and school configuration.
      </p>

      <div
        style={{
          marginTop: "24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
        }}
      >
        <AdminCard title="Courses" value="School-wide" />
        <AdminCard title="Teachers" value="Faculty view" />
        <AdminCard title="Students" value="Master directory" />
        <AdminCard title="Gradebooks" value="Cross-course" />
        <AdminCard title="Reports" value="School reporting" />
        <AdminCard title="Analytics" value="Pilot readiness" />
      </div>
    </div>
  )
}

function AdminCard({ title, value }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #d7d7d7",
        borderRadius: "14px",
        padding: "18px",
      }}
    >
      <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "8px" }}>
        {title}
      </div>
      <div style={{ fontSize: "22px", fontWeight: 800, color: "#111827" }}>
        {value}
      </div>
    </div>
  )
}
