export default function AssignmentCardsView({
  assignments,
  movingAssignmentId,
  duplicatingAssignmentId,
  deletingAssignmentId,
  formatDate,
  formatPercent,
  getStatusLabel,
  openSpeedGrading,
  openEditAssignment,
  openEditSections,
  moveAssignment,
  duplicateAssignment,
  deleteAssignment,
}) {
  return (
    <div style={assignmentGridStyle}>
      {assignments.map((assignment) => (
        <div key={assignment.id} style={assignmentCardStyle}>
          <h3 style={{ marginTop: 0 }}>{assignment.title || "Untitled Assignment"}</h3>

          <div style={statusPillStyle}>{getStatusLabel(assignment)}</div>

          <p>
            <strong>Due:</strong> {formatDate(assignment.due_date)}
          </p>
          <p>
            <strong>Assessment Pathway:</strong> {assignment.category_name || "Not linked"}
          </p>
          <p>
            <strong>Evidence Tier:</strong> {assignment.subcategory_name || "Not linked"}
          </p>
          <p>
            <strong>Description:</strong> {assignment.description || "No description"}
          </p>
          <p>
            <strong>Weight:</strong> {formatPercent(assignment.calculated_weight)}
          </p>

          <div style={buttonRowStyle}>
            <button
              type="button"
              onClick={() => moveAssignment(assignment.id, "up")}
              disabled={movingAssignmentId === `${assignment.id}-up`}
              style={buttonStyle}
            >
              {movingAssignmentId === `${assignment.id}-up` ? "Moving..." : "↑ Move Up"}
            </button>

            <button
              type="button"
              onClick={() => moveAssignment(assignment.id, "down")}
              disabled={movingAssignmentId === `${assignment.id}-down`}
              style={buttonStyle}
            >
              {movingAssignmentId === `${assignment.id}-down` ? "Moving..." : "↓ Move Down"}
            </button>

            <button type="button" onClick={() => openSpeedGrading(assignment.id)} style={buttonStyle}>
              Open Speed Grading
            </button>

            <button type="button" onClick={() => openEditAssignment(assignment.id)} style={buttonStyle}>
              Open Edit Page
            </button>

            <button type="button" onClick={() => openEditSections(assignment.id)} style={buttonStyle}>
              Edit Sections
            </button>

            <button
              type="button"
              onClick={() => duplicateAssignment(assignment)}
              disabled={String(duplicatingAssignmentId) === String(assignment.id)}
              style={buttonStyle}
            >
              {String(duplicatingAssignmentId) === String(assignment.id) ? "Duplicating..." : "Duplicate"}
            </button>

            <button type="button" onClick={() => openEditAssignment(assignment.id)} style={buttonStyle}>
              Inline Edit
            </button>

            <button
              type="button"
              onClick={() => deleteAssignment(assignment)}
              disabled={String(deletingAssignmentId) === String(assignment.id)}
              style={dangerButtonStyle}
            >
              {String(deletingAssignmentId) === String(assignment.id) ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

const assignmentGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "16px",
}

const assignmentCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "14px",
  padding: "16px",
  background: "#ffffff",
}

const buttonRowStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "14px",
}

const buttonStyle = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #d7dce5",
  background: "#ffffff",
  font: "inherit",
  fontWeight: 800,
  cursor: "pointer",
}

const dangerButtonStyle = {
  ...buttonStyle,
  border: "1px solid #d1a1a1",
  background: "#fff1f1",
}

const statusPillStyle = {
  display: "inline-block",
  border: "1px solid #d7dce5",
  borderRadius: "999px",
  padding: "6px 12px",
  fontWeight: 800,
  marginBottom: "10px",
}