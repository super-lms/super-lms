function SummaryCard({ label, value, helper }) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div style={summaryHelperStyle}>{helper}</div>
    </div>
  )
}

export default function StudentSummaryCards({
  courses = [],
  selectedCourse = null,
  selectedCourseId = "",
  dueSoonCount = 0,
  submittedCount = 0,
  gradedCount = 0,
  standing = "—",
  lessonsCount = 0,
  assignmentsCount = 0,
}) {
  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "16px" }}>
      <SummaryCard label="Courses" value={courses.length} helper="Courses currently visible in the student portal." />

      <SummaryCard
        label="Due Soon"
        value={dueSoonCount}
        helper={selectedCourse ? `Assignments approaching due date in ${selectedCourse.title || selectedCourse.class_name}.` : "Assignments approaching due date across the portal."}
      />

      <SummaryCard
        label="Submitted"
        value={submittedCount}
        helper={selectedCourseId ? "Assignments already submitted in the selected course." : "Assignments already submitted across the portal."}
      />

      <SummaryCard
        label="Graded"
        value={gradedCount}
        helper={selectedCourseId ? "Assignments with returned scores in the selected course." : "Assignments with returned scores across the portal."}
      />

      <SummaryCard label="Standing" value={standing} helper="Current standing from graded evidence currently shown." />

      <SummaryCard
        label="Lessons"
        value={lessonsCount}
        helper={selectedCourseId ? "Lessons for the selected course." : "Total lessons loaded into the student view."}
      />

      <SummaryCard
        label="Assignments"
        value={assignmentsCount}
        helper={selectedCourseId ? "Assignments for the selected course." : "Total assignments loaded into the student view."}
      />
    </section>
  )
}

const summaryCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "14px",
  padding: "18px",
  background: "#ffffff",
  boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
}

const summaryLabelStyle = {
  fontSize: "0.82rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#6b7280",
  marginBottom: "10px",
}

const summaryHelperStyle = {
  marginTop: "10px",
  fontSize: "0.95rem",
  lineHeight: 1.4,
  color: "#4b5563",
}
