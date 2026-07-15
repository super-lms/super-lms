import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import authFetch from "../../services/authFetch"

const COURSE_TYPE_OPTIONS = [
  {
    value: "english11_competency",
    label: "English 11 Competency Template",
  },
  {
    value: "english12_competency",
    label: "English 12 Competency Template",
  },
  {
    value: "custom_competency",
    label: "Start Blank / Custom Course",
  },
]

export default function AdminCoursesPage() {
  const navigate = useNavigate()

  const [courses, setCourses] = useState([])
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState("loading")
  const [error, setError] = useState("")

  const [showCreateCourse, setShowCreateCourse] = useState(false)
  const [newCourseTitle, setNewCourseTitle] = useState("")
  const [newCourseDescription, setNewCourseDescription] = useState("")
  const [newCourseTeacherEmail, setNewCourseTeacherEmail] = useState("")
  const [newCourseType, setNewCourseType] = useState("custom_competency")
  const [createStatus, setCreateStatus] = useState("idle")
  const [createError, setCreateError] = useState("")

  async function loadSchoolData() {
    try {
      setStatus("loading")
      setError("")

      const [coursesResponse, usersResponse] = await Promise.all([
        authFetch("/api/classes"),
        authFetch("/api/users"),
      ])

      const coursesData = await coursesResponse.json()
      const usersData = await usersResponse.json()

      if (!coursesResponse.ok) {
        throw new Error(coursesData.error || "Failed to load courses")
      }

      if (!usersResponse.ok) {
        throw new Error(usersData.error || "Failed to load users")
      }

      setCourses(Array.isArray(coursesData) ? coursesData : [])
      setUsers(Array.isArray(usersData) ? usersData : [])
      setStatus("ready")
    } catch (err) {
      setError(err.message || "Failed to load school courses")
      setStatus("error")
    }
  }

  useEffect(() => {
    loadSchoolData()
  }, [])

  const teachers = useMemo(() => {
    return users
      .filter((user) => String(user.role || "").toLowerCase() === "teacher")
      .filter((teacher) => String(teacher.email || "").trim())
      .sort((a, b) => {
        const aName = String(a.name || a.email || "")
        const bName = String(b.name || b.email || "")
        return aName.localeCompare(bName)
      })
  }, [users])

  const groupedCourses = useMemo(() => {
    const groups = new Map()

    courses.forEach((course) => {
      const department = String(course.department || "").trim() || "Other Courses"

      if (!groups.has(department)) {
        groups.set(department, [])
      }

      groups.get(department).push(course)
    })

    return Array.from(groups.entries())
      .map(([department, departmentCourses]) => ({
        department,
        courses: [...departmentCourses].sort((a, b) =>
          String(a.title || "").localeCompare(String(b.title || ""))
        ),
      }))
      .sort((a, b) => a.department.localeCompare(b.department))
  }, [courses])

  function resetCreateCourseForm() {
    setNewCourseTitle("")
    setNewCourseDescription("")
    setNewCourseTeacherEmail("")
    setNewCourseType("custom_competency")
    setCreateStatus("idle")
    setCreateError("")
  }

  function openCreateCourse() {
    resetCreateCourseForm()
    setShowCreateCourse(true)
  }

  function cancelCreateCourse() {
    if (createStatus === "saving") {
      return
    }

    setShowCreateCourse(false)
    resetCreateCourseForm()
  }

  async function createCourse(event) {
    event.preventDefault()

    const title = newCourseTitle.trim()
    const description = newCourseDescription.trim()
    const teacherEmail = newCourseTeacherEmail.trim().toLowerCase()

    if (!title) {
      setCreateError("Course title is required.")
      return
    }

    if (!teacherEmail) {
      setCreateError("Select an existing teacher.")
      return
    }

    try {
      setCreateStatus("saving")
      setCreateError("")

      const response = await authFetch("/api/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          teacher_email: teacherEmail,
          course_type: newCourseType,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create course")
      }

      setShowCreateCourse(false)
      resetCreateCourseForm()
      await loadSchoolData()
    } catch (err) {
      setCreateError(err.message || "Failed to create course")
      setCreateStatus("error")
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "18px",
          marginBottom: "22px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "28px" }}>Courses</h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "16px",
              color: "#4b5563",
              lineHeight: 1.6,
            }}
          >
            School-wide course access organized by department.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateCourse}
          style={{
            border: "1px solid #111827",
            borderRadius: "10px",
            background: "#111827",
            color: "white",
            padding: "11px 16px",
            fontSize: "15px",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          + Create Course
        </button>
      </div>

      {showCreateCourse && (
        <div
          style={{
            background: "white",
            border: "1px solid #cbd5e1",
            borderRadius: "14px",
            padding: "20px",
            marginBottom: "22px",
          }}
        >
          <div style={{ marginBottom: "18px" }}>
            <h2 style={{ margin: 0, fontSize: "22px" }}>Create Course</h2>
            <p
              style={{
                margin: "7px 0 0",
                color: "#4b5563",
                lineHeight: 1.55,
              }}
            >
              Create a school course and assign it to an existing teacher.
            </p>
          </div>

          <form onSubmit={createCourse}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "16px",
              }}
            >
              <FormField label="Course Title">
                <input
                  value={newCourseTitle}
                  onChange={(event) => setNewCourseTitle(event.target.value)}
                  placeholder="Example: Pre-Calculus 12"
                  disabled={createStatus === "saving"}
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Assign Teacher">
                <select
                  value={newCourseTeacherEmail}
                  onChange={(event) => setNewCourseTeacherEmail(event.target.value)}
                  disabled={createStatus === "saving"}
                  style={inputStyle}
                >
                  <option value="">Select an existing teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.email}>
                      {teacher.name || "Unnamed Teacher"} — {teacher.email}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Course Type">
                <select
                  value={newCourseType}
                  onChange={(event) => setNewCourseType(event.target.value)}
                  disabled={createStatus === "saving"}
                  style={inputStyle}
                >
                  {COURSE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div style={{ marginTop: "16px" }}>
              <FormField label="Description">
                <textarea
                  value={newCourseDescription}
                  onChange={(event) => setNewCourseDescription(event.target.value)}
                  placeholder="Optional course description"
                  disabled={createStatus === "saving"}
                  rows={4}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </FormField>
            </div>

            {createError && (
              <div
                style={{
                  marginTop: "16px",
                  border: "1px solid #b91c1c",
                  borderRadius: "10px",
                  padding: "12px",
                  color: "#7f1d1d",
                  background: "#fef2f2",
                  fontWeight: 700,
                }}
              >
                {createError}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "18px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={cancelCreateCourse}
                disabled={createStatus === "saving"}
                style={{
                  border: "1px solid #9ca3af",
                  borderRadius: "9px",
                  background: "white",
                  color: "#111827",
                  padding: "10px 15px",
                  fontWeight: 800,
                  cursor: createStatus === "saving" ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={createStatus === "saving"}
                style={{
                  border: "1px solid #111827",
                  borderRadius: "9px",
                  background: "#111827",
                  color: "white",
                  padding: "10px 15px",
                  fontWeight: 800,
                  cursor: createStatus === "saving" ? "not-allowed" : "pointer",
                }}
              >
                {createStatus === "saving" ? "Creating Course..." : "Create Course"}
              </button>
            </div>
          </form>
        </div>
      )}

      {status === "loading" && (
        <div
          style={{
            background: "white",
            border: "1px solid #d7d7d7",
            borderRadius: "14px",
            padding: "18px",
          }}
        >
          Loading school courses...
        </div>
      )}

      {status === "error" && (
        <div
          style={{
            background: "white",
            border: "1px solid #b91c1c",
            borderRadius: "14px",
            padding: "18px",
          }}
        >
          <strong>Unable to load school courses.</strong>
          <div style={{ marginTop: "8px", color: "#7f1d1d" }}>{error}</div>
        </div>
      )}

      {status === "ready" && groupedCourses.length === 0 && (
        <div
          style={{
            background: "white",
            border: "1px solid #d7d7d7",
            borderRadius: "14px",
            padding: "18px",
            color: "#4b5563",
          }}
        >
          No courses are available yet. Use Create Course to add the first school course.
        </div>
      )}

      {status === "ready" &&
        groupedCourses.map((group) => (
          <section key={group.department} style={{ marginBottom: "24px" }}>
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: "20px",
                color: "#1f2937",
              }}
            >
              {group.department}
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "14px",
              }}
            >
              {group.courses.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() =>
                    navigate(`/admin/courses/${encodeURIComponent(course.title)}`, {
                      state: { course },
                    })
                  }
                  style={{
                    textAlign: "left",
                    background: "white",
                    border: "1px solid #d7d7d7",
                    borderRadius: "14px",
                    padding: "18px",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 800,
                      color: "#111827",
                    }}
                  >
                    {course.title || "Untitled Course"}
                  </div>

                  <div
                    style={{
                      marginTop: "8px",
                      color: "#4b5563",
                      lineHeight: 1.5,
                    }}
                  >
                    {course.description || "No course description available."}
                  </div>

                  <div
                    style={{
                      marginTop: "12px",
                      fontSize: "14px",
                      color: "#6b7280",
                    }}
                  >
                    {Number(course.student_count || 0)} students
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          fontWeight: 800,
          marginBottom: "7px",
          color: "#111827",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  padding: "11px 12px",
  fontSize: "15px",
  background: "white",
  color: "#111827",
}
