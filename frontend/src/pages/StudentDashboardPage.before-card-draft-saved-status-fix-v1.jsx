import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import FloatingTeacherCoach from "../components/FloatingTeacherCoach.jsx"
import { useAuth } from "../AuthContext.jsx"

function SectionHeader({ title, subtitle, action }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "12px",
        flexWrap: "wrap",
        marginBottom: "16px",
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>{title}</h2>
        {subtitle ? (
          <p style={{ margin: "6px 0 0 0", fontSize: "0.95rem", lineHeight: 1.5, color: "#4b5563" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action || null}
    </div>
  )
}

function SummaryCard({ label, value, helper }) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryLabelStyle}>{label}</div>
      <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div style={summaryHelperStyle}>{helper}</div>
    </div>
  )
}

function NoticeBox({ children, type = "info" }) {
  const borderColor = type === "error" ? "#d1a1a1" : "#cfd8e3"
  const background = type === "error" ? "#fff8f8" : "#f8fafc"

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: "12px", padding: "14px 16px", background, lineHeight: 1.5 }}>
      {children}
    </div>
  )
}

function ActionButton({ children, onClick, type = "button", quiet = false, disabled = false }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={buttonStyle(quiet, disabled)}>
      {children}
    </button>
  )
}

function DetailCard({ title, children }) {
  return (
    <div style={detailCardStyle}>
      <div style={{ fontWeight: 800, marginBottom: "10px" }}>{title}</div>
      {children}
    </div>
  )
}

function CourseOverviewCard({ course, isSelected, onSelect }) {
  return (
    <button type="button" onClick={() => onSelect(String(course.id))} style={courseButtonStyle(isSelected)}>
      <div style={{ fontWeight: 800, marginBottom: "6px" }}>{course.title || course.class_name || "Untitled Course"}</div>
      <div style={{ fontSize: "0.95rem", lineHeight: 1.5, color: "#4b5563" }}>
        {course.description || "No course description available."}
      </div>
    </button>
  )
}

function AssignmentCard({ assignment, compact = false, footer = null, submissionStatus = "" }) {
  const dueLabel = formatDueDate(assignment?.due_date)
  const status = getAssignmentStatus(assignment?.due_date)

  return (
    <div style={assignmentCardStyle(compact)}>
      <div style={assignmentHeaderStyle}>
        <h3 style={{ margin: 0 }}>{assignment?.title || "Untitled Assignment"}</h3>
        <div style={statusPillStyle}>{status}</div>
      </div>

      <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.5 }}>
        {assignment?.description || "No assignment description available."}
      </p>

      <div style={assignmentMetaStyle}>
        <div>
          <strong>Due:</strong> {dueLabel}
        </div>
        {assignment?.points_possible !== undefined && assignment?.points_possible !== null ? (
          <div>
            <strong>Points:</strong> {assignment.points_possible}
          </div>
        ) : null}
        {submissionStatus ? (
          <div>
            <strong>Submission:</strong> {submissionStatus}
          </div>
        ) : null}
      </div>

      {footer ? <div style={{ marginTop: "14px" }}>{footer}</div> : null}
    </div>
  )
}

function LessonCard({ lesson }) {
  return (
    <div style={lessonCardStyle}>
      <h3 style={{ marginTop: 0, marginBottom: "8px" }}>{lesson.title || "Untitled Lesson"}</h3>
      <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.5 }}>
        {lesson.description || "No lesson description available."}
      </p>
    </div>
  )
}

function ResultCard({ assignment, submissionState, onOpen }) {
  const submission = submissionState?.submission || null
  const submissionStatusLabel = formatSubmissionStatus(submissionState?.submission_status || "not_submitted")

  return (
    <div style={resultCardStyle}>
      <div style={resultHeaderStyle}>
        <h3 style={{ margin: 0 }}>{assignment?.title || "Untitled Assignment"}</h3>
        <ActionButton quiet onClick={onOpen}>
          View Submission
        </ActionButton>
      </div>

      <div style={resultGridStyle}>
        <DetailCard title="Due Date">
          <div>{formatDueDate(assignment?.due_date)}</div>
        </DetailCard>

        <DetailCard title="Submission">
          <div>{submissionStatusLabel}</div>
        </DetailCard>

        <DetailCard title="Score">
          <div>{submission?.score === null || submission?.score === undefined ? "Not graded" : submission.score}</div>
        </DetailCard>

        <DetailCard title="KDU Evidence">
          <div style={{ lineHeight: 1.7 }}>
            KNOW: {submission?.rubric_selection?.KNOW ?? "—"}<br />
            DO: {submission?.rubric_selection?.DO ?? "—"}<br />
            UNDERSTAND: {submission?.rubric_selection?.UNDERSTAND ?? "—"}
          </div>
        </DetailCard>
      </div>

      <DetailCard title="Teacher Feedback">
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, color: "#374151" }}>
          {submission?.feedback || "No feedback yet."}
        </div>
      </DetailCard>
    </div>
  )
}

