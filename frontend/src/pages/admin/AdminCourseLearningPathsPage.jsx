import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import API_BASE from "../../apiBase"

export default function AdminCourseLearningPathsPage() {
  const { courseId } = useParams()

  const [course, setCourse] = useState(null)
  const [learningPaths, setLearningPaths] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isCancelled = false

    async function loadLearningPaths() {
      try {
        setLoading(true)
        setError("")

        const response = await fetch(`${API_BASE}/api/courses/${courseId}/learning-paths`)
        const data = await response.json()

        if (!response.ok || data?.success === false) {
          throw new Error(data?.error || "Failed to load learning paths")
        }

        if (!isCancelled) {
          setCourse(data?.course || null)
          setLearningPaths(Array.isArray(data?.learning_paths) ? data.learning_paths : [])
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || "Failed to load learning paths")
          setCourse(null)
          setLearningPaths([])
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadLearningPaths()

    return () => {
      isCancelled = true
    }
  }, [courseId])

  const courseTitle = course?.title || `Course ${courseId}`

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
          Learning Paths
        </h1>

        <p style={{ margin: "10px 0 0 0", color: "#4b5563", fontSize: "16px", lineHeight: 1.5 }}>
          {courseTitle}
        </p>
      </div>

      {loading ? <div style={noticeStyle}>Loading learning paths...</div> : null}

      {error ? <div style={errorStyle}>{error}</div> : null}

      {!loading && !error && learningPaths.length === 0 ? (
        <div style={noticeStyle}>No learning paths found for this course.</div>
      ) : null}

      <div style={pathListStyle}>
        {learningPaths.map((path) => (
          <div key={path.id} style={pathCardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "21px", color: "#111827" }}>
                  {path.title}
                </h2>

                {path.description ? (
                  <p style={{ margin: "10px 0 0 0", color: "#4b5563", lineHeight: 1.5 }}>
                    {path.description}
                  </p>
                ) : null}
              </div>

              <span style={statusPillStyle}>
                {path.is_published ? "Published" : "Draft"}
              </span>
            </div>

            <div style={metaStyle}>
              Sort Order: {path.sort_order ?? "—"} · Path ID: {path.id}
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

const pathListStyle = {
  marginTop: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
}

const pathCardStyle = {
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "14px",
  padding: "18px",
}

const statusPillStyle = {
  alignSelf: "flex-start",
  border: "1px solid #d7d7d7",
  borderRadius: "999px",
  padding: "6px 10px",
  fontSize: "13px",
  fontWeight: 800,
  color: "#374151",
  background: "#f9fafb",
}

const metaStyle = {
  marginTop: "14px",
  fontSize: "13px",
  color: "#6b7280",
}
