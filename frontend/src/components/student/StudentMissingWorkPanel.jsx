import { displayAssignmentTime } from "../../services/assignmentTime.js"
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

function formatDueDate(value) {
  return value ? displayAssignmentTime(value) : "No due date"
}

export default function StudentMissingWorkPanel({ missingAssignments = [] }) {
  return (
    <section className="panel">
      <SectionHeader
        title="Work Needing Attention"
        subtitle="A quick check of assignments that still need attention."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "14px" }}>
        <DetailCard title="Assignments to Review">
          <div style={{ fontSize: "2.4rem", fontWeight: 800 }}>{missingAssignments.length}</div>
          <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
            {missingAssignments.length === 0
              ? "Great job. You are currently caught up."
              : "Review submission and approval status for these assignments."}
          </div>
        </DetailCard>

        <DetailCard title="What To Do Next">
          {missingAssignments.length === 0 ? (
            <div style={{ lineHeight: 1.6 }}>
              Keep reviewing your teacher feedback and prepare for the next assignment.
            </div>
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
  )
}

const detailCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "14px",
  background: "#ffffff",
}
