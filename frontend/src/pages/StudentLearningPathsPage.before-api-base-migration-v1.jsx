import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../AuthContext.jsx"

const API_BASE = "http://localhost:3000"

function getItemLabel(type) {
  const clean = String(type || "").toLowerCase()
  if (clean === "lesson") return "Lesson"
  if (clean === "assignment") return "Assignment"
  if (clean === "resource") return "Resource"
  if (clean === "video") return "Video"
  if (clean === "quiz") return "Quiz"
  return "Item"
}

function normalizeSubmissionStatus(value) {
  const clean = String(value || "").trim().toLowerCase()
  if (clean === "submitted") return "Submitted"
  if (clean === "none") return "Not submitted"
  if (clean === "not_submitted") return "Not submitted"
  return "Not submitted"
}

export default function StudentLearningPathsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [courses, setCourses] = useState([])
  const [learningPathsByCourseId, setLearningPathsByCourseId] = useState({})
  const [itemsByPathId, setItemsByPathId] = useState({})
  const [submissionStatusByAssignmentId, setSubmissionStatusByAssignmentId] = useState({})
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState("")

  useEffect(() => {
    let isMounted = true

    async function loadStudentLearningPaths() {
      try {
        setLoading(true)
        setErrorText("")

        const studentEmail = String(user?.email || "").trim().toLowerCase()

        if (!studentEmail) {
          throw new Error("Student email is missing from the current session.")
        }

        const coursesRes = await fetch(`${API_BASE}/api/classes`)

        if (!coursesRes.ok) {
          throw new Error("Could not load courses.")
        }

        const coursesData = await coursesRes.json()
        const safeCourses = Array.isArray(coursesData) ? coursesData : []

        const visibleCourses = []

        for (const course of safeCourses) {
          const rosterRes = await fetch(`${API_BASE}/api/class-roster/${course.id}`)

          if (!rosterRes.ok) {
            continue
          }

          const rosterData = await rosterRes.json()
          const students = Array.isArray(rosterData.students) ? rosterData.students : []

          const studentIsEnrolled = students.some((student) => {
            return String(student.email || "").trim().toLowerCase() === studentEmail
          })

          if (studentIsEnrolled) {
            visibleCourses.push(course)
          }
        }

        const nextLearningPathsByCourseId = {}
        const nextItemsByPathId = {}
        const linkedAssignmentIds = new Set()

        for (const course of visibleCourses) {
          const pathsRes = await fetch(`${API_BASE}/api/courses/${course.id}/learning-paths`)

          if (!pathsRes.ok) {
            nextLearningPathsByCourseId[course.id] = []
            continue
          }

          const pathsData = await pathsRes.json()
          const paths = Array.isArray(pathsData.learning_paths) ? pathsData.learning_paths : []

          nextLearningPathsByCourseId[course.id] = paths

          for (const path of paths) {
            const itemsRes = await fetch(`${API_BASE}/api/learning-paths/${path.id}/items`)

            if (!itemsRes.ok) {
              nextItemsByPathId[path.id] = []
              continue
            }

            const itemsData = await itemsRes.json()
            const items = Array.isArray(itemsData.items) ? itemsData.items : []

            nextItemsByPathId[path.id] = items

            items.forEach((item) => {
              if (item.assignment_id) {
                linkedAssignmentIds.add(String(item.assignment_id))
              }
            })
          }
        }

        const nextSubmissionStatusByAssignmentId = {}

        for (const assignmentId of linkedAssignmentIds) {
          const gradebookRes = await fetch(`${API_BASE}/api/assignments/${assignmentId}/gradebook`)

          if (!gradebookRes.ok) {
            nextSubmissionStatusByAssignmentId[assignmentId] = "Not submitted"
            continue
          }

          const gradebookData = await gradebookRes.json()
          const rows = Array.isArray(gradebookData.rows) ? gradebookData.rows : []

          const studentRow = rows.find((row) => {
            return String(row.student_email || "").trim().toLowerCase() === studentEmail
          })

          nextSubmissionStatusByAssignmentId[assignmentId] = normalizeSubmissionStatus(
            studentRow?.submission_status
          )
        }

        if (!isMounted) return

        setCourses(visibleCourses)
        setLearningPathsByCourseId(nextLearningPathsByCourseId)
        setItemsByPathId(nextItemsByPathId)
        setSubmissionStatusByAssignmentId(nextSubmissionStatusByAssignmentId)

        if (visibleCourses.length > 0) {
          setSelectedCourseId(String(visibleCourses[0].id))
        } else {
          setSelectedCourseId("")
        }

        setLoading(false)
      } catch (err) {
        if (!isMounted) return
        setErrorText(err.message || "Could not load Learning Paths.")
        setCourses([])
        setLearningPathsByCourseId({})
        setItemsByPathId({})
        setSubmissionStatusByAssignmentId({})
        setSelectedCourseId("")
        setLoading(false)
      }
    }

    loadStudentLearningPaths()

    return () => {
      isMounted = false
    }
  }, [user?.email])

  const selectedCourse = courses.find((course) => String(course.id) === String(selectedCourseId))
  const selectedPaths = selectedCourseId ? learningPathsByCourseId[selectedCourseId] || [] : []

  if (loading) {
    return (
      <main style={pageStyle}>
        <section style={panelStyle}>
          <h1 style={{ marginTop: 0 }}>Learning Paths</h1>
          <p>Loading your Learning Paths...</p>
        </section>
      </main>
    )
  }

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={{ marginTop: 0, marginBottom: "8px" }}>Learning Paths</h1>
            <p style={mutedTextStyle}>
              View your course units, lessons, assignments, resources, videos, and quizzes in one place.
            </p>
          </div>

          <button type="button" onClick={() => navigate("/student")} style={buttonStyle}>
            Back to Student Dashboard
          </button>
        </div>

        {errorText ? <div style={noticeStyle}>{errorText}</div> : null}

        <div style={{ marginTop: "18px", maxWidth: "460px" }}>
          <label style={labelStyle}>Course</label>
          <select
            value={selectedCourseId}
            onChange={(event) => setSelectedCourseId(event.target.value)}
            style={inputStyle}
          >
            <option value="">Select Course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title || course.class_name}
              </option>
            ))}
          </select>
        </div>

        {selectedCourse ? (
          <p style={mutedTextStyle}>
            Showing Learning Paths for <strong>{selectedCourse.title || selectedCourse.class_name}</strong>.
          </p>
        ) : null}
      </section>

      <section style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>
          {selectedPaths.length} Learning Path{selectedPaths.length === 1 ? "" : "s"}
        </h2>

        {!selectedCourseId ? (
          <div style={noticeStyle}>Select a course to view Learning Paths.</div>
        ) : selectedPaths.length === 0 ? (
          <div style={noticeStyle}>No Learning Paths are available for this course yet.</div>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {selectedPaths.map((path) => {
              const items = itemsByPathId[path.id] || []
              const assignmentItems = items.filter((item) => item.assignment_id)
              const submittedAssignmentCount = assignmentItems.filter((item) => {
                const assignmentId = String(item.assignment_id || "")
                return submissionStatusByAssignmentId[assignmentId] === "Submitted"
              }).length

              return (
                <div key={path.id} style={pathCardStyle}>
                  <h3 style={{ marginTop: 0, marginBottom: "8px" }}>{path.title}</h3>

                  <p style={mutedTextStyle}>
                    {path.description || "No description available."}
                  </p>

                  <div style={{ marginTop: "8px", color: "#4b5563", fontWeight: 700 }}>
                    {items.length} Item{items.length === 1 ? "" : "s"}
                  </div>

                  {assignmentItems.length > 0 ? (
                    <div style={statusStyle}>
                      Progress: {submittedAssignmentCount} of {assignmentItems.length} assignment
                      {assignmentItems.length === 1 ? "" : "s"} submitted
                    </div>
                  ) : null}

                  {items.length === 0 ? (
                    <div style={{ ...noticeStyle, marginTop: "12px" }}>
                      No items have been added to this Learning Path yet.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
                      {items.map((item, index) => {
                        const label = getItemLabel(item.item_type)
                        const title = item.title || item.assignment_title || `${label} ${index + 1}`
                        const assignmentId = item.assignment_id ? String(item.assignment_id) : ""
                        const submissionStatus = assignmentId
                          ? submissionStatusByAssignmentId[assignmentId] || "Not submitted"
                          : ""

                        return (
                          <div key={item.id || `${path.id}-${index}`} style={itemCardStyle}>
                            <div style={pillStyle}>{label}</div>

                            <div style={{ fontWeight: 900, fontSize: "1.05rem" }}>
                              {title}
                            </div>

                            {item.assignment_title ? (
                              <div style={linkedStyle}>
                                Linked Assignment: {item.assignment_title}
                              </div>
                            ) : null}

                            {assignmentId ? (
                              <div style={statusStyle}>
                                {submissionStatus === "Submitted" ? "✓ Complete" : "○ Not Submitted"}
                              </div>
                            ) : null}

                            {item.description ? (
                              <p style={mutedTextStyle}>{item.description}</p>
                            ) : null}

                            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                              {assignmentId ? (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/student?assignmentId=${encodeURIComponent(assignmentId)}`)}
                                  style={buttonStyle}
                                >
                                  Open Assignment
                                </button>
                              ) : null}

                              {item.resource_url ? (
                                <a
                                  href={item.resource_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={linkButtonStyle}
                                >
                                  Open Resource
                                </a>
                              ) : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

const pageStyle = {
  padding: "24px",
  display: "grid",
  gap: "18px",
}

const panelStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "16px",
  padding: "20px",
  background: "#ffffff",
}

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  flexWrap: "wrap",
}

const mutedTextStyle = {
  color: "#4b5563",
  lineHeight: 1.5,
  marginTop: 0,
}

const noticeStyle = {
  border: "1px solid #cfd8e3",
  borderRadius: "12px",
  padding: "14px",
  background: "#f8fafc",
  lineHeight: 1.5,
}

const labelStyle = {
  display: "block",
  fontWeight: 800,
  marginBottom: "6px",
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
  font: "inherit",
  background: "#ffffff",
}

const buttonStyle = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #111827",
  background: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
}

const pathCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "14px",
  padding: "16px",
  background: "#f8fafc",
}

const itemCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "14px",
  background: "#ffffff",
  display: "grid",
  gap: "8px",
}

const pillStyle = {
  display: "inline-block",
  width: "fit-content",
  border: "1px solid #111827",
  borderRadius: "999px",
  padding: "3px 8px",
  fontSize: "0.82rem",
  fontWeight: 900,
  background: "#ffffff",
}

const linkedStyle = {
  border: "1px solid #111827",
  borderRadius: "10px",
  padding: "8px 10px",
  background: "#ffffff",
  fontWeight: 800,
  width: "fit-content",
}

const statusStyle = {
  border: "1px solid #cfd8e3",
  borderRadius: "10px",
  padding: "8px 10px",
  background: "#f8fafc",
  fontWeight: 800,
  width: "fit-content",
}

const linkButtonStyle = {
  display: "inline-block",
  width: "fit-content",
  border: "1px solid #111827",
  borderRadius: "10px",
  padding: "8px 10px",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 900,
  textDecoration: "none",
}
