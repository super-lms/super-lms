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

function getSuggestedGoal(gradedAverage) {
  if (gradedAverage === null || gradedAverage === undefined) return "Submit first evidence"

  const value = Number(gradedAverage)

  if (Number.isNaN(value)) return "Submit first evidence"
  if (value >= 95) return "Maintain excellence"
  if (value >= 86) return "Aim for 95%"
  if (value >= 73) return "Aim for 86%"
  if (value >= 60) return "Aim for 73%"

  return "Build consistency"
}

function getRecommendedAction(gradedAverage) {
  if (gradedAverage === null || gradedAverage === undefined) {
    return "Open your next assignment and submit evidence so your teacher can give feedback."
  }

  const value = Number(gradedAverage)

  if (Number.isNaN(value)) {
    return "Open your next assignment and submit evidence so your teacher can give feedback."
  }

  if (value >= 95) {
    return "Keep submitting high-quality work and look for enrichment or leadership opportunities."
  }

  if (value >= 86) {
    return "Review teacher feedback, maintain completion, and look for ways to deepen explanations."
  }

  if (value >= 73) {
    return "Focus on improving one KDU area and use teacher feedback before your next submission."
  }

  if (value >= 60) {
    return "Complete missing work, ask for help early, and revise using teacher feedback."
  }

  return "Start with the next assignment, submit evidence, and ask your teacher what to focus on first."
}

export default function StudentGoalsGrowthPanel({
  gradedAverage = null,
  standing = "—",
}) {
  return (
    <section className="panel">
      <SectionHeader
        title="Student Goals & Growth"
        subtitle="Use your current standing and teacher feedback to decide your next learning move."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" }}>
        <DetailCard title="Current Standing">
          <div style={{ fontSize: "2rem", fontWeight: 800 }}>{standing}</div>
          <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
            This is where your returned evidence currently places you.
          </div>
        </DetailCard>

        <DetailCard title="Suggested Goal">
          <div style={{ fontSize: "2rem", fontWeight: 800 }}>
            {getSuggestedGoal(gradedAverage)}
          </div>
          <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
            A simple next target based on your current evidence.
          </div>
        </DetailCard>

        <DetailCard title="Recommended Action">
          <div style={{ lineHeight: 1.6 }}>
            {getRecommendedAction(gradedAverage)}
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
