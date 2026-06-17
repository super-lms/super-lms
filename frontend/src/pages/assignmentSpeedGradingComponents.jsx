export function SectionHeader({ title, subtitle, action }) {
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
          <p
            style={{
              margin: "6px 0 0 0",
              fontSize: "0.95rem",
              lineHeight: 1.5,
              color: "#4b5563",
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {action || null}
    </div>
  );
}

export function SummaryCard({ label, value, helper }) {
  return (
    <div
      style={{
        border: "1px solid #d7dce5",
        borderRadius: "14px",
        padding: "18px",
        background: "#ffffff",
        boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
      }}
    >
      <div
        style={{
          fontSize: "0.82rem",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#6b7280",
          marginBottom: "10px",
        }}
      >
        {label}
      </div>

      <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>{value}</div>

      <div
        style={{
          marginTop: "10px",
          fontSize: "0.95rem",
          lineHeight: 1.4,
          color: "#4b5563",
        }}
      >
        {helper}
      </div>
    </div>
  );
}

export function NoticeBox({ children, type = "info" }) {
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
      }}
    >
      {children}
    </div>
  );
}

export function ActionButton({
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

export function DetailCard({ title, children }) {
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

export function FieldLabel({ htmlFor, children }) {
  return (
    <label
      htmlFor={htmlFor}
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

export function SwitchControl({
  id,
  label,
  description,
  checked,
  onChange,
  onLabel = "On",
  offLabel = "Off",
}) {
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        minHeight: "68px",
        padding: "12px 14px",
        border: "1px solid #d7dce5",
        borderRadius: "12px",
        background: "#ffffff",
        cursor: "pointer",
        boxSizing: "border-box",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>{label}</div>
        <div
          style={{
            marginTop: "4px",
            fontSize: "0.88rem",
            lineHeight: 1.45,
            color: "#4b5563",
          }}
        >
          {description}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "0.88rem",
            fontWeight: 800,
            minWidth: "28px",
            textAlign: "right",
          }}
        >
          {checked ? onLabel : offLabel}
        </span>

        <span
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            style={{
              position: "absolute",
              opacity: 0,
              width: "1px",
              height: "1px",
              pointerEvents: "none",
            }}
          />
          <span
            aria-hidden="true"
            style={{
              width: "52px",
              height: "30px",
              borderRadius: "999px",
              border: "1px solid #cbd5e1",
              background: checked ? "#dbeafe" : "#e5e7eb",
              display: "inline-flex",
              alignItems: "center",
              padding: "3px",
              boxSizing: "border-box",
              transition: "all 0.2s ease",
            }}
          >
            <span
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "999px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                transform: checked ? "translateX(22px)" : "translateX(0)",
                transition: "transform 0.2s ease",
                boxShadow: "0 1px 2px rgba(16, 24, 40, 0.12)",
              }}
            />
          </span>
        </span>
      </div>
    </label>
  );
}

export function QueueSummaryCard({ title, value, helper }) {
  return (
    <div
      style={{
        border: "1px solid #d7dce5",
        borderRadius: "12px",
        padding: "14px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          fontSize: "0.8rem",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#6b7280",
          marginBottom: "8px",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div
        style={{
          marginTop: "8px",
          fontSize: "0.92rem",
          lineHeight: 1.4,
          color: "#4b5563",
        }}
      >
        {helper}
      </div>
    </div>
  );
}

export function ProgressSnapshotCard({ title, value, helper }) {
  return (
    <div
      style={{
        border: "1px solid #d7dce5",
        borderRadius: "12px",
        padding: "14px",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          fontSize: "0.8rem",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#6b7280",
          marginBottom: "8px",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: "1.4rem", fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
      <div
        style={{
          marginTop: "8px",
          fontSize: "0.9rem",
          lineHeight: 1.45,
          color: "#4b5563",
        }}
      >
        {helper}
      </div>
    </div>
  );
}

export function EmptyStatePanel({ title, description, actions = null }) {
  return (
    <section className="panel">
      <div
        style={{
          border: "1px solid #d7dce5",
          borderRadius: "14px",
          background: "#f8fafc",
          padding: "20px",
        }}
      >
        <div
          style={{
            fontSize: "0.82rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "#6b7280",
            marginBottom: "10px",
          }}
        >
          Speed Grading Status
        </div>

        <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>{title}</h2>

        <p
          style={{
            margin: "10px 0 0 0",
            fontSize: "0.98rem",
            lineHeight: 1.6,
            color: "#4b5563",
            maxWidth: "840px",
          }}
        >
          {description}
        </p>

        {actions ? (
          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "16px",
            }}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
