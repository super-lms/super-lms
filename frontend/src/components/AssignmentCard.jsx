export default function AssignmentCard({ title, compact, children, style }) {
  if (!compact) return (
    <div style={{ border: "1px solid #d7dce5", borderRadius: "12px", padding: "14px", background: "#ffffff", ...style }}>
      <div style={{ fontWeight: 800, marginBottom: "10px" }}>{title}</div>
      {children}
    </div>
  )

  return (
    <details style={{
      gridColumn: "1 / -1",
      border: "1px solid #d7dce5",
      borderRadius: "12px",
      padding: "12px 14px",
      background: "#ffffff",
    }}>
      <summary
        title="Expand or collapse assignment details"
        style={{ cursor: "pointer", lineHeight: 1.6, overflowWrap: "anywhere" }}
      >
        <strong>{title}</strong>
        <span style={{ marginLeft: "12px", color: "#166534", fontSize: "0.85rem", fontWeight: 700 }}>
          All submissions marked
        </span>
      </summary>
      <div style={{ marginTop: "12px" }}>{children}</div>
    </details>
  )
}

