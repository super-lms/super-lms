import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

export default function CourseAssignmentsPage() {
  const { courseId } = useParams()
  const navigate = useNavigate()

  const [course, setCourse] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
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

    loadPage()
  }, [courseId])

  const courseAssignments = useMemo(() => {
    return assignments.filter((assignment) => String(assignment.class_id) === String(courseId))
  }, [assignments, courseId])

  function formatDate(value) {
    if (!value) return "No due date"
    return String(value).slice(0, 10)
  }

  function formatPercent(value) {
    const numberValue = Number(value)
    if (!Number.isFinite(numberValue)) return "Not calculated"
    return `${numberValue.toFixed(2)}%`
  }

  function openSpeedGrading(assignmentId) {
    navigate(`/assignments/${assignmentId}/grade`)
  }

  function openEditAssignment(assignmentId) {
    navigate(`/assignments/${assignmentId}/edit`)
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

        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Current Assignments</h2>

          {courseAssignments.length === 0 ? (
            <div style={noticeBoxStyle}>No assignments yet for this course.</div>
          ) : (
            <div style={assignmentGridStyle}>
              {courseAssignments.map((assignment) => (
                <div key={assignment.id} style={assignmentCardStyle}>
                  <h3 style={{ marginTop: 0 }}>{assignment.title || "Untitled Assignment"}</h3>

                  <div style={statusPillStyle}>Current</div>

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
                    <button type="button" onClick={() => openSpeedGrading(assignment.id)} style={buttonStyle}>
                      Open Speed Grading
                    </button>
                    <button type="button" onClick={() => openEditAssignment(assignment.id)} style={buttonStyle}>
                      Open Edit Page
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
