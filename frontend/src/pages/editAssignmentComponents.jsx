export function EditAssignmentNoticeBox({ type = "info", children }) {
  const borderColor = type === "error" ? "#d1a1a1" : "#cfd8e3";
  const background = type === "error" ? "#fff8f8" : "#f8fafc";

  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: "12px",
        padding: "14px 16px",
        background,
        lineHeight: 1.5,
        marginBottom: "16px",
      }}
    >
      {children}
    </div>
  );
}

export function EditAssignmentActionButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  quiet = false,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 14px",
        borderRadius: "10px",
        border: "1px solid #d7dce5",
        background: quiet ? "#ffffff" : "#f3f4f6",
        font: "inherit",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function EditAssignmentDetailCard({ title, children }) {
  return (
    <div
      style={{
        border: "1px solid #d7dce5",
        borderRadius: "12px",
        padding: "14px",
        background: "#ffffff",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: "10px" }}>{title}</div>
      {children}
    </div>
  );
}

export function EditAssignmentFieldLabel({ children }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: "0.92rem",
        fontWeight: 700,
        marginBottom: "6px",
      }}
    >
      {children}
    </label>
  );
}
