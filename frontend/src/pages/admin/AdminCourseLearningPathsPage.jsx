import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import API_BASE from "../../apiBase"

export default function AdminCourseLearningPathsPage() {
  const { courseId } = useParams()

  const [course, setCourse] = useState(null)
  const [learningPaths, setLearningPaths] = useState([])
  const [pathItemsById, setPathItemsById] = useState({})
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

        const paths = Array.isArray(data?.learning_paths) ? data.learning_paths : []
        const itemEntries = await Promise.all(
          paths.map(async (path) => {
            const itemResponse = await fetch(`${API_BASE}/api/learning-paths/${path.id}/items`)
            const itemData = await itemResponse.json()

            if (!itemResponse.ok || itemData?.success === false) {
              throw new Error(itemData?.error || `Failed to load items for ${path.title || "learning path"}`)
            }

            return [path.id, Array.isArray(itemData?.items) ? itemData.items : []]
          })
        )

        if (!isCancelled) {
          setCourse(data?.course || null)
          setLearningPaths(paths)
          setPathItemsById(Object.fromEntries(itemEntries))
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || "Failed to load learning paths")
          setCourse(null)
          setLearningPaths([])
          setPathItemsById({})
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

  const health = useMemo(() => {
    const publishedCount = learningPaths.filter((path) => Boolean(path.is_published)).length
    const draftCount = learningPaths.length - publishedCount
    const allItems = learningPaths.flatMap((path) => pathItemsById[path.id] || [])
    const assignmentItems = allItems.filter((item) => item.assignment_id || item.assignment_title || item.item_type === "assignment")
    const lessonItems = allItems.filter((item) => item.lesson_id || item.lesson_title || item.item_type === "lesson")
    const emptyPaths = learningPaths.filter((path) => (pathItemsById[path.id] || []).length === 0)
    const brokenItems = allItems.filter((item) => {
      if (item.item_type === "assignment") return !item.assignment_id && !item.assignment_title
      if (item.item_type === "lesson") return !item.lesson_id && !item.lesson_title
      return false
    })

    let readiness = "Needs Setup"
    let nextStep = "Create the first learning path for this course."

    if (learningPaths.length > 0 && allItems.length === 0) {
      nextStep = "Add lessons or assignments to the existing learning paths."
    } else if (emptyPaths.length > 0) {
      nextStep = `Add items to ${emptyPaths[0].title || "an empty learning path"}.`
    } else if (publishedCount === 0 && learningPaths.length > 0) {
      nextStep = "Publish at least one learning path when it is ready for students."
    } else if (brokenItems.length > 0) {
      nextStep = "Review learning path items with missing lesson or assignment links."
    } else if (publishedCount > 0 && allItems.length > 0) {
      readiness = "Ready For Students"
      nextStep = "Learning paths are connected and ready for review."
    }

    return {
      publishedCount,
      draftCount,
      totalItems: allItems.length,
      assignmentCount: assignmentItems.length,
      lessonCount: lessonItems.length,
      emptyPathCount: emptyPaths.length,
      brokenItemCount: brokenItems.length,
      readiness,
      nextStep,
    }
  }, [learningPaths, pathItemsById])

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

      {!loading && !error ? (
        <div style={healthPanelStyle}>
          <div>
            <div style={eyebrowStyle}>Truth on Open</div>
            <h2 style={sectionTitleStyle}>Learning Path Health</h2>
            <p style={summaryTextStyle}>{health.nextStep}</p>
          </div>

          <div style={healthGridStyle}>
            <HealthCard label="Learning Paths" value={learningPaths.length} />
            <HealthCard label="Published" value={health.publishedCount} />
            <HealthCard label="Draft" value={health.draftCount} />
            <HealthCard label="Total Items" value={health.totalItems} />
            <HealthCard label="Assignments Linked" value={health.assignmentCount} />
            <HealthCard label="Lessons Linked" value={health.lessonCount} />
            <HealthCard label="Empty Paths" value={health.emptyPathCount} />
            <HealthCard label="Broken Links" value={health.brokenItemCount} />
          </div>

          <div style={readinessStyle}>
            <strong>Status:</strong> {health.readiness}
          </div>
        </div>
      ) : null}

      {!loading && !error && learningPaths.length === 0 ? (
        <div style={noticeStyle}>No learning paths found for this course.</div>
      ) : null}

      <div style={pathListStyle}>
        {learningPaths.map((path) => {
          const items = pathItemsById[path.id] || []

          return (
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
                Sort Order: {path.sort_order ?? "—"} · Path ID: {path.id} · Items: {items.length}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HealthCard({ label, value }) {
  return (
    <div style={healthCardStyle}>
      <div style={healthValueStyle}>{value}</div>
      <div style={healthLabelStyle}>{label}</div>
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

const healthPanelStyle = {
  marginTop: "18px",
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "16px",
  padding: "20px",
}

const eyebrowStyle = {
  fontSize: "13px",
  fontWeight: 900,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
}

const sectionTitleStyle = {
  margin: "6px 0 0 0",
  fontSize: "22px",
  color: "#111827",
}

const summaryTextStyle = {
  margin: "8px 0 0 0",
  color: "#4b5563",
  lineHeight: 1.5,
}

const healthGridStyle = {
  marginTop: "16px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "12px",
}

const healthCardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "14px",
  background: "#f9fafb",
}

const healthValueStyle = {
  fontSize: "26px",
  fontWeight: 900,
  color: "#111827",
}

const healthLabelStyle = {
  marginTop: "4px",
  fontSize: "13px",
  fontWeight: 800,
  color: "#4b5563",
}

const readinessStyle = {
  marginTop: "16px",
  border: "1px solid #d7d7d7",
  borderRadius: "12px",
  padding: "12px",
  color: "#111827",
  background: "#f9fafb",
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
