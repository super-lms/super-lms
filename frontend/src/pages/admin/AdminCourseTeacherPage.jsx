import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import authFetch from "../../services/authFetch"

export default function AdminCourseTeacherPage() {
  const { courseId } = useParams()

  const [course, setCourse] = useState(null)
  const [teacher, setTeacher] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isCancelled = false

    async function loadTeacher() {
      try {
        setLoading(true)
        setError("")

        const response = await authFetch(`/api/admin/courses/${courseId}/teacher`)
        const data = await response.json()

        if (!response.ok || data?.success === false) {
          throw new Error(data?.error || "Failed to load course teacher")
        }

        if (!isCancelled) {
          setCourse(data?.course || null)
          setTeacher(data?.teacher || null)
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || "Failed to load course teacher")
          setCourse(null)
          setTeacher(null)
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadTeacher()

    return () => {
      isCancelled = true
    }
  }, [courseId])

  const courseTitle = course?.title || `Course ${courseId}`
  const hasTeacher = teacher && (teacher.name || teacher.email)

  return (
    <div>
      <Link to={`/admin/courses/${encodeURIComponent(String(courseId))}`} style={backLinkStyle}>
        ← Back to Course Workspace
      </Link>

      <div style={heroStyle}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#6b7280", marginBottom: "8px" }}>
          Administrator Course Workspace
        </div>

        <h1 style={{ margin: 0, fontSize: "30px", color: "#111827" }}>
          Teacher
        </h1>

        <p style={{ margin: "10px 0 0 0", color: "#4b5563", fontSize: "16px", lineHeight: 1.5 }}>
          {courseTitle}
        </p>
      </div>

      {loading ? <div style={noticeStyle}>Loading teacher...</div> : null}

      {error ? <div style={errorStyle}>{error}</div> : null}

      {!loading && !error ? (
        hasTeacher ? (
          <div style={teacherCardStyle}>
            <div style={labelStyle}>Assigned Teacher</div>

            <h2 style={{ margin: "8px 0 0 0", fontSize: "26px", color: "#111827" }}>
              {teacher.name || "Unnamed Teacher"}
            </h2>

            <div style={infoGridStyle}>
              <InfoItem label="Email" value={teacher.email || "No email recorded"} />
              <InfoItem label="Role" value={teacher.role || "Teacher"} />
              <InfoItem label="Teacher User ID" value={teacher.id || "—"} />
            </div>

            <div style={noteStyle}>
              Teacher Workspace expansion will later show this teacher's other courses,
              recent activity, assignments, learning paths, and administrator notes.
            </div>
          </div>
        ) : (
          <div style={noticeStyle}>No teacher is currently assigned to this course.</div>
        )
      ) : null}
    </div>
  )
}

function InfoItem({ label, value }) {
  return (
    <div style={infoItemStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={{ marginTop: "6px", fontWeight: 800, color: "#111827" }}>{value}</div>
    </div>
  )
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

const noticeStyle = {
  marginTop: "18px",
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "12px",
  padding: "14px",
  color: "#374151",
}

const errorStyle = {
  ...noticeStyle,
  border: "1px solid #d1a1a1",
  background: "#fff8f8",
  color: "#7f1d1d",
}

const teacherCardStyle = {
  marginTop: "20px",
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "16px",
  padding: "24px",
}

const infoGridStyle = {
  marginTop: "20px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
}

const infoItemStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "14px",
  background: "#fafafa",
}

const labelStyle = {
  fontSize: "13px",
  fontWeight: 800,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
}

const noteStyle = {
  marginTop: "20px",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "14px",
  background: "#f9fafb",
  color: "#4b5563",
  lineHeight: 1.5,
}
