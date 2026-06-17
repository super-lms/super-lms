import { useState } from "react"

export default function FloatingTeacherCoach({
  title = "Teacher Coach",
  subtitle = "SUPER LMS Guide",
  recommendationTitle = "Check your next step",
  recommendationReason = "SUPER LMS can help guide the teacher workflow.",
  recommendationAction = "Review the current page and continue with the next teaching task.",
  actionButtonLabel = "",
  onAction = null,
  children = null,
}) {
  const [open, setOpen] = useState(true)

  return (
    <div style={teacherCoachShellStyle}>
      {open ? (
        <div style={teacherCoachPanelStyle}>
          <div style={teacherCoachHeaderStyle}>
            <div>
              <div style={{ fontWeight: 900 }}>{title}</div>
              <div style={{ fontSize: "0.9rem", color: "#4b5563" }}>{subtitle}</div>
            </div>

            <button type="button" onClick={() => setOpen(false)} style={teacherCoachSmallButtonStyle}>
              Close
            </button>
          </div>

          <div style={teacherCoachRecommendationStyle}>
            <div style={{ fontWeight: 900, marginBottom: "6px" }}>SUPER LMS Recommends</div>
            <div>
              <strong>Next Step:</strong> {recommendationTitle}
            </div>
            <div style={{ marginTop: "6px", color: "#4b5563" }}>
              <strong>Reason:</strong> {recommendationReason}
            </div>
            <div style={{ marginTop: "6px" }}>
              <strong>Do this:</strong> {recommendationAction}
            </div>

            {actionButtonLabel && typeof onAction === "function" ? (
              <div style={{ marginTop: "10px" }}>
                <button type="button" onClick={onAction} style={primaryButtonStyle}>
                  {actionButtonLabel}
                </button>
              </div>
            ) : null}
          </div>

          {children ? <div style={teacherCoachStepStyle}>{children}</div> : null}
        </div>
      ) : null}

      <button type="button" onClick={() => setOpen((value) => !value)} style={teacherCoachButtonStyle}>
        {open ? "Hide Coach" : "Need Help?"}
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

const primaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "2px solid #111827",
  background: "#111827",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
}
