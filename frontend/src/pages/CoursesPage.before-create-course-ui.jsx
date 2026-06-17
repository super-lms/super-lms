import { useEffect, useState } from "react"

const API_BASE = "http://localhost:3000"

export default function CoursesPage() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [settingUpCourseId, setSettingUpCourseId] = useState(null)

  useEffect(() => {
    loadCourses()
  }, [])

  async function loadCourses() {
    try {
      setLoading(true)
      setError("")

      const res = await fetch(`${API_BASE}/api/classes`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to load courses")
      }

      setCourses(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || "Failed to load courses")
      setCourses([])
    } finally {
      setLoading(false)
    }
  }

  async function setupKdu(courseId) {
    try {
      setSettingUpCourseId(courseId)
      setMessage("")
      setError("")

      const res = await fetch(
        `${API_BASE}/api/courses/${courseId}/setup-kdu-assessment-structure`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Setup failed")
      }

      setMessage(
        `KDU assessment structure created for ${data.course?.title || "course"}: ${data.assessment_group_count} groups, total weight ${data.total_weight}%.`
      )
    } catch (err) {
      setError(err.message || "Failed to set up KDU structure")
    } finally {
      setSettingUpCourseId(null)
    }
  }

  async function forceSetupKdu(courseId) {
    const confirmReplace = window.confirm(
      "This will replace existing assessment groups for this course. Continue?"
    )

    if (!confirmReplace) return

    try {
      setSettingUpCourseId(courseId)
      setMessage("")
      setError("")

      const res = await fetch(
        `${API_BASE}/api/courses/${courseId}/setup-kdu-assessment-structure`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ replaceExisting: true }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Reset failed")
      }

      setMessage(
        `KDU assessment structure replaced for ${data.course?.title || "course"}: ${data.assessment_group_count} groups.`
      )

      await loadCourses()
    } catch (err) {
      setError(err.message || "Failed to reset KDU structure")
    } finally {
      setSettingUpCourseId(null)
    }
  }

  if (loading) {
    return (
      <div className="content-area">
        <section className="panel">
          <p>Loading courses...</p>
        </section>
      </div>
    )
  }

  return (
    <div className="content-area">
      <section className="panel">
        <h1 style={{ marginTop: 0 }}>Courses</h1>
        <p style={{ color: "#4b5563", lineHeight: 1.5 }}>
          Set up the standard English Studies assessment group structure for any course.
        </p>

        {message ? (
          <div
            style={{
              border: "1px solid #cfd8e3",
              borderRadius: "12px",
              padding: "14px",
              marginBottom: "16px",
              background: "#f8fafc",
            }}
          >
            {message}
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              border: "1px solid #d1a1a1",
              borderRadius: "12px",
              padding: "14px",
              marginBottom: "16px",
              background: "#fff8f8",
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: "14px" }}>
          {courses.map((course) => (
            <div
              key={course.id}
              style={{
                border: "1px solid #d7dce5",
                borderRadius: "14px",
                padding: "18px",
                background: "#ffffff",
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: "8px" }}>
                {course.class_name || course.title || `Course ${course.id}`}
              </h2>

              <div style={{ marginBottom: "14px", color: "#4b5563" }}>
                Course ID: {course.id}
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setupKdu(course.id)}
                  disabled={settingUpCourseId === course.id}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid #d7dce5",
                    background: "#ffffff",
                    fontWeight: 800,
                    cursor: settingUpCourseId === course.id ? "not-allowed" : "pointer",
                  }}
                >
                  {settingUpCourseId === course.id
                    ? "Setting up..."
                    : "Set Up KDU Structure"}
                </button>

                <button
                  type="button"
                  onClick={() => forceSetupKdu(course.id)}
                  disabled={settingUpCourseId === course.id}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid #d7dce5",
                    background: "#ffffff",
                    fontWeight: 800,
                    cursor: settingUpCourseId === course.id ? "not-allowed" : "pointer",
                  }}
                >
                  Force Reset KDU
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
