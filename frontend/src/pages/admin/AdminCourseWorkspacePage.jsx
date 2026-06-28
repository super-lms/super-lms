import { Link, useParams } from "react-router-dom"

export default function AdminCourseWorkspacePage() {
  const { courseName } = useParams()
  const courseId = decodeURIComponent(courseName || "")
  const displayCourseName = courseId ? `Course ${courseId}` : "Selected Course"

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
