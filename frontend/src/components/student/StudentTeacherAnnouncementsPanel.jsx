function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>{title}</h2>
      {subtitle ? (
        <p style={{ margin: "6px 0 0 0", fontSize: "0.95rem", lineHeight: 1.5, color: "#4b5563" }}>
          {subtitle}
        </p>
      ) : null}
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

export default function StudentTeacherAnnouncementsPanel({ selectedCourse = null }) {
  return (
    <section className="panel">
      <SectionHeader
        title="Teacher Announcements"
        subtitle="Important course messages from your teacher will appear here."
      />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 1.2fr)", gap: "14px" }}>
        <DetailCard title={selectedCourse?.title || selectedCourse?.class_name || "Selected Course"}>
          <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>
            Welcome to your course dashboard.
          </div>
          <div style={{ marginTop: "8px", color: "#4b5563", lineHeight: 1.6 }}>
            Check your standing, review your latest feedback, and open your next assignment when you are ready.
          </div>
        </DetailCard>

        <DetailCard title="Reminders">
          <div style={{ lineHeight: 1.7 }}>
            • Review teacher feedback before starting your next task.<br />
            • Keep track of upcoming due dates.<br />
            • Ask for help early if an assignment is unclear.
          </div>
        </DetailCard>
      </div>
    </section>
  )
}

const detailCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "14px",
  background: "#ffffff",
}
