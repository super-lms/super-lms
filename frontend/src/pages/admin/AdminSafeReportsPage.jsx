import { useEffect, useState } from "react"
import authFetch from "../../services/authFetch"

export default function AdminSafeReportsPage() {
  const [reports, setReports] = useState([])
  const [status, setStatus] = useState("loading")
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function loadSafeReports() {
      try {
        setStatus("loading")
        setError("")

        const response = await authFetch("/api/admin/safe-reports")
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to load safe reports")
        }

        if (isMounted) {
          setReports(Array.isArray(data.reports) ? data.reports : [])
          setStatus("ready")
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load safe reports")
          setStatus("error")
        }
      }
    }

    loadSafeReports()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div>
      <div style={{ marginBottom: "22px" }}>
        <h1 style={{ margin: 0, fontSize: "28px" }}>Safe Reports</h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "16px",
            color: "#4b5563",
            lineHeight: 1.6,
            maxWidth: "900px",
          }}
        >
          Review safety concerns submitted by students. These reports may contain
          sensitive information and should only be accessed by authorized staff.
        </p>
      </div>

      {status === "loading" ? (
        <div style={panelStyle}>Loading safe reports...</div>
      ) : null}

      {status === "error" ? (
        <div
          style={{
            ...panelStyle,
            border: "1px solid #b91c1c",
            color: "#7f1d1d",
          }}
        >
          <strong>Unable to load safe reports.</strong>
          <div style={{ marginTop: "8px" }}>{error}</div>
        </div>
      ) : null}

      {status === "ready" && reports.length === 0 ? (
        <div style={panelStyle}>
          <h2 style={{ margin: "0 0 8px", fontSize: "20px" }}>No Safe Reports</h2>
          <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.6 }}>
            There are currently no student Safe Reports to review.
          </p>
        </div>
      ) : null}

      {status === "ready" && reports.length > 0 ? (
        <div style={{ display: "grid", gap: "16px" }}>
          {reports.map((report) => (
            <SafeReportCard key={report.id} report={report} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SafeReportCard({ report }) {
  const createdAt = report.created_at
    ? new Date(report.created_at).toLocaleString()
    : "—"

  return (
    <section style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "13px",
              color: "#6b7280",
              fontWeight: 700,
              marginBottom: "5px",
            }}
          >
            SAFE REPORT #{report.id}
          </div>
          <h2 style={{ margin: 0, fontSize: "21px" }}>
            {report.category || "Safety Concern"}
          </h2>
        </div>

        <span
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: "999px",
            padding: "6px 11px",
            background: "#f8fafc",
            fontSize: "13px",
            fontWeight: 800,
          }}
        >
          {report.status || "New"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <Detail label="Student" value={report.student_name || "—"} />
        <Detail label="Student Email" value={report.student_email || "—"} />
        <Detail label="Submitted" value={createdAt} />
        <Detail label="Location" value={report.location || "Not provided"} />
        <Detail
          label="People Involved"
          value={report.people_involved || "Not provided"}
        />
        <Detail
          label="Attachment"
          value={report.attachment_original_name || "None"}
        />
      </div>

      <div
        style={{
          borderTop: "1px solid #e5e7eb",
          paddingTop: "16px",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            color: "#6b7280",
            fontWeight: 800,
            marginBottom: "7px",
          }}
        >
          DESCRIPTION
        </div>
        <div style={{ lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
          {report.description || "No description provided."}
        </div>
      </div>
    </section>
  )
}

function Detail({ label, value }) {
  return (
    <div>
      <div
        style={{
          fontSize: "12px",
          color: "#6b7280",
          fontWeight: 800,
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div style={{ lineHeight: 1.5, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  )
}

const panelStyle = {
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "14px",
  padding: "18px",
}
