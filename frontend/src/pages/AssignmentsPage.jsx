import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../AuthContext.jsx"
import API_BASE from "../apiBase"

function SectionHeader({ title, subtitle, action }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "12px",
        marginBottom: "16px",
        flexWrap: "wrap",
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

function NoticeBox({ type = "info", children }) {
  const borderColor = type === "error" ? "#d1a1a1" : "#cfd8e3"
  const background = type === "error" ? "#fff8f8" : "#f8fafc"

  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: "12px",
        padding: "14px 16px",
        background,
        marginBottom: "16px",
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  )
}

function ActionButton({ children, onClick, type = "button", disabled = false, quiet = false }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 14px",
        borderRadius: "10px",
        border: "1px solid #d7dce5",
        background: quiet ? "#ffffff" : "#f3f4f6",
        font: "inherit",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  )
}

function DangerActionButton({ children, onClick, type = "button", disabled = false }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 14px",
        borderRadius: "10px",
        border: "1px solid #d1a1a1",
        background: "#fff1f1",
        font: "inherit",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  )
}

function DetailCard({ title, children }) {
  return (
    <div
      style={{
        border: "1px solid #d7dce5",
        borderRadius: "12px",
        padding: "14px",
        background: "#ffffff",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: "10px" }}>{title}</div>
      {children}
    </div>
  )
}

function FieldLabel({ children }) {
  return (
    <label style={{ display: "block", fontSize: "0.92rem", fontWeight: 700, marginBottom: "6px" }}>
      {children}
    </label>
  )
}

function InputBlock({ label, children }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  )
}

function SummaryCard({ label, value, helper }) {
  return (
    <div
      style={{
        border: "1px solid #d7dce5",
        borderRadius: "14px",
        padding: "18px",
        background: "#ffffff",
        boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
      }}
    >
      <div
        style={{
          fontSize: "0.82rem",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#6b7280",
          marginBottom: "10px",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1 }}>{value}</div>
      <div style={{ marginTop: "10px", fontSize: "0.95rem", lineHeight: 1.4, color: "#4b5563" }}>
        {helper}
      </div>
    </div>
  )
}

function StatusPill({ label }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: "1px solid #d7dce5",
        borderRadius: "999px",
        padding: "6px 10px",
        fontSize: "0.82rem",
        fontWeight: 800,
        background: "#f8fafc",
      }}
    >
      {label}
    </span>
  )
}

const assignmentInboxPanelStyle = {
  borderTop: "1px solid #e5e7eb",
  marginTop: "18px",
  paddingTop: "18px",
}

const assignmentInboxGridStyle = {
  display: "grid",
  gap: "12px",
}

const assignmentInboxItemStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "14px",
  padding: "14px",
  background: "#f8fafc",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: "14px",
  alignItems: "center",
}

const assignmentInboxTitleStyle = {
  fontSize: "1.05rem",
  fontWeight: 900,
  lineHeight: 1.35,
  marginBottom: "6px",
  overflowWrap: "anywhere",
}

const assignmentInboxMetaStyle = {
  color: "#4b5563",
  lineHeight: 1.45,
  marginTop: "4px",
}

const assignmentInboxActionStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  justifyContent: "flex-end",
}


