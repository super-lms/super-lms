import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import API_BASE from "../apiBase"
import authFetch from "../services/authFetch"
import AssignmentCardsView from "../components/courseAssignments/AssignmentCardsView"
import TeachersPublishedAssignmentsView from "../components/courseAssignments/TeachersPublishedAssignmentsView"
import TeacherCoachPanel from "../components/courseAssignments/TeacherCoachPanel"

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
  const [assignmentView, setAssignmentView] = useState("cards")

  useEffect(() => {
    loadPage()
  }, [courseId])

  async function loadPage() {
    try {
      setLoading(true)
      setError("")

      const [classesRes, assignmentsRes] = await Promise.all([
        authFetch("/api/classes"),
        authFetch("/api/assignments"),
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
    const assignmentsRes = await authFetch("/api/assignments")
    const assignmentsData = await assignmentsRes.json()

    if (!assignmentsRes.ok) throw new Error(assignmentsData.error || "Failed to reload assignments")

    setAssignments(Array.isArray(assignmentsData) ? assignmentsData : [])
  }

  const courseAssignments = useMemo(() => {
    return assignments.filter((assignment) => String(assignment.class_id) === String(courseId))
  }, [assignments, courseId])

  const assignmentTruth = useMemo(() => {
    const totalAssignments = courseAssignments.length
    const publishedCount = courseAssignments.filter((assignment) => getPublishedLabel(assignment) === "Published").length
    const draftCount = totalAssignments - publishedCount
    const totalSubmissions = courseAssignments.reduce((sum, assignment) => sum + Number(assignment?.submission_count || 0), 0)
    const gradedSubmissions = courseAssignments.reduce((sum, assignment) => sum + Number(assignment?.graded_count || 0), 0)
    const ungradedSubmissions = courseAssignments.reduce((sum, assignment) => sum + Number(assignment?.ungraded_count || 0), 0)
    const assignmentsWithPathway = courseAssignments.filter((assignment) => assignment?.category_name || assignment?.subcategory_name).length
    const assignmentsWithoutPathway = totalAssignments - assignmentsWithPathway
    const assignmentsWithWeight = courseAssignments.filter((assignment) => Number.isFinite(Number(assignment?.calculated_weight))).length

    let readiness = "Needs Setup"
    let nextStep = "Create the first assignment for this course."

    if (totalAssignments > 0 && assignmentsWithoutPathway > 0) {
      nextStep = "Connect assignments to grading pathways and evidence tiers."
    } else if (totalAssignments > 0 && publishedCount === 0) {
      nextStep = "Publish at least one assignment when it is ready for students."
    } else if (ungradedSubmissions > 0) {
      readiness = "Ready to Grade"
      nextStep = "Open Speed Grading and grade submitted student work."
    } else if (publishedCount > 0 && assignmentsWithoutPathway === 0) {
      readiness = "Ready For Teaching"
      nextStep = "Assignments are connected. Continue monitoring submissions and grading progress."
    }

    return {
      totalAssignments,
      publishedCount,
      draftCount,
      totalSubmissions,
      gradedSubmissions,
      ungradedSubmissions,
      assignmentsWithPathway,
      assignmentsWithoutPathway,
      assignmentsWithWeight,
      readiness,
      nextStep,
    }
  }, [courseAssignments])

  const coachRecommendation = useMemo(() => {
    const count = courseAssignments.length

    if (count === 0) {
      return {
        title: "Create your first assignment",
        reason:
          "This course does not have any assignments yet. Students and parents will not see course evidence until at least one assignment exists.",
        action:
          "Go back to the course card and use + Create Assignment. After creating it, return here to check sections and grading readiness.",
        readiness: "Not ready for grading yet.",
      }
    }

    if (assignmentTruth.ungradedSubmissions > 0) {
      return {
        title: "Grade submitted work",
        reason:
          "Students have submitted work that has not been graded yet. This is the highest-value next action for keeping the course current.",
        action:
          "Open Speed Grading for assignments with ungraded submissions, enter marks, and save feedback.",
        readiness: `${assignmentTruth.ungradedSubmissions} ungraded submission${assignmentTruth.ungradedSubmissions === 1 ? "" : "s"} found.`,
      }
    }

    if (assignmentTruth.assignmentsWithoutPathway > 0) {
      return {
        title: "Connect assignments to evidence tiers",
        reason:
          "Some assignments are not connected to grading pathways or evidence tiers, which weakens gradebook and reporting accuracy.",
        action:
          "Open each assignment and confirm the grading pathway, evidence tier, section structure, and KDU setup.",
        readiness: `${assignmentTruth.assignmentsWithoutPathway} assignment${assignmentTruth.assignmentsWithoutPathway === 1 ? "" : "s"} need pathway review.`,
      }
    }

    return {
      title: "Check assignment sections before grading",
      reason:
        "Assignments are created, but raw mark grading works best when each assignment has clear exam sections connected to KNOW, DO, and UNDERSTAND evidence.",
      action:
        "Choose an assignment, click Edit Sections, confirm the section names, KDU buckets, out-of marks, and weights. Then use Open Speed Grading when you are ready to enter marks.",
      readiness: `${count} assignment${count === 1 ? "" : "s"} found. Next step is to verify grading structure.`,
    }
  }, [courseAssignments, assignmentTruth])

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

  function getPublishedLabel(assignment) {
    if (assignment?.published === true) return "Published"
    if (assignment?.is_published === true) return "Published"
    if (String(assignment?.status || "").toLowerCase() === "published") return "Published"
    return "Draft"
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

      const response = await authFetch(`/api/assignments/${assignmentId}/reorder`, {
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
      `Duplicate assignment "${currentTitle}" as "${title}"?This will copy the assignment details and exam sections.It will not copy student submissions, grades, rubric scores, feedback, or student work.`
    )

    if (!confirmed) return

    try {
      setDuplicatingAssignmentId(String(assignmentId))
      setError("")
      setMessage("")

      const response = await authFetch(`/api/assignments/${assignmentId}/duplicate`, {
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
      `Delete assignment "${assignmentTitle}"?This will remove the assignment. This should only be used when you are sure.`
    )

    if (!confirmed) return

    try {
      setDeletingAssignmentId(String(assignmentId))
      setError("")
      setMessage("")

      const response = await authFetch(`/api/assignments/${assignmentId}`, {
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
          <div style={truthHeaderStyle}>
            <div>
              <div style={truthEyebrowStyle}>Truth on Open</div>
              <h2 style={{ marginTop: "6px", marginBottom: "6px" }}>Assignment Health</h2>
              <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.5 }}>{assignmentTruth.nextStep}</p>
            </div>

            <div style={truthStatusStyle}>
              <strong>Status:</strong> {assignmentTruth.readiness}
            </div>
          </div>

          <div style={truthGridStyle}>
            <TruthCard label="Assignments" value={assignmentTruth.totalAssignments} />
            <TruthCard label="Published" value={assignmentTruth.publishedCount} />
            <TruthCard label="Draft" value={assignmentTruth.draftCount} />
            <TruthCard label="Submissions" value={assignmentTruth.totalSubmissions} />
            <TruthCard label="Graded" value={assignmentTruth.gradedSubmissions} />
            <TruthCard label="Ungraded" value={assignmentTruth.ungradedSubmissions} />
            <TruthCard label="With Pathway" value={assignmentTruth.assignmentsWithPathway} />
            <TruthCard label="Needs Pathway" value={assignmentTruth.assignmentsWithoutPathway} />
          </div>
        </section>

        <section className="panel">
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={{ marginTop: 0, marginBottom: "6px" }}>Current Assignments</h2>
              <p style={{ margin: 0, color: "#4b5563" }}>
                Use Assignment Cards for full assignment controls, or Teacher's Published Assignments for a quick teacher overview.
              </p>
            </div>

            <div style={viewToggleStyle} aria-label="Assignment view selector">
              <button
                type="button"
                onClick={() => setAssignmentView("cards")}
                style={assignmentView === "cards" ? activeToggleButtonStyle : toggleButtonStyle}
              >
                Assignment Cards
              </button>

              <button
                type="button"
                onClick={() => setAssignmentView("published-grid")}
                style={assignmentView === "published-grid" ? activeToggleButtonStyle : toggleButtonStyle}
              >
                Teacher's Published Assignments
              </button>
            </div>
          </div>

          {courseAssignments.length === 0 ? (
            <div style={noticeBoxStyle}>No assignments yet for this course.</div>
          ) : assignmentView === "published-grid" ? (
            <TeachersPublishedAssignmentsView
              assignments={courseAssignments}
              formatDate={formatDate}
              formatPercent={formatPercent}
              getStatusLabel={getStatusLabel}
              getPublishedLabel={getPublishedLabel}
              openSpeedGrading={openSpeedGrading}
              openEditAssignment={openEditAssignment}
              openEditSections={openEditSections}
            />
          ) : (
            <AssignmentCardsView
              assignments={courseAssignments}
              movingAssignmentId={movingAssignmentId}
              duplicatingAssignmentId={duplicatingAssignmentId}
              deletingAssignmentId={deletingAssignmentId}
              formatDate={formatDate}
              formatPercent={formatPercent}
              getStatusLabel={getStatusLabel}
              openSpeedGrading={openSpeedGrading}
              openEditAssignment={openEditAssignment}
              openEditSections={openEditSections}
              moveAssignment={moveAssignment}
              duplicateAssignment={duplicateAssignment}
              deleteAssignment={deleteAssignment}
            />
          )}
        </section>
      </div>

      <TeacherCoachPanel
        coachOpen={coachOpen}
        setCoachOpen={setCoachOpen}
        coachRecommendation={coachRecommendation}
      />
    </>
  )
}

function TruthCard({ label, value }) {
  return (
    <div style={truthCardStyle}>
      <div style={truthValueStyle}>{value}</div>
      <div style={truthLabelStyle}>{label}</div>
    </div>
  )
}

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
  marginBottom: "18px",
}

const viewToggleStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
}

const toggleButtonStyle = {
  padding: "10px 14px",
  borderRadius: "999px",
  border: "1px solid #d7dce5",
  background: "#ffffff",
  color: "#111827",
  font: "inherit",
  fontWeight: 900,
  cursor: "pointer",
}

const activeToggleButtonStyle = {
  ...toggleButtonStyle,
  border: "2px solid #111827",
  background: "#f8fafc",
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
const truthHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
}

const truthEyebrowStyle = {
  fontSize: "13px",
  fontWeight: 900,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
}

const truthStatusStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "12px 14px",
  background: "#f8fafc",
  color: "#111827",
}

const truthGridStyle = {
  marginTop: "16px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "12px",
}

const truthCardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "14px",
  background: "#f8fafc",
}

const truthValueStyle = {
  fontSize: "26px",
  fontWeight: 900,
  color: "#111827",
}

const truthLabelStyle = {
  marginTop: "4px",
  fontSize: "13px",
  fontWeight: 800,
  color: "#4b5563",
}
