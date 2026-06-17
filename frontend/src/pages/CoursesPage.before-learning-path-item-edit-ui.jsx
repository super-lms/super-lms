import { useEffect, useState } from "react"
import * as XLSX from "xlsx"

const API_BASE = "http://localhost:3000"

function buildSampleCsv(courseName = "Accounting 11") {
  return `class_name,student_name,student_email,parent_email,student_id
${courseName},Jordan Lee,jordan.lee@school.ca,parent1@email.com,S001
${courseName},Avery Smith,avery.smith@school.ca,parent2@email.com,S002
${courseName},Morgan Chen,morgan.chen@school.ca,parent3@email.com,S003`
}

function escapeCsvValue(value) {
  const text = String(value ?? "").trim()

  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
}

function getLearningPathItemLabel(type) {
  const cleanType = String(type || "").toLowerCase()

  if (cleanType === "lesson") return "Lesson"
  if (cleanType === "assignment") return "Assignment"
  if (cleanType === "resource") return "Resource"
  if (cleanType === "video") return "Video"
  if (cleanType === "quiz") return "Quiz"

  return "Item"
}

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

  const [showBulkRosterImport, setShowBulkRosterImport] = useState(false)
  const [bulkCsvText, setBulkCsvText] = useState(buildSampleCsv())
  const [bulkImportingRoster, setBulkImportingRoster] = useState(false)

  const [activeRosterCourseId, setActiveRosterCourseId] = useState(null)
  const [rosterLoadingCourseId, setRosterLoadingCourseId] = useState(null)
  const [rosterByCourseId, setRosterByCourseId] = useState({})

  const [activeImportCourseId, setActiveImportCourseId] = useState(null)
  const [courseImportCsvText, setCourseImportCsvText] = useState("")
  const [courseImportingCourseId, setCourseImportingCourseId] = useState(null)
  const [courseImportFileName, setCourseImportFileName] = useState("")

  const [activeLearningPathCourseId, setActiveLearningPathCourseId] = useState(null)
  const [learningPathLoadingCourseId, setLearningPathLoadingCourseId] = useState(null)
  const [learningPathsByCourseId, setLearningPathsByCourseId] = useState({})
  const [creatingLearningPathCourseId, setCreatingLearningPathCourseId] = useState(null)
  const [newLearningPathTitleByCourseId, setNewLearningPathTitleByCourseId] = useState({})
  const [newLearningPathDescriptionByCourseId, setNewLearningPathDescriptionByCourseId] = useState({})
  const [deletingLearningPathId, setDeletingLearningPathId] = useState(null)

  const [learningPathItemsByPathId, setLearningPathItemsByPathId] = useState({})
  const [loadingItemsPathId, setLoadingItemsPathId] = useState(null)
  const [creatingItemKey, setCreatingItemKey] = useState(null)

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

  function getCourseName(course) {
    return course?.class_name || course?.title || `Course ${course?.id || ""}`
  }

  function openCourseImport(course) {
    const courseName = getCourseName(course)

    if (activeImportCourseId === course.id) {
      setActiveImportCourseId(null)
      return
    }

    setActiveImportCourseId(course.id)
    setCourseImportCsvText(buildSampleCsv(courseName))
    setCourseImportFileName("")
    setMessage("")
    setError("")
  }

  function convertRowsToCourseCsv(rows, courseName) {
    if (!Array.isArray(rows) || rows.length < 2) {
      throw new Error("Spreadsheet must have a header row and at least one student row.")
    }

    const headers = rows[0].map(normalizeHeader)
    const studentNameIndex = headers.indexOf("student_name")
    const studentEmailIndex = headers.indexOf("student_email")
    const parentEmailIndex = headers.indexOf("parent_email")
    const studentIdIndex = headers.indexOf("student_id")

    if (studentNameIndex === -1 || studentEmailIndex === -1) {
      throw new Error("Spreadsheet must include student_name and student_email columns.")
    }

    const csvRows = [
      ["class_name", "student_name", "student_email", "parent_email", "student_id"],
    ]

    rows.slice(1).forEach((row) => {
      const studentName = String(row[studentNameIndex] || "").trim()
      const studentEmail = String(row[studentEmailIndex] || "").trim()

      if (!studentName || !studentEmail) {
        return
      }

      csvRows.push([
        courseName,
        studentName,
        studentEmail,
        parentEmailIndex === -1 ? "" : row[parentEmailIndex],
        studentIdIndex === -1 ? "" : row[studentIdIndex],
      ])
    })

    if (csvRows.length < 2) {
      throw new Error("No valid student rows found in spreadsheet.")
    }

    return csvRows.map((row) => row.map(escapeCsvValue).join(",")).join("\n")
  }

  async function handleCourseRosterFile(course, file) {
    if (!file) return

    try {
      setError("")
      setMessage("")
      setCourseImportFileName(file.name)

      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: "array" })
      const firstSheetName = workbook.SheetNames[0]

      if (!firstSheetName) {
        throw new Error("Spreadsheet does not contain a sheet.")
      }

      const worksheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
      })

      const courseName = getCourseName(course)
      const nextCsvText = convertRowsToCourseCsv(rows, courseName)

      setCourseImportCsvText(nextCsvText)
      setMessage(`Loaded ${file.name}. Students will import into ${courseName}.`)
    } catch (err) {
      setError(err.message || "Failed to read spreadsheet.")
      setCourseImportFileName("")
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

  async function importCsvText(csvTextToImport, options = {}) {
    const cleanCsvText = String(csvTextToImport || "").trim()

    if (!cleanCsvText) {
      throw new Error("Paste roster CSV text before importing students.")
    }

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
      `Roster imported for ${data.className || options.courseName || "course"}. Created students: ${
        data.createdStudents || 0
      }. Enrolled students: ${data.enrolledStudents || 0}. Updated roles: ${
        data.updatedStudentRoles || 0
      }.`
    )

    setRosterByCourseId({})
    await loadCourses()

    if (options.courseId) {
      await loadRoster(options.courseId, { forceOpen: true })
    }
  }

  async function importBulkRoster(event) {
    event.preventDefault()

    try {
      setBulkImportingRoster(true)
      setMessage("")
      setError("")

      await importCsvText(bulkCsvText)
    } catch (err) {
      setError(err.message || "Failed to import roster")
    } finally {
      setBulkImportingRoster(false)
    }
  }

  async function importCourseRoster(course) {
    try {
      setCourseImportingCourseId(course.id)
      setMessage("")
      setError("")

      await importCsvText(courseImportCsvText, {
        courseId: course.id,
        courseName: getCourseName(course),
      })

      setActiveImportCourseId(null)
      setCourseImportFileName("")
    } catch (err) {
      setError(err.message || "Failed to import roster")
    } finally {
      setCourseImportingCourseId(null)
    }
  }

  async function loadRoster(courseId, options = {}) {
    if (activeRosterCourseId === courseId && !options.forceOpen) {
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

  async function loadLearningPathItems(learningPathId) {
    try {
      setLoadingItemsPathId(learningPathId)

      const res = await fetch(`${API_BASE}/api/learning-paths/${learningPathId}/items`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to load Learning Path items")
      }

      const nextItems = Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.learning_path_items)
          ? data.learning_path_items
          : Array.isArray(data)
            ? data
            : []

      setLearningPathItemsByPathId((current) => ({
        ...current,
        [learningPathId]: nextItems,
      }))
    } catch (err) {
      setError(err.message || "Failed to load Learning Path items")
    } finally {
      setLoadingItemsPathId(null)
    }
  }

  async function loadLearningPaths(courseId, options = {}) {
    if (activeLearningPathCourseId === courseId && !options.forceOpen) {
      setActiveLearningPathCourseId(null)
      return
    }

    try {
      setLearningPathLoadingCourseId(courseId)
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/courses/${courseId}/learning-paths`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to load learning paths")
      }

      const nextLearningPaths = Array.isArray(data.learning_paths) ? data.learning_paths : []

      setLearningPathsByCourseId((current) => ({
        ...current,
        [courseId]: nextLearningPaths,
      }))

      setActiveLearningPathCourseId(courseId)

      await Promise.all(
        nextLearningPaths.map((learningPath) => loadLearningPathItems(learningPath.id))
      )
    } catch (err) {
      setError(err.message || "Failed to load learning paths")
    } finally {
      setLearningPathLoadingCourseId(null)
    }
  }

  async function createLearningPath(course) {
    const courseId = course.id
    const title = String(newLearningPathTitleByCourseId[courseId] || "").trim()
    const description = String(newLearningPathDescriptionByCourseId[courseId] || "").trim()

    if (!title) {
      setError("Learning Path title is required.")
      setMessage("")
      return
    }

    try {
      setCreatingLearningPathCourseId(courseId)
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/courses/${courseId}/learning-paths`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create learning path")
      }

      setNewLearningPathTitleByCourseId((current) => ({
        ...current,
        [courseId]: "",
      }))

      setNewLearningPathDescriptionByCourseId((current) => ({
        ...current,
        [courseId]: "",
      }))

      setMessage(`Learning Path created for ${getCourseName(course)}: ${data.learning_path?.title || title}`)

      await loadLearningPaths(courseId, { forceOpen: true })
    } catch (err) {
      setError(err.message || "Failed to create learning path")
    } finally {
      setCreatingLearningPathCourseId(null)
    }
  }

  async function deleteLearningPath(courseId, learningPath) {
    const confirmDelete = window.confirm(`Delete the Learning Path "${learningPath.title}"?`)

    if (!confirmDelete) return

    try {
      setDeletingLearningPathId(learningPath.id)
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/learning-paths/${learningPath.id}`, {
        method: "DELETE",
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete learning path")
      }

      setLearningPathItemsByPathId((current) => {
        const next = { ...current }
        delete next[learningPath.id]
        return next
      })

      setMessage(`Learning Path deleted: ${data.deleted?.title || learningPath.title}`)
      await loadLearningPaths(courseId, { forceOpen: true })
    } catch (err) {
      setError(err.message || "Failed to delete learning path")
    } finally {
      setDeletingLearningPathId(null)
    }
  }

  async function createLearningPathItem(courseId, learningPath, itemType) {
    const currentItems = learningPathItemsByPathId[learningPath.id] || []
    const label = getLearningPathItemLabel(itemType)
    const nextNumber = currentItems.filter((item) => String(item.item_type || item.type || "").toLowerCase() === itemType).length + 1
    const title = `${label} ${nextNumber}`

    try {
      setCreatingItemKey(`${learningPath.id}-${itemType}`)
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/learning-paths/${learningPath.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_type: itemType,
          type: itemType,
          title,
          name: title,
          description: "",
          sort_order: currentItems.length + 1,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create Learning Path item")
      }

      setMessage(`${label} added to ${learningPath.title}.`)
      await loadLearningPathItems(learningPath.id)
      await loadLearningPaths(courseId, { forceOpen: true })
    } catch (err) {
      setError(err.message || "Failed to create Learning Path item")
    } finally {
      setCreatingItemKey(null)
    }
  }

  async function setupKdu(courseId) {
    try {
      setSettingUpCourseId(courseId)
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/courses/${courseId}/setup-kdu-assessment-structure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

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

      const res = await fetch(`${API_BASE}/api/courses/${courseId}/setup-kdu-assessment-structure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replaceExisting: true }),
      })

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
              Create courses, import students, view rosters, build Learning Paths, then set up KDU assessment structures.
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
                setShowBulkRosterImport((current) => !current)
                setMessage("")
                setError("")
              }}
              style={primaryButtonStyle}
            >
              {showBulkRosterImport ? "Close Bulk Import" : "+ Bulk Import Students"}
            </button>
          </div>
        </div>

        {message ? <NoticeBox>{message}</NoticeBox> : null}
        {error ? <NoticeBox error>{error}</NoticeBox> : null}

        {showCreateCourse ? (
          <form onSubmit={createCourse} style={sectionBoxStyle}>
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

        {showBulkRosterImport ? (
          <form onSubmit={importBulkRoster} style={sectionBoxStyle}>
            <h2 style={{ marginTop: 0, marginBottom: "8px" }}>Bulk Import Students</h2>

            <p style={{ color: "#4b5563", lineHeight: 1.5 }}>
              Use this when your CSV already includes a class_name column for each student.
              For a single course, use the Import Students button on that course card instead.
            </p>

            <div style={csvHelperStyle}>
              Required headers:
              <br />
              <strong>class_name, student_name, student_email, parent_email, student_id</strong>
            </div>

            <textarea
              value={bulkCsvText}
              onChange={(event) => setBulkCsvText(event.target.value)}
              rows="9"
              style={textareaStyle}
            />

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
              <button type="submit" disabled={bulkImportingRoster} style={primaryButtonStyle}>
                {bulkImportingRoster ? "Importing..." : "Bulk Import Students"}
              </button>

              <button
                type="button"
                disabled={bulkImportingRoster}
                onClick={() => setBulkCsvText(buildSampleCsv())}
                style={buttonStyle}
              >
                Reset Sample CSV
              </button>

              <button
                type="button"
                disabled={bulkImportingRoster}
                onClick={() => {
                  setShowBulkRosterImport(false)
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
              Create your first course to begin setting up assignments, students, Learning Paths, KDU structures, and grading.
            </p>
            <button type="button" onClick={() => setShowCreateCourse(true)} style={primaryButtonStyle}>
              + Create First Course
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {courses.map((course) => {
              const roster = rosterByCourseId[course.id]
              const rosterStudents = roster?.students || []
              const isRosterOpen = activeRosterCourseId === course.id
              const isImportOpen = activeImportCourseId === course.id
              const isLearningPathsOpen = activeLearningPathCourseId === course.id
              const courseName = getCourseName(course)
              const learningPaths = learningPathsByCourseId[course.id] || []

              return (
                <div key={course.id} style={courseCardStyle}>
                  <h2 style={{ marginTop: 0, marginBottom: "8px" }}>{courseName}</h2>

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
                      onClick={() => openCourseImport(course)}
                      disabled={courseImportingCourseId === course.id}
                      style={buttonStyle}
                    >
                      {isImportOpen ? "Close Import" : "Import Students"}
                    </button>

                    <button
                      type="button"
                      onClick={() => loadLearningPaths(course.id)}
                      disabled={learningPathLoadingCourseId === course.id}
                      style={buttonStyle}
                    >
                      {learningPathLoadingCourseId === course.id
                        ? "Loading Paths..."
                        : isLearningPathsOpen
                          ? "Hide Learning Paths"
                          : "Learning Paths"}
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

                  {isLearningPathsOpen ? (
                    <div style={learningPathBoxStyle}>
                      <h3 style={{ marginTop: 0, marginBottom: "8px" }}>Learning Paths</h3>

                      <p style={{ color: "#4b5563", lineHeight: 1.5 }}>
                        Build teacher-friendly course sequences like units, chapters, weeks, or inquiry pathways.
                        This is SUPER LMS's better version of Canvas Modules.
                      </p>

                      <div style={learningPathCreateGridStyle}>
                        <div>
                          <label style={labelStyle}>New Learning Path Title</label>
                          <input
                            value={newLearningPathTitleByCourseId[course.id] || ""}
                            onChange={(event) =>
                              setNewLearningPathTitleByCourseId((current) => ({
                                ...current,
                                [course.id]: event.target.value,
                              }))
                            }
                            placeholder="Example: Unit 1 — Poetry Analysis"
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Description</label>
                          <textarea
                            value={newLearningPathDescriptionByCourseId[course.id] || ""}
                            onChange={(event) =>
                              setNewLearningPathDescriptionByCourseId((current) => ({
                                ...current,
                                [course.id]: event.target.value,
                              }))
                            }
                            placeholder="Optional: describe the learning sequence, goals, or major assessment."
                            rows="3"
                            style={textareaStyle}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => createLearningPath(course)}
                          disabled={creatingLearningPathCourseId === course.id}
                          style={primaryButtonStyle}
                        >
                          {creatingLearningPathCourseId === course.id ? "Creating..." : "+ Create Learning Path"}
                        </button>
                      </div>

                      <div style={{ marginTop: "16px", fontWeight: 800 }}>
                        {learningPaths.length} Learning Path{learningPaths.length === 1 ? "" : "s"}
                      </div>

                      {learningPaths.length === 0 ? (
                        <div style={{ color: "#4b5563", lineHeight: 1.5, marginTop: "8px" }}>
                          No Learning Paths yet. Create one above to start organizing this course.
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
                          {learningPaths.map((pathItem) => {
                            const pathItems = learningPathItemsByPathId[pathItem.id] || []

                            return (
                              <div key={pathItem.id} style={learningPathCardStyle}>
                                <div style={{ flex: "1 1 320px" }}>
                                  <div style={{ fontWeight: 900, marginBottom: "4px" }}>
                                    {pathItem.title}
                                  </div>

                                  {pathItem.description ? (
                                    <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
                                      {pathItem.description}
                                    </div>
                                  ) : (
                                    <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
                                      No description yet.
                                    </div>
                                  )}

                                  <div style={{ marginTop: "6px", fontSize: "0.92rem", color: "#4b5563" }}>
                                    Status: {pathItem.is_published ? "Published" : "Draft"} · Order {pathItem.sort_order}
                                  </div>

                                  <div style={itemBuilderStyle}>
                                    <div style={{ fontWeight: 900, marginBottom: "8px" }}>
                                      Build this Learning Path
                                    </div>

                                    <div style={itemButtonRowStyle}>
                                      {["lesson", "assignment", "resource", "video", "quiz"].map((itemType) => {
                                        const label = getLearningPathItemLabel(itemType)
                                        const key = `${pathItem.id}-${itemType}`

                                        return (
                                          <button
                                            key={itemType}
                                            type="button"
                                            onClick={() => createLearningPathItem(course.id, pathItem, itemType)}
                                            disabled={creatingItemKey === key}
                                            style={buttonStyle}
                                          >
                                            {creatingItemKey === key ? "Adding..." : `+ Add ${label}`}
                                          </button>
                                        )
                                      })}
                                    </div>

                                    <div style={{ marginTop: "12px", fontWeight: 900 }}>
                                      {pathItems.length} Item{pathItems.length === 1 ? "" : "s"}
                                    </div>

                                    {loadingItemsPathId === pathItem.id ? (
                                      <div style={{ color: "#4b5563", marginTop: "8px" }}>
                                        Loading items...
                                      </div>
                                    ) : pathItems.length === 0 ? (
                                      <div style={{ color: "#4b5563", marginTop: "8px", lineHeight: 1.5 }}>
                                        No items yet. Add a lesson, assignment, resource, video, or quiz.
                                      </div>
                                    ) : (
                                      <div style={itemListStyle}>
                                        {pathItems.map((item, index) => {
                                          const itemType = item.item_type || item.type
                                          const label = getLearningPathItemLabel(itemType)
                                          const title = item.title || item.name || `${label} ${index + 1}`

                                          return (
                                            <div key={item.id || `${pathItem.id}-${index}`} style={itemRowStyle}>
                                              <div style={itemTypePillStyle}>{label}</div>
                                              <div style={{ fontWeight: 800 }}>{title}</div>
                                              {item.description ? (
                                                <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
                                                  {item.description}
                                                </div>
                                              ) : null}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => deleteLearningPath(course.id, pathItem)}
                                  disabled={deletingLearningPathId === pathItem.id}
                                  style={buttonStyle}
                                >
                                  {deletingLearningPathId === pathItem.id ? "Deleting..." : "Delete"}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {isImportOpen ? (
                    <div style={rosterBoxStyle}>
                      <h3 style={{ marginTop: 0, marginBottom: "8px" }}>
                        Import Students into {courseName}
                      </h3>

                      <p style={{ color: "#4b5563", lineHeight: 1.5 }}>
                        Choose an Excel file or paste CSV text. SUPER LMS will automatically attach every row to this course.
                      </p>

                      <div style={csvHelperStyle}>
                        Your file should include at least:
                        <br />
                        <strong>student_name, student_email</strong>
                        <br />
                        Optional: <strong>parent_email, student_id</strong>
                      </div>

                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={(event) => handleCourseRosterFile(course, event.target.files?.[0])}
                        style={inputStyle}
                      />

                      {courseImportFileName ? (
                        <div style={{ marginTop: "8px", fontWeight: 800 }}>
                          Loaded file: {courseImportFileName}
                        </div>
                      ) : null}

                      <textarea
                        value={courseImportCsvText}
                        onChange={(event) => setCourseImportCsvText(event.target.value)}
                        rows="8"
                        style={{ ...textareaStyle, marginTop: "12px" }}
                      />

                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
                        <button
                          type="button"
                          onClick={() => importCourseRoster(course)}
                          disabled={courseImportingCourseId === course.id}
                          style={primaryButtonStyle}
                        >
                          {courseImportingCourseId === course.id ? "Importing..." : `Import into ${courseName}`}
                        </button>

                        <button
                          type="button"
                          disabled={courseImportingCourseId === course.id}
                          onClick={() => {
                            setCourseImportCsvText(buildSampleCsv(courseName))
                            setCourseImportFileName("")
                          }}
                          style={buttonStyle}
                        >
                          Reset Sample
                        </button>

                        <button
                          type="button"
                          disabled={courseImportingCourseId === course.id}
                          onClick={() => setActiveImportCourseId(null)}
                          style={buttonStyle}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {isRosterOpen ? (
                    <div style={rosterBoxStyle}>
                      <h3 style={{ marginTop: 0, marginBottom: "8px" }}>Roster</h3>

                      <div style={{ marginBottom: "12px", fontWeight: 800 }}>
                        {rosterStudents.length} enrolled student{rosterStudents.length === 1 ? "" : "s"}
                      </div>

                      {rosterStudents.length === 0 ? (
                        <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
                          No students are enrolled in this course yet. Use Import Students on this course card.
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

const sectionBoxStyle = {
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

const learningPathBoxStyle = {
  border: "2px solid #111827",
  borderRadius: "14px",
  padding: "16px",
  background: "#ffffff",
  marginTop: "16px",
}

const learningPathCreateGridStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "14px",
  background: "#f8fafc",
  display: "grid",
  gap: "12px",
}

const learningPathCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "14px",
  background: "#f8fafc",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  flexWrap: "wrap",
}

const itemBuilderStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "12px",
  background: "#ffffff",
  marginTop: "14px",
}

const itemButtonRowStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
}

const itemListStyle = {
  display: "grid",
  gap: "8px",
  marginTop: "10px",
}

const itemRowStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "10px",
  padding: "10px",
  background: "#f8fafc",
  display: "grid",
  gap: "6px",
}

const itemTypePillStyle = {
  display: "inline-block",
  width: "fit-content",
  border: "1px solid #111827",
  borderRadius: "999px",
  padding: "3px 8px",
  fontSize: "0.82rem",
  fontWeight: 900,
  background: "#ffffff",
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
