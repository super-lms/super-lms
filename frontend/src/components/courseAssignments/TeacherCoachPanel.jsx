export default function TeacherCoachPanel({
  coachOpen,
  setCoachOpen,
  coachRecommendation,
}) {
  return (
    <div style={teacherCoachShellStyle}>
      {coachOpen ? (
        <div style={teacherCoachPanelStyle}>
          <div style={teacherCoachHeaderStyle}>
            <div>
              <div style={{ fontWeight: 900 }}>Teacher Coach</div>
              <div style={{ fontSize: "0.9rem", color: "#4b5563" }}>
                Assignment Readiness Coach
              </div>
            </div>

            <button type="button" onClick={() => setCoachOpen(false)} style={teacherCoachSmallButtonStyle}>
              Close
            </button>
          </div>

          <div style={teacherCoachRecommendationStyle}>
            <div style={{ fontWeight: 900, marginBottom: "6px" }}>SUPER LMS Recommends</div>
            <div>
              <strong>Next Step:</strong> {coachRecommendation.title}
            </div>
            <div style={{ marginTop: "6px", color: "#4b5563" }}>
              <strong>Reason:</strong> {coachRecommendation.reason}
            </div>
            <div style={{ marginTop: "6px" }}>
              <strong>Do this:</strong> {coachRecommendation.action}
            </div>
            <div style={{ marginTop: "6px" }}>
              <strong>Readiness:</strong> {coachRecommendation.readiness}
            </div>
          </div>

          <div style={teacherCoachStepStyle}>
            <div style={{ fontWeight: 900, marginBottom: "6px" }}>Before grading, check:</div>
            <div style={{ color: "#111827", lineHeight: 1.55 }}>
              <div>□ Assignment exists</div>
              <div>□ Edit Sections has KNOW, DO, and UNDERSTAND evidence where needed</div>
              <div>□ Section out-of marks and weights make sense</div>
              <div>□ Students are enrolled in the course</div>
              <div>□ Open Speed Grading when ready to enter raw marks</div>
            </div>
          </div>
        </div>
      ) : null}

      <button type="button" onClick={() => setCoachOpen((value) => !value)} style={teacherCoachButtonStyle}>
        {coachOpen ? "Hide Coach" : "Need Help?"}
      </button>
    </div>
  )
}

const teacherCoachShellStyle = {
  position: "fixed",
  right: "20px",
  bottom: "20px",
  zIndex: 1000,
  display: "grid",
  gap: "10px",
  justifyItems: "end",
}

const teacherCoachPanelStyle = {
  width: "min(420px, calc(100vw - 40px))",
  border: "2px solid #111827",
  borderRadius: "16px",
  padding: "16px",
  background: "#ffffff",
  boxShadow: "0 18px 40px rgba(0, 0, 0, 0.22)",
}

const teacherCoachHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
}

const teacherCoachRecommendationStyle = {
  marginTop: "12px",
  border: "2px solid #111827",
  borderRadius: "12px",
  padding: "12px",
  background: "#f8fafc",
  lineHeight: 1.45,
}

const teacherCoachStepStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "14px",
  marginTop: "12px",
  background: "#ffffff",
}

const teacherCoachButtonStyle = {
  padding: "12px 16px",
  borderRadius: "999px",
  border: "2px solid #111827",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.22)",
}

const teacherCoachSmallButtonStyle = {
  padding: "8px 10px",
  borderRadius: "10px",
  border: "1px solid #d7dce5",
  background: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
}
