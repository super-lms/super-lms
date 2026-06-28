function SectionHeader({ title, subtitle, action }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "12px",
        flexWrap: "wrap",
        marginBottom: "16px",
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>{title}</h2>
        {subtitle ? (
          <p style={{ margin: "6px 0 0 0", fontSize: "0.95rem", lineHeight: 1.5, color: "#4b5563" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action || null}
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

export default function StudentCourseProgressPanel({
  courseProgressLoading = false,
  proficiencyLabel = "Not available yet",
  standing = "—",
  latestResultTitle = "No graded result yet",
  latestResultScore = "—",
  latestResultFeedback = "",
}) {
  return (
    <section className="panel">
      <SectionHeader
        title={courseProgressLoading ? "Loading Course Progress..." : `You're Currently ${proficiencyLabel}`}
        subtitle={
          courseProgressLoading
            ? "Checking submitted and graded work for the selected course."
            : "This is your current learning snapshot based on graded evidence your teacher has returned."
        }
      />

      {courseProgressLoading ? (
        <NoticeBox>⏳ Loading course progress...</NoticeBox>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 1fr) minmax(0, 1.2fr)", gap: "14px" }}>
        <DetailCard title="Current Standing">
          <div style={{ fontSize: "2.4rem", fontWeight: 800 }}>{standing}</div>
          <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
            Your current course standing from graded evidence.
          </div>
        </DetailCard>

        <DetailCard title="Latest Graded Result">
          <div style={{ fontSize: "1.15rem", fontWeight: 800, lineHeight: 1.3 }}>
            {latestResultTitle}
          </div>
          <div style={{ marginTop: "8px", fontSize: "2rem", fontWeight: 800 }}>
            {latestResultScore}
          </div>
          <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
            {latestResultFeedback || "Teacher feedback will appear here when available."}
          </div>
        </DetailCard>

        <DetailCard title="What This Means">
          <div style={{ lineHeight: 1.6 }}>
            {proficiencyLabel === "Extending"
              ? "You are demonstrating strong understanding and application of course concepts. Keep maintaining high-quality work and reviewing teacher feedback."
              : proficiencyLabel === "Proficient"
                ? "You are meeting important course expectations. Review feedback carefully and look for ways to deepen your explanations and applications."
                : proficiencyLabel === "Developing"
                  ? "You are building the required skills. Focus on feedback, complete missing work, and ask for help when a task is unclear."
                  : proficiencyLabel === "Emerging"
                    ? "You are beginning to show evidence of learning. Your next step is to complete current assignments and review teacher feedback."
                    : "Once your teacher returns graded evidence, your current standing and next steps will appear here."}
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
