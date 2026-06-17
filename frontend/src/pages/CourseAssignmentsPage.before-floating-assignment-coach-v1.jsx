import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

export default function CourseAssignmentsPage() {
  const { courseId } = useParams()
  const navigate = useNavigate()

  const [course, setCourse] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [movingAssignmentId, setMovingAssignmentId] = useState("")
  const [duplicatingAssignmentId, setDuplicatingAssignmentId] = useState("")
  const [deletingAssignmentId, setDeletingAssignmentId] = useState("")
  const [coachOpen, setCoachOpen] = useState(true)

  useEffect(() => {
    loadPage()
  }, [courseId])

  async function loadPage() {
    try {
      setLoading(true)
      setError("")

      const [classesRes, assignmentsRes] = await Promise.all([
        fetch("http://localhost:3000/api/classes"),
        fetch("http://localhost:3000/api/assignments"),
      ])

      const classesData = await classesRes.json()
      const assignmentsData = await assignmentsRes.json()

      if (!classesRes.ok) throw new Error(classesData.error || "Failed to load courses")
      if (!assignmentsRes.ok) throw new Error(assignmentsData.error || "Failed to load assignments")

      const matchingCourse = Array.isArray(classesData)
        ? classesData.find((item) => String(item.id) === String(courseId))
        : null

      setCourse(matchingCourse || null)
      setAssignments(Array.isArray(assignmentsData) ? assignmentsData : [])
    } catch (err) {
      setError(err.message || "Failed to load course assignments")
    } finally {
      setLoading(false)
    }
  }

  async function refreshAssignments() {
    const assignmentsRes = await fetch("http://localhost:3000/api/assignments")
    const assignmentsData = await assignmentsRes.json()

    if (!assignmentsRes.ok) throw new Error(assignmentsData.error || "Failed to reload assignments")

    setAssignments(Array.isArray(assignmentsData) ? assignmentsData : [])
  }

  const courseAssignments = useMemo(() => {
    return assignments.filter((assignment) => String(assignment.class_id) === String(courseId))
  }, [assignments, courseId])

  const coachRecommendation = useMemo(() => {
    const count = courseAssignments.length

    if (count === 0) {
      return {
        nextStep: "Create your first assignment",
        reason:
          "This course does not have any assignments yet. Students and parents will not see course evidence until at least one assignment exists.",
        doThis:
          "Go back to the course card and use + Create Assignment. After creating it, return here to check sections and grading readiness.",
        readiness: "Not ready for grading yet.",
      }
    }

    return {
      nextStep: "Check assignment sections before grading",
      reason:
        "Assignments are created, but raw mark grading works best when each assignment has clear exam sections connected to KNOW, DO, and UNDERSTAND evidence.",
      doThis:
        "Choose an assignment, click Edit Sections, confirm the section names, KDU buckets, out-of marks, and weights. Then use Open Speed Grading when you are ready to enter marks.",
      readiness: `${count} assignment${count === 1 ? "" : "s"} found. Next step is to verify grading structure.`,
    }
  }, [courseAssignments])

  function formatDate(value) {
    if (!value) return "No due date"
    return String(value).slice(0, 10)
  }

  function formatPercent(value) {
    const numberValue = Number(value)
    if (!Number.isFinite(numberValue)) return "Not calculated"
    return `${numberValue.toFixed(2)}%`
  }

  function getStatusLabel(assignment) {
    const submissions = Number(assignment?.submission_count || 0)
    const graded = Number(assignment?.graded_count || 0)
    const ungraded = Number(assignment?.ungraded_count || 0)

    if (submissions === 0) return "No Submissions"
    if (ungraded > 0) return "Ready to Grade"
    if (graded > 0 && graded >= submissions) return "Completed"
    return "Current"
  }

  function openSpeedGrading(assignmentId) {
    navigate(`/assignments/${assignmentId}/grade`)
  }

  function openEditAssignment(assignmentId) {
    navigate(`/assignments/${assignmentId}/edit`)
  }

  function openEditSections(assignmentId) {
    window.location.href = `/assignments/${assignmentId}/edit#exam-sections`
  }

  async function moveAssignment(assignmentId, direction) {
    if (!assignmentId || !["up", "down"].includes(direction)) {
      setError("Valid assignment and move direction are required.")
      setMessage("")
      return
    }

    try {
      setMovingAssignmentId(`${assignmentId}-${direction}`)
      setError("")
      setMessage("")

      const response = await fetch(`http://localhost:3000/api/assignments/${assignmentId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to reorder assignment")
      }

      setMessage(data.moved ? `Assignment moved ${direction}.` : data.reason || "Assignment order unchanged.")
      await refreshAssignments()
    } catch (err) {
      setError(err.message || "Failed to reorder assignment")
    } finally {
      setMovingAssignmentId("")
    }
  }

  async function duplicateAssignment(assignment) {
    const assignmentId = Number(assignment?.id || 0)
    const currentTitle = String(assignment?.title || "Assignment").trim()
    const defaultTitle = currentTitle.endsWith(" Copy") ? `${currentTitle} 2` : `${currentTitle} Copy`

    if (!assignmentId) {
      setError("Valid assignment is required.")
      setMessage("")
      return
    }

    const requestedTitle = window.prompt("New duplicated assignment name:", defaultTitle)

    if (requestedTitle === null) return

    const title = String(requestedTitle || "").trim()

    if (!title) {
      setError("Duplicated assignment name is required.")
      setMessage("")
      return
    }

    const confirmed = window.confirm(
      `Duplicate assignment "${currentTitle}" as "${title}"?\n\nThis will copy the assignment details and exam sections.\n\nIt will not copy student submissions, grades, rubric scores, feedback, or student work.`
    )

    if (!confirmed) return

    try {
      setDuplicatingAssignmentId(String(assignmentId))
      setError("")
      setMessage("")

      const response = await fetch(`http://localhost:3000/api/assignments/${assignmentId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to duplicate assignment")
      }

      setMessage(`Assignment duplicated: ${data.assignment?.title || title}.`)
      await refreshAssignments()
    } catch (err) {
      setError(err.message || "Failed to duplicate assignment")
    } finally {
      setDuplicatingAssignmentId("")
    }
  }

  async function deleteAssignment(assignment) {
    const assignmentId = Number(assignment?.id || 0)
    const assignmentTitle = String(assignment?.title || "this assignment")

    if (!assignmentId) {
      setError("Valid assignment is required.")
      setMessage("")
      return
    }

    const confirmed = window.confirm(
      `Delete assignment "${assignmentTitle}"?\n\nThis will remove the assignment. This should only be used when you are sure.`
    )

    if (!confirmed) return

    try {
      setDeletingAssignmentId(String(assignmentId))
      setError("")
      setMessage("")

      const response = await fetch(`http://localhost:3000/api/assignments/${assignmentId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete assignment")
      }

      setMessage(`Assignment deleted: ${data.deleted?.title || assignmentTitle}.`)
      await refreshAssignments()
    } catch (err) {
      setError(err.message || "Failed to delete assignment")
    } finally {
      setDeletingAssignmentId("")
    }
  }

  if (loading) {
    return (
      <div className="content-area">
        <section className="panel">
          <p>Loading course assignments...</p>
        </section>
      </div>
    )
  }

  return (
    <>
      <div className="topbar">
        <h1>{course?.title || course?.class_name || `Course ${courseId}`} Assignments</h1>
        <p className="topbar-subtitle">Current assignments for this course.</p>
      </div>

      <div className="content-area">
        <section className="panel">
          <button type="button" onClick={() => navigate("/courses")} style={buttonStyle}>
            ← Back to Courses
          </button>
        </section>

        {error ? (
          <section className="panel">
            <div style={errorBoxStyle}>{error}</div>
          </section>
        ) : null}

        {message ? (
          <section className="panel">
            <div style={noticeBoxStyle}>{message}</div>
          </section>
        ) : null}

        <section className="panel">
          <div style={coachHeaderRowStyle}>
            <div>
              <h2 style={{ margin: 0 }}>Teacher Coach V2</h2>
              <p style={mutedTextStyle}>Assignment Readiness Coach</p>
            </div>

            <button type="button" onClick={() => setCoachOpen((value) => !value)} style={buttonStyle}>
              {coachOpen ? "Hide Coach" : "Show Coach"}
            </button>
          </div>

          {coachOpen ? (
            <div style={coachBoxStyle}>
              <div style={coachRecommendationStyle}>
                <h3 style={{ marginTop: 0 }}>SUPER LMS Recommends</h3>
                <p>
                  <strong>Next Step:</strong> {coachRecommendation.nextStep}
                </p>
                <p>
                  <strong>Reason:</strong> {coachRecommendation.reason}
                </p>
                <p>
                  <strong>Do this:</strong> {coachRecommendation.doThis}
                </p>
                <p>
                  <strong>Readiness:</strong> {coachRecommendation.readiness}
                </p>
              </div>

              <div style={coachChecklistStyle}>
                <h3 style={{ marginTop: 0 }}>Before grading, check:</h3>
                <p>□ Assignment exists</p>
                <p>□ Edit Sections has KNOW, DO, and UNDERSTAND evidence where needed</p>
                <p>□ Section out-of marks and weights make sense</p>
                <p>□ Students are enrolled in the course</p>
                <p>□ Open Speed Grading when ready to enter raw marks</p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Current Assignments</h2>

          {courseAssignments.length === 0 ? (
            <div style={noticeBoxStyle}>No assignments yet for this course.</div>
          ) : (
            <div style={assignmentGridStyle}>
              {courseAssignments.map((assignment) => (
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
          )}
        </section>
      </div>
    </>
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

const noticeBoxStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "14px 16px",
  background: "#f8fafc",
}

const errorBoxStyle = {
  border: "1px solid #d1a1a1",
  borderRadius: "12px",
  padding: "14px 16px",
  background: "#fff8f8",
}

const coachHeaderRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
  flexWrap: "wrap",
}

const mutedTextStyle = {
  marginTop: "6px",
  marginBottom: 0,
  color: "#4b5563",
}

const coachBoxStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.8fr)",
  gap: "16px",
  marginTop: "16px",
}

const coachRecommendationStyle = {
  border: "1px solid #111827",
  borderRadius: "14px",
  padding: "16px",
  background: "#f8fafc",
}

const coachChecklistStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "14px",
  padding: "16px",
  background: "#ffffff",
}
