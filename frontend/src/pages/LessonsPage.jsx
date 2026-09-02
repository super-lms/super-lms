import { useEffect, useMemo, useRef, useState } from "react"
import API_BASE from "../apiBase"
import authFetch from "../services/authFetch"
import { groupCoursesByMaster } from "../services/courseSections"
import { sanitizeRichText } from "../services/richText"
import { useAuth } from "../AuthContext.jsx"
import { FormattedText, RichTextEditor } from "../components/RichText.jsx"
import RepositoryFilePicker from "../components/RepositoryFilePicker.jsx"

function LessonsPage() {
  const { user } = useAuth()
  const queryParams = new URLSearchParams(window.location.search)
  const requestedCourseId = queryParams.get("courseId") || ""
  const requestedSection = queryParams.get("section") || ""
  const requestedView = queryParams.get("view") || ""
  const requestedEvidenceTierName = queryParams.get("evidenceTierName") || ""
  const createLessonRef = useRef(null)
  const lessonCreatedTimerRef = useRef(null)

  const [lessons, setLessons] = useState([])
  const [courses, setCourses] = useState([])
  const [courseId, setCourseId] = useState(requestedCourseId)
  const [selectedLessonId, setSelectedLessonId] = useState(null)
  const [editingLessonId, setEditingLessonId] = useState(null)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState(
    requestedEvidenceTierName ? `Evidence focus: ${requestedEvidenceTierName}\n\n` : ""
  )
  const [selectedFiles, setSelectedFiles] = useState([])
  const [moduleFiles, setModuleFiles] = useState([])
  const [uploadingResources, setUploadingResources] = useState(false)
  const [resourceUploadMessage, setResourceUploadMessage] = useState("")
  const [repositoryPickerTarget, setRepositoryPickerTarget] = useState(null)
  const [pendingRepositoryFiles, setPendingRepositoryFiles] = useState([])
  const [message, setMessage] = useState("Loading lessons...")
  const [lessonCreatedMessage, setLessonCreatedMessage] = useState("")
  const courseGroups = useMemo(() => groupCoursesByMaster(courses), [courses])
  const masterCourseOptions = useMemo(() => courseGroups.map((group) => ({
    id: group.contentCourse.id,
    title: group.isMultiSection ? `${group.masterTitle} — Master Course` : group.contentCourse.title,
    isMultiSection: group.isMultiSection,
  })), [courseGroups])
  const selectedMasterCourse = masterCourseOptions.find(
    (course) => String(course.id) === String(courseId)
  )
  const availableLessonCourses = requestedView === "master" ? masterCourseOptions : courses
  const lessonCourseOptions = requestedCourseId
    ? availableLessonCourses.filter(
        (course) => String(course.id) === String(requestedCourseId)
      )
    : availableLessonCourses
  const selectedCourseTitle = availableLessonCourses.find(
    (course) => String(course.id) === String(requestedCourseId)
  )?.title
  const canEditLessonResources = requestedView === "master" || ["admin", "administrator", "teacher"].includes(
    String(user?.role || "").toLowerCase()
  )

  async function loadLessons() {
    try {
      const response = await authFetch(`${API_BASE}/api/lessons`)

      if (!response.ok) {
        throw new Error("Failed to load lessons")
      }

      const data = await response.json()
      setLessons(Array.isArray(data) ? data : [])
      setMessage("Lessons loaded")
    } catch (error) {
      console.error(error)
      setLessons([])
      setMessage("Could not load lessons")
    }
  }

  async function loadCourses() {
    try {
      const response = await authFetch(`${API_BASE}/api/courses`)

      if (!response.ok) {
        throw new Error("Failed to load courses")
      }

      const data = await response.json()
      const safeCourses = Array.isArray(data) ? data : []

      setCourses(safeCourses)

      if (
        requestedCourseId &&
        safeCourses.some(
          (course) => String(course.id) === String(requestedCourseId)
        )
      ) {
        setCourseId(String(requestedCourseId))
      }
    } catch (error) {
      console.error(error)
      setCourses([])
      setMessage("Could not load courses")
    }
  }

  useEffect(() => {
    loadLessons()
    loadCourses()

    return () => {
      if (lessonCreatedTimerRef.current) {
        window.clearTimeout(lessonCreatedTimerRef.current)
      }
    }
  }, [])

  function showLessonCreatedMessage() {
    if (lessonCreatedTimerRef.current) {
      window.clearTimeout(lessonCreatedTimerRef.current)
    }

    setLessonCreatedMessage("Lesson created successfully")
    lessonCreatedTimerRef.current = window.setTimeout(() => {
      setLessonCreatedMessage("")
      lessonCreatedTimerRef.current = null
    }, 4000)
  }

  useEffect(() => {
    if (requestedSection !== "create" && window.location.hash !== "#create-lesson") {
      return
    }

    const scrollToCreateLesson = () => {
      createLessonRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }

    const frameId = window.requestAnimationFrame(scrollToCreateLesson)
    const timeoutId = window.setTimeout(scrollToCreateLesson, 150)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(timeoutId)
    }
  }, [requestedSection])

  async function uploadLessonFiles(lessonId, files = selectedFiles) {
    if (!files.length) {
      return { skipped: true }
    }

    const savedFiles = []

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      setMessage(`Uploading resource ${index + 1} of ${files.length}: ${file.name}`)
      setResourceUploadMessage(`Uploading ${file.name}—please keep this page open...`)

      const encodedData = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error(`${file.name} could not be read`))
        reader.onload = () => {
          const result = String(reader.result || "")
          resolve(result.includes(",") ? result.split(",", 2)[1] : result)
        }
        reader.readAsDataURL(file)
      })

      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), 120000)

      try {
        const response = await authFetch(
          `${API_BASE}/api/lesson-file-data/${lessonId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: file.name,
              type: file.type || "application/octet-stream",
              data: encodedData,
            }),
            signal: controller.signal,
          }
        )

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data?.error || `${file.name} could not be saved`)
        }

        const data = await response.json()
        if (!Array.isArray(data?.files) || data.files.length !== 1) {
          throw new Error(`The server did not confirm ${file.name}`)
        }
        savedFiles.push(data.files[0])
        setResourceUploadMessage(`${file.name} uploaded successfully.`)
      } catch (error) {
        if (error?.name === "AbortError") {
          throw new Error(`${file.name} took too long to upload. Try a smaller file.`)
        }
        throw error
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    return { success: true, files: savedFiles }
  }

  async function createLesson(event) {
    event.preventDefault()

    if (!courseId || !title.trim()) {
      setMessage("Please select a course and enter a lesson title")
      return
    }

    setMessage("Creating lesson...")

    try {
      const response = await authFetch(`${API_BASE}/api/lessons`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          course_id: Number(courseId),
          title: title.trim(),
          content: sanitizeRichText(content),
        }),
      })

      const responseData = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          responseData?.error || "Failed to create lesson"
        )
      }

      const newLesson = responseData
      await uploadLessonFiles(newLesson.id)
      for (const resource of pendingRepositoryFiles) {
        const attachResponse = await authFetch(`${API_BASE}/api/lesson-files/${newLesson.id}/from-repository`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resource_id: resource.id }),
        })
        if (!attachResponse.ok) {
          const data = await attachResponse.json().catch(() => ({}))
          throw new Error(data.error || `${resource.original_name} could not be attached`)
        }
      }

      setTitle("")
      setContent("")
      setSelectedFiles([])
      setPendingRepositoryFiles([])

      const fileInput = document.getElementById("lesson-file")
      if (fileInput) {
        fileInput.value = ""
      }

      await loadLessons()
      showLessonCreatedMessage()
    } catch (error) {
      console.error(error)
      await loadLessons()
      setMessage(
        error.message || "Error creating lesson or uploading file"
      )
      setResourceUploadMessage(`Upload failed: ${error.message || "Could not save the lesson resource"}`)
    }
  }

  async function addResourcesToLesson(lessonId) {
    if (!moduleFiles.length) {
      setMessage("Choose one or more lesson resources first")
      return
    }

    try {
      setUploadingResources(true)
      setResourceUploadMessage("Uploading—please keep this page open...")
      setMessage("Saving lesson resources...")
      await uploadLessonFiles(lessonId, moduleFiles)
      setModuleFiles([])
      const input = document.getElementById(`lesson-module-files-${lessonId}`)
      if (input) input.value = ""
      await loadLessons()
      setMessage("Lesson resources saved")
      setResourceUploadMessage("Upload complete. The file is now attached.")
    } catch (error) {
      console.error(error)
      await loadLessons()
      setMessage(error.message || "Could not save lesson resources")
      setResourceUploadMessage(`Upload failed: ${error.message || "Could not save lesson resources"}`)
    } finally {
      setUploadingResources(false)
    }
  }

  async function deleteLesson(id) {
    const confirmed = window.confirm("Delete this lesson?")

    if (!confirmed) {
      return
    }

    try {
      const response = await authFetch(
        `${API_BASE}/api/lessons/${id}`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) {
        throw new Error("Failed to delete lesson")
      }

      await response.json().catch(() => ({}))

      setSelectedLessonId(null)
      setMessage("Lesson deleted")
      await loadLessons()
    } catch (error) {
      console.error(error)
      setMessage("Error deleting lesson")
    }
  }

  function beginEditLesson(lesson) {
    setEditingLessonId(lesson.id)
    setEditTitle(lesson.title || "")
    setEditContent(lesson.content || "")
    setMessage("Editing lesson")
  }

  async function saveLessonEdits(lessonId) {
    const cleanTitle = editTitle.trim()
    if (!cleanTitle) {
      setMessage("Lesson title is required")
      return
    }

    try {
      const response = await authFetch(`${API_BASE}/api/lessons/${lessonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          content: sanitizeRichText(editContent),
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update lesson")
      }

      setEditingLessonId(null)
      setMessage("Lesson updated successfully")
      await loadLessons()
    } catch (error) {
      console.error(error)
      setMessage(error.message || "Error updating lesson")
    }
  }

  function formatFileSize(size) {
    if (!size && size !== 0) {
      return ""
    }

    if (size < 1024) {
      return `${size} bytes`
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  const visibleLessons = requestedCourseId
    ? lessons.filter((lesson) => String(lesson.course_id) === String(requestedCourseId))
    : lessons

  const groupedLessons = visibleLessons.reduce((groups, lesson) => {
    const groupName =
      lesson.course_title || `Course ${lesson.course_id}`

    if (!groups[groupName]) {
      groups[groupName] = []
    }

    groups[groupName].push(lesson)
    return groups
  }, {})

  const lessonsWithContent = visibleLessons.filter(
    (lesson) => String(lesson.content || "").trim().length > 0
  )

  const lessonsWithFiles = visibleLessons.filter(
    (lesson) =>
      Array.isArray(lesson.files) && lesson.files.length > 0
  )

  const lessonsMissingContent =
    visibleLessons.length - lessonsWithContent.length

  const lessonsMissingFiles =
    visibleLessons.length - lessonsWithFiles.length

  const courseCountWithLessons = Object.keys(groupedLessons).length

  const lessonReadinessScore =
    visibleLessons.length === 0
      ? 0
      : Math.round(
          (lessonsWithContent.length / visibleLessons.length) * 50 +
            (lessonsWithFiles.length / visibleLessons.length) * 50
        )

  const lessonReadinessLabel =
    visibleLessons.length === 0
      ? "No Lessons Yet"
      : lessonReadinessScore === 100
        ? "Lesson Workspace Ready"
        : lessonReadinessScore >= 75
          ? "Lessons Mostly Ready"
          : lessonReadinessScore >= 50
            ? "Lessons Need Some Attention"
            : "Lessons Need Setup"

  return (
    <div>
      <header
        style={{
          marginBottom: "24px",
          padding: "24px",
          backgroundColor: "#ffffff",
          border: "1px solid #cbd5e1",
          borderRadius: "10px",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: "10px",
            fontSize: "48px",
          }}
        >
          Lessons
        </h2>

        {requestedCourseId ? (
          <p style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 800 }}>
            Course: {selectedCourseTitle || `Course ${requestedCourseId}`}
          </p>
        ) : null}

        <p style={{ margin: 0, fontSize: "20px" }}>{message}</p>
      </header>

      <section
        style={{
          background: "#ffffff",
          padding: "24px",
          borderRadius: "10px",
          marginBottom: "24px",
          border: "1px solid #cbd5e1",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            marginBottom: "16px",
            fontSize: "32px",
          }}
        >
          Lesson Status
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "14px",
            marginBottom: "18px",
          }}
        >
          <div style={statusCardStyle}>
            <div style={statusLabelStyle}>Total Lessons</div>
            <div style={statusValueStyle}>{visibleLessons.length}</div>
          </div>

          <div style={statusCardStyle}>
            <div style={statusLabelStyle}>
              Courses With Lessons
            </div>
            <div style={statusValueStyle}>
              {courseCountWithLessons}
            </div>
          </div>

          <div style={statusCardStyle}>
            <div style={statusLabelStyle}>With Content</div>
            <div style={statusValueStyle}>
              {lessonsWithContent.length}
            </div>
          </div>

          <div style={statusCardStyle}>
            <div style={statusLabelStyle}>With Files</div>
            <div style={statusValueStyle}>
              {lessonsWithFiles.length}
            </div>
          </div>
        </div>

        <div
          style={{
            border: "1px solid #d7dce5",
            borderRadius: "10px",
            padding: "14px",
            background: "#f8fafc",
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              fontWeight: 900,
              marginBottom: "6px",
            }}
          >
            Lesson Readiness: {lessonReadinessScore}%
          </div>

          <div
            style={{
              fontWeight: 800,
              marginBottom: "8px",
            }}
          >
            {lessonReadinessLabel}
          </div>

          <div style={{ display: "grid", gap: "5px" }}>
            <div>
              {visibleLessons.length > 0 ? "☑" : "☐"} Lessons Created
            </div>

            <div>
              {lessonsMissingContent === 0 &&
              visibleLessons.length > 0
                ? "☑"
                : "☐"}{" "}
              Lesson Content Added
            </div>

            <div>
              {lessonsMissingFiles === 0 &&
              visibleLessons.length > 0
                ? "☑"
                : "☐"}{" "}
              Lesson Files Attached
            </div>
          </div>

          {visibleLessons.length === 0 ? (
            <div
              style={{
                marginTop: "10px",
                color: "#4b5563",
              }}
            >
              Next Step: Create the first lesson for one of your
              courses.
            </div>
          ) : lessonsMissingContent > 0 ||
            lessonsMissingFiles > 0 ? (
            <div
              style={{
                marginTop: "10px",
                color: "#4b5563",
              }}
            >
              Next Step: Review lessons missing content or attached
              files.
            </div>
          ) : (
            <div
              style={{
                marginTop: "10px",
                color: "#4b5563",
              }}
            >
              All lessons currently have content and attached files.
            </div>
          )}
        </div>
      </section>

      <section
        style={{
          background: "#ffffff",
          padding: "24px",
          borderRadius: "10px",
          border: "1px solid #cbd5e1",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            marginBottom: "20px",
            fontSize: "32px",
          }}
        >
          Lessons by Course
        </h3>

        {visibleLessons.length === 0 ? (
          <p style={{ fontSize: "20px", margin: 0 }}>
            No lessons yet
          </p>
        ) : !selectedLessonId ? (
          Object.entries(groupedLessons).map(
            ([courseTitle, courseLessons]) => (
              <div
                key={courseTitle}
                style={{ marginBottom: "32px" }}
              >
                <h4
                  style={{
                    marginBottom: "16px",
                    fontSize: "28px",
                    color: "#0f172a",
                  }}
                >
                  {courseTitle}
                </h4>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {courseLessons.map((lesson) => {
                    const fileCount = Array.isArray(lesson.files)
                      ? lesson.files.length
                      : 0

                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() =>
                          setSelectedLessonId(lesson.id)
                        }
                        style={{
                          padding: "18px",
                          border: "1px solid #d1d5db",
                          borderRadius: "12px",
                          backgroundColor: "#f8fafc",
                          textAlign: "left",
                          cursor: "pointer",
                          height: "220px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          overflow: "hidden",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "22px",
                              fontWeight: "bold",
                              marginBottom: "10px",
                            }}
                          >
                            {lesson.title}
                          </div>

                          <FormattedText
                            value={lesson.content}
                            fallback="No lesson content added yet."
                            style={{
                              fontSize: "16px",
                              color: "#4b5563",
                              lineHeight: "1.45",
                              display: "-webkit-box",
                              WebkitLineClamp: 4,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          />
                        </div>

                        <div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: "10px",
                              marginBottom: "12px",
                            }}
                          >
                            <div
                              style={{
                                border:
                                  "1px solid #d7dce5",
                                borderRadius: "10px",
                                padding: "10px",
                                background: "#ffffff",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "13px",
                                  color: "#4b5563",
                                  fontWeight: 800,
                                }}
                              >
                                Files
                              </div>

                              <div
                                style={{
                                  fontSize: "24px",
                                  fontWeight: 900,
                                }}
                              >
                                {fileCount}
                              </div>
                            </div>

                            <div
                              style={{
                                border:
                                  "1px solid #d7dce5",
                                borderRadius: "10px",
                                padding: "10px",
                                background: "#ffffff",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "13px",
                                  color: "#4b5563",
                                  fontWeight: 800,
                                }}
                              >
                                Lesson ID
                              </div>

                              <div
                                style={{
                                  fontSize: "24px",
                                  fontWeight: 900,
                                }}
                              >
                                {lesson.id}
                              </div>
                            </div>
                          </div>

                          <div style={{ fontWeight: 900 }}>
                            Open lesson workspace →
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          )
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setSelectedLessonId(null)}
              style={primaryButtonStyle}
            >
              ← Back to Lesson Cards
            </button>

            {lessons
              .filter(
                (lesson) =>
                  String(lesson.id) ===
                  String(selectedLessonId)
              )
              .map((lesson) => (
                <div
                  key={lesson.id}
                  style={{
                    marginTop: "18px",
                    padding: "20px",
                    border: "1px solid #d1d5db",
                    borderRadius: "10px",
                    backgroundColor: "#f8fafc",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        minWidth: "280px",
                      }}
                    >
                      {String(editingLessonId) === String(lesson.id) ? (
                        <div style={{ marginBottom: "18px" }}>
                          <label style={labelStyle} htmlFor={`edit-lesson-title-${lesson.id}`}>
                            Lesson Title
                          </label>
                          <input
                            id={`edit-lesson-title-${lesson.id}`}
                            value={editTitle}
                            onChange={(event) => setEditTitle(event.target.value)}
                            style={{ ...inputStyle, maxWidth: "none", marginBottom: "14px" }}
                          />
                          <label style={labelStyle}>Lesson Description</label>
                          <RichTextEditor
                            value={editContent}
                            onChange={setEditContent}
                            placeholder="Enter the lesson description."
                          />
                          <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
                            <button type="button" onClick={() => saveLessonEdits(lesson.id)} style={primaryButtonStyle}>
                              Save Changes
                            </button>
                            <button type="button" onClick={() => setEditingLessonId(null)} style={secondaryButtonStyle}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            style={{
                              fontSize: "28px",
                              fontWeight: "bold",
                              marginBottom: "10px",
                            }}
                          >
                            {lesson.title}
                          </div>

                          <FormattedText
                            value={lesson.content}
                            fallback="No lesson content"
                            style={{
                              fontSize: "18px",
                              marginBottom: "12px",
                              lineHeight: "1.5",
                            }}
                          />
                        </>
                      )}

                      <div
                        style={{
                          fontSize: "15px",
                          color: "#475569",
                          marginBottom: "14px",
                        }}
                      >
                        Lesson ID: {lesson.id} | Course ID:{" "}
                        {lesson.course_id}
                      </div>

                      <div
                        style={{
                          padding: "14px",
                          backgroundColor: "#ffffff",
                          border: "1px solid #dbe4ee",
                          borderRadius: "8px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "18px",
                            fontWeight: "bold",
                            marginBottom: "10px",
                          }}
                        >
                          Lesson Module Resources
                        </div>

                        {!lesson.files ||
                        lesson.files.length === 0 ? (
                          <p
                            style={{
                              margin: 0,
                              fontSize: "16px",
                            }}
                          >
                            No files attached.
                          </p>
                        ) : (
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: "20px",
                            }}
                          >
                            {lesson.files.map((file) => (
                              <li
                                key={file.id}
                                style={{
                                  marginBottom: "10px",
                                }}
                              >
                                <a
                                  href={`${API_BASE}${file.file_path}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    color: "#1d4ed8",
                                    textDecoration: "none",
                                    fontSize: "16px",
                                    fontWeight: "bold",
                                  }}
                                >
                                  {file.original_name}
                                </a>

                                <div
                                  style={{
                                    fontSize: "14px",
                                    color: "#64748b",
                                    marginTop: "2px",
                                  }}
                                >
                                  {file.mime_type ||
                                    "Unknown file type"}
                                  {file.file_size
                                    ? ` • ${formatFileSize(
                                        file.file_size
                                      )}`
                                    : ""}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}

                        {canEditLessonResources ? (
                          <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #dbe4ee" }}>
                            <div style={{ fontSize: "16px", fontWeight: 800, marginBottom: "8px" }}>
                              Add Resources to This Lesson Module
                            </div>
                            <button type="button" style={{ ...primaryButtonStyle, marginBottom: 10 }} onClick={() => setRepositoryPickerTarget(lesson.id)}>
                              Add File
                            </button>
                            <input
                              id={`lesson-module-files-${lesson.id}`}
                              type="file"
                              multiple
                              onChange={(event) => setModuleFiles(Array.from(event.target.files || []))}
                              style={{ display: "block", fontSize: "15px", marginBottom: "10px" }}
                            />
                            <button
                              type="button"
                              onClick={() => addResourcesToLesson(lesson.id)}
                              disabled={uploadingResources || moduleFiles.length === 0}
                              style={primaryButtonStyle}
                            >
                              {uploadingResources ? "Uploading Resources..." : `Upload ${moduleFiles.length || ""} Resource${moduleFiles.length === 1 ? "" : "s"}`}
                            </button>
                            {resourceUploadMessage ? (
                              <div
                                role="status"
                                style={{
                                  marginTop: "10px",
                                  padding: "10px 12px",
                                  borderRadius: "8px",
                                  background: resourceUploadMessage.startsWith("Upload failed") ? "#fee2e2" : "#e0f2fe",
                                  color: resourceUploadMessage.startsWith("Upload failed") ? "#991b1b" : "#0c4a6e",
                                  fontWeight: 700,
                                }}
                              >
                                {resourceUploadMessage}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => beginEditLesson(lesson)}
                        style={secondaryButtonStyle}
                      >
                        Edit Lesson
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLesson(lesson.id)}
                        style={deleteButtonStyle}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      <section
        id="create-lesson"
        ref={createLessonRef}
        style={{
          background: "#ffffff",
          padding: "24px",
          borderRadius: "10px",
          marginTop: "24px",
          marginBottom: "24px",
          border: "1px solid #cbd5e1",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            marginBottom: "16px",
            fontSize: "32px",
          }}
        >
          Create Lesson
        </h3>

        <form onSubmit={createLesson}>
          {requestedView === "master" && selectedMasterCourse?.isMultiSection ? (
            <div style={{ marginBottom: "16px", padding: "14px", border: "1px solid #bfd2e4", borderRadius: "10px", background: "#eef5fa", color: "#1f4e78", lineHeight: 1.5 }}>
              <strong>Shared master lesson workspace:</strong> {selectedMasterCourse.title}
              <div>This lesson will automatically appear in every linked lettered section.</div>
            </div>
          ) : null}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Course</label>

            <select
              value={courseId}
              onChange={(event) =>
                setCourseId(event.target.value)
              }
              disabled={Boolean(requestedCourseId)}
              style={inputStyle}
            >
              <option value="">Select Course</option>

              {lessonCourseOptions.map((course) => (
                <option key={course.id} value={course.id}>
                  ID {course.id} — {course.title}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Lesson Title</label>

            <input
              type="text"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Lesson Content</label>

            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Enter lesson content."
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={labelStyle}>
              Lesson Module Resources
            </label>

            <input
              id="lesson-file"
              type="file"
              multiple
              onChange={(event) => {
                setSelectedFiles(Array.from(event.target.files || []))
              }}
              style={{
                display: "block",
                fontSize: "16px",
              }}
            />

            <button type="button" style={{ ...secondaryButtonStyle, marginTop: 10 }} onClick={() => setRepositoryPickerTarget("new")}>
              Add File
            </button>
            {pendingRepositoryFiles.length ? (
              <ul style={{ marginBottom: 0 }}>{pendingRepositoryFiles.map((resource) => <li key={resource.id}>{resource.original_name}</li>)}</ul>
            ) : null}

            <p
              style={{
                marginTop: "8px",
                marginBottom: 0,
                fontSize: "14px",
                color: "#475569",
              }}
            >
              Select up to 20 files at once (maximum 50 MB each). All resources will be stored together in this lesson module and shared with linked class sections.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            <button type="submit" style={primaryButtonStyle}>
              Create Lesson
            </button>
            {lessonCreatedMessage ? (
              <span
                role="status"
                aria-live="polite"
                style={{ color: "#166534", fontSize: "18px", fontWeight: 800 }}
              >
                Lesson created successfully
              </span>
            ) : null}
            {resourceUploadMessage ? (
              <span
                role="status"
                aria-live="polite"
                style={{
                  color: resourceUploadMessage.startsWith("Upload failed") ? "#991b1b" : "#0c4a6e",
                  fontSize: "16px",
                  fontWeight: 800,
                }}
              >
                {resourceUploadMessage}
              </span>
            ) : null}
          </div>
        </form>
      </section>
      <RepositoryFilePicker
        courseId={courseId}
        open={repositoryPickerTarget !== null}
        title="Add a File to This Lesson"
        onClose={() => setRepositoryPickerTarget(null)}
        onSelect={async (resource) => {
          if (repositoryPickerTarget === "new") {
            setPendingRepositoryFiles((current) => current.some((item) => item.id === resource.id) ? current : [...current, resource])
            setRepositoryPickerTarget(null)
            return
          }
          const response = await authFetch(`${API_BASE}/api/lesson-files/${repositoryPickerTarget}/from-repository`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resource_id: resource.id }),
          })
          const data = await response.json().catch(() => ({}))
          if (!response.ok) { setResourceUploadMessage(`Upload failed: ${data.error || "File could not be attached"}`); return }
          setRepositoryPickerTarget(null)
          setResourceUploadMessage("File added from the repository.")
          await loadLessons()
        }}
      />
    </div>
  )
}

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  fontSize: "18px",
}

const inputStyle = {
  width: "100%",
  maxWidth: "500px",
  padding: "12px",
  fontSize: "18px",
  border: "1px solid #94a3b8",
  borderRadius: "8px",
  backgroundColor: "#ffffff",
}

const textareaStyle = {
  width: "100%",
  maxWidth: "500px",
  padding: "12px",
  fontSize: "18px",
  border: "1px solid #94a3b8",
  borderRadius: "8px",
  resize: "vertical",
}

const primaryButtonStyle = {
  padding: "12px 20px",
  fontSize: "18px",
  border: "1px solid #1e293b",
  borderRadius: "8px",
  backgroundColor: "#1f2937",
  color: "#ffffff",
  cursor: "pointer",
}

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  backgroundColor: "#ffffff",
  color: "#1f2937",
}

const statusCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "10px",
  padding: "16px",
  backgroundColor: "#ffffff",
}

const statusLabelStyle = {
  fontSize: "14px",
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: "8px",
}

const statusValueStyle = {
  fontSize: "30px",
  fontWeight: 900,
  color: "#0f172a",
}

const deleteButtonStyle = {
  padding: "10px 16px",
  fontSize: "16px",
  border: "1px solid #7f1d1d",
  borderRadius: "8px",
  backgroundColor: "#ffffff",
  color: "#7f1d1d",
  cursor: "pointer",
  alignSelf: "flex-start",
}

export default LessonsPage
