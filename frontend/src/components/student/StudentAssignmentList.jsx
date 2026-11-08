import FeedbackFiles from "../FeedbackFiles.jsx"
import StudentStatusBadge from "./StudentStatusBadge.jsx"

export function AssignmentViewToggle({ value, onChange }) {
  return <div role="group" aria-label="Assignment layout" className="student-layout-toggle">
    <button type="button" aria-pressed={value === "table"} onClick={() => onChange("table")}>Table view</button>
    <button type="button" aria-pressed={value === "list"} onClick={() => onChange("list")}>List view</button>
  </div>
}

export default function StudentAssignmentList({ visible = true, assignments, states, showResults = false, showFeedbackFiles = false, attachmentMessages = {}, formatDate, formatStatus, onOpen }) {
  if (!visible) return null
  return <div className="student-assignment-list">
    {assignments.map(assignment => {
      const state = states[String(assignment.id)] || {}
      const submission = state.submission || {}
      const status = state.submission_status || "not_submitted"
      return <article key={assignment.id} className="student-assignment-list-card">
        <h3>{assignment.title || "Untitled Assignment"}</h3>
        <p><strong>Due:</strong> {formatDate(assignment.due_date)}</p>
        <StudentStatusBadge status={status} label={attachmentMessages[String(assignment.id)] ? "Draft Saved" : formatStatus(status)} />
        {showResults ? <>
          <p><strong>Score:</strong> {submission.score === null || submission.score === undefined ? "Not graded" : submission.score}</p>
          <p><strong>KDU evidence:</strong> KNOW: {submission.rubric_selection?.KNOW ?? "—"} · DO: {submission.rubric_selection?.DO ?? "—"} · UNDERSTAND: {submission.rubric_selection?.UNDERSTAND ?? "—"}</p>
          <p style={{whiteSpace:"pre-wrap"}}><strong>Teacher feedback:</strong> {submission.feedback || "No feedback yet."}</p>
          {showFeedbackFiles ? <FeedbackFiles assignmentId={assignment.id} /> : null}
        </> : null}
        {attachmentMessages[String(assignment.id)] ? <p role="status">{attachmentMessages[String(assignment.id)]}</p> : null}
        <button type="button" aria-label={`Open assignment ${assignment.title || "Untitled Assignment"}`} onClick={() => onOpen(assignment)}>
          {assignment.submission_required === false ? "View Mark" : showResults ? "View Submission" : "Open Assignment"}
        </button>
      </article>
    })}
  </div>
}
