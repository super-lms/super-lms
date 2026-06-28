export default function TeachersPublishedAssignmentsView({
  assignments,
  formatDate,
  formatPercent,
  getStatusLabel,
  getPublishedLabel,
  openSpeedGrading,
  openEditAssignment,
  openEditSections,
}) {
  function getSubmissionSummary(assignment) {
    const submitted = Number(assignment?.submission_count || 0)
    const graded = Number(assignment?.graded_count || 0)
    const missing = Number(assignment?.missing_count || 0)
    const ungraded = Number(assignment?.ungraded_count || 0)

    if (submitted === 0 && graded === 0 && missing === 0 && ungraded === 0) {
      return "No submission data yet"
    }

    if (ungraded > 0) {
      return `${ungraded} waiting to grade`
    }

    if (submitted > 0 && graded >= submitted) {
      return "All submitted work graded"
    }

    return `Submitted ${submitted} · Graded ${graded} · Missing ${missing}`
  }

  function getShortText(value, fallback = "Not linked", maxLength = 34) {
    const text = String(value || fallback).trim()
    if (text.length <= maxLength) return text
    return `${text.slice(0, maxLength - 1)}…`
  }

  return (
    <div>
      <div style={viewIntroStyle}>
        <h3 style={{ margin: 0 }}>Teacher's Published Assignments</h3>
        <p style={{ margin: "6px 0 0", color: "#4b5563" }}>
          Each assignment is shown as a vertical column. Scroll horizontally as the number of assignments grows.
        </p>
      </div>

      <div style={matrixShellStyle}>
        <div style={assignmentMatrixStyle}>
          {assignments.map((assignment) => (
            <article key={assignment.id} style={assignmentColumnStyle}>
              <div style={assignmentHeaderStyle}>
                <div style={statusRowStyle}>
                  <span style={statusPillStyle}>{getPublishedLabel(assignment)}</span>
                  <span style={statusPillStyle}>{getStatusLabel(assignment)}</span>
                </div>

                <button type="button" onClick={() => openEditAssignment(assignment.id)} style={titleButtonStyle}>
                  {assignment.title || "Untitled Assignment"}
                </button>

                <div style={summaryBoxStyle}>{getSubmissionSummary(assignment)}</div>
              </div>

              <div style={infoStackStyle}>
                <InfoRow label="Due" value={formatDate(assignment.due_date)} />
                <InfoRow label="Weight" value={formatPercent(assignment.calculated_weight)} />
                <InfoRow
                  label="Pathway"
                  value={getShortText(assignment.category_name)}
                  title={assignment.category_name || "Not linked"}
                />
                <InfoRow
                  label="Evidence"
                  value={getShortText(assignment.subcategory_name)}
                  title={assignment.subcategory_name || "Not linked"}
                />
              </div>

              <div style={buttonBlockStyle}>
                <button type="button" onClick={() => openSpeedGrading(assignment.id)} style={primaryButtonStyle}>
                  Grade
                </button>

                <button type="button" onClick={() => openEditAssignment(assignment.id)} style={buttonStyle}>
                  Full Detail
                </button>

                <button type="button" onClick={() => openEditSections(assignment.id)} style={buttonStyle}>
                  Sections
                </button>
              </div>

              <div style={futureRowsStyle}>
                <div style={futureRowsTitleStyle}>Student Rows</div>
                <div style={futureRowsTextStyle}>Ready for student submission rows in the next phase.</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, title }) {
  return (
    <div style={infoRowStyle}>
      <div style={infoLabelStyle}>{label}</div>
      <div style={infoValueStyle} title={title || value}>
        {value}
      </div>
    </div>
  )
}

const viewIntroStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "14px",
  padding: "14px 16px",
  background: "#f8fafc",
  marginBottom: "14px",
}

const matrixShellStyle = {
  width: "100%",
  overflowX: "auto",
  border: "1px solid #d7dce5",
  borderRadius: "14px",
  background: "#ffffff",
}

const assignmentMatrixStyle = {
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "280px",
  alignItems: "stretch",
  minHeight: "520px",
}

const assignmentColumnStyle = {
  display: "grid",
  gridTemplateRows: "auto auto auto 1fr",
  borderRight: "1px solid #d7dce5",
  background: "#ffffff",
  minWidth: 0,
}

const assignmentHeaderStyle = {
  padding: "14px",
  borderBottom: "1px solid #d7dce5",
  background: "#f8fafc",
  minHeight: "170px",
}

const statusRowStyle = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
  marginBottom: "10px",
}

const statusPillStyle = {
  display: "inline-block",
  border: "1px solid #d7dce5",
  borderRadius: "999px",
  padding: "5px 9px",
  fontWeight: 900,
  fontSize: "0.76rem",
  background: "#ffffff",
  color: "#111827",
}

const titleButtonStyle = {
  display: "block",
  width: "100%",
  border: 0,
  background: "transparent",
  padding: 0,
  margin: "0 0 10px",
  textAlign: "left",
  color: "#111827",
  font: "inherit",
  fontSize: "1.02rem",
  fontWeight: 900,
  lineHeight: 1.25,
  cursor: "pointer",
}

const summaryBoxStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "10px",
  padding: "8px 10px",
  background: "#ffffff",
  color: "#111827",
  fontSize: "0.86rem",
  fontWeight: 800,
  lineHeight: 1.35,
}

const infoStackStyle = {
  display: "grid",
  gap: 0,
  borderBottom: "1px solid #d7dce5",
}

const infoRowStyle = {
  display: "grid",
  gridTemplateColumns: "82px minmax(0, 1fr)",
  gap: "8px",
  padding: "10px 12px",
  borderBottom: "1px solid #eef2f7",
  alignItems: "start",
}

const infoLabelStyle = {
  color: "#4b5563",
  fontSize: "0.76rem",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
}

const infoValueStyle = {
  color: "#111827",
  fontSize: "0.9rem",
  fontWeight: 800,
  lineHeight: 1.3,
  overflowWrap: "anywhere",
}

const buttonBlockStyle = {
  display: "grid",
  gap: "8px",
  padding: "12px",
  borderBottom: "1px solid #d7dce5",
  background: "#ffffff",
}

const buttonStyle = {
  width: "100%",
  padding: "9px 10px",
  borderRadius: "10px",
  border: "1px solid #d7dce5",
  background: "#ffffff",
  color: "#111827",
  font: "inherit",
  fontSize: "0.88rem",
  fontWeight: 900,
  cursor: "pointer",
}

const primaryButtonStyle = {
  ...buttonStyle,
  border: "2px solid #111827",
}

const futureRowsStyle = {
  padding: "12px",
  background: "#ffffff",
  minHeight: "120px",
}

const futureRowsTitleStyle = {
  fontWeight: 900,
  marginBottom: "6px",
  color: "#111827",
}

const futureRowsTextStyle = {
  color: "#4b5563",
  fontSize: "0.88rem",
  lineHeight: 1.35,
}