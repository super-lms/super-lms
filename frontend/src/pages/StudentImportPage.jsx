import { useState } from "react"
import API_BASE from "../apiBase"

export default function StudentImportPage() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const rows = Array.isArray(preview?.rows) ? preview.rows : []
  const reviewRows = rows.filter((row) => row.import_status === "Review")
  const readyRows = rows.filter((row) => row.import_status === "Ready")

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null
    setSelectedFile(file)
    setPreview(null)
    setMessage("")
    setError("")
  }

  async function handlePreviewImport() {
    if (!selectedFile) {
      setError("Please choose an Excel file first.")
      return
    }

    setIsPreviewing(true)
    setMessage("")
    setError("")
    setPreview(null)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const response = await fetch(`${API_BASE}/api/master-students/preview-import`, {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Preview failed.")
      }

      setPreview(data)
      setMessage("Preview complete. Review the summary before importing.")
    } catch (err) {
      setError(err.message || "Preview failed.")
    } finally {
      setIsPreviewing(false)
    }
  }

  async function handleImportStudents() {
    if (!preview || readyRows.length === 0) {
      setError("There are no ready rows to import.")
      return
    }

    setIsImporting(true)
    setMessage("")
    setError("")

    try {
      const response = await fetch(`${API_BASE}/api/master-students/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rows: readyRows }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Import failed.")
      }

      setMessage(`Import complete. ${data.importedCount || 0} students were imported or updated.`)
    } catch (err) {
      setError(err.message || "Import failed.")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div style={pageStyle}>
      <section style={cardStyle}>
        <div style={headerRowStyle}>
          <div>
            <h1 style={titleStyle}>Student Import V1</h1>
            <p style={subtitleStyle}>
              Upload the Master Student Directory Excel file. SUPER LMS will preview rows first,
              then import approved students using PEN as the unique identity field.
            </p>
          </div>
        </div>

        <div style={noticeStyle}>
          <strong>Identity rule:</strong> PEN identifies the student. Names are display information only.
        </div>

        <div style={uploadBoxStyle}>
          <label style={labelStyle} htmlFor="student-import-file">
            Choose Excel file
          </label>
          <input
            id="student-import-file"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            style={inputStyle}
          />

          <div style={fileInfoStyle}>
            <strong>Selected file:</strong>{" "}
            {selectedFile ? selectedFile.name : "No file selected yet"}
          </div>

          <div style={buttonRowStyle}>
            <button
              type="button"
              onClick={handlePreviewImport}
              disabled={!selectedFile || isPreviewing}
              style={primaryButtonStyle}
            >
              {isPreviewing ? "Previewing..." : "Preview Import"}
            </button>

            <button
              type="button"
              onClick={handleImportStudents}
              disabled={!preview || readyRows.length === 0 || isImporting}
              style={secondaryButtonStyle}
            >
              {isImporting ? "Importing..." : "Import Ready Students"}
            </button>
          </div>
        </div>

        {message && <div style={successStyle}>{message}</div>}
        {error && <div style={errorStyle}>{error}</div>}
      </section>

      {preview && (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Import Summary</h2>

          <div style={summaryGridStyle}>
            <SummaryCard label="Rows Found" value={preview.rowCount || 0} />
            <SummaryCard label="Ready" value={preview.readyCount || 0} />
            <SummaryCard label="Review" value={preview.reviewCount || 0} />
            <SummaryCard label="Sheet" value={preview.sheetName || "Unknown"} />
          </div>

          {Array.isArray(preview.missingColumns) && preview.missingColumns.length > 0 && (
            <div style={warningStyle}>
              <strong>Missing required columns:</strong> {preview.missingColumns.join(", ")}
            </div>
          )}
        </section>
      )}

      {preview && (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Rows Requiring Review</h2>

          {reviewRows.length === 0 ? (
            <p style={subtitleStyle}>No review rows found. All rows are ready for import.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Row</th>
                    <th style={thStyle}>PEN</th>
                    <th style={thStyle}>Student</th>
                    <th style={thStyle}>Grade</th>
                    <th style={thStyle}>Issue</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewRows.map((row, index) => (
                    <tr key={`${row.pen || "missing"}-${row.source_row_number || index}`}>
                      <td style={tdStyle}>{row.source_row_number || ""}</td>
                      <td style={tdStyle}>{row.pen || "Missing"}</td>
                      <td style={tdStyle}>{row.display_name || "Missing name"}</td>
                      <td style={tdStyle}>
                        {row.current_grade || "?"} → {row.next_year_grade || "?"}
                      </td>
                      <td style={tdStyle}>
                        {Array.isArray(row.import_issues)
                          ? row.import_issues.join(" ")
                          : "Review needed"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {preview && (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Ready Rows Preview</h2>

          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>PEN</th>
                  <th style={thStyle}>Student</th>
                  <th style={thStyle}>Current Grade</th>
                  <th style={thStyle}>Next Year</th>
                  <th style={thStyle}>Homeform</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {readyRows.slice(0, 25).map((row) => (
                  <tr key={row.pen}>
                    <td style={tdStyle}>{row.pen}</td>
                    <td style={tdStyle}>{row.display_name}</td>
                    <td style={tdStyle}>{row.current_grade}</td>
                    <td style={tdStyle}>{row.next_year_grade}</td>
                    <td style={tdStyle}>{row.current_homeform || ""}</td>
                    <td style={tdStyle}>{row.import_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {readyRows.length > 25 && (
            <p style={subtitleStyle}>
              Showing first 25 ready rows. Total ready rows: {readyRows.length}.
            </p>
          )}
        </section>
      )}
    </div>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={summaryValueStyle}>{value}</div>
    </div>
  )
}

const pageStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "18px",
}

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #d7d7d7",
  borderRadius: "14px",
  padding: "22px",
}

const headerRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
}

const titleStyle = {
  margin: 0,
  fontSize: "28px",
  color: "#111",
}

const subtitleStyle = {
  marginTop: "8px",
  marginBottom: 0,
  color: "#374151",
  lineHeight: 1.5,
}

const sectionTitleStyle = {
  marginTop: 0,
  marginBottom: "14px",
  fontSize: "20px",
  color: "#111",
}

const noticeStyle = {
  marginTop: "18px",
  padding: "12px 14px",
  border: "1px solid #d7d7d7",
  borderRadius: "12px",
  background: "#f9fafb",
  color: "#111",
}

const uploadBoxStyle = {
  marginTop: "18px",
  padding: "16px",
  border: "1px solid #d7d7d7",
  borderRadius: "12px",
  background: "#ffffff",
}

const labelStyle = {
  display: "block",
  fontWeight: 700,
  marginBottom: "8px",
  color: "#111",
}

const inputStyle = {
  display: "block",
  width: "100%",
  maxWidth: "520px",
  padding: "10px",
  border: "1px solid #d7d7d7",
  borderRadius: "10px",
  background: "#ffffff",
}

const fileInfoStyle = {
  marginTop: "12px",
  color: "#111",
}

const buttonRowStyle = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  marginTop: "16px",
}

const primaryButtonStyle = {
  border: "1px solid #111",
  background: "#111",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
}

const secondaryButtonStyle = {
  border: "1px solid #111",
  background: "#ffffff",
  color: "#111",
  borderRadius: "10px",
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
}

const successStyle = {
  marginTop: "14px",
  border: "1px solid #d7d7d7",
  borderRadius: "10px",
  padding: "12px",
  background: "#f9fafb",
  color: "#111",
  fontWeight: 700,
}

const errorStyle = {
  marginTop: "14px",
  border: "2px solid #111",
  borderRadius: "10px",
  padding: "12px",
  background: "#ffffff",
  color: "#111",
  fontWeight: 700,
}

const warningStyle = {
  marginTop: "14px",
  border: "2px solid #111",
  borderRadius: "10px",
  padding: "12px",
  background: "#ffffff",
  color: "#111",
}

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "12px",
}

const summaryCardStyle = {
  border: "1px solid #d7d7d7",
  borderRadius: "12px",
  padding: "14px",
  background: "#f9fafb",
}

const summaryLabelStyle = {
  color: "#374151",
  fontSize: "14px",
  fontWeight: 700,
}

const summaryValueStyle = {
  color: "#111",
  fontSize: "24px",
  fontWeight: 800,
  marginTop: "6px",
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
}

const thStyle = {
  textAlign: "left",
  borderBottom: "2px solid #d7d7d7",
  padding: "10px",
  background: "#f9fafb",
  color: "#111",
}

const tdStyle = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px",
  color: "#111",
}
