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

export default function StudentNextStepsPanel() {
  return (
    <section className="panel">
      <SectionHeader
        title="My Next Steps"
        subtitle="A simple checklist to help you stay organized in this course."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" }}>
        <DetailCard title="1. Check Your Standing">
          <div style={{ lineHeight: 1.5 }}>
            Review your current standing and proficiency so you know how you are doing right now.
          </div>
        </DetailCard>

        <DetailCard title="2. Review Latest Feedback">
          <div style={{ lineHeight: 1.5 }}>
            Read your latest teacher feedback and KDU evidence before starting the next task.
          </div>
        </DetailCard>

        <DetailCard title="3. Open Your Next Assignment">
          <div style={{ lineHeight: 1.5 }}>
            Use Open Assignment to continue your work or review assignment details.
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
