import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import authFetch from "../../services/authFetch"
import { openAdminCourseBuilder } from "../../services/adminCourseBuilder"

export default function AdminCourseWorkspacePage() {
  const { courseName } = useParams()
  const navigate = useNavigate()
  const courseId = decodeURIComponent(courseName || "")
  const [course, setCourse] = useState(null)
  const [openingBuilder, setOpeningBuilder] = useState(false)
  const [error, setError] = useState("")
  const displayCourseName = course?.title || (courseId ? `Course ${courseId}` : "Selected Course")

  useEffect(() => {
    let cancelled = false

    async function loadCourse() {
      try {
        const response = await authFetch(`/api/classes`)
        const data = await response.json()
        if (!response.ok) throw new Error(data?.error || "Failed to load course")
        const match = Array.isArray(data)
          ? data.find((item) => String(item.id) === String(courseId))
          : null
        if (!cancelled) setCourse(match || null)
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load course")
      }
    }

    loadCourse()
    return () => { cancelled = true }
  }, [courseId])

  async function openBuilder(section = "") {
    try {
      setOpeningBuilder(true)
      setError("")
      await openAdminCourseBuilder(courseId, navigate, section)
    } catch (err) {
      setError(err.message || "Failed to open course builder")
      setOpeningBuilder(false)
    }
  }

  return (
    <div>
      <Link to="/admin/courses" style={backLinkStyle}>
        ← Back to Courses
      </Link>

      <div style={heroStyle}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#6b7280", marginBottom: "8px" }}>
          Administrator Course Workspace
        </div>

        <h1 style={{ margin: 0, fontSize: "32px", color: "#111827" }}>
          {displayCourseName}
        </h1>

        <p style={{ margin: "12px 0 0 0", color: "#4b5563", fontSize: "16px", lineHeight: 1.5 }}>
          School-wide course workspace. Open a door below to work inside this course.
        </p>
      </div>

      <div style={builderPanelStyle}>
        <div>
          <div style={{ fontWeight: 800, fontSize: "20px", color: "#111827" }}>
            Build and Teach This Course
          </div>
          <div style={{ marginTop: "7px", color: "#4b5563", lineHeight: 1.5 }}>
            Open the full teacher course builder for learning paths, lessons, assignments,
            rosters, gradebook, and reports. You will be added as a co-teacher; the current
            teacher assignment will not be replaced.
          </div>
        </div>
        <div style={builderActionsStyle}>
          <button type="button" onClick={() => openBuilder("")} disabled={openingBuilder} style={primaryButtonStyle}>
            {openingBuilder ? "Opening..." : "Open Full Course Builder"}
          </button>
          <button type="button" onClick={() => openBuilder("learning-paths")} disabled={openingBuilder} style={secondaryButtonStyle}>
            Build Learning Paths
          </button>
          <Link to={`/admin/courses/${encodeURIComponent(courseId)}/teacher`} style={secondaryLinkStyle}>
            Assign or Review Teacher
          </Link>
        </div>
        {error ? <div style={errorStyle}>{error}</div> : null}
      </div>

      <div style={toolGridStyle}>
        <WorkspaceTool title="Overview" />
        <WorkspaceTool
          title="Lessons"
          to={`/admin/courses/${encodeURIComponent(courseId)}/lessons`}
          isActiveDoor
        />
        <WorkspaceTool
          title="Assignments"
          to={`/course-assignments/${encodeURIComponent(courseId)}`}
          isActiveDoor
        />
        <WorkspaceTool
          title="Learning Paths"
          to={`/admin/courses/${encodeURIComponent(courseId)}/learning-paths`}
          isActiveDoor
        />
        <WorkspaceTool
          title="Gradebook"
          to={`/gradebook?classId=${encodeURIComponent(courseId)}`}
          isActiveDoor
        />
        <WorkspaceTool
          title="Attendance"
          to={`/admin/courses/${encodeURIComponent(courseId)}/attendance`}
          isActiveDoor
        />
        <WorkspaceTool
          title="Reports"
          to={`/admin/courses/${encodeURIComponent(courseId)}/reports`}
          isActiveDoor
        />
        <WorkspaceTool
          title="Students"
          to={`/admin/courses/${encodeURIComponent(courseId)}/students`}
          isActiveDoor
        />
        <WorkspaceTool
          title="Teacher"
          to={`/admin/courses/${encodeURIComponent(courseId)}/teacher`}
          isActiveDoor
        />
        <WorkspaceTool
          title="Analytics"
          to={`/admin/courses/${encodeURIComponent(courseId)}/analytics`}
          isActiveDoor
        />
      </div>
    </div>
  )
}

function WorkspaceTool({ title, to, isActiveDoor = false }) {
  const content = (
    <>
      <div style={{ fontSize: "18px", fontWeight: 800, color: "#111827" }}>
        {title}
      </div>
      <div style={{ marginTop: "8px", fontSize: "14px", color: "#6b7280", lineHeight: 1.4 }}>
        {isActiveDoor ? "Open this workspace area." : "Coming soon."}
      </div>
    </>
  )

  if (to) {
    return (
      <Link to={to} style={toolLinkCardStyle}>
        {content}
      </Link>
    )
  }

  return <div style={toolCardStyle}>{content}</div>
}

const backLinkStyle = {
  display: "inline-block",
  marginBottom: "18px",
  color: "#111827",
  textDecoration: "none",
  fontWeight: 700,
}

const heroStyle = {
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "16px",
  padding: "24px",
}

const toolGridStyle = {
  marginTop: "20px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "16px",
}

const toolCardStyle = {
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "14px",
  padding: "18px",
}

const toolLinkCardStyle = {
  ...toolCardStyle,
  display: "block",
  textDecoration: "none",
}

const builderPanelStyle = {
  marginTop: "20px",
  padding: "22px",
  border: "2px solid #111827",
  borderRadius: "16px",
  background: "#f8fafc",
}

const builderActionsStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "18px",
}

const primaryButtonStyle = {
  border: "1px solid #111827",
  borderRadius: "10px",
  padding: "12px 16px",
  background: "#111827",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
}

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  background: "white",
  color: "#111827",
}

const secondaryLinkStyle = {
  ...secondaryButtonStyle,
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
}

const errorStyle = {
  marginTop: "14px",
  color: "#991b1b",
  fontWeight: 700,
}