export default function AssignmentsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const queryParams = new URLSearchParams(location.search)
  const requestedClassId = queryParams.get("classId")
  const requestedSection = queryParams.get("section")

  const workspaceContentRef = useRef(null)
  const rosterSectionRef = useRef(null)
  const createSectionRef = useRef(null)
  const importSectionRef = useRef(null)
  const currentSectionRef = useRef(null)
  const pendingSectionScrollRef = useRef("")

  const normalizedRole = String(user?.role || "").trim().toLowerCase()
  const isTeacherLikeRole = normalizedRole === "teacher" || normalizedRole === "admin"

  const [assignments, setAssignments] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [teacherSection, setTeacherSection] = useState("create")

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueDate, setDueDate] = useState("")

  const [submissionText, setSubmissionText] = useState("")
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("")
  const [selectedFiles, setSelectedFiles] = useState([])
  const [studentSubmissions, setStudentSubmissions] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const [categories, setCategories] = useState([])
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState({})
  const [selectedCategoryId, setSelectedCategoryId] = useState("")
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("")

  const [csvImportText, setCsvImportText] = useState("")
  const [csvImportResult, setCsvImportResult] = useState(null)
  const [csvImportLoading, setCsvImportLoading] = useState(false)

  const [editingAssignmentId, setEditingAssignmentId] = useState("")
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editDueDate, setEditDueDate] = useState("")
  const [editSaving, setEditSaving] = useState(false)

  const [classStudents, setClassStudents] = useState([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterSaving, setRosterSaving] = useState(false)
  const [rosterStudentName, setRosterStudentName] = useState("")
  const [rosterStudentEmail, setRosterStudentEmail] = useState("")
  const [rosterParentEmail, setRosterParentEmail] = useState("")
  const [rosterStudentId, setRosterStudentId] = useState("")

  const [deleteTargetAssignment, setDeleteTargetAssignment] = useState(null)
  const [duplicatingAssignmentId, setDuplicatingAssignmentId] = useState("")
  const [movingAssignmentId, setMovingAssignmentId] = useState("")
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [assignmentCreating, setAssignmentCreating] = useState(false)

  function toNumber(value) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  function formatPercent(value) {
    return `${toNumber(value).toFixed(2)}%`
  }

  function formatDate(value) {
    if (!value) return "No due date"
    return String(value).slice(0, 10)
  }

  function resetTeacherFormState() {
    setSelectedCategoryId("")
    setSelectedSubcategoryId("")
    setTitle("")
    setDescription("")
    setDueDate("")
    setCsvImportText("")
    setCsvImportResult(null)
  }

  function resetEditState() {
    setEditingAssignmentId("")
    setEditTitle("")
    setEditDescription("")
    setEditDueDate("")
    setEditSaving(false)
  }

  function resetRosterFormState() {
    setRosterStudentName("")
    setRosterStudentEmail("")
    setRosterParentEmail("")
    setRosterStudentId("")
    setRosterSaving(false)
  }

  function getAssignmentSubmissionCount(assignment) {
    return toNumber(
      assignment?.submission_count ??
        assignment?.submissions_count ??
        assignment?.submitted_count ??
        assignment?.submittedCount ??
        0
    )
  }

  function getAssignmentGradedCount(assignment) {
    return toNumber(
      assignment?.graded_count ??
        assignment?.gradedCount ??
        assignment?.graded_submissions_count ??
        assignment?.gradedSubmissionsCount ??
        0
    )
  }

  function getAssignmentUngradedCount(assignment) {
    const explicitUngraded = assignment?.ungraded_count ?? assignment?.ungradedCount
    if (explicitUngraded !== null && explicitUngraded !== undefined && explicitUngraded !== "") {
      return toNumber(explicitUngraded)
    }

    const submissions = getAssignmentSubmissionCount(assignment)
    const graded = getAssignmentGradedCount(assignment)
    return Math.max(submissions - graded, 0)
  }

  function getAssignmentStatusLabel(assignment, classStudentTotal) {
    const submissions = getAssignmentSubmissionCount(assignment)
    const graded = getAssignmentGradedCount(assignment)
    const ungraded = getAssignmentUngradedCount(assignment)

    if (classStudentTotal === 0) return "Roster Needed"
    if (submissions === 0) return "No Submissions"
    if (ungraded > 0) return "Ready to Grade"
    if (graded > 0 && graded >= submissions) return "Completed"
    return "In Progress"
  }

  function closeDeleteConfirmation() {
    if (deleteSaving) return
    setDeleteTargetAssignment(null)
  }

  function getTeacherSectionRef(sectionName) {
    if (sectionName === "roster") return rosterSectionRef
    if (sectionName === "create") return createSectionRef
    if (sectionName === "import") return importSectionRef
    if (sectionName === "current") return currentSectionRef
    return workspaceContentRef
  }

  function openTeacherSection(sectionName) {
    if (!selectedClassId) return
    pendingSectionScrollRef.current = sectionName
    setTeacherSection(sectionName)
    setError("")
    setMessage("")
  }

  function loadAssignments() {
    return fetch(`${API_BASE}/api/assignments`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load assignments")
        return res.json()
      })
      .then((data) => {
        setAssignments(Array.isArray(data) ? data : [])
      })
  }

  function loadStudentAssignments() {
    if (!user?.email) {
      setAssignments([])
      return Promise.resolve()
    }

    return fetch(`${API_BASE}/api/students/${encodeURIComponent(user.email)}/assignments`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load student assignments")
        return res.json()
      })
      .then((data) => {
        setAssignments(Array.isArray(data) ? data : [])
      })
  }

  function loadStudentSubmissions() {
    if (!user?.email) {
      setStudentSubmissions([])
      return Promise.resolve()
    }

    return fetch(`${API_BASE}/api/students/${encodeURIComponent(user.email)}/submissions`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load student submissions")
        return res.json()
      })
      .then((data) => {
        setStudentSubmissions(Array.isArray(data) ? data : [])
      })
  }

  function loadClassStudents(classId) {
    if (!classId) {
      setClassStudents([])
      return Promise.resolve([])
    }

    setRosterLoading(true)

    return fetch(`${API_BASE}/api/class-roster/${classId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load class roster")
        return res.json()
      })
      .then((data) => {
        const nextStudents = Array.isArray(data)
          ? data
          : Array.isArray(data?.students)
            ? data.students
            : []
        setClassStudents(nextStudents)
        return nextStudents
      })
      .finally(() => {
        setRosterLoading(false)
      })
  }

  function loadCategoriesForClass(classId) {
    if (!classId) {
      setCategories([])
      setSubcategoriesByCategory({})
      setSelectedCategoryId("")
      setSelectedSubcategoryId("")
      return Promise.resolve()
    }

    return fetch(`${API_BASE}/api/courses/${classId}/categories`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load grading categories")
        return res.json()
      })
      .then((data) => {
        const nextCategories = Array.isArray(data) ? data : []
        setCategories(nextCategories)
        setSelectedCategoryId("")
        setSelectedSubcategoryId("")

        if (nextCategories.length === 0) {
          setSubcategoriesByCategory({})
          return undefined
        }

        return Promise.all(
          nextCategories.map((category) =>
            fetch(`${API_BASE}/api/categories/${category.id}/subcategories`)
              .then((res) => {
                if (!res.ok) throw new Error(`Failed to load subcategories for category ${category.id}`)
                return res.json()
              })
              .then((subcategories) => ({
                categoryId: category.id,
                subcategories: Array.isArray(subcategories) ? subcategories : [],
              }))
          )
        ).then((results) => {
          const nextMap = {}
          results.forEach((result) => {
            nextMap[result.categoryId] = result.subcategories
          })
          setSubcategoriesByCategory(nextMap)
        })
      })
  }

  function loadClasses() {
    return fetch(`${API_BASE}/api/classes`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load classes")
        return res.json()
      })
      .then((data) => {
        const safeClasses = Array.isArray(data) ? data : []
        const normalizedUserId = String(user?.id || "").trim()
        const normalizedUserEmail = String(user?.email || "").trim().toLowerCase()

        const visibleClasses =
          normalizedRole === "teacher"
            ? safeClasses.filter((classItem) => {
                const classTeacherId = String(
                  classItem?.teacher_id ?? classItem?.assigned_teacher_id ?? classItem?.teacherId ?? ""
                ).trim()

                const classTeacherEmail = String(
                  classItem?.teacher_email ??
                    classItem?.assigned_teacher_email ??
                    classItem?.teacherEmail ??
                    ""
                )
                  .trim()
                  .toLowerCase()

                if (normalizedUserId && classTeacherId) return classTeacherId === normalizedUserId
                if (normalizedUserEmail && classTeacherEmail) return classTeacherEmail === normalizedUserEmail
                return false
              })
            : safeClasses

        setClasses(visibleClasses)

        const requestedClassExists =
          requestedClassId &&
          visibleClasses.some((classItem) => String(classItem.id) === String(requestedClassId))

        const selectedStillExists =
          selectedClassId && visibleClasses.some((classItem) => String(classItem.id) === String(selectedClassId))

        if (requestedClassExists && String(selectedClassId) !== String(requestedClassId)) {
          const validRequestedSection = ["roster", "create", "import", "current"].includes(String(requestedSection || ""))
            ? String(requestedSection)
            : "current"

          setSelectedClassId(String(requestedClassId))
          setTeacherSection(validRequestedSection)
          pendingSectionScrollRef.current = validRequestedSection
          return Promise.all([loadCategoriesForClass(String(requestedClassId)), loadClassStudents(String(requestedClassId))])
        }

        if (selectedClassId && !selectedStillExists) {
          setSelectedClassId("")
          setCategories([])
          setSubcategoriesByCategory({})
          setSelectedCategoryId("")
          setSelectedSubcategoryId("")
          setClassStudents([])
          resetTeacherFormState()
          resetEditState()
          resetRosterFormState()
          setDeleteTargetAssignment(null)
        }

        if (!selectedStillExists && visibleClasses.length > 0) {
          const firstClassId = requestedClassExists
            ? String(requestedClassId)
            : String(visibleClasses[0].id)
          const validRequestedSection = ["roster", "create", "import", "current"].includes(String(requestedSection || ""))
            ? String(requestedSection)
            : "create"

          setSelectedClassId(firstClassId)
          setTeacherSection(validRequestedSection)
          pendingSectionScrollRef.current = validRequestedSection
          return Promise.all([loadCategoriesForClass(firstClassId), loadClassStudents(firstClassId)])
        }

        return undefined
      })
  }

  function loadPage() {
    setLoading(true)
    setError("")
    setMessage("")

    const requests = isTeacherLikeRole
      ? [loadAssignments(), loadClasses()]
      : [loadStudentAssignments(), loadStudentSubmissions()]

    Promise.all(requests)
      .catch((err) => {
        setError(err.message || "Failed to load page")
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    loadPage()
  }, [isTeacherLikeRole, user?.email, user?.id])

  useEffect(() => {
    if (!requestedClassId) return

    const requestedClassExists = classes.some((classItem) => String(classItem.id) === String(requestedClassId))

    if (!requestedClassExists) return

    const validRequestedSection = ["roster", "create", "import", "current"].includes(String(requestedSection || ""))
      ? String(requestedSection)
      : "current"

    if (String(selectedClassId) !== String(requestedClassId)) {
      setSelectedClassId(String(requestedClassId))
      loadCategoriesForClass(String(requestedClassId))
      loadClassStudents(String(requestedClassId))
    }

    setTeacherSection(validRequestedSection)
    pendingSectionScrollRef.current = validRequestedSection
  }, [requestedClassId, requestedSection, classes.length, selectedClassId])

  useEffect(() => {
    if (!selectedClassId) {
      pendingSectionScrollRef.current = ""
      return
    }

    if (!pendingSectionScrollRef.current) return

    const targetSectionName = pendingSectionScrollRef.current
    const targetRef = getTeacherSectionRef(targetSectionName)

    const timeoutId = window.setTimeout(() => {
      targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      pendingSectionScrollRef.current = ""
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [teacherSection, selectedClassId])

  async function handleSetupKduStructure() {
    if (!selectedClassId) {
      setError("Select a class before setting up KDU structure.")
      return
    }

    const confirmed = window.confirm(
      "Set up the default KDU learning categories and evidence tiers for this class?"
    )

    if (!confirmed) return

    setLoading(true)
    setError("")
    setMessage("Setting up KDU structure...")

    try {
      const response = await fetch(
        `${API_BASE}/api/courses/${selectedClassId}/setup-kdu-assessment-structure`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data?.error || "Failed to set up KDU structure")
      }

      await loadCategoriesForClass(selectedClassId)
      setMessage("KDU learning categories and evidence tiers are ready.")
    } catch (err) {
      setError(err.message || "Failed to set up KDU structure")
    } finally {
      setLoading(false)
    }
  }

  function handleTeacherClassChange(e) {
    const nextClassId = e.target.value
    setSelectedClassId(nextClassId)
    setError("")
    setMessage("")
    resetTeacherFormState()
    resetEditState()
    resetRosterFormState()
    setDeleteTargetAssignment(null)
    pendingSectionScrollRef.current = ""

    Promise.all([loadCategoriesForClass(nextClassId), loadClassStudents(nextClassId)]).catch((err) => {
      setError(err.message || "Failed to load class data")
    })
  }

  function createAssignment(e) {
    e.preventDefault()

    if (assignmentCreating) return

    if (!selectedClassId || !title.trim() || !user?.id) {
      setError("Missing required fields")
      return
    }

    if (!selectedSubcategoryId) {
      setError("Select an evidence tier for this assignment")
      return
    }

    setError("")
    setMessage("")
    setAssignmentCreating(true)

    fetch(`${API_BASE}/api/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        class_id: Number(selectedClassId),
        teacher_id: user.id,
        title: title.trim(),
        description: description.trim(),
        due_date: dueDate || null,
        subcategory_id: Number(selectedSubcategoryId),
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Failed to create assignment")
        return data
      })
      .then((data) => {
        setTitle("")
        setDescription("")
        setDueDate("")
        setMessage(
          `Assignment created successfully. Calculated assignment weight: ${formatPercent(
            data.calculated_weight
          )}.`
        )
        return loadAssignments()
      })
      .catch((err) => {
        setError(err.message || "Failed to create assignment")
      })
      .finally(() => {
        setAssignmentCreating(false)
      })
  }

  function importAssignmentsFromCsv() {
    if (!selectedClassId) {
      setError("Select a class before importing CSV")
      return
    }

    if (!csvImportText.trim()) {
      setError("Paste assignment CSV text before importing")
      return
    }

    setCsvImportLoading(true)
    setError("")
    setMessage("")
    setCsvImportResult(null)

    fetch(`${API_BASE}/api/assignments/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        class_id: Number(selectedClassId),
        teacher_id: user?.id || null,
        csvText: csvImportText,
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Failed to import assignments")
        return data
      })
      .then((data) => {
        setCsvImportResult(data)
        setMessage(
          `CSV import complete. Created ${data.createdCount || 0}, skipped ${
            data.skippedCount || 0
          }, errors ${data.errorCount || 0}.`
        )
        if ((data.errorCount || 0) === 0) setCsvImportText("")
        return loadAssignments()
      })
      .catch((err) => {
        setError(err.message || "Failed to import assignments")
      })
      .finally(() => {
        setCsvImportLoading(false)
      })
  }

  function beginEditAssignment(assignment) {
    setEditingAssignmentId(String(assignment.id))
    setEditTitle(assignment.title || "")
    setEditDescription(assignment.description || "")
    setEditDueDate(assignment.due_date ? String(assignment.due_date).slice(0, 10) : "")
    setError("")
    setMessage("")
    setDeleteTargetAssignment(null)
  }

  async function moveAssignment(assignmentId, direction) {
    if (!assignmentId || !["up", "down"].includes(direction)) {
      setError("Valid assignment and move direction are required.")
      setMessage("")
      return
    }

    try {
      setMovingAssignmentId(`${assignmentId}-${direction}`)
      setError("")
      setMessage("")

      const response = await fetch(`${API_BASE}/api/assignments/${assignmentId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to reorder assignment")
      }

      setMessage(
        data.moved
          ? `Assignment moved ${direction}.`
          : data.reason || "Assignment order unchanged."
      )

      await loadAssignments()
    } catch (err) {
      setError(err.message || "Failed to reorder assignment")
    } finally {
      setMovingAssignmentId("")
    }
  }

  async function duplicateAssignment(assignment) {
    const assignmentId = Number(assignment?.id || 0)
    const currentTitle = String(assignment?.title || "Assignment").trim()
    const defaultTitle = currentTitle.endsWith(" Copy") ? `${currentTitle} 2` : `${currentTitle} Copy`

    if (!assignmentId) {
      setError("Valid assignment is required.")
      return
    }

    const requestedTitle = window.prompt("New duplicated assignment name:", defaultTitle)

    if (requestedTitle === null) return

    const title = String(requestedTitle || "").trim()

    if (!title) {
      setError("Duplicated assignment name is required.")
      return
    }

    const confirmed = window.confirm(
      `Duplicate assignment "${currentTitle}" as "${title}"?\n\nThis will copy the assignment details and exam sections.\n\nIt will not copy student submissions, grades, rubric scores, feedback, or student work.`
    )

    if (!confirmed) return

    try {
      setDuplicatingAssignmentId(String(assignmentId))
      setError("")
      setMessage("")

      const response = await fetch(`${API_BASE}/api/assignments/${assignmentId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to duplicate assignment")
      }

      setMessage(
        `Assignment duplicated: ${data.assignment?.title || title}. Copied ${data.copied?.assignment_sections || 0} exam section${data.copied?.assignment_sections === 1 ? "" : "s"}.`
      )

      await loadAssignments()
    } catch (err) {
      setError(err.message || "Failed to duplicate assignment")
    } finally {
      setDuplicatingAssignmentId("")
    }
  }

  function openEditAssignmentPage(assignmentId) {
    navigate(`/assignments/${assignmentId}/edit`)
  }

  function openGradeAssignmentPage(assignmentId) {
    if (assignmentId) navigate(`/assignments/${assignmentId}/grade`)
  }

  function saveEditedAssignment(assignmentId) {
    if (!String(editTitle || "").trim()) {
      setError("Assignment title is required")
      return
    }

    setEditSaving(true)
    setError("")
    setMessage("")

    fetch(`${API_BASE}/api/assignments/${assignmentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: String(editTitle || "").trim(),
        description: String(editDescription || "").trim(),
        due_date: editDueDate || null,
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Failed to update assignment")
        return data
      })
      .then((data) => {
        setMessage(
          `Assignment updated successfully.${
            data.calculated_weight !== null && data.calculated_weight !== undefined
              ? ` Calculated assignment weight: ${formatPercent(data.calculated_weight)}`
              : ""
          }`
        )
        resetEditState()
        return loadAssignments()
      })
      .catch((err) => {
        setError(err.message || "Failed to update assignment")
      })
      .finally(() => {
        setEditSaving(false)
      })
  }

  function beginDeleteAssignment(assignment) {
    setDeleteTargetAssignment(assignment)
    setError("")
    setMessage("")
  }

  function confirmDeleteAssignment() {
    if (!deleteTargetAssignment) return

    setDeleteSaving(true)
    setError("")
    setMessage("")

    fetch(`${API_BASE}/api/assignments/${deleteTargetAssignment.id}`, {
      method: "DELETE",
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Failed to delete assignment")
        return data
      })
      .then(() => {
        if (String(editingAssignmentId) === String(deleteTargetAssignment.id)) resetEditState()
        const deletedTitle = deleteTargetAssignment.title
        setDeleteTargetAssignment(null)
        setMessage(`Assignment deleted: ${deletedTitle}`)
        return loadAssignments()
      })
      .catch((err) => {
        setError(err.message || "Failed to delete assignment")
      })
      .finally(() => {
        setDeleteSaving(false)
      })
  }

  function addStudentToRoster(e) {
    e.preventDefault()

    if (!selectedClassId) {
      setError("Select a class before adding a student")
      return
    }

    if (!String(rosterStudentName || "").trim()) {
      setError("Student name is required")
      return
    }

    if (!String(rosterStudentEmail || "").trim()) {
      setError("Student email is required")
      return
    }

    setRosterSaving(true)
    setError("")
    setMessage("")

    fetch(`${API_BASE}/api/classes/${selectedClassId}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_name: String(rosterStudentName || "").trim(),
        student_email: String(rosterStudentEmail || "").trim().toLowerCase(),
        parent_email: String(rosterParentEmail || "").trim().toLowerCase(),
        student_id: String(rosterStudentId || "").trim(),
      }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Failed to add student to class")
        return data
      })
      .then((data) => {
        resetRosterFormState()
        setMessage(
          `Student added to ${data.className || selectedClassName || `Class ${selectedClassId}`}. Roster is ready for grading.`
        )
        return loadClassStudents(selectedClassId)
      })
      .catch((err) => {
        setError(err.message || "Failed to add student to class")
      })
      .finally(() => {
        setRosterSaving(false)
      })
  }

  function submitAssignment(e) {
    e.preventDefault()

    if (!selectedAssignmentId || !user?.name || !user?.email) {
      setError("Select an assignment")
      return
    }

    if (!submissionText.trim() && selectedFiles.length === 0) {
      setError("Enter submission text or choose files")
      return
    }

    setError("")
    setMessage("")

    const formData = new FormData()
    formData.append("assignment_id", String(Number(selectedAssignmentId)))
    formData.append("student_name", user.name)
    formData.append("student_email", user.email)
    formData.append("content", submissionText.trim())

    selectedFiles.forEach((file) => {
      formData.append("attachments", file)
    })

    fetch(`${API_BASE}/api/submissions`, {
      method: "POST",
      body: formData,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Failed to submit assignment")
        return data
      })
      .then(() => {
        setSubmissionText("")
        setSelectedFiles([])
        const fileInput = document.getElementById("submission-file-input")
        if (fileInput) fileInput.value = ""
        setMessage("Submission saved successfully")
        return loadStudentSubmissions()
      })
      .catch((err) => {
        setError(err.message || "Failed to submit assignment")
      })
  }

  const selectedCategory = useMemo(() => {
    return categories.find((category) => String(category.id) === String(selectedCategoryId)) || null
  }, [categories, selectedCategoryId])

  const availableSubcategories = useMemo(() => {
    return selectedCategoryId ? subcategoriesByCategory[selectedCategoryId] || [] : []
  }, [selectedCategoryId, subcategoriesByCategory])

  const selectedSubcategory = useMemo(() => {
    return (
      availableSubcategories.find((subcategory) => String(subcategory.id) === String(selectedSubcategoryId)) ||
      null
    )
  }, [availableSubcategories, selectedSubcategoryId])

  const previewCalculatedWeight = useMemo(() => {
    if (!selectedCategory || !selectedSubcategory) return null
    return (
      (toNumber(selectedCategory.weight_percent) *
        toNumber(selectedSubcategory.weight_percent_of_parent)) /
      100
    )
  }, [selectedCategory, selectedSubcategory])

  const selectedClassName = useMemo(() => {
    const selectedClass = classes.find((item) => String(item.id) === String(selectedClassId))
    return selectedClass?.class_name || selectedClass?.title || ""
  }, [classes, selectedClassId])

  const teacherAssignments = useMemo(() => {
    const safeAssignments = Array.isArray(assignments) ? assignments : []
    if (!selectedClassId) return []
    return safeAssignments.filter((assignment) => String(assignment.class_id) === String(selectedClassId))
  }, [assignments, selectedClassId])

  const classHasCategories = categories.length > 0
  const classHasAssignments = teacherAssignments.length > 0
  const classStudentCount = Array.isArray(classStudents) ? classStudents.length : 0

  const teacherAssignmentStatusSummary = useMemo(() => {
    return {
      readyToGrade: teacherAssignments.filter(
        (assignment) => getAssignmentStatusLabel(assignment, classStudentCount) === "Ready to Grade"
      ).length,
      noSubmissions: teacherAssignments.filter(
        (assignment) => getAssignmentStatusLabel(assignment, classStudentCount) === "No Submissions"
      ).length,
      completed: teacherAssignments.filter(
        (assignment) => getAssignmentStatusLabel(assignment, classStudentCount) === "Completed"
      ).length,
      rosterNeeded: teacherAssignments.filter(
        (assignment) => getAssignmentStatusLabel(assignment, classStudentCount) === "Roster Needed"
      ).length,
    }
  }, [teacherAssignments, classStudentCount])

  const teacherAssignmentInboxItems = useMemo(() => {
    return teacherAssignments
      .map((assignment) => {
        const statusLabel = getAssignmentStatusLabel(assignment, classStudentCount)
        const submissions = getAssignmentSubmissionCount(assignment)
        const graded = getAssignmentGradedCount(assignment)
        const ungraded = getAssignmentUngradedCount(assignment)
        const missing = Math.max(classStudentCount - submissions, 0)

        return {
          assignment,
          statusLabel,
          submissions,
          graded,
          ungraded,
          missing,
        }
      })
      .filter((item) => item.statusLabel === "Ready to Grade" || item.statusLabel === "No Submissions" || item.statusLabel === "In Progress")
      .sort((a, b) => {
        const priority = {
          "Ready to Grade": 1,
          "In Progress": 2,
          "No Submissions": 3,
        }

        const aPriority = priority[a.statusLabel] || 9
        const bPriority = priority[b.statusLabel] || 9

        if (aPriority !== bPriority) return aPriority - bPriority
        return b.ungraded - a.ungraded
      })
      .slice(0, 6)
  }, [teacherAssignments, classStudentCount])

  const teacherSectionButtonStyle = (sectionName) => ({
    width: "100%",
    textAlign: "left",
    padding: "12px 14px",
    borderRadius: "10px",
    border: "1px solid #d7dce5",
    background: teacherSection === sectionName ? "#eef2f7" : "#ffffff",
    fontWeight: teacherSection === sectionName ? "800" : "600",
    cursor: selectedClassId ? "pointer" : "not-allowed",
    opacity: selectedClassId ? 1 : 0.65,
  })

  return (
    <div className="page">
      <div style={{ marginBottom: "12px" }}>
        <ActionButton quiet onClick={() => navigate(isTeacherLikeRole ? "/dashboard" : "/student")}>
          {isTeacherLikeRole ? "← Back to Dashboard" : "← Back to Student Dashboard"}
        </ActionButton>
      </div>

      <h1>Assignments</h1>

      {error ? <NoticeBox type="error">{error}</NoticeBox> : null}
      {message ? <NoticeBox>{message}</NoticeBox> : null}

      {isTeacherLikeRole ? (
        <>
          {selectedClassId && deleteTargetAssignment ? (
            <div
              style={{
                border: "1px solid #d1a1a1",
                borderRadius: "14px",
                padding: "18px",
                background: "#fff8f8",
                marginBottom: "20px",
                boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
              }}
            >
              <SectionHeader
                title="Confirm Delete Assignment"
                subtitle="This keeps deletion intentional and teacher-safe before anything is removed."
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: "16px",
                  alignItems: "start",
                }}
              >
                <div style={{ display: "grid", gap: "10px", fontSize: "0.95rem", lineHeight: 1.5 }}>
                  <div>
                    You are deleting <strong>{deleteTargetAssignment.title}</strong>.
                  </div>
                  <div>
                    <strong>Due date:</strong> {formatDate(deleteTargetAssignment.due_date)}
                  </div>
                  <div>
                    <strong>Assessment Pathway:</strong> {deleteTargetAssignment.category_name || "Not linked"}
                  </div>
                  <div>
                    <strong>Evidence Tier:</strong> {deleteTargetAssignment.subcategory_name || "Not linked"}
                  </div>
                  <div style={{ color: "#4b5563" }}>
                    This removes the assignment from the class assignment list.
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <ActionButton quiet onClick={closeDeleteConfirmation} disabled={deleteSaving}>
                    Cancel
                  </ActionButton>
                  <DangerActionButton onClick={confirmDeleteAssignment} disabled={deleteSaving}>
                    {deleteSaving ? "Deleting..." : "Confirm Delete"}
                  </DangerActionButton>
                </div>
              </div>
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <SummaryCard label="Classes" value={classes.length} helper="Teacher-facing class list." />
            <SummaryCard
              label="Selected Class"
              value={selectedClassId ? "1" : "0"}
              helper={selectedClassId ? selectedClassName || `Class ${selectedClassId}` : "Choose a class to begin"}
            />
            <SummaryCard
              label="Students"
              value={selectedClassId ? classStudentCount : 0}
              helper={selectedClassId ? "Roster count for selected class." : "Select a class to load roster."}
            />
            <SummaryCard
              label="Assignments"
              value={selectedClassId ? teacherAssignments.length : assignments.length}
              helper="Assignments currently loaded."
            />
            <SummaryCard
              label="Categories"
              value={selectedClassId ? categories.length : 0}
              helper="Grading categories for assignment linking."
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "260px minmax(0, 1fr)",
              gap: "20px",
              alignItems: "start",
              maxWidth: "1280px",
            }}
          >
            <div
              style={{
                border: "1px solid #d7dce5",
                borderRadius: "14px",
                padding: "18px",
                background: "#ffffff",
                position: "sticky",
                top: "24px",
                boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: "14px", fontSize: "1.2rem" }}>
                Assignment Tools
              </h2>

              <InputBlock label="Class">
                <select
                  value={selectedClassId}
                  onChange={handleTeacherClassChange}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #d7dce5",
                    background: "#ffffff",
                    font: "inherit",
                  }}
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.class_name || `Class ${c.id}`}
                    </option>
                  ))}
                </select>
              </InputBlock>

              <div style={{ marginTop: "18px", marginBottom: "10px", fontWeight: 800 }}>Workspace</div>

              <div style={{ display: "grid", gap: "10px" }}>
                <button type="button" style={teacherSectionButtonStyle("roster")} onClick={() => openTeacherSection("roster")} disabled={!selectedClassId}>
                  Roster UI
                </button>
                <button type="button" style={teacherSectionButtonStyle("create")} onClick={() => openTeacherSection("create")} disabled={!selectedClassId}>
                  Create Assignment
                </button>
                <button type="button" style={teacherSectionButtonStyle("import")} onClick={() => openTeacherSection("import")} disabled={!selectedClassId}>
                  Assignment CSV Import
                </button>
                <button type="button" style={teacherSectionButtonStyle("current")} onClick={() => openTeacherSection("current")} disabled={!selectedClassId}>
                  Current Assignments
                </button>
              </div>

              <div
                style={{
                  marginTop: "18px",
                  paddingTop: "16px",
                  borderTop: "1px solid #e5e7eb",
                  display: "grid",
                  gap: "10px",
                }}
              >
                {!selectedClassId ? (
                  <div style={{ fontSize: "0.95rem", lineHeight: 1.5, color: "#4b5563" }}>
                    Select a class first.
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: "0.95rem", lineHeight: 1.5 }}>
                      Working in <strong>{selectedClassName || `Class ${selectedClassId}`}</strong>
                    </div>
                    <div style={{ fontSize: "0.95rem", color: "#4b5563" }}>
                      Students: <strong>{classStudentCount}</strong>
                    </div>
                    <div style={{ fontSize: "0.95rem", color: "#4b5563" }}>
                      Categories: <strong>{categories.length}</strong>
                    </div>
                    <div style={{ fontSize: "0.95rem", color: "#4b5563" }}>
                      Assignments: <strong>{teacherAssignments.length}</strong>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={{ minWidth: 0 }} ref={workspaceContentRef}>
              {!selectedClassId ? (
                <div
                  style={{
                    border: "1px solid #d7dce5",
                    borderRadius: "14px",
                    padding: "22px",
                    background: "#ffffff",
                    boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
                  }}
                >
                  <SectionHeader
                    title="Start with a class"
                    subtitle="Select a class, then use roster, create, import, review, and grade workflows."
                  />
                </div>
              ) : null}

              {selectedClassId ? (
                <div
                  style={{
                    border: "1px solid #d7dce5",
                    borderRadius: "14px",
                    padding: "20px",
                    background: "#ffffff",
                    boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
                    marginBottom: "20px",
                  }}
                >
                  <SectionHeader
                    title="Teacher Launchpad"
                    subtitle={`Fast workflow for ${selectedClassName || `Class ${selectedClassId}`}.`}
                  />

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                      gap: "14px",
                    }}
                  >
                    <SummaryCard label="Ready to Grade" value={teacherAssignmentStatusSummary.readyToGrade} helper="Submissions need grading." />
                    <SummaryCard label="No Submissions" value={teacherAssignmentStatusSummary.noSubmissions} helper="Waiting on students." />
                    <SummaryCard label="Completed" value={teacherAssignmentStatusSummary.completed} helper="Appears fully graded." />
                    <SummaryCard label="Roster Needed" value={teacherAssignmentStatusSummary.rosterNeeded} helper="Needs students first." />
                  </div>

                  <div style={assignmentInboxPanelStyle}>
                    <SectionHeader
                      title="Assignment Inbox"
                      subtitle="Start grading from the assignments that need attention most."
                      action={
                        <ActionButton quiet onClick={() => openTeacherSection("current")}>
                          View All Assignments
                        </ActionButton>
                      }
                    />

                    {teacherAssignmentInboxItems.length === 0 ? (
                      <NoticeBox>
                        No assignments need attention right now. Completed or empty assignment lists will appear in Current Assignments.
                      </NoticeBox>
                    ) : (
                      <div style={assignmentInboxGridStyle}>
                        {teacherAssignmentInboxItems.map((item) => {
                          const assignment = item.assignment
                          const helperText =
                            item.statusLabel === "Ready to Grade"
                              ? `${item.ungraded} submitted work ${item.ungraded === 1 ? "item needs" : "items need"} grading.`
                              : item.statusLabel === "No Submissions"
                                ? `${item.missing} ${item.missing === 1 ? "student has" : "students have"} not submitted yet.`
                                : `${item.submissions} submitted, ${item.graded} graded, ${item.ungraded} waiting.`

                          return (
                            <div key={assignment.id} style={assignmentInboxItemStyle}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ marginBottom: "8px" }}>
                                  <StatusPill label={item.statusLabel} />
                                </div>
                                <div style={assignmentInboxTitleStyle}>
                                  {assignment.title}
                                </div>
                                <div style={assignmentInboxMetaStyle}>
                                  Due: {formatDate(assignment.due_date)}
                                </div>
                                <div style={assignmentInboxMetaStyle}>
                                  {helperText}
                                </div>
                                <div style={assignmentInboxMetaStyle}>
                                  Submitted: <strong>{item.submissions}</strong> · Graded: <strong>{item.graded}</strong> · Missing: <strong>{item.missing}</strong>
                                </div>
                              </div>

                              <div style={assignmentInboxActionStyle}>
                                <ActionButton onClick={() => openGradeAssignmentPage(assignment.id)}>
                                  Grade Now
                                </ActionButton>
                                <ActionButton quiet onClick={() => openEditAssignmentPage(assignment.id)}>
                                  Edit Assignment
                                </ActionButton>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {selectedClassId && teacherSection === "roster" ? (
                <div ref={rosterSectionRef}>
                  <DetailCard title="Roster UI">
                    <form onSubmit={addStudentToRoster}>
                      <div style={{ display: "grid", gap: "14px" }}>
                        <InputBlock label="Student Name">
                          <input value={rosterStudentName} onChange={(e) => setRosterStudentName(e.target.value)} placeholder="Enter student full name" />
                        </InputBlock>
                        <InputBlock label="Student Email">
                          <input value={rosterStudentEmail} onChange={(e) => setRosterStudentEmail(e.target.value)} placeholder="Enter student email" />
                        </InputBlock>
                        <InputBlock label="Parent Email">
                          <input value={rosterParentEmail} onChange={(e) => setRosterParentEmail(e.target.value)} placeholder="Optional" />
                        </InputBlock>
                        <InputBlock label="Student ID">
                          <input value={rosterStudentId} onChange={(e) => setRosterStudentId(e.target.value)} placeholder="Optional" />
                        </InputBlock>
                        <ActionButton type="submit" disabled={rosterSaving}>
                          {rosterSaving ? "Adding..." : "Add Student To Class"}
                        </ActionButton>
                      </div>
                    </form>
                  </DetailCard>
                </div>
              ) : null}

              {selectedClassId && teacherSection === "create" ? (
                <div ref={createSectionRef}>
                  <DetailCard title="Create Assignment">
                    {!classHasCategories ? (
                      <NoticeBox>
                        <div style={{ display: "grid", gap: "12px" }}>
                          <div>
                            This class does not have assessment pathways available yet. Create assessment pathways and evidence tiers before creating competency-linked assignments.
                          </div>
                          <div>
                            <ActionButton
                              type="button"
                              onClick={handleSetupKduStructure}
                              disabled={loading || !selectedClassId}
                            >
                              {loading ? "Setting Up..." : "Set Up KDU Structure"}
                            </ActionButton>
                          </div>
                        </div>
                      </NoticeBox>
                    ) : null}

                    <form onSubmit={createAssignment}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
                          gap: "20px",
                          alignItems: "start",
                        }}
                      >
                        <div style={{ display: "grid", gap: "14px" }}>
                          <InputBlock label="Assessment Pathway">
                            <select
                              value={selectedCategoryId}
                              onChange={(e) => {
                                setSelectedCategoryId(e.target.value)
                                setSelectedSubcategoryId("")
                                setError("")
                                setMessage("")
                              }}
                            >
                              <option value="">Select assessment pathway</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name} ({formatPercent(category.weight_percent)})
                                </option>
                              ))}
                            </select>
                          </InputBlock>

                          <InputBlock label="Evidence Tier">
                            <select
                              value={selectedSubcategoryId}
                              onChange={(e) => {
                                setSelectedSubcategoryId(e.target.value)
                                setError("")
                                setMessage("")
                              }}
                              disabled={!selectedCategoryId}
                            >
                              <option value="">Select evidence tier</option>
                              {availableSubcategories.map((subcategory) => (
                                <option key={subcategory.id} value={subcategory.id}>
                                  {subcategory.name} ({formatPercent(subcategory.weight_percent_of_parent)})
                                </option>
                              ))}
                            </select>
                          </InputBlock>

                          <InputBlock label="Assignment Title">
                            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter assignment title" />
                          </InputBlock>

                          <InputBlock label="Description">
                            <textarea rows="5" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Enter assignment description" />
                          </InputBlock>

                          <InputBlock label="Due Date">
                            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                          </InputBlock>

                          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                            <ActionButton type="submit" disabled={!classHasCategories || assignmentCreating}>
                              {assignmentCreating ? "Creating..." : "Create Assignment"}
                            </ActionButton>
                            <ActionButton quiet onClick={resetTeacherFormState}>
                              Reset Form
                            </ActionButton>
                          </div>
                        </div>

                        <div>
                          <DetailCard title="Assignment Weight Preview">
                            <div style={{ display: "grid", gap: "12px" }}>
                              <div>
                                <strong>Selected Assessment Pathway:</strong>{" "}
                                {selectedCategory ? `${selectedCategory.name} (${formatPercent(selectedCategory.weight_percent)})` : "Not selected"}
                              </div>
                              <div>
                                <strong>Selected Evidence Tier:</strong>{" "}
                                {selectedSubcategory ? `${selectedSubcategory.name} (${formatPercent(selectedSubcategory.weight_percent_of_parent)})` : "Not selected"}
                              </div>
                              <div>
                                <strong>Calculated assignment weight:</strong>{" "}
                                {previewCalculatedWeight === null ? "Select assessment pathway and subcategory" : formatPercent(previewCalculatedWeight)}
                              </div>
                            </div>
                          </DetailCard>
                        </div>
                      </div>
                    </form>
                  </DetailCard>
                </div>
              ) : null}

              {selectedClassId && teacherSection === "import" ? (
                <div ref={importSectionRef}>
                  <DetailCard title="Assignment CSV Import">
                    <textarea
                      rows="10"
                      value={csvImportText}
                      onChange={(e) => setCsvImportText(e.target.value)}
                      placeholder={`title,category,subcategory,due_date,description
Quiz 1,Writing,Major Assessments,2026-04-01,First imported assignment`}
                      style={{ width: "100%", boxSizing: "border-box" }}
                    />
                    <div style={{ marginTop: "12px" }}>
                      <ActionButton onClick={importAssignmentsFromCsv} disabled={csvImportLoading}>
                        {csvImportLoading ? "Importing..." : "Import Assignments"}
                      </ActionButton>
                    </div>
                    {csvImportResult ? (
                      <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(csvImportResult, null, 2)}</pre>
                    ) : null}
                  </DetailCard>
                </div>
              ) : null}

              {selectedClassId && teacherSection === "current" ? (
                <div ref={currentSectionRef}>
                  <DetailCard title="Current Assignments">
                    {loading ? (
                      <p>Loading assignments...</p>
                    ) : !classHasAssignments ? (
                      <NoticeBox>No assignments yet for this class.</NoticeBox>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" }}>
                        {teacherAssignments.map((assignment) => {
                          const isEditing = String(editingAssignmentId) === String(assignment.id)
                          const statusLabel = getAssignmentStatusLabel(assignment, classStudentCount)

                          return (
                            <DetailCard key={assignment.id} title={assignment.title}>
                              <div style={{ display: "grid", gap: "8px" }}>
                                <StatusPill label={statusLabel} />
                                <div>
                                  <strong>Due:</strong> {formatDate(assignment.due_date)}
                                </div>
                                <div>
                                  <strong>Assessment Pathway:</strong> {assignment.category_name || "Not linked"}
                                </div>
                                <div>
                                  <strong>Evidence Tier:</strong> {assignment.subcategory_name || "Not linked"}
                                </div>
                                <div>
                                  <strong>Description:</strong> {assignment.description || "No description"}
                                </div>
                                <div>
                                  <strong>Weight:</strong>{" "}
                                  {assignment.calculated_weight !== null && assignment.calculated_weight !== undefined
                                    ? formatPercent(assignment.calculated_weight)
                                    : "Not calculated"}
                                </div>

                                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
                                  <ActionButton quiet onClick={() => moveAssignment(assignment.id, "up")} disabled={movingAssignmentId === `${assignment.id}-up`}>
                                    {movingAssignmentId === `${assignment.id}-up` ? "Moving..." : "↑ Move Up"}
                                  </ActionButton>
                                  <ActionButton quiet onClick={() => moveAssignment(assignment.id, "down")} disabled={movingAssignmentId === `${assignment.id}-down`}>
                                    {movingAssignmentId === `${assignment.id}-down` ? "Moving..." : "↓ Move Down"}
                                  </ActionButton>
                                  <ActionButton onClick={() => openGradeAssignmentPage(assignment.id)}>
                                    Open Speed Grading
                                  </ActionButton>
                                  <ActionButton quiet onClick={() => openEditAssignmentPage(assignment.id)}>
                                    Open Edit Page
                                  </ActionButton>
                                  <ActionButton quiet onClick={() => duplicateAssignment(assignment)} disabled={String(duplicatingAssignmentId) === String(assignment.id)}>
                                    {String(duplicatingAssignmentId) === String(assignment.id) ? "Duplicating..." : "Duplicate"}
                                  </ActionButton>
                                  <ActionButton quiet onClick={() => beginEditAssignment(assignment)}>
                                    Inline Edit
                                  </ActionButton>
                                  <DangerActionButton onClick={() => beginDeleteAssignment(assignment)}>
                                    Delete
                                  </DangerActionButton>
                                </div>

                                {isEditing ? (
                                  <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
                                    <InputBlock label="Title">
                                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                                    </InputBlock>
                                    <InputBlock label="Description">
                                      <textarea rows="4" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                                    </InputBlock>
                                    <InputBlock label="Due Date">
                                      <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                                    </InputBlock>
                                    <ActionButton onClick={() => saveEditedAssignment(assignment.id)} disabled={editSaving}>
                                      {editSaving ? "Saving..." : "Save Changes"}
                                    </ActionButton>
                                  </div>
                                ) : null}
                              </div>
                            </DetailCard>
                          )
                        })}
                      </div>
                    )}
                  </DetailCard>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <>
          <DetailCard title="Submit Assignment">
            <form onSubmit={submitAssignment}>
              <div style={{ display: "grid", gap: "14px", maxWidth: "760px" }}>
                <InputBlock label="Assignment">
                  <select value={selectedAssignmentId} onChange={(e) => setSelectedAssignmentId(e.target.value)}>
                    <option value="">Select assignment</option>
                    {assignments.map((assignment) => (
                      <option key={assignment.id} value={assignment.id}>
                        {assignment.title} — {assignment.class_name || assignment.class_id}
                      </option>
                    ))}
                  </select>
                </InputBlock>

                <InputBlock label="Submission Text">
                  <textarea rows="6" value={submissionText} onChange={(e) => setSubmissionText(e.target.value)} />
                </InputBlock>

                <InputBlock label="Attachments">
                  <input
                    id="submission-file-input"
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = e.target.files ? Array.from(e.target.files) : []
                      setSelectedFiles(files)
                    }}
                  />
                </InputBlock>

                <ActionButton type="submit">Submit Assignment</ActionButton>
              </div>
            </form>
          </DetailCard>

          <DetailCard title="My Grades and Feedback">
            {studentSubmissions.length === 0 ? (
              <p>No submissions yet.</p>
            ) : (
              <div style={{ display: "grid", gap: "16px" }}>
                {studentSubmissions.map((submission) => (
                  <DetailCard key={submission.id} title={submission.assignment_title || "Assignment"}>
                    <div>{submission.content || "No text submission"}</div>
                    <div>
                      <strong>Score:</strong>{" "}
                      {submission.score !== null && submission.score !== undefined ? submission.score : "Not graded"}
                    </div>
                    <div>
                      <strong>Grade:</strong> {submission.grade || "Not graded"}
                    </div>
                    <div>
                      <strong>Feedback:</strong> {submission.feedback || "No feedback yet"}
                    </div>
                  </DetailCard>
                ))}
              </div>
            )}
          </DetailCard>
        </>
      )}
    </div>
  )
}
