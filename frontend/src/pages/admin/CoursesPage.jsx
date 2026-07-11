import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import authFetch from "../../services/authFetch"

const departmentRules = [
  {
    name: "Sciences",
    matches: ["science", "chemistry", "physics", "biology"],
  },
  {
    name: "Mathematics",
    matches: ["math", "fmp", "pre-calculus", "precalculus", "calculus"],
  },
  {
    name: "Humanities",
    matches: ["english", "composition", "studies", "social", "career life", "clc"],
  },
  {
    name: "Business",
    matches: ["accounting", "business", "marketing", "economics"],
  },
  {
    name: "Arts",
    matches: ["art", "media", "drama", "music"],
  },
  {
    name: "Electives",
    matches: ["fitness", "leadership", "study skills", "test", "practice", "template"],
  },
]

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isCancelled = false

    async function loadCourses() {
      try {
        setLoading(true)
        setError("")

        const response = await authFetch("/api/classes")
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.error || "Failed to load courses")
        }

        if (!isCancelled) {
          setCourses(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || "Failed to load courses")
          setCourses([])
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadCourses()

    return () => {
      isCancelled = true
    }
  }, [])

  const departments = useMemo(() => {
    const grouped = departmentRules.map((department) => ({
      name: department.name,
      courses: [],
    }))

    const other = {
      name: "Other Courses",
      courses: [],
    }

    courses.forEach((course) => {
      const title = String(course?.title || course?.class_name || "").trim()
      const lowerTitle = title.toLowerCase()

      const matchedDepartment = grouped.find((department) =>
        departmentRules
          .find((rule) => rule.name === department.name)
          ?.matches.some((term) => lowerTitle.includes(term))
      )

      if (matchedDepartment) {
        matchedDepartment.courses.push(course)
      } else {
        other.courses.push(course)
      }
    })

    const visibleDepartments = grouped.filter((department) => department.courses.length > 0)

    if (other.courses.length > 0) {
      visibleDepartments.push(other)
    }

    return visibleDepartments
  }, [courses])

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: "28px" }}>Courses</h1>

      <p style={{ fontSize: "16px", color: "#4b5563", maxWidth: "900px", lineHeight: 1.6 }}>
        School-wide course access organized by department. Select a course title to open
        its administrator course workspace.
      </p>

      {loading ? (
        <div style={noticeStyle}>Loading courses...</div>
      ) : null}

      {error ? (
        <div style={errorStyle}>{error}</div>
      ) : null}

      {!loading && !error && departments.length === 0 ? (
        <div style={noticeStyle}>No courses found.</div>
      ) : null}

      <div
        style={{
          marginTop: "24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "18px",
        }}
      >
        {departments.map((department) => (
          <section key={department.name} style={departmentCardStyle}>
            <h2 style={departmentTitleStyle}>{department.name}</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {department.courses.map((course) => {
                const title = String(course?.title || course?.class_name || "Untitled Course").trim()
                const courseId = course?.id

                return (
                  <Link
                    key={courseId || title}
                    to={`/admin/courses/${encodeURIComponent(String(courseId))}`}
                    style={courseLinkStyle}
                  >
                    {title}
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
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

const departmentCardStyle = {
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "14px",
  padding: "18px",
}

const departmentTitleStyle = {
  margin: "0 0 14px 0",
  fontSize: "20px",
  color: "#111827",
}

const courseLinkStyle = {
  display: "block",
  color: "#111827",
  textDecoration: "none",
  fontSize: "16px",
  fontWeight: 700,
  padding: "10px 12px",
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  background: "#fafafa",
}
