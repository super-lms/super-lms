import { useEffect, useState } from "react"

const API_BASE = "http://localhost:3000"

const SAMPLE_CSV = `class_name,student_name,student_email,parent_email,student_id
English Studies 12 Block A,Jordan Lee,jordan.lee@school.ca,parent1@email.com,S001
English Studies 12 Block A,Avery Smith,avery.smith@school.ca,parent2@email.com,S002
English Studies 12 Block A,Morgan Chen,morgan.chen@school.ca,parent3@email.com,S003`

export default function CoursesPage() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [settingUpCourseId, setSettingUpCourseId] = useState(null)

  const [showCreateCourse, setShowCreateCourse] = useState(false)
  const [creatingCourse, setCreatingCourse] = useState(false)
  const [newCourseTitle, setNewCourseTitle] = useState("")
  const [newCourseDescription, setNewCourseDescription] = useState("")
  const [newCourseTeacherEmail, setNewCourseTeacherEmail] = useState("")

  const [showRosterImport, setShowRosterImport] = useState(false)
  const [importingRoster, setImportingRoster] = useState(false)
  const [csvText, setCsvText] = useState(SAMPLE_CSV)

  const [activeRosterCourseId, setActiveRosterCourseId] = useState(null)
  const [rosterLoadingCourseId, setRosterLoadingCourseId] = useState(null)
  const [rosterByCourseId, setRosterByCourseId] = useState({})

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

  async function createCourse(event) {
    event.preventDefault()

    const cleanTitle = String(newCourseTitle || "").trim()
    const cleanDescription = String(newCourseDescription || "").trim()
    const cleanTeacherEmail = String(newCourseTeacherEmail || "").trim().toLowerCase()

    if (!cleanTitle) {
      setError("Course title is required.")
      setMessage("")
      return
    }

    try {
      setCreatingCourse(true)
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          description: cleanDescription,
          teacher_email: cleanTeacherEmail,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create course")
      }

      setNewCourseTitle("")
      setNewCourseDescription("")
      setNewCourseTeacherEmail("")
      setShowCreateCourse(false)
      setMessage(`Course created: ${data.title || cleanTitle}`)

      await loadCourses()
    } catch (err) {
      setError(err.message || "Failed to create course")
    } finally {
      setCreatingCourse(false)
    }
  }

  async function importRoster(event) {
    event.preventDefault()

    const cleanCsvText = String(csvText || "").trim()

    if (!cleanCsvText) {
      setError("Paste roster CSV text before importing students.")
      setMessage("")
      return
    }

    try {
      setImportingRoster(true)
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/import/class-from-csv-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText: cleanCsvText,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to import roster")
      }

      setMessage(
        `Roster imported for ${data.className || "course"}. Created students: ${
          data.createdStudents || 0
        }. Enrolled students: ${data.enrolledStudents || 0}. Updated roles: ${
          data.updatedStudentRoles || 0
        }.`
      )

      setRosterByCourseId({})
      await loadCourses()
    } catch (err) {
      setError(err.message || "Failed to import roster")
    } finally {
      setImportingRoster(false)
    }
  }

  async function loadRoster(courseId) {
    if (activeRosterCourseId === courseId) {
      setActiveRosterCourseId(null)
      return
    }

    try {
      setRosterLoadingCourseId(courseId)
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/class-roster/${courseId}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to load course roster")
      }

      setRosterByCourseId((current) => ({
        ...current,
        [courseId]: {
          course: data.course || null,
          students: Array.isArray(data.students) ? data.students : [],
        },
      }))

      setActiveRosterCourseId(courseId)
    } catch (err) {
      setError(err.message || "Failed to load course roster")
    } finally {
      setRosterLoadingCourseId(null)
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

      await loadCourses()
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
        <div style={pageHeaderStyle}>
          <div>
            <h1 style={{ marginTop: 0, marginBottom: "8px" }}>Courses</h1>
            <p style={{ color: "#4b5563", lineHeight: 1.5, marginTop: 0 }}>
              Create courses, import students, view rosters, then set up the standard English Studies KDU assessment structure.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                setShowCreateCourse((current) => !current)
                setMessage("")
                setError("")
              }}
              style={primaryButtonStyle}
            >
              {showCreateCourse ? "Close Create Course" : "+ Create Course"}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowRosterImport((current) => !current)
                setMessage("")
                setError("")
              }}
              style={primaryButtonStyle}
            >
              {showRosterImport ? "Close Roster Import" : "+ Import Students"}
            </button>
          </div>
        </div>

        {message ? <NoticeBox>{message}</NoticeBox> : null}
        {error ? <NoticeBox error>{error}</NoticeBox> : null}

        {showCreateCourse ? (
          <form onSubmit={createCourse} style={createCourseBoxStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "8px" }}>Create Course</h2>

            <div style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Course Title</label>
                <input
                  value={newCourseTitle}
                  onChange={(event) => setNewCourseTitle(event.target.value)}
                  placeholder="Example: English Studies 12 Block A"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Description</label>
                <textarea
                  value={newCourseDescription}
                  onChange={(event) => setNewCourseDescription(event.target.value)}
                  placeholder="Optional course notes, term, or class description."
                  rows="4"
                  style={textareaStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Teacher Email</label>
                <input
                  value={newCourseTeacherEmail}
                  onChange={(event) => setNewCourseTeacherEmail(event.target.value)}
                  placeholder="Optional. Example: teacher@school.ca"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button type="submit" disabled={creatingCourse} style={primaryButtonStyle}>
                  {creatingCourse ? "Creating..." : "Save Course"}
                </button>

                <button
                  type="button"
                  disabled={creatingCourse}
                  onClick={() => {
                    setShowCreateCourse(false)
                    setNewCourseTitle("")
                    setNewCourseDescription("")
                    setNewCourseTeacherEmail("")
                    setError("")
                  }}
                  style={buttonStyle}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        ) : null}

        {showRosterImport ? (
          <form onSubmit={importRoster} style={createCourseBoxStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "8px" }}>Import Students</h2>

            <p style={{ color: "#4b5563", lineHeight: 1.5 }}>
              Paste CSV text below. The <strong>class_name</strong> must match the course name.
              If the course does not exist yet, the backend will create it.
            </p>

            <div style={csvHelperStyle}>
              Required headers:
              <br />
              <strong>class_name, student_name, student_email, parent_email, student_id</strong>
            </div>

            <textarea
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              rows="9"
              style={textareaStyle}
            />

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
              <button type="submit" disabled={importingRoster} style={primaryButtonStyle}>
                {importingRoster ? "Importing..." : "Import Students"}
              </button>

              <button
                type="button"
                disabled={importingRoster}
                onClick={() => setCsvText(SAMPLE_CSV)}
                style={buttonStyle}
              >
                Reset Sample CSV
              </button>

              <button
                type="button"
                disabled={importingRoster}
                onClick={() => {
                  setShowRosterImport(false)
                  setError("")
                }}
                style={buttonStyle}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <div style={{ marginBottom: "14px", fontWeight: 800 }}>
          Showing {courses.length} course{courses.length === 1 ? "" : "s"}.
        </div>

        {courses.length === 0 ? (
          <div style={emptyStateStyle}>
            <h2 style={{ marginTop: 0 }}>No courses yet</h2>
            <p style={{ color: "#4b5563", lineHeight: 1.5 }}>
              Create your first course to begin setting up assignments, students, KDU structures, and grading.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateCourse(true)}
              style={primaryButtonStyle}
            >
              + Create First Course
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {courses.map((course) => {
              const roster = rosterByCourseId[course.id]
              const rosterStudents = roster?.students || []
              const isRosterOpen = activeRosterCourseId === course.id

              return (
                <div key={course.id} style={courseCardStyle}>
                  <h2 style={{ marginTop: 0, marginBottom: "8px" }}>
                    {course.class_name || course.title || `Course ${course.id}`}
                  </h2>

                  {course.description ? (
                    <div style={{ marginBottom: "10px", color: "#4b5563", lineHeight: 1.5 }}>
                      {course.description}
                    </div>
                  ) : null}

                  <div style={{ marginBottom: "14px", color: "#4b5563" }}>
                    Course ID: {course.id}
                  </div>

                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => loadRoster(course.id)}
                      disabled={rosterLoadingCourseId === course.id}
                      style={buttonStyle}
                    >
                      {rosterLoadingCourseId === course.id
                        ? "Loading Roster..."
                        : isRosterOpen
                          ? "Hide Roster"
                          : "View Roster"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setupKdu(course.id)}
                      disabled={settingUpCourseId === course.id}
                      style={buttonStyle}
                    >
                      {settingUpCourseId === course.id ? "Setting up..." : "Set Up KDU Structure"}
                    </button>

                    <button
                      type="button"
                      onClick={() => forceSetupKdu(course.id)}
                      disabled={settingUpCourseId === course.id}
                      style={buttonStyle}
                    >
                      Force Reset KDU
                    </button>
                  </div>

                  {isRosterOpen ? (
                    <div style={rosterBoxStyle}>
                      <h3 style={{ marginTop: 0, marginBottom: "8px" }}>
                        Roster
                      </h3>

                      <div style={{ marginBottom: "12px", fontWeight: 800 }}>
                        {rosterStudents.length} enrolled student{rosterStudents.length === 1 ? "" : "s"}
                      </div>

                      {rosterStudents.length === 0 ? (
                        <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
                          No students are enrolled in this course yet. Use + Import Students above.
                        </div>
                      ) : (
                        <div style={{ overflowX: "auto" }}>
                          <table style={tableStyle}>
                            <thead>
                              <tr>
                                <th style={tableHeaderStyle}>Student</th>
                                <th style={tableHeaderStyle}>Email</th>
                                <th style={tableHeaderStyle}>Parent Email</th>
                                <th style={tableHeaderStyle}>Student ID</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rosterStudents.map((student) => (
                                <tr key={student.id || student.email}>
                                  <td style={tableCellStyle}>{student.name || "—"}</td>
                                  <td style={tableCellStyle}>{student.email || "—"}</td>
                                  <td style={tableCellStyle}>{student.parent_email || "—"}</td>
                                  <td style={tableCellStyle}>{student.student_id || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function NoticeBox({ children, error = false }) {
  return (
    <div
      style={{
        border: error ? "1px solid #d1a1a1" : "1px solid #cfd8e3",
        borderRadius: "12px",
        padding: "14px",
        marginBottom: "16px",
        background: error ? "#fff8f8" : "#f8fafc",
      }}
    >
      {children}
    </div>
  )
}

const pageHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
  marginBottom: "12px",
}

const createCourseBoxStyle = {
  border: "2px solid #111827",
  borderRadius: "16px",
  padding: "18px",
  background: "#ffffff",
  marginBottom: "18px",
}

const courseCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "14px",
  padding: "18px",
  background: "#ffffff",
}

const emptyStateStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "14px",
  padding: "18px",
  background: "#ffffff",
}

const csvHelperStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "12px",
  background: "#f8fafc",
  marginBottom: "12px",
  lineHeight: 1.5,
}

const rosterBoxStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "14px",
  padding: "16px",
  background: "#f8fafc",
  marginTop: "16px",
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

const textareaStyle = {
  ...inputStyle,
  resize: "vertical",
}

const buttonStyle = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #d7dce5",
  background: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
}

const primaryButtonStyle = {
  ...buttonStyle,
  border: "2px solid #111827",
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#ffffff",
}

const tableHeaderStyle = {
  border: "1px solid #d7dce5",
  padding: "10px",
  textAlign: "left",
  background: "#ffffff",
}

const tableCellStyle = {
  border: "1px solid #d7dce5",
  padding: "10px",
  verticalAlign: "top",
}