function SubmissionEditor({
  assignment,
  submissionState,
  submissionLoading,
  submissionSaving,
  submissionSaveMessage,
  submissionErrorText,
  draftText,
  onDraftChange,
  onSave,
  onClose,
  onBackToLearningPaths,
  attachments = [],
  attachmentLoading = false,
  attachmentUploading = false,
  attachmentErrorText = "",
  attachmentSuccessText = "",
  deletingAttachmentId = "",
  onAttachmentFileChange,
  onDeleteAttachment,
}) {
  const submissionStatusLabel = formatSubmissionStatus(submissionState?.submission_status || "not_submitted")
  const existingFeedback = submissionState?.submission?.feedback || ""
  const existingScore = submissionState?.submission?.score
  const existingContent = submissionState?.submission?.content || ""

  return (
    <div style={submissionEditorStyle}>
      <SectionHeader
        title={assignment?.title || "Assignment Submission"}
        subtitle="Review the assignment details, write your response, and save your work."
        action={<ActionButton quiet onClick={onClose}>Close</ActionButton>}
      />

      <div style={submissionStatsGridStyle}>
        <DetailCard title="Due Date">
          <div>{formatDueDate(assignment?.due_date)}</div>
        </DetailCard>

        <DetailCard title="Submission Status">
          <div>{submissionStatusLabel}</div>
        </DetailCard>

        <DetailCard title="Current Score">
          <div>{existingScore === null || existingScore === undefined ? "Not graded" : existingScore}</div>
        </DetailCard>
      </div>

      {assignment?.description ? (
        <div style={{ marginBottom: "16px", color: "#4b5563", lineHeight: 1.5 }}>
          <strong>Assignment Details:</strong> {assignment.description}
        </div>
      ) : null}

      {submissionLoading ? (
        <NoticeBox>Loading submission details...</NoticeBox>
      ) : (
        <>
          {submissionErrorText ? <NoticeBox type="error">{submissionErrorText}</NoticeBox> : null}

          {submissionSaveMessage ? (
            <div style={{ marginTop: submissionErrorText ? "12px" : 0, marginBottom: "12px" }}>
              <NoticeBox>{submissionSaveMessage}</NoticeBox>
            </div>
          ) : null}

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Your Response</label>
            <p style={{ marginTop: "4px", marginBottom: "8px", color: "#4b5563", lineHeight: 1.5 }}>
              Write your answer, reflection, notes, or draft below. You can update it and save again.
            </p>
            <textarea
              rows="10"
              value={draftText}
              onChange={(e) => onDraftChange(e.target.value)}
              style={textareaStyle}
              placeholder="Write your response here."
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Attach Files</label>
            <p style={{ marginTop: "4px", marginBottom: "8px", color: "#4b5563", lineHeight: 1.5 }}>
              Add a document, image, or file that supports your submission.
            </p>

            <input
              type="file"
              onChange={onAttachmentFileChange}
              disabled={attachmentUploading}
              style={fileInputStyle}
            />

            {attachmentUploading ? (
              <div style={{ marginTop: "10px" }}>
                <NoticeBox>Uploading attachment...</NoticeBox>
              </div>
            ) : null}

            {attachmentErrorText ? (
              <div style={{ marginTop: "10px" }}>
                <NoticeBox type="error">{attachmentErrorText}</NoticeBox>
              </div>
            ) : null}

            {attachmentSuccessText ? (
              <div style={{ marginTop: "10px" }}>
                <NoticeBox>{attachmentSuccessText}<br />Submission: Draft Saved</NoticeBox>
              </div>
            ) : null}

            <div style={{ marginTop: "12px" }}>
              {attachmentLoading ? (
                <NoticeBox>Loading attachments...</NoticeBox>
              ) : attachments.length === 0 ? (
                <NoticeBox>No files attached yet.</NoticeBox>
              ) : (
                <div style={{ display: "grid", gap: "8px" }}>
                  {attachments.map((attachment) => (
                    <div key={attachment.id} style={attachmentRowStyle}>
                      <a
                        href={`http://localhost:3000${attachment.file_path}`}
                        target="_blank"
                        rel="noreferrer"
                        style={attachmentLinkStyle}
                      >
                        {attachment.original_name || "Attached file"}
                      </a>

                      <ActionButton
                        quiet
                        onClick={() => onDeleteAttachment(attachment)}
                        disabled={String(deletingAttachmentId) === String(attachment.id)}
                      >
                        {String(deletingAttachmentId) === String(attachment.id) ? "Deleting..." : "Delete"}
                      </ActionButton>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
            <ActionButton onClick={onSave} disabled={submissionSaving || (String(draftText || "").trim() === "" && attachments.length === 0)}>
              {submissionSaving ? "Saving Submission..." : "Save Submission"}
            </ActionButton>
            <ActionButton quiet onClick={onClose}>
              Close Assignment
            </ActionButton>
            <ActionButton quiet onClick={onBackToLearningPaths}>
              Back to Learning Paths
            </ActionButton>
          </div>

          <div style={submissionPreviewGridStyle}>
            <DetailCard title="Saved Submission Preview">
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, color: "#374151" }}>
                {existingContent || "No submission saved yet."}
              </div>
            </DetailCard>

            <DetailCard title="Teacher Feedback">
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, color: "#374151" }}>
                {existingFeedback || "No feedback yet."}
              </div>
            </DetailCard>
          </div>
        </>
      )}
    </div>
  )
}

function getAssignmentCourseId(assignment) {
  return assignment.class_id ?? assignment.course_id ?? assignment.courseId ?? ""
}

function getLessonCourseId(lesson) {
  return lesson.course_id ?? lesson.courseId ?? lesson.class_id ?? ""
}

function formatDueDate(value) {
  if (!value) return "No due date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toLocaleDateString()
}

function getAssignmentStatus(dueDateValue) {
  if (!dueDateValue) return "No due date"

  const dueDate = new Date(dueDateValue)
  if (Number.isNaN(dueDate.getTime())) return "Scheduled"

  const now = new Date()
  const dueOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffMs = dueOnly.getTime() - todayOnly.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return "Past due"
  if (diffDays === 0) return "Due today"
  if (diffDays <= 7) return "Due soon"
  return "Upcoming"
}

function formatSubmissionStatus(value) {
  if (value === "submitted") return "Submitted"
  if (value === "not_submitted") return "Not submitted"
  return "Unknown"
}

function formatAverage(value) {
  if (value === null || value === undefined) return "—"
  if (Number.isNaN(Number(value))) return "—"
  return `${Number(value).toFixed(1)}%`
}

function getProficiencyLabel(value) {
  if (value === null || value === undefined) return "Not available yet"

  const numericValue = Number(value)

  if (Number.isNaN(numericValue)) return "Not available yet"
  if (numericValue >= 86) return "Extending"
  if (numericValue >= 73) return "Proficient"
  if (numericValue >= 60) return "Developing"
  if (numericValue >= 50) return "Emerging"

  return "Beginning"
}

export default function StudentDashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const submissionEditorRef = useRef(null)

  const [courses, setCourses] = useState([])
  const [lessons, setLessons] = useState([])
  const [assignments, setAssignments] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [loading, setLoading] = useState(true)
  const [errorText, setErrorText] = useState("")

  const [selectedSubmissionAssignmentId, setSelectedSubmissionAssignmentId] = useState("")
  const [submissionStateByAssignmentId, setSubmissionStateByAssignmentId] = useState({})
  const [submissionLoadingId, setSubmissionLoadingId] = useState("")
  const [submissionSavingId, setSubmissionSavingId] = useState("")
  const [submissionDraftText, setSubmissionDraftText] = useState("")
  const [submissionErrorText, setSubmissionErrorText] = useState("")
  const [submissionSaveMessage, setSubmissionSaveMessage] = useState("")
  const [submissionAttachmentsByAssignmentId, setSubmissionAttachmentsByAssignmentId] = useState({})
  const [attachmentLoadingId, setAttachmentLoadingId] = useState("")
  const [attachmentUploadingId, setAttachmentUploadingId] = useState("")
  const [attachmentErrorText, setAttachmentErrorText] = useState("")
  const [attachmentSuccessText, setAttachmentSuccessText] = useState("")
  const [attachmentSuccessByAssignmentId, setAttachmentSuccessByAssignmentId] = useState({})
  const [deletingAttachmentId, setDeletingAttachmentId] = useState("")

  useEffect(() => {
    let isMounted = true

    async function loadStudentDashboard() {
      const studentEmail = String(user?.email || "").trim().toLowerCase()

      if (!studentEmail) {
        if (!isMounted) return
        setCourses([])
        setLessons([])
        setAssignments([])
        setSelectedCourseId("")
        setErrorText("Student email is missing from the current session.")
        setLoading(false)
        return
      }

      try {
        const [coursesResponse, assignmentsResponse] = await Promise.all([
          fetch("http://localhost:3000/api/classes"),
          fetch("http://localhost:3000/api/assignments"),
        ])

        if (!coursesResponse.ok || !assignmentsResponse.ok) {
          throw new Error("Could not load student learning data.")
        }

        const [coursesData, assignmentsData] = await Promise.all([
          coursesResponse.json(),
          assignmentsResponse.json(),
        ])

        const safeCourses = Array.isArray(coursesData) ? coursesData : []
        const safeLessons = []
        const safeAssignments = Array.isArray(assignmentsData) ? assignmentsData : []

        const visibleCourses = []

        for (const course of safeCourses) {
          const rosterResponse = await fetch(`http://localhost:3000/api/class-roster/${course.id}`)

          if (!rosterResponse.ok) {
            continue
          }

          const rosterData = await rosterResponse.json()
          const rosterStudents = Array.isArray(rosterData.students) ? rosterData.students : []

          const isEnrolled = rosterStudents.some((student) => {
            return String(student.email || "").trim().toLowerCase() === studentEmail
          })

          if (isEnrolled) {
            visibleCourses.push(course)
          }
        }

        if (!isMounted) return

        const visibleCourseIds = new Set(visibleCourses.map((course) => String(course.id)))

        const visibleLessons = safeLessons.filter((lesson) =>
          visibleCourseIds.has(String(getLessonCourseId(lesson)))
        )

        const visibleAssignments = safeAssignments.filter((assignment) =>
          visibleCourseIds.has(String(getAssignmentCourseId(assignment)))
        )

        setCourses(visibleCourses)
        setLessons(visibleLessons)
        setAssignments(visibleAssignments)
        setErrorText("")
        setLoading(false)

        if (visibleCourses.length > 0) {
          setSelectedCourseId((currentSelectedCourseId) => {
            const currentStillVisible = visibleCourses.some(
              (course) => String(course.id) === String(currentSelectedCourseId)
            )

            if (currentStillVisible) {
              return currentSelectedCourseId
            }

            return String(visibleCourses[0].id)
          })
        } else {
          setSelectedCourseId("")
        }
      } catch (err) {
        console.error("Error loading student dashboard:", err)

        if (!isMounted) return

        setCourses([])
        setLessons([])
        setAssignments([])
        setSelectedCourseId("")
        setErrorText("Could not load student learning data.")
        setLoading(false)
      }
    }

    loadStudentDashboard()

    return () => {
      isMounted = false
    }
  }, [user?.email])

  const selectedCourse = useMemo(() => {
    return courses.find((course) => String(course.id) === String(selectedCourseId)) || null
  }, [courses, selectedCourseId])

  const filteredLessons = useMemo(() => {
    if (!selectedCourseId) return []
    return lessons.filter((lesson) => String(getLessonCourseId(lesson)) === String(selectedCourseId))
  }, [lessons, selectedCourseId])

  const filteredAssignments = useMemo(() => {
    if (!selectedCourseId) return []
    return assignments.filter((assignment) => String(getAssignmentCourseId(assignment)) === String(selectedCourseId))
  }, [assignments, selectedCourseId])

  const upcomingAssignments = useMemo(() => {
    const list = selectedCourseId ? filteredAssignments : assignments

    return [...list].sort((a, b) => {
      const aTime = a?.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER
      const bTime = b?.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER
      return aTime - bTime
    })
  }, [assignments, filteredAssignments, selectedCourseId])

  const recentLessons = useMemo(() => {
    const list = selectedCourseId ? filteredLessons : lessons
    return list.slice(0, 4)
  }, [filteredLessons, lessons, selectedCourseId])

  const dueSoonCount = useMemo(() => {
    return upcomingAssignments.filter((assignment) => {
      const status = getAssignmentStatus(assignment?.due_date)
      return status === "Due today" || status === "Due soon"
    }).length
  }, [upcomingAssignments])

  const submittedCount = useMemo(() => {
    const list = selectedCourseId ? filteredAssignments : assignments

    return list.filter((assignment) => {
      const assignmentId = String(assignment.id)
      const submissionState = submissionStateByAssignmentId[assignmentId]
      return submissionState?.submission_status === "submitted"
    }).length
  }, [assignments, filteredAssignments, selectedCourseId, submissionStateByAssignmentId])

  const gradedCount = useMemo(() => {
    const list = selectedCourseId ? filteredAssignments : assignments

    return list.filter((assignment) => {
      const assignmentId = String(assignment.id)
      const submissionState = submissionStateByAssignmentId[assignmentId]
      const score = submissionState?.submission?.score
      return score !== null && score !== undefined && !Number.isNaN(Number(score))
    }).length
  }, [assignments, filteredAssignments, selectedCourseId, submissionStateByAssignmentId])

  const gradedAverage = useMemo(() => {
    const list = selectedCourseId ? filteredAssignments : assignments

    const gradedScores = list
      .map((assignment) => {
        const assignmentId = String(assignment.id)
        const submissionState = submissionStateByAssignmentId[assignmentId]
        return submissionState?.submission?.score
      })
      .filter((score) => score !== null && score !== undefined && !Number.isNaN(Number(score)))
      .map((score) => Number(score))

    if (gradedScores.length === 0) return null

    const total = gradedScores.reduce((sum, score) => sum + score, 0)
    return total / gradedScores.length
  }, [assignments, filteredAssignments, selectedCourseId, submissionStateByAssignmentId])

  const visibleAssignmentCount = selectedCourseId ? filteredAssignments.length : assignments.length
  const notSubmittedCount = Math.max(visibleAssignmentCount - submittedCount, 0)

  const missingAssignments = useMemo(() => {
    const list = selectedCourseId ? filteredAssignments : assignments

    return list.filter((assignment) => {
      const assignmentId = String(assignment.id)
      const submissionState = submissionStateByAssignmentId[assignmentId]
      return submissionState?.submission_status !== "submitted"
    })
  }, [assignments, filteredAssignments, selectedCourseId, submissionStateByAssignmentId])

  const progressCompletionPercent = visibleAssignmentCount > 0
    ? Math.round((submittedCount / visibleAssignmentCount) * 100)
    : 0

  const selectedSubmissionAssignment = useMemo(() => {
    if (!selectedSubmissionAssignmentId) return null
    return assignments.find((assignment) => String(assignment.id) === String(selectedSubmissionAssignmentId)) || null
  }, [assignments, selectedSubmissionAssignmentId])

  const selectedSubmissionState = selectedSubmissionAssignmentId
    ? submissionStateByAssignmentId[String(selectedSubmissionAssignmentId)] || null
    : null

  const selectedSubmissionAttachments = selectedSubmissionAssignmentId
    ? submissionAttachmentsByAssignmentId[String(selectedSubmissionAssignmentId)] || []
    : []

  const latestResultAssignment = useMemo(() => {
    const list = selectedCourseId ? filteredAssignments : assignments

    return list.find((assignment) => {
      const submissionState = submissionStateByAssignmentId[String(assignment.id)]
      const score = submissionState?.submission?.score
      return score !== null && score !== undefined && !Number.isNaN(Number(score))
    }) || null
  }, [assignments, filteredAssignments, selectedCourseId, submissionStateByAssignmentId])

  const latestResultState = latestResultAssignment
    ? submissionStateByAssignmentId[String(latestResultAssignment.id)] || null
    : null

  const resultAssignments = useMemo(() => {
    const list = selectedCourseId ? filteredAssignments : assignments

    return [...list].sort((a, b) => {
      const aState = submissionStateByAssignmentId[String(a.id)]
      const bState = submissionStateByAssignmentId[String(b.id)]
      const aScore = aState?.submission?.score
      const bScore = bState?.submission?.score
      const aHasScore = aScore !== null && aScore !== undefined && !Number.isNaN(Number(aScore))
      const bHasScore = bScore !== null && bScore !== undefined && !Number.isNaN(Number(bScore))

      if (aHasScore && !bHasScore) return -1
      if (!aHasScore && bHasScore) return 1

      const aDue = a?.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER
      const bDue = b?.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER

      return aDue - bDue
    })
  }, [assignments, filteredAssignments, selectedCourseId, submissionStateByAssignmentId])

  useEffect(() => {
    let isCancelled = false

    async function loadVisibleSubmissionStatuses() {
      const studentEmail = String(user?.email || "").trim().toLowerCase()

      if (!studentEmail) return

      const visibleAssignments = selectedCourseId ? filteredAssignments : assignments

      if (!Array.isArray(visibleAssignments) || visibleAssignments.length === 0) return

      const assignmentsNeedingStatus = visibleAssignments.filter((assignment) => {
        const assignmentId = String(assignment.id)
        return !submissionStateByAssignmentId[assignmentId]
      })

      if (assignmentsNeedingStatus.length === 0) return

      try {
        const results = await Promise.all(
          assignmentsNeedingStatus.map(async (assignment) => {
            const assignmentId = String(assignment.id)
            const response = await fetch(
              `http://localhost:3000/api/assignments/${assignmentId}/student-submission?student_email=${encodeURIComponent(studentEmail)}`
            )
            const data = await response.json()

            if (!response.ok) {
              return { assignmentId, failed: true }
            }

            return { assignmentId, data, failed: false }
          })
        )

        if (isCancelled) return

        setSubmissionStateByAssignmentId((current) => {
          const next = { ...current }

          results.forEach((result) => {
            if (!result.failed && result.data) {
              next[result.assignmentId] = result.data
            }
          })

          return next
        })
      } catch (err) {
        console.error("Error loading visible submission statuses:", err)
      }
    }

    loadVisibleSubmissionStatuses()

    return () => {
      isCancelled = true
    }
  }, [assignments, filteredAssignments, selectedCourseId, submissionStateByAssignmentId, user?.email])

  useEffect(() => {
    if (!selectedSubmissionAssignmentId) return

    const timeoutId = window.setTimeout(() => {
      submissionEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [selectedSubmissionAssignmentId])

  useEffect(() => {
    const requestedAssignmentId = String(searchParams.get("assignmentId") || "").trim()

    if (!requestedAssignmentId) return
    if (loading) return
    if (selectedSubmissionAssignmentId) return

    const matchingAssignment = assignments.find((assignment) => {
      return String(assignment.id) === requestedAssignmentId
    })

    if (!matchingAssignment) return

    openSubmissionEditor(matchingAssignment)
  }, [assignments, loading, searchParams, selectedSubmissionAssignmentId])

  async function loadSubmissionAttachments(assignmentId, studentEmail) {
    if (!assignmentId || !studentEmail) return

    setAttachmentLoadingId(assignmentId)
    setAttachmentErrorText("")

    try {
      const response = await fetch(
        `http://localhost:3000/api/assignments/${assignmentId}/student-attachments?student_email=${encodeURIComponent(studentEmail)}`
      )
      const data = await response.json()

      if (!response.ok) {
        setAttachmentErrorText(data.error || "Failed to load attachments.")
        return
      }

      setSubmissionAttachmentsByAssignmentId((current) => ({
        ...current,
        [assignmentId]: Array.isArray(data.attachments) ? data.attachments : [],
      }))
    } catch (err) {
      console.error("Error loading submission attachments:", err)
      setAttachmentErrorText("Failed to load attachments.")
    } finally {
      setAttachmentLoadingId("")
    }
  }

  async function openSubmissionEditor(assignment) {
    const assignmentId = String(assignment.id)
    const studentEmail = String(user?.email || "").trim().toLowerCase()

    setSelectedSubmissionAssignmentId(assignmentId)
    setSubmissionErrorText("")
    setSubmissionSaveMessage("")
    setAttachmentErrorText("")
    setSubmissionLoadingId(assignmentId)

    if (!studentEmail) {
      setSubmissionDraftText("")
      setSubmissionErrorText("Student email is missing from the current session.")
      setSubmissionLoadingId("")
      return
    }

    try {
      const response = await fetch(
        `http://localhost:3000/api/assignments/${assignmentId}/student-submission?student_email=${encodeURIComponent(studentEmail)}`
      )
      const data = await response.json()

      if (!response.ok) {
        setSubmissionErrorText(data.error || "Failed to load submission details.")
        setSubmissionDraftText("")
        setSubmissionLoadingId("")
        return
      }

      setSubmissionStateByAssignmentId((current) => ({
        ...current,
        [assignmentId]: data,
      }))
      setSubmissionDraftText(data?.submission?.content || "")
      setSubmissionErrorText("")
      await loadSubmissionAttachments(assignmentId, studentEmail)
    } catch (err) {
      console.error("Error loading student submission:", err)
      setSubmissionErrorText("Failed to load submission details.")
      setSubmissionDraftText("")
    } finally {
      setSubmissionLoadingId("")
    }
  }

  async function handleDeleteAttachment(attachment) {
    const attachmentId = attachment?.id
    const assignmentId = String(selectedSubmissionAssignmentId || "").trim()
    const studentEmail = String(user?.email || "").trim().toLowerCase()
    const fileName = attachment?.original_name || "attached file"

    if (!attachmentId) {
      setAttachmentErrorText("Could not delete this file because its attachment ID is missing.")
      return
    }

    const confirmed = window.confirm(`Delete "${fileName}" from this submission?`)

    if (!confirmed) return

    try {
      setDeletingAttachmentId(String(attachmentId))
      setAttachmentErrorText("")
      setAttachmentSuccessText("")

      const response = await fetch(`http://localhost:3000/api/student-attachments/${attachmentId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        setAttachmentErrorText(data.error || "Failed to delete attachment.")
        return
      }

      if (assignmentId && studentEmail) {
        await loadSubmissionAttachments(assignmentId, studentEmail)
      }

      setAttachmentSuccessText(`File deleted successfully: ${fileName}`)
      setAttachmentSuccessByAssignmentId((current) => ({
        ...current,
        [assignmentId]: `File deleted successfully: ${fileName}`,
      }))
    } catch (err) {
      console.error("Error deleting submission attachment:", err)
      setAttachmentErrorText("Failed to delete attachment.")
    } finally {
      setDeletingAttachmentId("")
    }
  }

  async function handleAttachmentFileChange(event) {
    const file = event.target.files?.[0] || null
    const assignmentId = String(selectedSubmissionAssignmentId || "").trim()
    const studentEmail = String(user?.email || "").trim().toLowerCase()

    if (!file) return

    if (!assignmentId) {
      setAttachmentErrorText("Please choose an assignment first.")
      event.target.value = ""
      return
    }

    if (!studentEmail) {
      setAttachmentErrorText("Student email is missing from the current session.")
      event.target.value = ""
      return
    }

    const formData = new FormData()
    formData.append("student_email", studentEmail)
    formData.append("attachment", file)

    setAttachmentUploadingId(assignmentId)
    setAttachmentErrorText("")
    setAttachmentSuccessText("")

    try {
      const response = await fetch(`http://localhost:3000/api/assignments/${assignmentId}/student-attachments`, {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setAttachmentErrorText(data.error || "Failed to upload attachment.")
        return
      }

      await loadSubmissionAttachments(assignmentId, studentEmail)
      const successMessage = `File attached successfully: ${file.name}`
      setAttachmentSuccessText(successMessage)
      setAttachmentSuccessByAssignmentId((current) => ({
        ...current,
        [assignmentId]: successMessage,
      }))
    } catch (err) {
      console.error("Error uploading submission attachment:", err)
      setAttachmentErrorText("Failed to upload attachment.")
    } finally {
      setAttachmentUploadingId("")
      event.target.value = ""
    }
  }

  async function handleSaveSubmission() {
    const assignmentId = String(selectedSubmissionAssignmentId || "").trim()
    const studentName = String(user?.name || "Student").trim()
    const studentEmail = String(user?.email || "").trim().toLowerCase()
    const content = String(submissionDraftText || "").trim()

    if (!assignmentId) {
      setSubmissionErrorText("Please choose an assignment first.")
      return
    }

    if (!studentEmail) {
      setSubmissionErrorText("Student email is missing from the current session.")
      return
    }

    if (!content) {
      setSubmissionErrorText("Please enter submission text before saving.")
      return
    }

    setSubmissionSavingId(assignmentId)
    setSubmissionErrorText("")
    setSubmissionSaveMessage("")

    try {
      const response = await fetch(`http://localhost:3000/api/assignments/${assignmentId}/student-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: studentName,
          student_email: studentEmail,
          content,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setSubmissionErrorText(data.error || "Failed to save submission.")
        setSubmissionSavingId("")
        return
      }

      setSubmissionStateByAssignmentId((current) => ({
        ...current,
        [assignmentId]: data,
      }))
      setSubmissionDraftText(data?.submission?.content || "")
      setSubmissionSaveMessage("Submission saved successfully.")
    } catch (err) {
      console.error("Error saving student submission:", err)
      setSubmissionErrorText("Failed to save submission.")
    } finally {
      setSubmissionSavingId("")
    }
  }

  function closeSubmissionEditor() {
    setSelectedSubmissionAssignmentId("")
    setSubmissionLoadingId("")
    setSubmissionSavingId("")
    setSubmissionDraftText("")
    setSubmissionErrorText("")
    setSubmissionSaveMessage("")
    setAttachmentErrorText("")
    setAttachmentSuccessText("")
    setAttachmentLoadingId("")
    setAttachmentUploadingId("")
  }

  function handleLogout() {
    logout()
    navigate("/login")
  }

  const studentCoachRecommendation = useMemo(() => {
    if (errorText) {
      return {
        title: "Ask for help",
        reason:
          "Something is preventing your dashboard from loading correctly.",
        action:
          "Tell your teacher what message you see so they can help check your account, course, or login.",
      }
    }

    if (!courses || courses.length === 0) {
      return {
        title: "Check your courses",
        reason:
          "No courses are showing yet. Your assignments and progress will appear after you are enrolled in a course.",
        action:
          "Ask your teacher to confirm that you are enrolled with the correct student email.",
      }
    }

    if (!selectedCourseId) {
      return {
        title: "Choose a course",
        reason:
          "Your next steps depend on which course you are looking at.",
        action:
          "Select a course to see assignments, results, feedback, and upcoming work.",
      }
    }

    if (!assignments || assignments.length === 0) {
      return {
        title: "Watch for your first assignment",
        reason:
          "There are no assignments showing for this course yet.",
        action:
          "Check back after your teacher posts an assignment or learning activity.",
      }
    }

    const selectedCourseAssignments = assignments.filter((assignment) => {
      const assignmentClassId = assignment.class_id || assignment.course_id || assignment.classId
      return String(assignmentClassId) === String(selectedCourseId)
    })

    if (selectedCourseAssignments.length === 0) {
      return {
        title: "Check the selected course",
        reason:
          "This course does not currently show assignments in your dashboard.",
        action:
          "Try another course or ask your teacher whether work has been posted yet.",
      }
    }

    const openAssignment = selectedCourseAssignments.find((assignment) => {
      const status = String(assignment.submission_status || assignment.status || "").toLowerCase()
      return status.includes("not") || status.includes("missing") || status.includes("draft")
    })

    if (openAssignment) {
      return {
        title: "Work on your next assignment",
        reason:
          "You have at least one assignment that may still need attention.",
        action:
          "Open the assignment, read the instructions, save your response, and attach files if your teacher asked for them.",
      }
    }

    return {
      title: "Review feedback and next steps",
      reason:
        "Your course work is showing. The best next step is to review results, feedback, and any upcoming due dates.",
      action:
        "Check your latest result, KDU breakdown, teacher feedback, and goals for improvement.",
    }
  }, [errorText, courses, selectedCourseId, assignments])

  if (loading) {
    return (
      <div className="content-area">
        <section className="panel">
          <p>Loading student dashboard...</p>
        </section>
      </div>
    )
  }

  return (
    <>
      <div className="topbar">
        <h1>Student Portal</h1>
        <p className="topbar-subtitle">
          Welcome{user?.name ? `, ${user.name}` : ""}. Review your courses, assignments, lessons, and submissions in one place.
        </p>
      </div>

      <div className="content-area">
        <section className="panel">
          <SectionHeader
            title="Student Session"
            subtitle="Use these actions to move through the student experience."
            action={
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <ActionButton quiet onClick={() => navigate("/student-progress")}>
                  Progress
                </ActionButton>
                <ActionButton quiet onClick={() => navigate("/student-learning-paths")}>
                  Learning Paths
                </ActionButton>
                <ActionButton quiet onClick={() => navigate("/student-reports")}>
                  Reports
                </ActionButton>
                <ActionButton onClick={handleLogout}>Logout</ActionButton>
              </div>
            }
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" }}>
            <DetailCard title="Student Name">
              <div>{user?.name || "Student"}</div>
            </DetailCard>

            <DetailCard title="Email">
              <div>{user?.email || "—"}</div>
            </DetailCard>

            <DetailCard title="Role">
              <div>{user?.role || "student"}</div>
            </DetailCard>
          </div>
        </section>

        {errorText ? (
          <section className="panel">
            <NoticeBox type="error">{errorText}</NoticeBox>
          </section>
        ) : null}

        <section className="panel">
          <SectionHeader
            title={`You're Currently ${getProficiencyLabel(gradedAverage)}`}
            subtitle="This is your current learning snapshot based on graded evidence your teacher has returned."
          />

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.7fr) minmax(0, 1.3fr)", gap: "14px" }}>
            <DetailCard title="Current Standing">
              <div style={{ fontSize: "2.4rem", fontWeight: 800 }}>{formatAverage(gradedAverage)}</div>
              <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                Your current course standing from graded evidence.
              </div>
            </DetailCard>

            <DetailCard title="What This Means">
              <div style={{ lineHeight: 1.6 }}>
                {getProficiencyLabel(gradedAverage) === "Extending"
                  ? "You are demonstrating strong understanding and application of course concepts. Keep maintaining high-quality work and reviewing teacher feedback."
                  : getProficiencyLabel(gradedAverage) === "Proficient"
                    ? "You are meeting important course expectations. Review feedback carefully and look for ways to deepen your explanations and applications."
                    : getProficiencyLabel(gradedAverage) === "Developing"
                      ? "You are building the required skills. Focus on feedback, complete missing work, and ask for help when a task is unclear."
                      : getProficiencyLabel(gradedAverage) === "Emerging"
                        ? "You are beginning to show evidence of learning. Your next step is to complete current assignments and review teacher feedback."
                        : "Once your teacher returns graded evidence, your current standing and next steps will appear here."}
              </div>
            </DetailCard>
          </div>
        </section>

        <section className="panel">
          <SectionHeader
            title="My Progress Snapshot"
            subtitle={selectedCourse ? `A quick view of your progress in ${selectedCourse.title || selectedCourse.class_name}.` : "Select a course to focus this snapshot on one class."}
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: "14px" }}>
            <DetailCard title="Current Standing">
              <div style={{ fontSize: "2rem", fontWeight: 800 }}>{formatAverage(gradedAverage)}</div>
              <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                Based on graded evidence currently visible.
              </div>
            </DetailCard>

            <DetailCard title="Proficiency">
              <div style={{ fontSize: "2rem", fontWeight: 800 }}>{getProficiencyLabel(gradedAverage)}</div>
              <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                A student-friendly summary of your current standing.
              </div>
            </DetailCard>

            <DetailCard title="Latest Result">
              <div style={{ fontSize: "1.35rem", fontWeight: 800 }}>
                {latestResultAssignment?.title || "No graded result yet"}
              </div>
              <div style={{ marginTop: "6px", fontSize: "1.6rem", fontWeight: 800 }}>
                {formatAverage(latestResultState?.submission?.score)}
              </div>
              <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                {latestResultState?.submission?.feedback || "Teacher feedback will appear here when available."}
              </div>
            </DetailCard>

            <DetailCard title="KDU Breakdown">
              <div style={{ fontSize: "1.1rem", fontWeight: 800, lineHeight: 1.7 }}>
                KNOW: {latestResultState?.submission?.rubric_selection?.KNOW ?? "—"}<br />
                DO: {latestResultState?.submission?.rubric_selection?.DO ?? "—"}<br />
                UNDERSTAND: {latestResultState?.submission?.rubric_selection?.UNDERSTAND ?? "—"}
              </div>
              <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                Converted from raw marks into competency evidence.
              </div>
            </DetailCard>

            <DetailCard title="Submitted">
              <div style={{ fontSize: "2rem", fontWeight: 800 }}>{submittedCount} / {visibleAssignmentCount}</div>
              <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                {progressCompletionPercent}% of visible assignments submitted.
              </div>
            </DetailCard>

            <DetailCard title="Not Submitted">
              <div style={{ fontSize: "2rem", fontWeight: 800 }}>{notSubmittedCount}</div>
              <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                Assignments still needing attention.
              </div>
            </DetailCard>

            <DetailCard title="Graded">
              <div style={{ fontSize: "2rem", fontWeight: 800 }}>{gradedCount}</div>
              <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                Assignments with returned scores.
              </div>
            </DetailCard>

            <DetailCard title="Due Soon">
              <div style={{ fontSize: "2rem", fontWeight: 800 }}>{dueSoonCount}</div>
              <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                Upcoming deadlines to watch.
              </div>
            </DetailCard>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "16px" }}>
          <SummaryCard label="Courses" value={courses.length} helper="Courses currently visible in the student portal." />
          <SummaryCard
            label="Due Soon"
            value={dueSoonCount}
            helper={selectedCourse ? `Assignments approaching due date in ${selectedCourse.title || selectedCourse.class_name}.` : "Assignments approaching due date across the portal."}
          />
          <SummaryCard
            label="Submitted"
            value={submittedCount}
            helper={selectedCourseId ? "Assignments already submitted in the selected course." : "Assignments already submitted across the portal."}
          />
          <SummaryCard
            label="Graded"
            value={gradedCount}
            helper={selectedCourseId ? "Assignments with returned scores in the selected course." : "Assignments with returned scores across the portal."}
          />
          <SummaryCard label="Standing" value={formatAverage(gradedAverage)} helper="Current standing from graded evidence currently shown." />
          <SummaryCard
            label="Lessons"
            value={selectedCourseId ? filteredLessons.length : lessons.length}
            helper={selectedCourseId ? "Lessons for the selected course." : "Total lessons loaded into the student view."}
          />
          <SummaryCard
            label="Assignments"
            value={selectedCourseId ? filteredAssignments.length : assignments.length}
            helper={selectedCourseId ? "Assignments for the selected course." : "Total assignments loaded into the student view."}
          />
        </section>

        <section className="panel">
          <SectionHeader
            title="Missing Work"
            subtitle="A quick check of assignments that still need attention."
          />

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.6fr) minmax(0, 1.4fr)", gap: "14px" }}>
            <DetailCard title="Assignments Missing">
              <div style={{ fontSize: "2.4rem", fontWeight: 800 }}>{missingAssignments.length}</div>
              <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                {missingAssignments.length === 0
                  ? "Great job. You are currently caught up."
                  : "These assignments still need to be submitted."}
              </div>
            </DetailCard>

            <DetailCard title="What To Do Next">
              {missingAssignments.length === 0 ? (
                <div style={{ lineHeight: 1.6 }}>
                  Keep reviewing your teacher feedback and prepare for the next assignment.
                </div>
              ) : (
                <div style={{ display: "grid", gap: "8px" }}>
                  {missingAssignments.slice(0, 5).map((assignment) => (
                    <div key={assignment.id} style={{ lineHeight: 1.5 }}>
                      <strong>{assignment.title || "Untitled Assignment"}</strong>
                      <div style={{ color: "#4b5563" }}>Due: {formatDueDate(assignment.due_date)}</div>
                    </div>
                  ))}
                </div>
              )}
            </DetailCard>
          </div>
        </section>

        <section className="panel">
          <SectionHeader
            title="Upcoming Due Dates"
            subtitle="Assignments coming up soon in your selected course."
          />

          {!selectedCourseId ? (
            <NoticeBox>Select a course above to view upcoming due dates.</NoticeBox>
          ) : upcomingAssignments.length === 0 ? (
            <NoticeBox>No upcoming assignments found for this course.</NoticeBox>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" }}>
              {upcomingAssignments.slice(0, 3).map((assignment) => (
                <DetailCard key={assignment.id} title={assignment.title || "Untitled Assignment"}>
                  <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>
                    Due: {formatDueDate(assignment.due_date)}
                  </div>
                  <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                    {assignment.description || "Open the assignment to review the details."}
                  </div>
                </DetailCard>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <SectionHeader
            title="Course Progress"
            subtitle="A simple view of how much assigned work has been completed."
          />

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.7fr) minmax(0, 1.3fr)", gap: "14px" }}>
            <DetailCard title="Progress">
              <div style={{ fontSize: "2.4rem", fontWeight: 800 }}>{progressCompletionPercent}%</div>
              <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                {submittedCount} of {visibleAssignmentCount} visible assignments submitted.
              </div>
            </DetailCard>

            <DetailCard title="Completion Tracker">
              <div
                aria-label={`Course progress ${progressCompletionPercent}%`}
                style={{
                  border: "1px solid #d7dce5",
                  borderRadius: "999px",
                  padding: "4px",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(0, Math.min(progressCompletionPercent, 100))}%`,
                    minWidth: progressCompletionPercent > 0 ? "24px" : "0",
                    height: "22px",
                    borderRadius: "999px",
                    background: "#111827",
                  }}
                />
              </div>

              <div style={{ marginTop: "10px", color: "#4b5563", lineHeight: 1.5 }}>
                {progressCompletionPercent === 100
                  ? "All visible assignments are submitted. Keep reviewing feedback and preparing for what comes next."
                  : progressCompletionPercent > 0
                    ? "You are making progress. Keep working through the remaining assignments."
                    : "Start by opening your next assignment and submitting your work when ready."}
              </div>
            </DetailCard>
          </div>
        </section>

        <section className="panel">
          <SectionHeader
            title="Student Goals & Growth"
            subtitle="Use your current standing and teacher feedback to decide your next learning move."
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" }}>
            <DetailCard title="Current Standing">
              <div style={{ fontSize: "2rem", fontWeight: 800 }}>{formatAverage(gradedAverage)}</div>
              <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                This is where your returned evidence currently places you.
              </div>
            </DetailCard>

            <DetailCard title="Suggested Goal">
              <div style={{ fontSize: "2rem", fontWeight: 800 }}>
                {gradedAverage === null || gradedAverage === undefined
                  ? "Submit first evidence"
                  : Number(gradedAverage) >= 95
                    ? "Maintain excellence"
                    : Number(gradedAverage) >= 86
                      ? "Aim for 95%"
                      : Number(gradedAverage) >= 73
                        ? "Aim for 86%"
                        : Number(gradedAverage) >= 60
                          ? "Aim for 73%"
                          : "Build consistency"}
              </div>
              <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                A simple next target based on your current evidence.
              </div>
            </DetailCard>

            <DetailCard title="Recommended Action">
              <div style={{ lineHeight: 1.6 }}>
                {gradedAverage === null || gradedAverage === undefined
                  ? "Open your next assignment and submit evidence so your teacher can give feedback."
                  : Number(gradedAverage) >= 95
                    ? "Keep submitting high-quality work and look for enrichment or leadership opportunities."
                    : Number(gradedAverage) >= 86
                      ? "Review teacher feedback, maintain completion, and look for ways to deepen explanations."
                      : Number(gradedAverage) >= 73
                        ? "Focus on improving one KDU area and use teacher feedback before your next submission."
                        : Number(gradedAverage) >= 60
                          ? "Complete missing work, ask for help early, and revise using teacher feedback."
                          : "Start with the next assignment, submit evidence, and ask your teacher what to focus on first."}
              </div>
            </DetailCard>
          </div>
        </section>

        <section className="panel">
          <SectionHeader
            title="Teacher Announcements"
            subtitle="Important course messages from your teacher will appear here."
          />

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 1.2fr)", gap: "14px" }}>
            <DetailCard title={selectedCourse?.title || selectedCourse?.class_name || "Selected Course"}>
              <div style={{ fontSize: "1.25rem", fontWeight: 800 }}>
                Welcome to your course dashboard.
              </div>
              <div style={{ marginTop: "8px", color: "#4b5563", lineHeight: 1.6 }}>
                Check your standing, review your latest feedback, and open your next assignment when you are ready.
              </div>
            </DetailCard>

            <DetailCard title="Reminders">
              <div style={{ lineHeight: 1.7 }}>
                • Review teacher feedback before starting your next task.<br />
                • Keep track of upcoming due dates.<br />
                • Ask for help early if an assignment is unclear.
              </div>
            </DetailCard>
          </div>
        </section>

        <section className="panel">
          <SectionHeader
            title="My Next Steps"
            subtitle="A simple checklist to help you stay organized in this course."
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" }}>
            <DetailCard title="1. Check Your Standing">
              <div style={{ lineHeight: 1.5 }}>
                Review your current standing and proficiency so you know how you are doing right now.
              </div>
            </DetailCard>

            <DetailCard title="2. Review Latest Feedback">
              <div style={{ lineHeight: 1.5 }}>
                Read your latest teacher feedback and KDU evidence before starting the next task.
              </div>
            </DetailCard>

            <DetailCard title="3. Open Your Next Assignment">
              <div style={{ lineHeight: 1.5 }}>
                Use Open Assignment to continue your work or review assignment details.
              </div>
            </DetailCard>
          </div>
        </section>

        <section className="panel">
          <SectionHeader title="My Courses" subtitle="Choose a course to focus the dashboard on that class." />

          {courses.length === 0 ? (
            <NoticeBox>No courses are currently available.</NoticeBox>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" }}>
              {courses.map((course) => (
                <CourseOverviewCard
                  key={course.id}
                  course={course}
                  isSelected={String(course.id) === String(selectedCourseId)}
                  onSelect={setSelectedCourseId}
                />
              ))}
            </div>
          )}

          <div style={{ marginTop: "18px", maxWidth: "460px" }}>
            <label style={labelStyle}>Course</label>
            <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} style={inputStyle}>
              <option value="">Select Course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title || course.class_name}
                </option>
              ))}
            </select>
          </div>

          {selectedCourse ? (
            <p style={{ marginTop: "16px", marginBottom: 0, color: "#4b5563" }}>
              Viewing learning materials for <strong>{selectedCourse.title || selectedCourse.class_name}</strong>.
            </p>
          ) : (
            <p style={{ marginTop: "16px", marginBottom: 0, color: "#4b5563" }}>
              Select a course to load lessons and assignments.
            </p>
          )}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.8fr)", gap: "16px", alignItems: "start" }}>
          <div className="panel">
            <SectionHeader
              title="Upcoming Assignments"
              subtitle={selectedCourse ? `Assignments scheduled in ${selectedCourse.title || selectedCourse.class_name}.` : "Assignments scheduled across your visible courses."}
            />

            {!selectedCourseId ? (
              <NoticeBox>Select a course above to view assignments.</NoticeBox>
            ) : upcomingAssignments.length === 0 ? (
              <NoticeBox>No assignments found for this course.</NoticeBox>
            ) : (
              <div style={{ display: "grid", gap: "14px" }}>
                {upcomingAssignments.slice(0, 5).map((assignment) => {
                  const cachedSubmissionState = submissionStateByAssignmentId[String(assignment.id)] || null

                  return (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                      submissionStatus={formatSubmissionStatus(cachedSubmissionState?.submission_status || "not_submitted")}
                      footer={
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          <ActionButton quiet onClick={() => openSubmissionEditor(assignment)}>
                            {String(selectedSubmissionAssignmentId) === String(assignment.id) ? "Continue Work" : "Open Assignment"}
                          </ActionButton>
                        </div>
                      }
                    />
                  )
                })}
              </div>
            )}
          </div>

          <div className="panel">
            <SectionHeader title="Learning Snapshot" subtitle="A quick read of your current dashboard view." />

            <div style={{ display: "grid", gap: "12px" }}>
              <DetailCard title="Selected Course">
                <div>{selectedCourse?.title || selectedCourse?.class_name || "No course selected"}</div>
              </DetailCard>

              <DetailCard title="Lessons Available">
                <div>{selectedCourseId ? filteredLessons.length : 0}</div>
              </DetailCard>

              <DetailCard title="Assignments Available">
                <div>{selectedCourseId ? filteredAssignments.length : 0}</div>
              </DetailCard>

              <DetailCard title="Assignments Submitted">
                <div>{submittedCount}</div>
              </DetailCard>

              <DetailCard title="Assignments Graded">
                <div>{gradedCount}</div>
              </DetailCard>

              <DetailCard title="Current Standing">
                <div>{formatAverage(gradedAverage)}</div>
              </DetailCard>

              <DetailCard title="Proficiency">
                <div>{getProficiencyLabel(gradedAverage)}</div>
              </DetailCard>

              <DetailCard title="Assignments Due Soon">
                <div>{dueSoonCount}</div>
              </DetailCard>
            </div>
          </div>
        </section>

        {selectedSubmissionAssignment ? (
          <section className="panel" ref={submissionEditorRef}>
            <SubmissionEditor
              assignment={selectedSubmissionAssignment}
              submissionState={selectedSubmissionState}
              submissionLoading={String(submissionLoadingId) === String(selectedSubmissionAssignmentId)}
              submissionSaving={String(submissionSavingId) === String(selectedSubmissionAssignmentId)}
              submissionSaveMessage={submissionSaveMessage}
              submissionErrorText={submissionErrorText}
              draftText={submissionDraftText}
              onDraftChange={setSubmissionDraftText}
              onSave={handleSaveSubmission}
              onClose={closeSubmissionEditor}
              onBackToLearningPaths={() => navigate("/student-learning-paths")}
              attachments={selectedSubmissionAttachments}
              attachmentLoading={String(attachmentLoadingId) === String(selectedSubmissionAssignmentId)}
              attachmentUploading={String(attachmentUploadingId) === String(selectedSubmissionAssignmentId)}
              attachmentErrorText={attachmentErrorText}
              attachmentSuccessText={attachmentSuccessText}
              deletingAttachmentId={deletingAttachmentId}
              onAttachmentFileChange={handleAttachmentFileChange}
              onDeleteAttachment={handleDeleteAttachment}
            />
          </section>
        ) : null}

        <section className="panel">
          <SectionHeader title="My Results" subtitle="See returned scores and teacher feedback for your visible assignments." />

          {!selectedCourseId ? (
            <NoticeBox>Select a course above to view results.</NoticeBox>
          ) : resultAssignments.length === 0 ? (
            <NoticeBox>No assignments found for this course.</NoticeBox>
          ) : (
            <div style={{ display: "grid", gap: "14px" }}>
              {resultAssignments.map((assignment) => {
                const submissionState = submissionStateByAssignmentId[String(assignment.id)] || null

                return (
                  <ResultCard
                    key={assignment.id}
                    assignment={assignment}
                    submissionState={submissionState}
                    onOpen={() => openSubmissionEditor(assignment)}
                  />
                )
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <SectionHeader title="Recent Lessons" subtitle="Lessons available for the currently selected course." />

          {!selectedCourseId ? (
            <NoticeBox>Select a course above to view lessons.</NoticeBox>
          ) : recentLessons.length === 0 ? (
            <NoticeBox>No lessons found for this course.</NoticeBox>
          ) : (
            <div style={{ display: "grid", gap: "14px" }}>
              {recentLessons.map((lesson) => (
                <LessonCard key={lesson.id} lesson={lesson} />
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <SectionHeader title="All Course Assignments" subtitle="A complete list of assignments for the currently selected course." />

          {!selectedCourseId ? (
            <NoticeBox>Select a course above to view assignments.</NoticeBox>
          ) : filteredAssignments.length === 0 ? (
            <NoticeBox>No assignments found for this course.</NoticeBox>
          ) : (
            <div style={{ display: "grid", gap: "14px" }}>
              {filteredAssignments.map((assignment) => {
                const cachedSubmissionState = submissionStateByAssignmentId[String(assignment.id)] || null

                const cardAttachmentSuccessText = attachmentSuccessByAssignmentId[String(assignment.id)]

                return (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    compact
                    submissionStatus={formatSubmissionStatus(cachedSubmissionState?.submission_status || "not_submitted")}
                    footer={
                      <div style={{ display: "grid", gap: "10px" }}>
                        {cardAttachmentSuccessText ? (
                          <NoticeBox>{cardAttachmentSuccessText}</NoticeBox>
                        ) : null}

                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          <ActionButton quiet onClick={() => openSubmissionEditor(assignment)}>
                            {String(selectedSubmissionAssignmentId) === String(assignment.id) ? "Continue Work" : "Open Assignment"}
                          </ActionButton>
                        </div>
                      </div>
                    }
                  />
                )
              })}
            </div>
          )}
        </section>
      </div>
      <FloatingTeacherCoach
        title="Student Coach"
        subtitle="Student Progress Coach"
        recommendationTitle={studentCoachRecommendation.title}
        recommendationReason={studentCoachRecommendation.reason}
        recommendationAction={studentCoachRecommendation.action}
      >
        <div style={{ fontWeight: 900, marginBottom: "6px" }}>Student workflow</div>
        <div style={{ color: "#111827", lineHeight: 1.55 }}>
          <div>□ Choose a course</div>
          <div>□ Check upcoming work</div>
          <div>□ Open your next assignment</div>
          <div>□ Review teacher feedback</div>
          <div>□ Look for one thing to improve next</div>
        </div>
      </FloatingTeacherCoach>
    </>
  )
}

const summaryCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "14px",
  padding: "18px",
  background: "#ffffff",
  boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
}

const summaryLabelStyle = {
  fontSize: "0.82rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#6b7280",
  marginBottom: "10px",
}

const summaryHelperStyle = {
  marginTop: "10px",
  fontSize: "0.95rem",
  lineHeight: 1.4,
  color: "#4b5563",
}

function buttonStyle(quiet, disabled) {
  return {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #d7dce5",
    background: quiet ? "#ffffff" : "#f3f4f6",
    font: "inherit",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
  }
}

const detailCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "14px",
  background: "#ffffff",
}

function courseButtonStyle(isSelected) {
  return {
    width: "100%",
    textAlign: "left",
    border: "1px solid #d7dce5",
    borderRadius: "12px",
    padding: "16px",
    background: isSelected ? "#f8fafc" : "#ffffff",
    cursor: "pointer",
    font: "inherit",
  }
}

function assignmentCardStyle(compact) {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: compact ? "14px" : "18px",
    background: "#f8fafc",
  }
}

const assignmentHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "8px",
}

const statusPillStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "999px",
  padding: "4px 10px",
  fontSize: "0.85rem",
  fontWeight: 700,
  background: "#ffffff",
}

const assignmentMetaStyle = {
  marginTop: "12px",
  display: "flex",
  gap: "16px",
  flexWrap: "wrap",
  fontSize: "0.95rem",
  color: "#4b5563",
}

const lessonCardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "16px",
  background: "#ffffff",
}

const resultCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "16px",
  background: "#ffffff",
}

const resultHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "10px",
}

const resultGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "12px",
  marginBottom: "14px",
}

const submissionEditorStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "16px",
  background: "#ffffff",
}

const submissionStatsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "12px",
  marginBottom: "16px",
}

const submissionPreviewGridStyle = {
  borderTop: "1px solid #e5e7eb",
  paddingTop: "16px",
  display: "grid",
  gap: "12px",
}

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  fontSize: "16px",
  fontWeight: "600",
}

const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "10px",
  border: "1px solid #b7c4d6",
  fontSize: "16px",
  boxSizing: "border-box",
  background: "#ffffff",
}

const fileInputStyle = {
  display: "block",
  width: "100%",
  padding: "10px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  background: "#ffffff",
  boxSizing: "border-box",
}


const attachmentRowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "10px",
  alignItems: "center",
}

const attachmentLinkStyle = {
  display: "block",
  border: "1px solid #cfd8e3",
  borderRadius: "10px",
  padding: "10px 12px",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 800,
  textDecoration: "none",
}

const textareaStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "10px",
  border: "1px solid #b7c4d6",
  fontSize: "16px",
  boxSizing: "border-box",
  background: "#ffffff",
  font: "inherit",
  lineHeight: 1.5,
  resize: "vertical",
}
