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

function NoticeBox({ children, type = "info" }) {
  const borderColor = type === "error" ? "#d1a1a1" : "#cfd8e3"
  const background = type === "error" ? "#fff8f8" : "#f8fafc"

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: "12px", padding: "14px 16px", background, lineHeight: 1.5 }}>
      {children}
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

function formatDueDate(value) {
  if (!value) return "No due date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toLocaleDateString()
}

export default function StudentUpcomingDueDatesPanel({
  selectedCourseId = "",
  upcomingAssignments = [],
}) {
  return (
    <section className="panel">
      <SectionHeader
        title="Upcoming Due Dates"
        subtitle="Assignments coming up soon in your selected course."
      />

      {!selectedCourseId ? (
        <NoticeBox>Select a course above to view upcoming due dates.</NoticeBox>
      ) : upcomingAssignments.length === 0 ? (
        <NoticeBox>No upcoming assignments found for this course.</NoticeBox>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" }}>
          {upcomingAssignments.slice(0, 3).map((assignment) => (
            <DetailCard key={assignment.id} title={assignment.title || "Untitled Assignment"}>
              <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>
                Due: {formatDueDate(assignment.due_date)}
              </div>
              <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                {assignment.description || "Open the assignment to review the details."}
              </div>
            </DetailCard>
          ))}
        </div>
      )}
    </section>
  )
}

const detailCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "14px",
  background: "#ffffff",
}
