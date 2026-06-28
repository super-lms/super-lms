import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import API_BASE from "../../apiBase"

export default function AdminCourseLessonsPage() {
  const { courseId } = useParams()

  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isCancelled = false

    async function loadLessons() {
      try {
        setLoading(true)
        setError("")

        const response = await fetch(`${API_BASE}/api/lessons`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.error || "Failed to load lessons")
        }

        if (!isCancelled) {
          setLessons(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || "Failed to load lessons")
          setLessons([])
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadLessons()

    return () => {
      isCancelled = true
    }
  }, [])

  const courseLessons = useMemo(() => {
    return lessons.filter((lesson) => String(lesson.course_id) === String(courseId))
  }, [lessons, courseId])

  const courseTitle = courseLessons[0]?.course_title || `Course ${courseId}`

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
          Lessons
        </h1>

        <p style={{ margin: "10px 0 0 0", color: "#4b5563", fontSize: "16px", lineHeight: 1.5 }}>
          {courseTitle}
        </p>
      </div>

      {loading ? <div style={noticeStyle}>Loading lessons...</div> : null}

      {error ? <div style={errorStyle}>{error}</div> : null}

      {!loading && !error && courseLessons.length === 0 ? (
        <div style={noticeStyle}>No lessons found for this course.</div>
      ) : null}

      <div style={lessonListStyle}>
        {courseLessons.map((lesson) => (
          <div key={lesson.id} style={lessonCardStyle}>
            <h2 style={{ margin: 0, fontSize: "21px", color: "#111827" }}>
              {lesson.title}
            </h2>

            <p style={{ margin: "10px 0 0 0", color: "#4b5563", lineHeight: 1.5 }}>
              {lesson.content || "No lesson content"}
            </p>

            <div style={metaStyle}>
              Lesson ID: {lesson.id} · Order: {lesson.order_index ?? "—"}
            </div>
          </div>
        ))}
      </div>
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

const lessonListStyle = {
  marginTop: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
}

const lessonCardStyle = {
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "14px",
  padding: "18px",
}

const metaStyle = {
  marginTop: "14px",
  fontSize: "13px",
  color: "#6b7280",
}
