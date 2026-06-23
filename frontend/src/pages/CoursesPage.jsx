import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import * as XLSX from "xlsx"
import { useAuth } from "../AuthContext.jsx"
import API_BASE from "../apiBase"


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
  const navigate = useNavigate()
  const { user } = useAuth()
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
  const [newCourseType, setNewCourseType] = useState("custom_competency")

  const [editingCourseId, setEditingCourseId] = useState(null)
  const [editCourseTitle, setEditCourseTitle] = useState("")
  const [editCourseDescription, setEditCourseDescription] = useState("")
  const [editCourseTeacherEmail, setEditCourseTeacherEmail] = useState("")
  const [editCourseType, setEditCourseType] = useState("custom_competency")
  const [savingCourseId, setSavingCourseId] = useState(null)
  const [duplicatingCourseId, setDuplicatingCourseId] = useState(null)
  const [savingTemplateCourseId, setSavingTemplateCourseId] = useState(null)

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

  const [activeCompetencyCourseId, setActiveCompetencyCourseId] = useState(null)
  const [competencyLoadingCourseId, setCompetencyLoadingCourseId] = useState(null)
  const [competenciesByCourseId, setCompetenciesByCourseId] = useState({})
  const [newLearningCategoryNameByCourseId, setNewLearningCategoryNameByCourseId] = useState({})
  const [newLearningCategoryWeightByCourseId, setNewLearningCategoryWeightByCourseId] = useState({})
  const [creatingLearningCategoryCourseId, setCreatingLearningCategoryCourseId] = useState(null)
  const [newEvidenceTierNameByCategoryId, setNewEvidenceTierNameByCategoryId] = useState({})
  const [newEvidenceTierWeightByCategoryId, setNewEvidenceTierWeightByCategoryId] = useState({})
  const [newEvidenceTierLevelByCategoryId, setNewEvidenceTierLevelByCategoryId] = useState({})
  const [creatingEvidenceTierCategoryId, setCreatingEvidenceTierCategoryId] = useState(null)
  const [deletingEvidenceTierId, setDeletingEvidenceTierId] = useState(null)
  const [duplicatingEvidenceTierId, setDuplicatingEvidenceTierId] = useState(null)
  const [movingEvidenceTierId, setMovingEvidenceTierId] = useState(null)
  const [editingEvidenceTierId, setEditingEvidenceTierId] = useState(null)
  const [editEvidenceTierName, setEditEvidenceTierName] = useState("")
  const [editEvidenceTierWeight, setEditEvidenceTierWeight] = useState("")
  const [editEvidenceTierLevel, setEditEvidenceTierLevel] = useState("")
  const [savingEvidenceTierId, setSavingEvidenceTierId] = useState(null)
  const [deletingLearningCategoryId, setDeletingLearningCategoryId] = useState(null)
  const [duplicatingLearningCategoryId, setDuplicatingLearningCategoryId] = useState(null)
  const [movingLearningCategoryId, setMovingLearningCategoryId] = useState(null)
  const [editingLearningCategoryId, setEditingLearningCategoryId] = useState(null)
  const [editLearningCategoryName, setEditLearningCategoryName] = useState("")
  const [editLearningCategoryWeight, setEditLearningCategoryWeight] = useState("")
  const [savingLearningCategoryId, setSavingLearningCategoryId] = useState(null)
  const [learningPathLoadingCourseId, setLearningPathLoadingCourseId] = useState(null)
  const [learningPathsByCourseId, setLearningPathsByCourseId] = useState({})
  const [creatingLearningPathCourseId, setCreatingLearningPathCourseId] = useState(null)
  const [newLearningPathTitleByCourseId, setNewLearningPathTitleByCourseId] = useState({})
  const [newLearningPathDescriptionByCourseId, setNewLearningPathDescriptionByCourseId] = useState({})
  const [deletingLearningPathId, setDeletingLearningPathId] = useState(null)
  const [duplicatingLearningPathId, setDuplicatingLearningPathId] = useState(null)
  const [movingLearningPathKey, setMovingLearningPathKey] = useState(null)

  const [learningPathItemsByPathId, setLearningPathItemsByPathId] = useState({})
  const [loadingItemsPathId, setLoadingItemsPathId] = useState(null)
  const [creatingItemKey, setCreatingItemKey] = useState(null)
  const [editingItemId, setEditingItemId] = useState(null)
  const [editItemDraftById, setEditItemDraftById] = useState({})
  const [savingItemId, setSavingItemId] = useState(null)
  const [deletingItemId, setDeletingItemId] = useState(null)
  const [movingLearningPathItemKey, setMovingLearningPathItemKey] = useState(null)

  const [allAssignments, setAllAssignments] = useState([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)

  const [activeTemplateLibraryCourseId, setActiveTemplateLibraryCourseId] = useState(null)
  const [templateLibraryLoading, setTemplateLibraryLoading] = useState(false)
  const [courseStructureTemplates, setCourseStructureTemplates] = useState([])
  const [applyingTemplateKey, setApplyingTemplateKey] = useState(null)
  const [previewTemplateId, setPreviewTemplateId] = useState(null)

  const [teacherCoachOpen, setTeacherCoachOpen] = useState(true)
  const [teacherCoachGuide, setTeacherCoachGuide] = useState("first_course")
  const [teacherCoachStep, setTeacherCoachStep] = useState(0)

  useEffect(() => {
    loadCourses()

    const params = new URLSearchParams(window.location.search)
    const shouldStartCreate = params.get("startCreate") === "1"
    const suggestedTitle = params.get("title") || ""

    if (shouldStartCreate) {
      setShowCreateCourse(true)
      setShowBulkRosterImport(false)
      setNewCourseTitle(suggestedTitle || "")
      setNewCourseType("custom_competency")

      window.setTimeout(() => {
        const target = document.getElementById("create-course-form")
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" })
        } else {
          window.scrollTo({ top: 0, behavior: "auto" })
        }
      }, 300)
    }
  }, [])

  useEffect(() => {
    if (loading) return

    const params = new URLSearchParams(window.location.search)
    const requestedCourseId = params.get("courseId")

    if (requestedCourseId) {
      window.localStorage.setItem("super-lms-last-course-id", String(requestedCourseId))

      window.setTimeout(() => {
        const target = document.getElementById(`course-${requestedCourseId}`)
        if (target) {
          target.scrollIntoView({ behavior: "auto", block: "start" })
        }
      }, 250)

      return
    }

    window.scrollTo({ top: 0, behavior: "auto" })
  }, [loading, courses.length])

  async function loadCourses() {
    try {
      setLoading(true)
      setError("")

      const res = await fetch(`${API_BASE}/api/classes`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Failed to load courses")

      const currentTeacherId = Number(user?.id || 0)
      const userRole = String(user?.role || "").toLowerCase()

      const visibleCourses = Array.isArray(data)
        ? data.filter((course) => {
            if (userRole === "admin") return true
            if (userRole === "teacher") {
              const sharedTeacherIds = Array.isArray(course.shared_teacher_ids)
                ? course.shared_teacher_ids.map((id) => Number(id || 0)).filter(Boolean)
                : []

              return (
                currentTeacherId &&
                (
                  Number(course.teacher_id || course.teacherId || 0) === currentTeacherId ||
                  sharedTeacherIds.includes(currentTeacherId)
                )
              )
            }
            return false
          })
        : []

      const sortedCourses = visibleCourses.sort((a, b) => {
        const nameA = String(a.title || a.class_name || "").toLowerCase()
        const nameB = String(b.title || b.class_name || "").toLowerCase()
        const baseA = nameA.replace(/\s+copy.*$/i, "").trim()
        const baseB = nameB.replace(/\s+copy.*$/i, "").trim()

        if (baseA !== baseB) {
          return baseA.localeCompare(baseB)
        }

        return Number(a.id || 0) - Number(b.id || 0)
      })

      setCourses(sortedCourses)
    } catch (err) {
      setError(err.message || "Failed to load courses")
      setCourses([])
    } finally {
      setLoading(false)
    }
  }

  async function loadAssignments() {
    try {
      setAssignmentsLoading(true)

      const res = await fetch(`${API_BASE}/api/assignments`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Failed to load assignments")

      setAllAssignments(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || "Failed to load assignments")
      setAllAssignments([])
    } finally {
      setAssignmentsLoading(false)
    }
  }

  async function loadTemplateLibrary(courseId) {
    if (activeTemplateLibraryCourseId === courseId) {
      setActiveTemplateLibraryCourseId(null)
      return
    }

    try {
      setActiveTemplateLibraryCourseId(courseId)
      setTemplateLibraryLoading(true)
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/course-structure-templates`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to load template library")
      }

      setCourseStructureTemplates(Array.isArray(data.templates) ? data.templates : [])
    } catch (err) {
      setError(err.message || "Failed to load template library")
      setCourseStructureTemplates([])
    } finally {
      setTemplateLibraryLoading(false)
    }
  }

  async function deleteCourseStructureTemplate(template) {
    const templateName = template?.template_name || "this template"

    const confirmed = window.confirm(
      `Delete template "${templateName}"?\n\nThis will not delete any courses, assignments, students, grades, or course structures already created from this template.`
    )

    if (!confirmed) {
      return
    }

    try {
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/course-structure-templates/${template.id}`, {
        method: "DELETE",
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete template")
      }

      setCourseStructureTemplates((current) =>
        current.filter((item) => Number(item.id) !== Number(template.id))
      )

      setMessage(`Template deleted: ${data.deleted?.template_name || templateName}`)
    } catch (err) {
      setError(err.message || "Failed to delete template")
    }
  }


  async function applyCourseStructureTemplate(course, template) {
    const courseName = getCourseName(course)
    const templateName = template?.template_name || "selected template"

    const replaceExisting = window.confirm(
      `${courseName} may already have Grading Pathways.\n\nClick OK to replace the existing structure with "${templateName}".\n\nClick Cancel to apply only if the course is blank.`
    )

    try {
      setApplyingTemplateKey(`${course.id}-${template.id}`)
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/courses/${course.id}/apply-structure-template/${template.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replace_existing: replaceExisting,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to apply template")
      }

      setMessage(
        `Template applied to ${courseName}: ${data.template?.template_name || templateName}. ` +
        `${data.category_count || 0} pathways and ${data.subcategory_count || 0} evidence tiers created.`
      )

      await loadCourses()

      if (activeCompetencyCourseId === course.id) {
        await loadCompetencies(course.id)
      }
    } catch (err) {
      setError(err.message || "Failed to apply template")
    } finally {
      setApplyingTemplateKey(null)
    }
  }


  function getCourseName(course) {
    return course?.class_name || course?.title || `Course ${course?.id || ""}`
  }

  function getTeacherCoachRecommendation() {
    if (!Array.isArray(courses) || courses.length === 0) {
      return {
        title: "Create your first course",
        reason: "No courses are loaded yet. Start by creating the class you want to teach.",
        action: "Use the Create Course box and enter a clear course title.",
        target: null,
        courseId: null,
      }
    }

    const lastCourseId = window.localStorage.getItem("super-lms-last-course-id")
    const selectedCourse =
      courses.find((course) => String(course.id) === String(lastCourseId)) || courses[0]

    const courseName = getCourseName(selectedCourse)
    const courseCompetencies = competenciesByCourseId[selectedCourse.id] || []
    const courseAssignments = getAssignmentsForCourse(selectedCourse.id)
    const totalEvidenceTiers = courseCompetencies.reduce(
      (sum, category) => sum + Number(category.subcategories?.length || 0),
      0
    )
    const pathwayTotal = courseCompetencies.reduce(
      (sum, category) => sum + Number(category.weight_percent || 0),
      0
    )
    const studentCount = Number(selectedCourse.student_count || selectedCourse.studentCount || 0)

    if (courseCompetencies.length === 0) {
      return {
        title: "Add Grading Pathways",
        reason: `${courseName} needs Grading Pathways before grades can be organized clearly.`,
        action: "Add the main learning areas for this course, such as Writing, Reading, Speaking, or Grammar.",
        target: "competencies",
        courseId: selectedCourse.id,
      }
    }

    if (pathwayTotal !== 100) {
      return {
        title: "Balance pathway weights",
        reason: `${courseName} pathway weights currently total ${pathwayTotal.toFixed(2)}%. They should total 100%.`,
        action: "Adjust the pathway weights so the course grading structure is complete.",
        target: "competencies",
        courseId: selectedCourse.id,
      }
    }

    if (totalEvidenceTiers === 0) {
      return {
        title: "Add Evidence Tiers",
        reason: `${courseName} has Grading Pathways. Now add the assignment types or evidence categories inside them.`,
        action: "Use Add Evidence Tier to create the boxes where assignments will live.",
        target: "competencies",
        courseId: selectedCourse.id,
      }
    }

    if (courseAssignments.length === 0) {
      return {
        title: "Create the first assignment",
        reason: `${courseName} has a grading structure. Now create an assignment to collect student evidence.`,
        action: "Create an assignment and connect it to the correct Evidence Tier.",
        target: "assignments",
        courseId: selectedCourse.id,
      }
    }

    if (studentCount === 0) {
      return {
        title: "Import students",
        reason: `${courseName} has assignments, but no students are enrolled yet.`,
        action: "Import students so marks, student views, and parent views can be connected.",
        target: "import",
        courseId: selectedCourse.id,
      }
    }

    return {
      title: "Ready for teaching",
      reason: `${courseName} has structure, assignments, and students.`,
      action: "Open the Gradebook or begin marking the first assignment.",
      target: "assignments",
      courseId: selectedCourse.id,
    }
  }

  async function moveLearningCategory(courseId, categoryId, direction) {
    if (!courseId || !categoryId || !["up", "down"].includes(direction)) {
      setError("Valid course, grading pathway, and move direction are required.")
      setMessage("")
      return
    }

    try {
      setMovingLearningCategoryId(`${categoryId}-${direction}`)
      setError("")
      setMessage("")

      const res = await fetch(`${API_BASE}/api/categories/${categoryId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to reorder grading pathway")
      }

      setMessage(
        data.moved
          ? `Assessment pathway moved ${direction}.`
          : data.reason || "Assessment pathway order unchanged."
      )

      setActiveCompetencyCourseId(null)
      await loadCompetencies(courseId)
    } catch (err) {
      setError(err.message || "Failed to reorder grading pathway")
    } finally {
      setMovingLearningCategoryId(null)
    }
  }

  function beginEditLearningCategory(category) {
    setEditingLearningCategoryId(category.id)
    setEditLearningCategoryName(category.name || "")
    setEditLearningCategoryWeight(category.weight_percent || "")
    setError("")
    setMessage("")
  }

  function cancelEditLearningCategory() {
    setEditingLearningCategoryId(null)
    setEditLearningCategoryName("")
    setEditLearningCategoryWeight("")
  }

  async function saveLearningCategory(courseId, categoryId) {
    const name = String(editLearningCategoryName || "").trim()
    const weight = Number(editLearningCategoryWeight || 0)

    if (!name) {
      setError("Assessment pathway name is required.")
      setMessage("")
      return
    }

    if (!Number.isFinite(weight) || weight <= 0) {
      setError("Assessment pathway weight must be greater than 0.")
      setMessage("")
      return
    }

    try {
      setSavingLearningCategoryId(categoryId)
      setError("")
      setMessage("")

      const res = await fetch(`${API_BASE}/api/categories/${categoryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          weight_percent: weight,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to update grading pathway")
      }

      setMessage(`Assessment pathway updated: ${data.name || name}`)
      cancelEditLearningCategory()

      setActiveCompetencyCourseId(null)
      await loadCompetencies(courseId)
    } catch (err) {
      setError(err.message || "Failed to update grading pathway")
    } finally {
      setSavingLearningCategoryId(null)
    }
  }

  async function deleteLearningCategory(courseId, category) {
    const categoryName = String(category?.name || "this grading pathway")

    const confirmed = window.confirm(
      `Delete grading pathway "${categoryName}"? This is only allowed when no evidence tiers remain.`
    )

    if (!confirmed) return

    try {
      setDeletingLearningCategoryId(category.id)
      setError("")
      setMessage("")

      const res = await fetch(`${API_BASE}/api/categories/${category.id}`, {
        method: "DELETE",
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete grading pathway")
      }

      setMessage(`Assessment pathway deleted: ${data.deleted?.name || categoryName}`)

      setActiveCompetencyCourseId(null)
      await loadCompetencies(courseId)
    } catch (err) {
      setError(err.message || "Failed to delete grading pathway")
    } finally {
      setDeletingLearningCategoryId(null)
    }
  }

  async function duplicateLearningCategory(courseId, category) {
    const categoryId = Number(category?.id || 0)
    const categoryName = String(category?.name || "Grading Pathway").trim()
    const duplicateName = categoryName.endsWith(" Copy") ? `${categoryName} 2` : `${categoryName} Copy`
    const categoryWeight = Number(category?.weight_percent || 0)

    if (!courseId || !categoryId) {
      setError("Valid course and grading pathway are required.")
      setMessage("")
      return
    }

    const confirmed = window.confirm(
      `Duplicate grading pathway "${categoryName}"?\n\nThis will copy the pathway weight and its Evidence Tiers.\n\nIt will not copy assignments, grades, submissions, rubric scores, or student work.`
    )

    if (!confirmed) return

    try {
      setDuplicatingLearningCategoryId(categoryId)
      setError("")
      setMessage("")

      const sourceTiersRes = await fetch(`${API_BASE}/api/categories/${categoryId}/subcategories`)
      const sourceTiersData = await sourceTiersRes.json()

      if (!sourceTiersRes.ok) {
        throw new Error(sourceTiersData.error || "Failed to load source evidence tiers")
      }

      const tiersToCopy = Array.isArray(sourceTiersData) ? sourceTiersData : []

      const categoryRes = await fetch(`${API_BASE}/api/courses/${courseId}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: duplicateName,
          weight_percent: categoryWeight,
          insert_after_category_id: categoryId,
        }),
      })

      const duplicatedCategory = await categoryRes.json()

      if (!categoryRes.ok) {
        throw new Error(duplicatedCategory.error || "Failed to duplicate grading pathway")
      }

      for (const tier of tiersToCopy) {
        const tierName = String(tier?.name || "Evidence Tier").trim()
        const tierWeight = Number(tier?.weight_percent_of_parent || 0)
        const tierLevel = tier?.level_number === undefined || tier?.level_number === null || tier?.level_number === ""
          ? null
          : Number(tier.level_number)

        if (!tierName || !Number.isFinite(tierWeight) || tierWeight <= 0) {
          continue
        }

        const tierRes = await fetch(`${API_BASE}/api/categories/${duplicatedCategory.id}/subcategories`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: tierName,
            weight_percent_of_parent: tierWeight,
            level_number: Number.isFinite(tierLevel) && tierLevel > 0 ? tierLevel : 1,
          }),
        })

        const tierData = await tierRes.json()

        if (!tierRes.ok) {
          throw new Error(tierData.error || `Failed to duplicate evidence tier "${tierName}"`)
        }
      }

      setMessage(
        `Assessment pathway duplicated: ${duplicatedCategory.name || duplicateName} with ${tiersToCopy.length} evidence tier${tiersToCopy.length === 1 ? "" : "s"}.`
      )

      setActiveCompetencyCourseId(null)
      await loadCompetencies(courseId)
    } catch (err) {
      setError(err.message || "Failed to duplicate grading pathway")
    } finally {
      setDuplicatingLearningCategoryId(null)
    }
  }

  async function moveEvidenceTier(courseId, tierId, direction) {
    if (!courseId || !tierId || !["up", "down"].includes(direction)) {
      setError("Valid course, evidence tier, and move direction are required.")
      setMessage("")
      return
    }

    try {
      setMovingEvidenceTierId(`${tierId}-${direction}`)
      setError("")
      setMessage("")

      const res = await fetch(`${API_BASE}/api/subcategories/${tierId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to reorder evidence tier")
      }

      setMessage(
        data.moved
          ? `Evidence tier moved ${direction}.`
          : data.reason || "Evidence tier order unchanged."
      )

      setActiveCompetencyCourseId(null)
      await loadCompetencies(courseId)
    } catch (err) {
      setError(err.message || "Failed to reorder evidence tier")
    } finally {
      setMovingEvidenceTierId(null)
    }
  }

  function beginEditEvidenceTier(tier) {
    setEditingEvidenceTierId(tier.id)
    setEditEvidenceTierName(tier.name || "")
    setEditEvidenceTierWeight(tier.weight_percent_of_parent || "")
    setEditEvidenceTierLevel(tier.level_number || "")
    setError("")
    setMessage("")
  }

  function cancelEditEvidenceTier() {
    setEditingEvidenceTierId(null)
    setEditEvidenceTierName("")
    setEditEvidenceTierWeight("")
    setEditEvidenceTierLevel("")
  }

  async function saveEvidenceTier(courseId, tierId) {
    const name = String(editEvidenceTierName || "").trim()
    const weight = Number(editEvidenceTierWeight || 0)
    const level = Number(editEvidenceTierLevel || 0)

    if (!name) {
      setError("Evidence tier name is required.")
      setMessage("")
      return
    }

    if (!Number.isFinite(weight) || weight <= 0) {
      setError("Evidence tier weight must be greater than 0.")
      setMessage("")
      return
    }

    if (!Number.isFinite(level) || level <= 0) {
      setError("Evidence tier level must be greater than 0.")
      setMessage("")
      return
    }

    try {
      setSavingEvidenceTierId(tierId)
      setError("")
      setMessage("")

      const res = await fetch(`${API_BASE}/api/subcategories/${tierId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          weight_percent_of_parent: weight,
          level_number: level,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to update evidence tier")
      }

      setMessage(`Evidence tier updated: ${data.name || name}`)
      cancelEditEvidenceTier()

      setActiveCompetencyCourseId(null)
      await loadCompetencies(courseId)
    } catch (err) {
      setError(err.message || "Failed to update evidence tier")
    } finally {
      setSavingEvidenceTierId(null)
    }
  }

  async function deleteEvidenceTier(courseId, tier) {
    const tierName = String(tier?.name || "this evidence tier")

    const confirmed = window.confirm(
      `Delete evidence tier "${tierName}"? This is only allowed if no assignments are linked to it.`
    )

    if (!confirmed) return

    try {
      setDeletingEvidenceTierId(tier.id)
      setError("")
      setMessage("")

      const res = await fetch(`${API_BASE}/api/subcategories/${tier.id}`, {
        method: "DELETE",
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete evidence tier")
      }

      setMessage(`Evidence tier deleted: ${data.deleted?.name || tierName}`)

      setActiveCompetencyCourseId(null)
      await loadCompetencies(courseId)
    } catch (err) {
      setError(err.message || "Failed to delete evidence tier")
    } finally {
      setDeletingEvidenceTierId(null)
    }
  }

  async function duplicateEvidenceTier(courseId, categoryId, tier) {
    const tierId = Number(tier?.id || 0)
    const tierName = String(tier?.name || "Evidence Tier").trim()
    const duplicateName = tierName.endsWith(" Copy") ? `${tierName} 2` : `${tierName} Copy`
    const tierWeight = Number(tier?.weight_percent_of_parent || 0)
    const tierLevel = tier?.level_number === undefined || tier?.level_number === null || tier?.level_number === ""
      ? null
      : Number(tier.level_number)

    if (!courseId || !categoryId || !tierId) {
      setError("Valid course, grading pathway, and evidence tier are required.")
      setMessage("")
      return
    }

    const confirmed = window.confirm(
      `Duplicate evidence tier "${tierName}"?\n\nThis will copy the tier weight and level.\n\nIt will not copy assignments, grades, submissions, rubric scores, or student work.`
    )

    if (!confirmed) return

    try {
      setDuplicatingEvidenceTierId(tierId)
      setError("")
      setMessage("")

      const res = await fetch(`${API_BASE}/api/categories/${categoryId}/subcategories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: duplicateName,
          weight_percent_of_parent: tierWeight,
          level_number: Number.isFinite(tierLevel) && tierLevel > 0 ? tierLevel : 1,
          insert_after_subcategory_id: tierId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to duplicate evidence tier")
      }

      setMessage(`Evidence tier duplicated: ${data.name || duplicateName}`)

      await loadCompetencies(courseId, { forceOpen: true })
    } catch (err) {
      setError(err.message || "Failed to duplicate evidence tier")
    } finally {
      setDuplicatingEvidenceTierId(null)
    }
  }

  async function createEvidenceTier(courseId, categoryId) {
    const name = String(newEvidenceTierNameByCategoryId[categoryId] || "").trim()
    const weight = Number(newEvidenceTierWeightByCategoryId[categoryId] || 0)
    const level = Number(newEvidenceTierLevelByCategoryId[categoryId] || 0)

    if (!name) {
      setError("Evidence tier name is required.")
      setMessage("")
      return
    }

    if (!Number.isFinite(weight) || weight <= 0) {
      setError("Evidence tier weight must be greater than 0.")
      setMessage("")
      return
    }

    if (!Number.isFinite(level) || level <= 0) {
      setError("Evidence tier level must be greater than 0.")
      setMessage("")
      return
    }

    try {
      setCreatingEvidenceTierCategoryId(categoryId)
      setError("")
      setMessage("")

      const res = await fetch(`${API_BASE}/api/categories/${categoryId}/subcategories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          weight_percent_of_parent: weight,
          level_number: level,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create evidence tier")
      }

      setNewEvidenceTierNameByCategoryId((current) => ({ ...current, [categoryId]: "" }))
      setNewEvidenceTierWeightByCategoryId((current) => ({ ...current, [categoryId]: "" }))
      setNewEvidenceTierLevelByCategoryId((current) => ({ ...current, [categoryId]: "" }))
      setMessage(`Evidence tier created: ${data.name || name}`)

      await loadCompetencies(courseId, { forceOpen: true })

      window.setTimeout(() => {
        const target = document.getElementById(`category-${categoryId}`)
        if (target) {
          target.scrollIntoView({ behavior: "auto", block: "center" })
        }
      }, 100)
    } catch (err) {
      setError(err.message || "Failed to create evidence tier")
    } finally {
      setCreatingEvidenceTierCategoryId(null)
    }
  }

  async function createLearningCategory(courseId) {
    const name = String(newLearningCategoryNameByCourseId[courseId] || "").trim()
    const weight = Number(newLearningCategoryWeightByCourseId[courseId] || 0)

    if (!name) {
      setError("Assessment pathway name is required.")
      setMessage("")
      return
    }

    if (!Number.isFinite(weight) || weight <= 0) {
      setError("Assessment pathway weight must be greater than 0.")
      setMessage("")
      return
    }

    try {
      setCreatingLearningCategoryCourseId(courseId)
      setError("")
      setMessage("")

      const res = await fetch(`${API_BASE}/api/courses/${courseId}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, weight_percent: weight }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create grading pathway")
      }

      setNewLearningCategoryNameByCourseId((current) => ({ ...current, [courseId]: "" }))
      setNewLearningCategoryWeightByCourseId((current) => ({ ...current, [courseId]: "" }))
      setMessage(`Assessment pathway created: ${data.name || name}`)

      setActiveCompetencyCourseId(null)
      await loadCompetencies(courseId)
    } catch (err) {
      setError(err.message || "Failed to create grading pathway")
    } finally {
      setCreatingLearningCategoryCourseId(null)
    }
  }

  async function loadCompetencies(courseId, options = {}) {
    const forceOpen = Boolean(options.forceOpen)

    if (!forceOpen && activeCompetencyCourseId === courseId) {
      setActiveCompetencyCourseId(null)
      return
    }

    try {
      setCompetencyLoadingCourseId(courseId)
      setError("")

      const categoriesRes = await fetch(`${API_BASE}/api/courses/${courseId}/categories`)
      const categoriesData = await categoriesRes.json()

      if (!categoriesRes.ok) {
        throw new Error(categoriesData.error || "Failed to load grading pathways")
      }

      const categories = Array.isArray(categoriesData)
        ? [...categoriesData].sort((a, b) => {
            const orderA = Number(a.sort_order || 0)
            const orderB = Number(b.sort_order || 0)

            if (orderA !== orderB) {
              return orderA - orderB
            }

            return Number(a.id || 0) - Number(b.id || 0)
          })
        : []

      const categoriesWithSubcategories = await Promise.all(
        categories.map(async (category) => {
          const subcategoriesRes = await fetch(`${API_BASE}/api/categories/${category.id}/subcategories`)
          const subcategoriesData = await subcategoriesRes.json()

          if (!subcategoriesRes.ok) {
            throw new Error(subcategoriesData.error || "Failed to load evidence tiers")
          }

          return {
            ...category,
            subcategories: Array.isArray(subcategoriesData) ? subcategoriesData : [],
          }
        })
      )

      setCompetenciesByCourseId((current) => ({
        ...current,
        [courseId]: categoriesWithSubcategories,
      }))
      setActiveCompetencyCourseId(courseId)
    } catch (err) {
      setError(err.message || "Failed to load competencies")
    } finally {
      setCompetencyLoadingCourseId(null)
    }
  }

  function getAssignmentsForCourse(courseId) {
    return allAssignments.filter((assignment) => Number(assignment.class_id) === Number(courseId))
  }

  function getAssignmentTitle(assignmentId) {
    const assignment = allAssignments.find((item) => Number(item.id) === Number(assignmentId))
    return assignment?.title || ""
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

    const csvRows = [["class_name", "student_name", "student_email", "parent_email", "student_id"]]

    rows.slice(1).forEach((row) => {
      const studentName = String(row[studentNameIndex] || "").trim()
      const studentEmail = String(row[studentEmailIndex] || "").trim()

      if (!studentName || !studentEmail) return

      csvRows.push([
        courseName,
        studentName,
        studentEmail,
        parentEmailIndex === -1 ? "" : row[parentEmailIndex],
        studentIdIndex === -1 ? "" : row[studentIdIndex],
      ])
    })

    if (csvRows.length < 2) throw new Error("No valid student rows found in spreadsheet.")

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

      if (!firstSheetName) throw new Error("Spreadsheet does not contain a sheet.")

      const worksheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" })

      const courseName = getCourseName(course)
      const nextCsvText = convertRowsToCourseCsv(rows, courseName)

      setCourseImportCsvText(nextCsvText)
      setMessage(`Loaded ${file.name}. Students will import into ${courseName}.`)
    } catch (err) {
      setError(err.message || "Failed to read spreadsheet.")
      setCourseImportFileName("")
    }
  }

  async function duplicateCourse(course) {
    const courseId = Number(course?.id || 0)
    const currentTitle = getCourseName(course)
    const defaultTitle = currentTitle.endsWith(" Copy") ? `${currentTitle} 2` : `${currentTitle} Copy`

    if (!courseId) {
      setError("Valid course is required.")
      setMessage("")
      return
    }

    const requestedTitle = window.prompt(
      "New duplicated course name:",
      defaultTitle
    )

    if (requestedTitle === null) return

    const title = String(requestedTitle || "").trim()

    if (!title) {
      setError("Duplicated course name is required.")
      setMessage("")
      return
    }

    const confirmed = window.confirm(
      `Duplicate course "${currentTitle}" as "${title}"?\n\nThis will copy course structure, Grading Pathways, Evidence Tiers, assignments, and exam sections.\n\nIt will not copy students, grades, submissions, rubric scores, or student work.`
    )

    if (!confirmed) return

    try {
      setDuplicatingCourseId(courseId)
      setError("")
      setMessage("")

      const res = await fetch(`${API_BASE}/api/courses/${courseId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to duplicate course")
      }

      setMessage(
        `Course duplicated: ${data.course?.title || title}. Copied ${data.copied?.categories || 0} pathways, ${data.copied?.subcategories || 0} evidence tiers, ${data.copied?.assignments || 0} assignments, and ${data.copied?.assignment_sections || 0} exam sections.`
      )

      await loadCourses()

      if (data.course?.id) {
        window.localStorage.setItem("super-lms-last-course-id", String(data.course.id))
        window.history.replaceState(null, "", `/courses?courseId=${data.course.id}`)
      }
    } catch (err) {
      setError(err.message || "Failed to duplicate course")
    } finally {
      setDuplicatingCourseId(null)
    }
  }

  function beginEditCourse(course) {
    setEditingCourseId(course.id)
    setEditCourseTitle(getCourseName(course))
    setEditCourseDescription(course.description || "")
    setEditCourseTeacherEmail(course.teacher_email || "")
    setEditCourseType(course.course_type || "custom_competency")
    setError("")
    setMessage("")
  }

  function cancelEditCourse() {
    setEditingCourseId(null)
    setEditCourseTitle("")
    setEditCourseDescription("")
    setEditCourseTeacherEmail("")
    setEditCourseType("custom_competency")
  }

  async function saveCourse(courseId) {
    const cleanTitle = String(editCourseTitle || "").trim()
    const cleanDescription = String(editCourseDescription || "").trim()
    const cleanTeacherEmail = String(editCourseTeacherEmail || "").trim().toLowerCase()
    const cleanCourseType = String(editCourseType || "custom_competency").trim()

    if (!cleanTitle) {
      setError("Course title is required.")
      setMessage("")
      return
    }

    try {
      setSavingCourseId(courseId)
      setError("")
      setMessage("")

      const res = await fetch(`${API_BASE}/api/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          description: cleanDescription,
          teacher_email: cleanTeacherEmail,
          course_type: cleanCourseType,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to update course")
      }

      setMessage(`Course updated: ${data.title || cleanTitle}`)
      cancelEditCourse()
      await loadCourses()
    } catch (err) {
      setError(err.message || "Failed to update course")
    } finally {
      setSavingCourseId(null)
    }
  }

  async function createCourse(event) {
    event.preventDefault()

    const cleanTitle = String(newCourseTitle || "").trim()
    const cleanDescription = String(newCourseDescription || "").trim()
    const cleanTeacherEmail = String(newCourseTeacherEmail || "").trim().toLowerCase()
    const cleanCourseType = String(newCourseType || "custom_competency").trim()

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
          course_type: cleanCourseType,
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Failed to create course")

      const createdCourseId = data?.id || data?.course?.id || null

      setNewCourseTitle("")
      setNewCourseDescription("")
      setNewCourseTeacherEmail("")
      setNewCourseType("custom_competency")
      setShowCreateCourse(false)
      setMessage(`Course created: ${data.title || data?.course?.title || cleanTitle}`)

      if (createdCourseId) {
        window.localStorage.setItem("super-lms-last-course-id", String(createdCourseId))
        setTeacherCoachGuide("first_course")
        setTeacherCoachStep(1)
        setTeacherCoachOpen(true)
      }

      await loadCourses()

      if (createdCourseId) {
        await loadCompetencies(createdCourseId, { forceOpen: true })
        window.setTimeout(() => {
          const target = document.getElementById(`course-${createdCourseId}`)
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        }, 400)
      }
    } catch (err) {
      setError(err.message || "Failed to create course")
    } finally {
      setCreatingCourse(false)
    }
  }

  async function saveCourseStructureAsTemplate(course) {
    const courseName = getCourseName(course)
    const defaultTemplateName = `${courseName} Structure`

    const templateName = window.prompt(
      "Template name:",
      defaultTemplateName
    )

    if (templateName === null) {
      return
    }

    const cleanTemplateName = String(templateName || "").trim()

    if (!cleanTemplateName) {
      setError("Template name is required.")
      setMessage("")
      return
    }

    const templateDescription = window.prompt(
      "Template description:",
      `Saved from ${courseName}`
    )

    if (templateDescription === null) {
      return
    }

    try {
      setSavingTemplateCourseId(course.id)
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/courses/${course.id}/save-structure-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_name: cleanTemplateName,
          template_description: String(templateDescription || "").trim(),
          teacher_email: course.teacher_email || "",
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to save course structure as template")
      }

      setMessage(
        `Template saved: ${data.template?.template_name || cleanTemplateName}. ` +
        `${data.category_count || 0} pathways and ${data.subcategory_count || 0} evidence tiers saved.`
      )
    } catch (err) {
      setError(err.message || "Failed to save course structure as template")
    } finally {
      setSavingTemplateCourseId(null)
    }
  }


  async function importCsvText(csvTextToImport, options = {}) {
    const cleanCsvText = String(csvTextToImport || "").trim()

    if (!cleanCsvText) throw new Error("Paste roster CSV text before importing students.")

    const res = await fetch(`${API_BASE}/api/import/class-from-csv-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csvText: cleanCsvText }),
    })

    const data = await res.json()

    if (!res.ok) throw new Error(data.error || "Failed to import roster")

    setMessage(
      `Roster imported for ${data.className || options.courseName || "course"}. Created students: ${
        data.createdStudents || 0
      }. Enrolled students: ${data.enrolledStudents || 0}. Updated roles: ${data.updatedStudentRoles || 0}.`
    )

    setRosterByCourseId({})
    await loadCourses()

    if (options.courseId) await loadRoster(options.courseId, { forceOpen: true })
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


  async function enrollFromMasterDirectory(course, currentGrade = 11) {
    const courseId = Number(course?.id || 0)
    const courseName = course?.title || "this course"

    if (!courseId) {
      setError("Valid course is required.")
      setMessage("")
      return
    }

    const confirmed = window.confirm(
      `Enroll current Grade ${currentGrade} students from the Master Directory into ${courseName}?\\n\\nThis will create/update student user accounts and add them to this course roster.`
    )

    if (!confirmed) return

    try {
      setCourseImportingCourseId(courseId)
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/courses/${courseId}/enroll-from-master-directory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_grade: currentGrade }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to enroll students from Master Directory")
      }

      setMessage(
        `Master Directory enrollment complete: processed ${data.processed_master_students || 0}, created ${data.created_users || 0} users, updated ${data.updated_users || 0} users, enrolled ${data.enrolled_students || 0} students, skipped ${data.skipped_missing_email || 0} missing/invalid emails.`
      )

      await loadRoster(courseId)
    } catch (err) {
      setError(err.message || "Failed to enroll students from Master Directory")
    } finally {
      setCourseImportingCourseId(null)
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

      if (!res.ok) throw new Error(data.error || "Failed to load course roster")

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

      if (!res.ok) throw new Error(data.error || "Failed to load Learning Path items")

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

      if (!res.ok) throw new Error(data.error || "Failed to load learning paths")

      const nextLearningPaths = Array.isArray(data.learning_paths) ? data.learning_paths : []

      setLearningPathsByCourseId((current) => ({
        ...current,
        [courseId]: nextLearningPaths,
      }))

      setActiveLearningPathCourseId(courseId)

      await loadAssignments()
      await Promise.all(nextLearningPaths.map((learningPath) => loadLearningPathItems(learningPath.id)))
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
        body: JSON.stringify({ title, description }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Failed to create learning path")

      setNewLearningPathTitleByCourseId((current) => ({ ...current, [courseId]: "" }))
      setNewLearningPathDescriptionByCourseId((current) => ({ ...current, [courseId]: "" }))

      setMessage(`Learning Path created for ${getCourseName(course)}: ${data.learning_path?.title || title}`)

      await loadLearningPaths(courseId, { forceOpen: true })
    } catch (err) {
      setError(err.message || "Failed to create learning path")
    } finally {
      setCreatingLearningPathCourseId(null)
    }
  }



  async function duplicateLearningPath(courseId, learningPath) {
    const learningPathId = Number(learningPath?.id || 0)
    const currentTitle = String(learningPath?.title || "Learning Path").trim()
    const defaultTitle = currentTitle.endsWith(" Copy") ? `${currentTitle} 2` : `${currentTitle} Copy`

    if (!courseId || !learningPathId) {
      setError("Valid course and Learning Path are required.")
      setMessage("")
      return
    }

    const requestedTitle = window.prompt("New duplicated Learning Path name:", defaultTitle)

    if (requestedTitle === null) {
      return
    }

    const title = String(requestedTitle || "").trim()

    if (!title) {
      setError("Duplicated Learning Path name is required.")
      setMessage("")
      return
    }

    const confirmed = window.confirm(
      `Duplicate Learning Path "${currentTitle}" as "${title}"?\n\nThis will copy the Learning Path and its items.\n\nLinked assignments will stay connected to the same assignment records.`
    )

    if (!confirmed) return

    try {
      setDuplicatingLearningPathId(learningPathId)
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/learning-paths/${learningPathId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to duplicate Learning Path")
      }

      setMessage(
        `Learning Path duplicated: ${data.learning_path?.title || title}. Copied ${data.copied?.items || 0} item${Number(data.copied?.items || 0) === 1 ? "" : "s"}.`
      )

      await loadLearningPaths(courseId, { forceOpen: true })
    } catch (err) {
      setError(err.message || "Failed to duplicate Learning Path")
    } finally {
      setDuplicatingLearningPathId(null)
    }
  }

  async function moveLearningPath(courseId, learningPathId, direction) {
    if (!courseId || !learningPathId || !["up", "down"].includes(direction)) {
      setError("Valid Learning Path and move direction are required.")
      setMessage("")
      return
    }

    try {
      setMovingLearningPathKey(`${learningPathId}-${direction}`)
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/learning-paths/${learningPathId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to move Learning Path")
      }

      setMessage(
        data.moved
          ? `Learning Path moved ${direction}.`
          : data.reason || "Learning Path order unchanged."
      )

      await loadLearningPaths(courseId, { forceOpen: true })
    } catch (err) {
      setError(err.message || "Failed to move Learning Path")
    } finally {
      setMovingLearningPathKey(null)
    }
  }

  async function deleteLearningPath(courseId, learningPath) {
    const confirmDelete = window.confirm(`Delete the Learning Path "${learningPath.title}"?`)
    if (!confirmDelete) return

    try {
      setDeletingLearningPathId(learningPath.id)
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/learning-paths/${learningPath.id}`, { method: "DELETE" })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Failed to delete learning path")

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
    const nextNumber =
      currentItems.filter((item) => String(item.item_type || item.type || "").toLowerCase() === itemType).length + 1
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
          resource_url: "",
          sort_order: currentItems.length + 1,
          is_required: true,
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Failed to create Learning Path item")

      setMessage(`${label} added to ${learningPath.title}.`)
      await loadLearningPathItems(learningPath.id)
    } catch (err) {
      setError(err.message || "Failed to create Learning Path item")
    } finally {
      setCreatingItemKey(null)
    }
  }



  async function createLearningPathLesson(course, learningPath) {
    const courseId = Number(course?.id || 0)
    const learningPathId = Number(learningPath?.id || 0)

    if (!courseId || !learningPathId) {
      setError("Valid course and Learning Path are required.")
      setMessage("")
      return
    }

    try {
      setCreatingItemKey(`${learningPathId}-lesson`)
      setMessage("")
      setError("")

      const title = window.prompt("Lesson title:", "New Learning Path Lesson")

      if (title === null) {
        return
      }

      const cleanTitle = String(title || "").trim()

      if (!cleanTitle) {
        setError("Lesson title is required.")
        setMessage("")
        return
      }

      const content = window.prompt("Optional lesson content:", "") || ""

      const res = await fetch(`${API_BASE}/api/learning-paths/${learningPathId}/create-lesson`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          content: String(content || "").trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create Learning Path lesson")
      }

      await loadLearningPathItems(learningPathId)

      setMessage(`Lesson created and linked to Learning Path: ${data.lesson?.title || cleanTitle}`)

      window.location.href = "/lessons"
    } catch (err) {
      setError(err.message || "Failed to create Learning Path lesson")
    } finally {
      setCreatingItemKey(null)
    }
  }

  async function createLearningPathAssignment(course, learningPath) {
    const courseId = Number(course?.id || 0)
    const learningPathId = Number(learningPath?.id || 0)

    if (!courseId || !learningPathId) {
      setError("Valid course and Learning Path are required.")
      setMessage("")
      return
    }

    try {
      setCreatingItemKey(`${learningPathId}-assignment`)
      setMessage("")
      setError("")

      const title = window.prompt("Assignment title:", "New Learning Path Assignment")

      if (title === null) {
        return
      }

      const cleanTitle = String(title || "").trim()

      if (!cleanTitle) {
        setError("Assignment title is required.")
        setMessage("")
        return
      }

      const categoriesRes = await fetch(`${API_BASE}/api/courses/${courseId}/categories`)
      const categoriesData = await categoriesRes.json()

      if (!categoriesRes.ok) {
        throw new Error(categoriesData.error || "Failed to load grading pathways")
      }

      const categories = Array.isArray(categoriesData) ? categoriesData : []
      const tierOptions = []

      for (const category of categories) {
        const tiersRes = await fetch(`${API_BASE}/api/categories/${category.id}/subcategories`)
        const tiersData = await tiersRes.json()

        if (!tiersRes.ok) {
          throw new Error(tiersData.error || "Failed to load evidence tiers")
        }

        const tiers = Array.isArray(tiersData) ? tiersData : []

        tiers.forEach((tier) => {
          tierOptions.push({
            id: tier.id,
            label: `${category.name || "Assessment Pathway"} → ${tier.name || "Evidence Tier"}`,
          })
        })
      }

      if (tierOptions.length === 0) {
        setError("Create at least one Grading Pathway and Evidence Tier before adding a Learning Path assignment.")
        setMessage("")
        return
      }

      const tierList = tierOptions
        .map((tier, index) => `${index + 1}. ${tier.label}`)
        .join("\n")

      const selectedText = window.prompt(
        `Choose the Evidence Tier number for this assignment:\n\n${tierList}`,
        "1"
      )

      if (selectedText === null) {
        return
      }

      const selectedIndex = Number(selectedText) - 1
      const selectedTier = tierOptions[selectedIndex]

      if (!selectedTier) {
        setError("Valid Evidence Tier number is required.")
        setMessage("")
        return
      }

      const description = window.prompt("Optional assignment description:", "") || ""

      const res = await fetch(`${API_BASE}/api/learning-paths/${learningPathId}/create-assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: cleanTitle,
          description: String(description || "").trim(),
          subcategory_id: selectedTier.id,
          teacher_id: user?.id || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create Learning Path assignment")
      }

      await loadAssignments()
      await loadLearningPathItems(learningPathId)

      setMessage(`Assignment created and linked to Learning Path: ${data.assignment?.title || cleanTitle}`)

      if (data.assignment?.id) {
        window.location.href = `/assignments/${data.assignment.id}/edit`
      }
    } catch (err) {
      setError(err.message || "Failed to create Learning Path assignment")
    } finally {
      setCreatingItemKey(null)
    }
  }

  function startEditingLearningPathItem(item) {
    setEditingItemId(item.id)
    setEditItemDraftById((current) => ({
      ...current,
      [item.id]: {
        item_type: item.item_type || item.type || "lesson",
        title: item.title || item.name || "",
        description: item.description || "",
        resource_url: item.resource_url || "",
        assignment_id: item.assignment_id || "",
        sort_order: item.sort_order || 1,
        is_required: item.is_required === undefined ? true : Boolean(item.is_required),
      },
    }))
    setMessage("")
    setError("")
  }

  function updateItemDraft(itemId, field, value) {
    setEditItemDraftById((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] || {}),
        [field]: value,
      },
    }))
  }

  function cancelEditingLearningPathItem(itemId) {
    setEditingItemId(null)
    setEditItemDraftById((current) => {
      const next = { ...current }
      delete next[itemId]
      return next
    })
  }

  async function saveLearningPathItem(learningPathId, item) {
    const draft = editItemDraftById[item.id] || {}
    const title = String(draft.title || "").trim()

    if (!title) {
      setError("Item title is required.")
      setMessage("")
      return
    }

    try {
      setSavingItemId(item.id)
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/learning-path-items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_type: draft.item_type || item.item_type || "lesson",
          title,
          description: String(draft.description || "").trim(),
          resource_url: String(draft.resource_url || "").trim(),
          assignment_id: draft.assignment_id ? Number(draft.assignment_id) : null,
          sort_order: draft.sort_order ? Number(draft.sort_order) : item.sort_order || 1,
          is_required: draft.is_required === undefined ? true : Boolean(draft.is_required),
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Failed to save Learning Path item")

      setEditingItemId(null)
      setEditItemDraftById((current) => {
        const next = { ...current }
        delete next[item.id]
        return next
      })

      setMessage(`Saved item: ${data.item?.title || title}`)
      await loadLearningPathItems(learningPathId)
    } catch (err) {
      setError(err.message || "Failed to save Learning Path item")
    } finally {
      setSavingItemId(null)
    }
  }


  async function moveLearningPathItem(learningPathId, itemId, direction) {
    if (!learningPathId || !itemId || !["up", "down"].includes(direction)) {
      setError("Valid Learning Path item and move direction are required.")
      setMessage("")
      return
    }

    try {
      setMovingLearningPathItemKey(`${itemId}-${direction}`)
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/learning-path-items/${itemId}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to move Learning Path item")
      }

      setMessage(
        data.moved
          ? `Learning Path item moved ${direction}.`
          : data.reason || "Learning Path item order unchanged."
      )

      await loadLearningPathItems(learningPathId)
    } catch (err) {
      setError(err.message || "Failed to move Learning Path item")
    } finally {
      setMovingLearningPathItemKey(null)
    }
  }

  async function deleteLearningPathItem(learningPathId, item) {
    const confirmDelete = window.confirm(`Delete the item "${item.title || item.name || "Untitled item"}"?`)
    if (!confirmDelete) return

    try {
      setDeletingItemId(item.id)
      setMessage("")
      setError("")

      const res = await fetch(`${API_BASE}/api/learning-path-items/${item.id}`, { method: "DELETE" })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Failed to delete Learning Path item")

      setMessage(`Deleted item: ${data.deleted?.title || item.title || "Learning Path item"}`)
      await loadLearningPathItems(learningPathId)
    } catch (err) {
      setError(err.message || "Failed to delete Learning Path item")
    } finally {
      setDeletingItemId(null)
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

      if (!res.ok) throw new Error(data.error || "Setup failed")

      setMessage(
        `KDU assessment structure created for ${data.course?.title || "course"}: ${data.assessment_group_count} groups, total weight ${data.total_weight}%.`
      )

      window.localStorage.setItem("super-lms-last-course-id", String(courseId))
      await loadCourses()
      await loadCompetencies(courseId, { forceOpen: true })

      window.setTimeout(() => {
        const target = document.getElementById(`course-${courseId}`)
        if (target) {
          target.scrollIntoView({ behavior: "auto", block: "start" })
        }
      }, 250)
    } catch (err) {
      setError(err.message || "Failed to set up KDU structure")
    } finally {
      setSettingUpCourseId(null)
    }
  }

  async function forceSetupKdu(courseId) {
    const confirmReplace = window.confirm("This will replace existing assessment groups for this course. Continue?")
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

      if (!res.ok) throw new Error(data.error || "Reset failed")

      setMessage(
        `KDU assessment structure replaced for ${data.course?.title || "course"}: ${data.assessment_group_count} groups.`
      )

      window.localStorage.setItem("super-lms-last-course-id", String(courseId))
      await loadCourses()
      await loadCompetencies(courseId, { forceOpen: true })

      window.setTimeout(() => {
        const target = document.getElementById(`course-${courseId}`)
        if (target) {
          target.scrollIntoView({ behavior: "auto", block: "start" })
        }
      }, 250)
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
                  placeholder="Insert Course Title Here"
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
                <label style={labelStyle}>Course Type</label>
                <select
                  value={newCourseType}
                  onChange={(event) => setNewCourseType(event.target.value)}
                  style={inputStyle}
                >
                  <option value="english_11_template">English 11 Competency Template</option>
                  <option value="english_12_template">English 12 Competency Template</option>
                  <option value="custom_competency">Start Blank / Custom Course</option>
                </select>
                <div style={{ marginTop: "6px", fontSize: "0.9rem", color: "#4b5563", lineHeight: 1.45 }}>
                  Template courses automatically create Grading Pathways and Evidence Tiers. Blank courses let you build your own structure.
                </div>
              </div>

              <div
                style={{
                  border: "1px solid #d7dce5",
                  borderRadius: "12px",
                  padding: "14px",
                  background: "#f8fafc",
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: "8px" }}>
                  Assessment Structure Setup
                </h3>
                <p style={{ marginTop: 0, color: "#4b5563", lineHeight: 1.5 }}>
                  After creating the course, build the grading structure using Grading Pathways and Evidence Tiers.
                </p>
                <div style={{ display: "grid", gap: "6px", color: "#111827", lineHeight: 1.45 }}>
                  <div><strong>Grading Pathways</strong> hold the main weighted areas of the course.</div>
                  <div><strong>Evidence Tiers</strong> hold the assignment buckets inside each pathway.</div>
                  <div><strong>Assignments</strong> are created inside a pathway and evidence tier.</div>
                </div>
                <p style={{ marginBottom: 0, color: "#4b5563", lineHeight: 1.5 }}>
                  Example: Financial Literacy 40% → Major Assessments 70% → Budget Project.
                </p>
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
      setNewCourseType("custom_competency")
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

            <textarea value={bulkCsvText} onChange={(event) => setBulkCsvText(event.target.value)} rows="9" style={textareaStyle} />

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
              <button type="submit" disabled={bulkImportingRoster} style={primaryButtonStyle}>
                {bulkImportingRoster ? "Importing..." : "Bulk Import Students"}
              </button>

              <button type="button" disabled={bulkImportingRoster} onClick={() => setBulkCsvText(buildSampleCsv())} style={buttonStyle}>
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
              const isCompetenciesOpen = activeCompetencyCourseId === course.id
              const courseCompetencies = competenciesByCourseId[course.id] || []
              const assessmentPathwayTotal = courseCompetencies.reduce(
                (sum, pathway) => sum + Number(pathway.weight_percent || 0),
                0
              )
              const assessmentPathwayDifference = Math.round((100 - assessmentPathwayTotal) * 100) / 100
              const totalEvidenceTiers = courseCompetencies.reduce(
                (sum, pathway) => sum + (pathway.subcategories?.length || 0),
                0
              )

              const courseName = getCourseName(course)
              const learningPaths = learningPathsByCourseId[course.id] || []
              const courseAssignments = getAssignmentsForCourse(course.id)

              const displayedStudentCount = Number(course.student_count ?? rosterStudents.length ?? 0)
              const hasStudents = displayedStudentCount > 0
              const hasAssignments = courseAssignments.length > 0
              const hasAssessmentPathways = courseCompetencies.length > 0
              const pathwaysComplete = assessmentPathwayTotal === 100
              const hasEvidenceTiers = totalEvidenceTiers > 0
              const readinessScore =
                (hasAssessmentPathways ? 20 : 0) +
                (pathwaysComplete ? 20 : 0) +
                (hasEvidenceTiers ? 20 : 0) +
                (hasAssignments ? 20 : 0) +
                (hasStudents ? 20 : 0)
              const readinessLabel =
                readinessScore === 100
                  ? "Ready For Teaching"
                  : readinessScore >= 80
                    ? "Almost Ready"
                    : readinessScore >= 60
                      ? "Needs a Few More Steps"
                      : readinessScore >= 40
                        ? "Basic Setup Started"
                        : "Setup Just Started"

              return (
                <div
                  id={`course-${course.id}`}
                  key={course.id}
                  style={courseCardStyle}
                >
                  {editingCourseId === course.id ? (
                    <div
                      style={{
                        border: "1px solid #d7dce5",
                        borderRadius: "12px",
                        padding: "14px",
                        marginBottom: "14px",
                        background: "#f8fafc",
                      }}
                    >
                      <h2 style={{ marginTop: 0, marginBottom: "12px" }}>Edit Course</h2>

                      <div style={{ display: "grid", gap: "12px" }}>
                        <div>
                          <label style={labelStyle}>Course Title</label>
                          <input
                            value={editCourseTitle}
                            onChange={(event) => setEditCourseTitle(event.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Description</label>
                          <textarea
                            value={editCourseDescription}
                            onChange={(event) => setEditCourseDescription(event.target.value)}
                            rows="3"
                            style={textareaStyle}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Course Type</label>
                          <select
                            value={editCourseType}
                            onChange={(event) => setEditCourseType(event.target.value)}
                            style={inputStyle}
                          >
                            <option value="english_11_template">English 11 Competency Template</option>
                            <option value="english_12_template">English 12 Competency Template</option>
                            <option value="custom_competency">Start Blank / Custom Course</option>
                          </select>
                        </div>

                        <div>
                          <label style={labelStyle}>Teacher Email</label>
                          <input
                            value={editCourseTeacherEmail}
                            onChange={(event) => setEditCourseTeacherEmail(event.target.value)}
                            placeholder="Optional. Example: teacher@school.ca"
                            style={inputStyle}
                          />
                        </div>

                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => saveCourse(course.id)}
                            disabled={savingCourseId === course.id}
                            style={primaryButtonStyle}
                          >
                            {savingCourseId === course.id ? "Saving..." : "Save Course Changes"}
                          </button>

                          <button
                            type="button"
                            onClick={cancelEditCourse}
                            disabled={savingCourseId === course.id}
                            style={buttonStyle}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2 style={{ marginTop: 0, marginBottom: "8px" }}>{courseName}</h2>

                      {course.description ? (
                        <div style={{ marginBottom: "10px", color: "#4b5563", lineHeight: 1.5 }}>{course.description}</div>
                      ) : null}

                      <div style={{ marginBottom: "14px", color: "#4b5563" }}>Course ID: {course.id}</div>

                      <div
                        style={{
                          border: "1px solid #d7dce5",
                          borderRadius: "12px",
                          padding: "14px",
                          marginBottom: "14px",
                          background: "#f8fafc",
                        }}
                      >
                        <div style={{ fontWeight: 800, marginBottom: "10px" }}>
                          Course Status
                        </div>

                        <div style={{ display: "grid", gap: "6px", lineHeight: 1.45 }}>
                          <div><strong>Students:</strong> {displayedStudentCount}</div>
                          <div><strong>Grading Pathways:</strong> {courseCompetencies.length}</div>
                          <div><strong>Evidence Tiers:</strong> {totalEvidenceTiers}</div>
                          <div><strong>Assignments:</strong> {courseAssignments.length}</div>
                        </div>

                        <div style={{ marginTop: "12px", display: "grid", gap: "4px", lineHeight: 1.45 }}>
                          <div> {hasAssessmentPathways ? "☑" : "☐"} Grading Pathways Created</div>
                          <div> {pathwaysComplete ? "☑" : "☐"} Grading Pathways Total 100%</div>
                          <div> {hasEvidenceTiers ? "☑" : "☐"} Evidence Tiers Created</div>
                          <div> {hasAssignments ? "☑" : "☐"} Assignments Created</div>
                          <div> {hasStudents ? "☑" : "☐"} Students Imported</div>
                        </div>

                        <div style={{ marginTop: "12px", fontWeight: 800 }}>
                          {hasAssessmentPathways &&
                          pathwaysComplete &&
                          hasEvidenceTiers &&
                          hasAssignments &&
                          hasStudents
                            ? "✓ Ready For Teaching"
                            : "⚠ Setup Incomplete"}
                        </div>

                        <div
                          style={{
                            marginTop: "14px",
                            border: "1px solid #d7dce5",
                            borderRadius: "12px",
                            padding: "14px",
                            background: "#ffffff",
                          }}
                        >
                          <div style={{ fontWeight: 800, marginBottom: "8px" }}>
                            Course Health Check
                          </div>

                          <div
                            style={{
                              border: "1px solid #d7dce5",
                              borderRadius: "10px",
                              padding: "10px",
                              marginBottom: "10px",
                              background: "#f8fafc",
                              lineHeight: 1.45,
                            }}
                          >
                            <div style={{ fontWeight: 900 }}>
                              Course Readiness: {readinessScore}%
                            </div>
                            <div style={{ marginTop: "4px" }}>
                              {readinessLabel}
                            </div>
                            <div style={{ marginTop: "6px", color: "#4b5563" }}>
                              Each completed setup area is worth 20%: Pathways, 100% weighting, Evidence Tiers, Assignments, and Students.
                            </div>
                          </div>

                          <div style={{ display: "grid", gap: "6px", lineHeight: 1.45 }}>
                            {!hasAssessmentPathways ? (
                              <div>⚠ No Grading Pathways yet. Create pathways or apply a template.</div>
                            ) : pathwaysComplete ? (
                              <div>✓ Grading Pathway weights total 100%.</div>
                            ) : assessmentPathwayTotal < 100 ? (
                              <div>
                                ⚠ Grading Pathway weights total {assessmentPathwayTotal.toFixed(2)}%.
                                Add {(100 - assessmentPathwayTotal).toFixed(2)}% more.
                              </div>
                            ) : (
                              <div>
                                ⚠ Grading Pathway weights total {assessmentPathwayTotal.toFixed(2)}%.
                                Reduce by {(assessmentPathwayTotal - 100).toFixed(2)}%.
                              </div>
                            )}

                            {hasAssessmentPathways && courseCompetencies.some((category) => !Array.isArray(category.subcategories) || category.subcategories.length === 0) ? (
                              <div>
                                ⚠ Some Grading Pathways have no Evidence Tiers yet.
                              </div>
                            ) : hasEvidenceTiers ? (
                              <div>✓ Evidence Tiers are created.</div>
                            ) : (
                              <div>⚠ No Evidence Tiers yet.</div>
                            )}

                            {hasAssignments ? (
                              <div>✓ Assignments are created.</div>
                            ) : (
                              <div>⚠ No assignments yet. Create the first assignment after the structure is ready.</div>
                            )}

                            {hasStudents ? (
                              <div>✓ Students are imported.</div>
                            ) : (
                              <div>⚠ No students imported yet.</div>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            marginTop: "14px",
                            border: "1px solid #d7dce5",
                            borderRadius: "12px",
                            padding: "14px",
                            background: "#ffffff",
                          }}
                        >
                          <div style={{ fontWeight: 800, marginBottom: "8px" }}>
                            Course Setup Guide
                          </div>

                          <div style={{ display: "grid", gap: "8px", lineHeight: 1.5 }}>
                            <div>
                              <strong>Step 1:</strong> Create Grading Pathways. These are your major grading areas, such as Tests, Projects, Assignments, Exams, or KDU competency areas. Their weights should total 100%.
                            </div>

                            <div>
                              <strong>Step 2:</strong> Create Evidence Tiers inside each pathway. These are the assignment buckets where work will be placed, such as Major Evidence, Developing Evidence, Daily Evidence, or KDU Rubric Assessments.
                            </div>

                            <div>
                              <strong>Step 3:</strong> Create assignments and connect each assignment to an Evidence Tier.
                            </div>

                            <div>
                              <strong>Step 4:</strong> Import students, enter marks, and use the Gradebook to monitor progress.
                            </div>

                            <div style={{ marginTop: "4px", fontWeight: 700 }}>
                              Fast start: click Set Up Course Structure to generate a default competency framework automatically.
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <div style={{ flexBasis: "100%", fontWeight: 900, marginTop: "4px" }}>
                      Main Teacher Workflow
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        window.localStorage.setItem("super-lms-last-course-id", String(course.id))
                        window.history.replaceState(null, "", `/courses?courseId=${course.id}`)
                        loadLearningPaths(course.id)
                      }}
                      disabled={learningPathLoadingCourseId === course.id}
                      style={buttonStyle}
                    >
                      {learningPathLoadingCourseId === course.id ? "Loading Paths..." : isLearningPathsOpen ? "Hide Learning Paths" : "Learning Paths"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        window.localStorage.setItem("super-lms-last-course-id", String(course.id))
                        window.history.replaceState(null, "", `/courses?courseId=${course.id}`)
                        loadCompetencies(course.id)
                      }}
                      disabled={competencyLoadingCourseId === course.id}
                      style={buttonStyle}
                    >
                      {competencyLoadingCourseId === course.id ? "Loading Assessment Pathways..." : isCompetenciesOpen ? "Hide Assessment Pathways" : "Open Assessment Pathways"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        window.localStorage.setItem("super-lms-last-course-id", String(course.id))
                        navigate(`/course-assignments/${course.id}`)
                      }}
                      style={buttonStyle}
                    >
                      Current Assignments
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        window.localStorage.setItem("super-lms-last-course-id", String(course.id))
                        navigate(`/gradebook?classId=${course.id}`)
                      }}
                      style={buttonStyle}
                    >
                      Gradebook
                    </button>

                    <div style={{ flexBasis: "100%", fontWeight: 900, marginTop: "10px" }}>
                      Setup & Creation
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        window.localStorage.setItem("super-lms-last-course-id", String(course.id))
                        window.location.href = `/assignments?classId=${course.id}&section=create`
                      }}
                      style={buttonStyle}
                    >
                      + Create Assignment
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        window.localStorage.setItem("super-lms-last-course-id", String(course.id))
                        window.history.replaceState(null, "", `/courses?courseId=${course.id}`)
                        loadCompetencies(course.id, { forceOpen: true })
                      }}
                      disabled={competencyLoadingCourseId === course.id}
                      style={buttonStyle}
                    >
                      + Add Evidence Tier
                    </button>

                    <button type="button" onClick={() => setupKdu(course.id)} disabled={settingUpCourseId === course.id} style={buttonStyle}>
                      {settingUpCourseId === course.id ? "Setting up..." : "Set Up Course Structure"}
                    </button>

                    <div style={{ flexBasis: "100%", fontWeight: 900, marginTop: "10px" }}>
                      Students & Templates
                    </div>

                    <button type="button" onClick={() => {
                      window.localStorage.setItem("super-lms-last-course-id", String(course.id))
                        window.history.replaceState(null, "", `/courses?courseId=${course.id}`)
                      loadRoster(course.id)
                    }} disabled={rosterLoadingCourseId === course.id} style={buttonStyle}>
                      {rosterLoadingCourseId === course.id ? "Loading Roster..." : isRosterOpen ? "Hide Roster" : "View Roster"}
                    </button>

                    <button type="button" onClick={() => {
                      window.localStorage.setItem("super-lms-last-course-id", String(course.id))
                        window.history.replaceState(null, "", `/courses?courseId=${course.id}`)
                      openCourseImport(course)
                    }} disabled={courseImportingCourseId === course.id} style={buttonStyle}>
                      {isImportOpen ? "Close Import" : "Import Students"}
                    </button>

                    <button
                      type="button"
                      onClick={() => loadTemplateLibrary(course.id)}
                      disabled={templateLibraryLoading && activeTemplateLibraryCourseId === course.id}
                      style={buttonStyle}
                    >
                      {templateLibraryLoading && activeTemplateLibraryCourseId === course.id
                        ? "Loading Templates..."
                        : activeTemplateLibraryCourseId === course.id
                          ? "Hide Template Library"
                          : "Template Library"}
                    </button>

                    <button
                      type="button"
                      onClick={() => saveCourseStructureAsTemplate(course)}
                      disabled={savingTemplateCourseId === course.id}
                      style={buttonStyle}
                    >
                      {savingTemplateCourseId === course.id ? "Saving Template..." : "Save Structure as Template"}
                    </button>

                    <div style={{ flexBasis: "100%", fontWeight: 900, marginTop: "10px" }}>
                      Course Admin
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        window.localStorage.setItem("super-lms-last-course-id", String(course.id))
                        window.history.replaceState(null, "", `/courses?courseId=${course.id}`)
                        beginEditCourse(course)
                      }}
                      disabled={savingCourseId === course.id}
                      style={buttonStyle}
                    >
                      Edit Course
                    </button>

                    <button
                      type="button"
                      onClick={() => duplicateCourse(course)}
                      disabled={duplicatingCourseId === course.id}
                      style={buttonStyle}
                    >
                      {duplicatingCourseId === course.id ? "Duplicating Course..." : "Duplicate Course"}
                    </button>

                    <button type="button" onClick={() => forceSetupKdu(course.id)} disabled={settingUpCourseId === course.id} style={buttonStyle}>
                      Force Reset KDU
                    </button>
                  </div>

                  {activeTemplateLibraryCourseId === course.id ? (
                    <div style={learningPathBoxStyle}>
                      <h3 style={{ marginTop: 0, marginBottom: "8px" }}>Template Library</h3>

                      <p style={{ color: "#4b5563", lineHeight: 1.5 }}>
                        Reuse a saved course structure. Templates copy Grading Pathways,
                        Evidence Tiers, weights, and order. They do not copy students, grades,
                        submissions, or assignments.
                      </p>

                      {templateLibraryLoading ? (
                        <div>Loading templates...</div>
                      ) : courseStructureTemplates.length === 0 ? (
                        <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
                          No saved templates yet. Use Save Structure as Template on a course that already has Grading Pathways.
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: "12px" }}>
                          {courseStructureTemplates.map((template) => (
                            <div
                              key={template.id}
                              style={{
                                border: "1px solid #d7dce5",
                                borderRadius: "12px",
                                padding: "14px",
                                background: "#ffffff",
                              }}
                            >
                              <div style={{ fontWeight: 800, marginBottom: "6px" }}>
                                {template.template_name}
                              </div>

                              {template.template_description ? (
                                <div style={{ color: "#4b5563", lineHeight: 1.45, marginBottom: "8px" }}>
                                  {template.template_description}
                                </div>
                              ) : null}

                              <div style={{ display: "grid", gap: "4px", color: "#111827", lineHeight: 1.45 }}>
                                <div><strong>Grading Pathways:</strong> {template.category_count || 0}</div>
                                <div><strong>Evidence Tiers:</strong> {template.subcategory_count || 0}</div>
                                <div><strong>Created By:</strong> {template.created_by_teacher_email || "Unknown"}</div>
                              </div>

                              <div style={{ marginTop: "10px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewTemplateId((current) =>
                                      Number(current) === Number(template.id) ? null : template.id
                                    )
                                  }
                                  style={buttonStyle}
                                >
                                  {Number(previewTemplateId) === Number(template.id) ? "Hide Preview" : "Preview Template"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => applyCourseStructureTemplate(course, template)}
                                  disabled={applyingTemplateKey === `${course.id}-${template.id}`}
                                  style={buttonStyle}
                                >
                                  {applyingTemplateKey === `${course.id}-${template.id}` ? "Applying..." : "Apply Template"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deleteCourseStructureTemplate(template)}
                                  disabled={applyingTemplateKey === `${course.id}-${template.id}`}
                                  style={buttonStyle}
                                >
                                  Delete Template
                                </button>
                              </div>

                              {Number(previewTemplateId) === Number(template.id) ? (
                                <div
                                  style={{
                                    marginTop: "12px",
                                    border: "1px solid #d7dce5",
                                    borderRadius: "12px",
                                    padding: "12px",
                                    background: "#f8fafc",
                                  }}
                                >
                                  <div style={{ fontWeight: 900, marginBottom: "8px" }}>
                                    Template Preview
                                  </div>

                                  {!Array.isArray(template.categories) || template.categories.length === 0 ? (
                                    <div style={{ color: "#4b5563", lineHeight: 1.5 }}>
                                      This template does not have Grading Pathway details available.
                                    </div>
                                  ) : (
                                    <div style={{ display: "grid", gap: "10px" }}>
                                      {template.categories.map((category) => (
                                        <div
                                          key={category.id}
                                          style={{
                                            border: "1px solid #d7dce5",
                                            borderRadius: "10px",
                                            padding: "10px",
                                            background: "#ffffff",
                                          }}
                                        >
                                          <div style={{ fontWeight: 900 }}>
                                            {category.name}
                                          </div>
                                          <div style={{ color: "#4b5563", marginTop: "4px" }}>
                                            Pathway Weight: {Number(category.weight_percent || 0).toFixed(2)}%
                                          </div>

                                          {Array.isArray(category.subcategories) && category.subcategories.length > 0 ? (
                                            <div style={{ marginTop: "8px", display: "grid", gap: "6px" }}>
                                              {category.subcategories.map((subcategory) => (
                                                <div key={subcategory.id} style={{ lineHeight: 1.45 }}>
                                                  <strong>{subcategory.name}</strong>
                                                  {" — "}
                                                  {Number(subcategory.weight_percent_of_parent || 0).toFixed(2)}%
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <div style={{ marginTop: "8px", color: "#4b5563" }}>
                                              No Evidence Tiers saved in this pathway.
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {isCompetenciesOpen ? (
                    <div style={learningPathBoxStyle}>
                      <h3 style={{ marginTop: 0, marginBottom: "8px" }}>Grading Pathways</h3>

                      <p style={{ color: "#4b5563", lineHeight: 1.5 }}>
                        Grading Pathways are the weighted grading areas for your course.
                        Create Grading Pathways totaling 100%, then create Evidence Tiers inside each pathway.
                        Assignments are placed inside Evidence Tiers and graded using KDU assessments.
                      </p>

                      <div
                        style={{
                          border: "1px solid #d7dce5",
                          borderRadius: "12px",
                          padding: "14px",
                          marginBottom: "14px",
                          background: "#ffffff",
                        }}
                      >
                        <h4 style={{ marginTop: 0, marginBottom: "10px" }}>
                          Grading Pathway Weight Check
                        </h4>

                        <div style={{ display: "grid", gap: "6px", color: "#111827", lineHeight: 1.45 }}>
                          <div>
                            <strong>Current Total:</strong> {assessmentPathwayTotal.toFixed(2)}%
                          </div>

                          {courseCompetencies.length === 0 ? (
                            <div style={{ color: "#4b5563" }}>
                              Add grading pathways until the course total reaches 100%.
                            </div>
                          ) : assessmentPathwayTotal === 100 ? (
                            <div style={{ color: "#166534", fontWeight: 800 }}>
                              Assessment structure complete. Pathway weights equal 100%.
                            </div>
                          ) : assessmentPathwayTotal < 100 ? (
                            <div style={{ color: "#92400e", fontWeight: 800 }}>
                              {assessmentPathwayDifference.toFixed(2)}% still unallocated.
                            </div>
                          ) : (
                            <div style={{ color: "#991b1b", fontWeight: 800 }}>
                              Reduce pathway weights by {Math.abs(assessmentPathwayDifference).toFixed(2)}%.
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ border: "1px solid #d7dce5", borderRadius: "12px", padding: "14px", marginBottom: "14px", background: "#ffffff" }}>
                        <h4 style={{ marginTop: 0, marginBottom: "10px" }}>Add Grading Pathway</h4>
                        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 160px", gap: "10px" }}>
                          <div>
                            <label style={labelStyle}>Grading Pathway Name</label>
                            <input
                              value={newLearningCategoryNameByCourseId[course.id] || ""}
                              onChange={(event) =>
                                setNewLearningCategoryNameByCourseId((current) => ({
                                  ...current,
                                  [course.id]: event.target.value,
                                }))
                              }
                              placeholder="Example: Trigonometry"
                              style={inputStyle}
                            />
                          </div>

                          <div>
                            <label style={labelStyle}>Weight %</label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              step="1"
                              value={newLearningCategoryWeightByCourseId[course.id] || ""}
                              onChange={(event) =>
                                setNewLearningCategoryWeightByCourseId((current) => ({
                                  ...current,
                                  [course.id]: event.target.value,
                                }))
                              }
                              placeholder="25"
                              style={inputStyle}
                            />
                          </div>
                        </div>

                        <div style={{ marginTop: "12px" }}>
                          <button
                            type="button"
                            onClick={() => createLearningCategory(course.id)}
                            disabled={creatingLearningCategoryCourseId === course.id}
                            style={primaryButtonStyle}
                          >
                            {creatingLearningCategoryCourseId === course.id ? "Adding..." : "Add Grading Pathway"}
                          </button>
                        </div>
                      </div>

                      {courseCompetencies.length === 0 ? (
                        <div style={emptyStateStyle}>
                          <strong>No Grading Pathways Yet</strong>
                          <div style={{ marginTop: "6px", color: "#4b5563", lineHeight: 1.5 }}>
                            This custom competency course is ready for teacher-created grading pathways.
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: "12px" }}>
                          {courseCompetencies.map((category) => {
                            const evidenceTierTotal = category.subcategories.reduce(
                              (sum, tier) => sum + Number(tier.weight_percent_of_parent || 0),
                              0
                            )
                            const evidenceTierDifference = Math.round((100 - evidenceTierTotal) * 100) / 100

                            return (
                            <div
                              key={category.id}
                              id={`category-${category.id}`}
                              style={learningPathCardStyle}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                                <div style={{ minWidth: "260px", flex: "1 1 320px" }}>
                                  {editingLearningCategoryId === category.id ? (
                                    <div style={{ display: "grid", gap: "8px" }}>
                                      <input
                                        value={editLearningCategoryName}
                                        onChange={(event) => setEditLearningCategoryName(event.target.value)}
                                        style={inputStyle}
                                      />
                                      <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        step="1"
                                        value={editLearningCategoryWeight}
                                        onChange={(event) => setEditLearningCategoryWeight(event.target.value)}
                                        style={inputStyle}
                                      />
                                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                        <button
                                          type="button"
                                          onClick={() => saveLearningCategory(course.id, category.id)}
                                          disabled={savingLearningCategoryId === category.id}
                                          style={primaryButtonStyle}
                                        >
                                          {savingLearningCategoryId === category.id ? "Saving..." : "Save"}
                                        </button>
                                        <button type="button" onClick={cancelEditLearningCategory} style={buttonStyle}>
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <h4 style={{ marginTop: 0, marginBottom: "6px" }}>{category.name}</h4>
                                      <div style={{ color: "#4b5563" }}>
                                        Grading Pathway Weight: {category.weight_percent || "0.00"}%
                                      </div>
                                    </>
                                  )}
                                </div>
                                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                                  <div style={{ fontWeight: 800 }}>
                                    {category.subcategories.length} Evidence Tier{category.subcategories.length === 1 ? "" : "s"}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => moveLearningCategory(course.id, category.id, "up")}
                                    disabled={movingLearningCategoryId === `${category.id}-up`}
                                    style={{
                                      padding: "8px 10px",
                                      borderRadius: "10px",
                                      border: "1px solid #d7dce5",
                                      background: "#ffffff",
                                      font: "inherit",
                                      fontWeight: 800,
                                      cursor: movingLearningCategoryId === `${category.id}-up` ? "not-allowed" : "pointer",
                                      opacity: movingLearningCategoryId === `${category.id}-up` ? 0.7 : 1,
                                    }}
                                  >
                                    {movingLearningCategoryId === `${category.id}-up` ? "Moving..." : "↑ Move Up"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => moveLearningCategory(course.id, category.id, "down")}
                                    disabled={movingLearningCategoryId === `${category.id}-down`}
                                    style={{
                                      padding: "8px 10px",
                                      borderRadius: "10px",
                                      border: "1px solid #d7dce5",
                                      background: "#ffffff",
                                      font: "inherit",
                                      fontWeight: 800,
                                      cursor: movingLearningCategoryId === `${category.id}-down` ? "not-allowed" : "pointer",
                                      opacity: movingLearningCategoryId === `${category.id}-down` ? 0.7 : 1,
                                    }}
                                  >
                                    {movingLearningCategoryId === `${category.id}-down` ? "Moving..." : "↓ Move Down"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => beginEditLearningCategory(category)}
                                    disabled={editingLearningCategoryId === category.id}
                                    style={{
                                      padding: "8px 10px",
                                      borderRadius: "10px",
                                      border: "1px solid #d7dce5",
                                      background: "#ffffff",
                                      font: "inherit",
                                      fontWeight: 800,
                                      cursor: editingLearningCategoryId === category.id ? "not-allowed" : "pointer",
                                      opacity: editingLearningCategoryId === category.id ? 0.7 : 1,
                                    }}
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => duplicateLearningCategory(course.id, category)}
                                    disabled={duplicatingLearningCategoryId === category.id}
                                    style={{
                                      padding: "8px 10px",
                                      borderRadius: "10px",
                                      border: "1px solid #d7dce5",
                                      background: "#ffffff",
                                      font: "inherit",
                                      fontWeight: 800,
                                      cursor: duplicatingLearningCategoryId === category.id ? "not-allowed" : "pointer",
                                      opacity: duplicatingLearningCategoryId === category.id ? 0.7 : 1,
                                    }}
                                  >
                                    {duplicatingLearningCategoryId === category.id ? "Duplicating..." : "Duplicate"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => deleteLearningCategory(course.id, category)}
                                    disabled={deletingLearningCategoryId === category.id}
                                    style={{
                                      padding: "8px 10px",
                                      borderRadius: "10px",
                                      border: "1px solid #d1a1a1",
                                      background: "#fff1f1",
                                      font: "inherit",
                                      fontWeight: 800,
                                      cursor: deletingLearningCategoryId === category.id ? "not-allowed" : "pointer",
                                      opacity: deletingLearningCategoryId === category.id ? 0.7 : 1,
                                    }}
                                  >
                                    {deletingLearningCategoryId === category.id ? "Deleting..." : "Delete"}
                                  </button>
                                </div>

                              </div>


                              <div style={{
                                border: "1px solid #d7dce5",
                                borderRadius: "10px",
                                padding: "10px",
                                marginTop: "10px",
                                marginBottom: "10px",
                                background: "#ffffff"
                              }}>
                                <strong>Add Evidence Tier</strong>

                                <div style={{
                                  display: "grid",
                                  gridTemplateColumns: "minmax(0,1fr) 140px 140px",
                                  gap: "10px",
                                  marginTop: "10px"
                                }}>
                                  <input
                                    value={newEvidenceTierNameByCategoryId[category.id] || ""}
                                    onChange={(event) =>
                                      setNewEvidenceTierNameByCategoryId((current) => ({
                                        ...current,
                                        [category.id]: event.target.value,
                                      }))
                                    }
                                    placeholder="Evidence Tier Name"
                                    style={inputStyle}
                                  />

                                  <input
                                    type="number"
                                    value={newEvidenceTierWeightByCategoryId[category.id] || ""}
                                    onChange={(event) =>
                                      setNewEvidenceTierWeightByCategoryId((current) => ({
                                        ...current,
                                        [category.id]: event.target.value,
                                      }))
                                    }
                                    placeholder="Weight %"
                                    style={inputStyle}
                                  />

                                  <input
                                    type="number"
                                    value={newEvidenceTierLevelByCategoryId[category.id] || ""}
                                    onChange={(event) =>
                                      setNewEvidenceTierLevelByCategoryId((current) => ({
                                        ...current,
                                        [category.id]: event.target.value,
                                      }))
                                    }
                                    placeholder="Level"
                                    style={inputStyle}
                                  />
                                </div>

                                <div style={{ marginTop: "10px" }}>
                                  <button
                                    type="button"
                                    onClick={() => createEvidenceTier(course.id, category.id)}
                                    disabled={creatingEvidenceTierCategoryId === category.id}
                                    style={primaryButtonStyle}
                                  >
                                    {creatingEvidenceTierCategoryId === category.id ? "Adding..." : "Add Evidence Tier"}
                                  </button>
                                </div>
                              </div>

                              <div
                                style={{
                                  border: "1px solid #d7dce5",
                                  borderRadius: "10px",
                                  padding: "10px",
                                  marginTop: "10px",
                                  background: "#f8fafc",
                                }}
                              >
                                <strong>Evidence Tier Weight Check</strong>
                                <div style={{ marginTop: "6px", color: "#111827", lineHeight: 1.45 }}>
                                  <div>
                                    <strong>Current Total:</strong> {evidenceTierTotal.toFixed(2)}%
                                  </div>

                                  {category.subcategories.length === 0 ? (
                                    <div style={{ color: "#4b5563" }}>
                                      Add evidence tiers until this pathway total reaches 100%.
                                    </div>
                                  ) : evidenceTierTotal === 100 ? (
                                    <div style={{ color: "#166534", fontWeight: 800 }}>
                                      Evidence tier structure complete. Tier weights equal 100%.
                                    </div>
                                  ) : evidenceTierTotal < 100 ? (
                                    <div style={{ color: "#92400e", fontWeight: 800 }}>
                                      {evidenceTierDifference.toFixed(2)}% still unallocated.
                                    </div>
                                  ) : (
                                    <div style={{ color: "#991b1b", fontWeight: 800 }}>
                                      Reduce evidence tier weights by {Math.abs(evidenceTierDifference).toFixed(2)}%.
                                    </div>
                                  )}
                                </div>
                              </div>

                              {category.subcategories.length === 0 ? (
                                <div style={{ marginTop: "10px", color: "#4b5563" }}>
                                  No evidence tiers yet.
                                </div>
                              ) : (
                                <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
                                  {category.subcategories.map((tier) => (
                                    <div key={tier.id} style={learningPathCardStyle}>
                                      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                                        <div style={{ minWidth: "260px", flex: "1 1 320px" }}>
                                          {editingEvidenceTierId === tier.id ? (
                                            <div style={{ display: "grid", gap: "8px" }}>
                                              <input
                                                value={editEvidenceTierName}
                                                onChange={(event) => setEditEvidenceTierName(event.target.value)}
                                                style={inputStyle}
                                              />
                                              <input
                                                type="number"
                                                min="1"
                                                max="100"
                                                step="1"
                                                value={editEvidenceTierWeight}
                                                onChange={(event) => setEditEvidenceTierWeight(event.target.value)}
                                                style={inputStyle}
                                              />
                                              <input
                                                type="number"
                                                min="1"
                                                step="1"
                                                value={editEvidenceTierLevel}
                                                onChange={(event) => setEditEvidenceTierLevel(event.target.value)}
                                                style={inputStyle}
                                              />
                                              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                                <button
                                                  type="button"
                                                  onClick={() => saveEvidenceTier(course.id, tier.id)}
                                                  disabled={savingEvidenceTierId === tier.id}
                                                  style={primaryButtonStyle}
                                                >
                                                  {savingEvidenceTierId === tier.id ? "Saving..." : "Save"}
                                                </button>
                                                <button type="button" onClick={cancelEditEvidenceTier} style={buttonStyle}>
                                                  Cancel
                                                </button>
                                              </div>
                                            </div>
                                          ) : (
                                            <>
                                              <strong>{tier.name}</strong>
                                              <div style={{ color: "#4b5563", marginTop: "4px" }}>
                                                Tier Weight: {tier.weight_percent_of_parent || "0.00"}%
                                              </div>
                                              <div style={{ color: "#4b5563", marginTop: "6px", lineHeight: 1.45 }}>
                                                {String(tier.name || "").includes("Tier 1")
                                                  ? "Use for practice work, skill checks, daily activities, and foundational evidence."
                                                  : String(tier.name || "").includes("Tier 2")
                                                    ? "Use for assignments, projects, case studies, and application of learning."
                                                    : String(tier.name || "").includes("Tier 3")
                                                      ? "Use for unit tests, major projects, midterms, finals, and mastery evidence."
                                                      : "Use this tier to organize related assignments and evidence."}
                                              </div>
                                            </>
                                          )}
                                        </div>

                                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                          <button
                                            type="button"
                                            onClick={() => moveEvidenceTier(course.id, tier.id, "up")}
                                            disabled={movingEvidenceTierId === `${tier.id}-up`}
                                            style={buttonStyle}
                                          >
                                            {movingEvidenceTierId === `${tier.id}-up` ? "Moving..." : "↑ Move Up"}
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => moveEvidenceTier(course.id, tier.id, "down")}
                                            disabled={movingEvidenceTierId === `${tier.id}-down`}
                                            style={buttonStyle}
                                          >
                                            {movingEvidenceTierId === `${tier.id}-down` ? "Moving..." : "↓ Move Down"}
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => beginEditEvidenceTier(tier)}
                                            disabled={editingEvidenceTierId === tier.id}
                                            style={buttonStyle}
                                          >
                                            Edit
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => duplicateEvidenceTier(course.id, category.id, tier)}
                                            disabled={duplicatingEvidenceTierId === tier.id}
                                            style={buttonStyle}
                                          >
                                            {duplicatingEvidenceTierId === tier.id ? "Duplicating..." : "Duplicate"}
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => deleteEvidenceTier(course.id, tier)}
                                            disabled={deletingEvidenceTierId === tier.id}
                                            style={{
                                              padding: "8px 10px",
                                              borderRadius: "10px",
                                              border: "1px solid #d1a1a1",
                                              background: "#fff1f1",
                                              font: "inherit",
                                              fontWeight: 800,
                                              cursor: deletingEvidenceTierId === tier.id ? "not-allowed" : "pointer",
                                              opacity: deletingEvidenceTierId === tier.id ? 0.7 : 1,
                                            }}
                                          >
                                            {deletingEvidenceTierId === tier.id ? "Deleting..." : "Delete"}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {isLearningPathsOpen ? (
                    <div style={learningPathBoxStyle}>
                      <h3 style={{ marginTop: 0, marginBottom: "8px" }}>Learning Paths</h3>

                      <p style={{ color: "#4b5563", lineHeight: 1.5 }}>
                        Build teacher-friendly course sequences like units, chapters, weeks, or inquiry pathways.
                        This is SUPER LMS's better version of Canvas Modules.
                      </p>

                      {assignmentsLoading ? (
                        <div style={{ color: "#4b5563", marginBottom: "10px" }}>Loading assignments for linking...</div>
                      ) : null}

                      <div style={learningPathCreateGridStyle}>
                        <div>
                          <label style={labelStyle}>New Learning Path Title</label>
                          <input
                            value={newLearningPathTitleByCourseId[course.id] || ""}
                            onChange={(event) =>
                              setNewLearningPathTitleByCourseId((current) => ({ ...current, [course.id]: event.target.value }))
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
                                  <div style={{ fontWeight: 900, marginBottom: "4px" }}>{pathItem.title}</div>

                                  {pathItem.description ? (
                                    <div style={{ color: "#4b5563", lineHeight: 1.5 }}>{pathItem.description}</div>
                                  ) : (
                                    <div style={{ color: "#4b5563", lineHeight: 1.5 }}>No description yet.</div>
                                  )}

                                  <div style={{ marginTop: "6px", fontSize: "0.92rem", color: "#4b5563" }}>
                                    Status: {pathItem.is_published ? "Published" : "Draft"} · Order {pathItem.sort_order}
                                  </div>

                                  <div style={itemBuilderStyle}>
                                    <div style={{ fontWeight: 900, marginBottom: "8px" }}>Build this Learning Path</div>

                                    <div style={itemButtonRowStyle}>
                                      {["lesson", "assignment", "resource", "video", "quiz"].map((itemType) => {
                                        const label = getLearningPathItemLabel(itemType)
                                        const key = `${pathItem.id}-${itemType}`

                                        return (
                                          <button
                                            key={itemType}
                                            type="button"
                                            onClick={() => itemType === "assignment" ? createLearningPathAssignment(course, pathItem) : itemType === "lesson" ? createLearningPathLesson(course, pathItem) : createLearningPathItem(course.id, pathItem, itemType)}
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
                                      <div style={{ color: "#4b5563", marginTop: "8px" }}>Loading items...</div>
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
                                          const isEditing = editingItemId === item.id
                                          const draft = editItemDraftById[item.id] || {}
                                          const linkedAssignmentTitle = item.assignment_id ? getAssignmentTitle(item.assignment_id) : ""
                                          const linkedLessonTitle = item.lesson_id && String(itemType || "").toLowerCase() === "lesson" ? title : ""

                                          return (
                                            <div key={item.id || `${pathItem.id}-${index}`} style={itemRowStyle}>
                                              {isEditing ? (
                                                <div style={{ display: "grid", gap: "10px" }}>
                                                  <div style={itemTypePillStyle}>{label}</div>

                                                  <div>
                                                    <label style={labelStyle}>Title</label>
                                                    <input
                                                      value={draft.title || ""}
                                                      onChange={(event) => updateItemDraft(item.id, "title", event.target.value)}
                                                      style={inputStyle}
                                                    />
                                                  </div>

                                                  <div>
                                                    <label style={labelStyle}>Description</label>
                                                    <textarea
                                                      value={draft.description || ""}
                                                      onChange={(event) => updateItemDraft(item.id, "description", event.target.value)}
                                                      rows="3"
                                                      style={textareaStyle}
                                                    />
                                                  </div>

                                                  {String(draft.item_type || itemType).toLowerCase() === "assignment" ? (
                                                    <div>
                                                      <label style={labelStyle}>Linked Assignment</label>
                                                      <select
                                                        value={draft.assignment_id || ""}
                                                        onChange={(event) => {
                                                          const selectedId = event.target.value
                                                          const selectedAssignment = courseAssignments.find(
                                                            (assignment) => Number(assignment.id) === Number(selectedId)
                                                          )

                                                          updateItemDraft(item.id, "assignment_id", selectedId)

                                                          if (selectedAssignment && (!draft.title || draft.title === title)) {
                                                            updateItemDraft(item.id, "title", selectedAssignment.title)
                                                          }
                                                        }}
                                                        style={inputStyle}
                                                      >
                                                        <option value="">No assignment linked yet</option>
                                                        {courseAssignments.map((assignment) => (
                                                          <option key={assignment.id} value={assignment.id}>
                                                            {assignment.title}
                                                          </option>
                                                        ))}
                                                      </select>

                                                      {courseAssignments.length === 0 ? (
                                                        <div style={{ color: "#4b5563", marginTop: "6px", lineHeight: 1.5 }}>
                                                          No assignments found for this course yet.
                                                        </div>
                                                      ) : null}
                                                    </div>
                                                  ) : null}

                                                  <div>
                                                    <label style={labelStyle}>Resource URL</label>
                                                    <input
                                                      value={draft.resource_url || ""}
                                                      onChange={(event) => updateItemDraft(item.id, "resource_url", event.target.value)}
                                                      placeholder="Optional: paste a link for a video, file, website, or resource"
                                                      style={inputStyle}
                                                    />
                                                  </div>

                                                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                                    <button
                                                      type="button"
                                                      onClick={() => saveLearningPathItem(pathItem.id, item)}
                                                      disabled={savingItemId === item.id}
                                                      style={primaryButtonStyle}
                                                    >
                                                      {savingItemId === item.id ? "Saving..." : "Save Item"}
                                                    </button>

                                                    <button
                                                      type="button"
                                                      onClick={() => cancelEditingLearningPathItem(item.id)}
                                                      disabled={savingItemId === item.id}
                                                      style={buttonStyle}
                                                    >
                                                      Cancel
                                                    </button>
                                                  </div>
                                                </div>
                                              ) : (
                                                <>
                                                  <div style={itemTypePillStyle}>{label}</div>
                                                  <div style={{ fontWeight: 800 }}>{title}</div>

                                                  {linkedAssignmentTitle ? (
                                                    <div style={{ display: "grid", gap: "8px" }}>
                                                      <div style={linkedAssignmentStyle}>Linked assignment: {linkedAssignmentTitle}</div>

                                                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                                        <button
                                                          type="button"
                                                          onClick={() => { window.location.href = `/assignments/${item.assignment_id}/edit` }}
                                                          style={buttonStyle}
                                                        >
                                                          Open Edit Page
                                                        </button>

                                                        <button
                                                          type="button"
                                                          onClick={() => { window.location.href = `/assignments/${item.assignment_id}/grade` }}
                                                          style={buttonStyle}
                                                        >
                                                          Open Speed Grading
                                                        </button>
                                                      </div>
                                                    </div>
                                                  ) : null}

                                                  {linkedLessonTitle ? (
                                                    <div style={{ display: "grid", gap: "8px" }}>
                                                      <div style={linkedAssignmentStyle}>Linked lesson: {linkedLessonTitle}</div>

                                                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                                        <button
                                                          type="button"
                                                          onClick={() => { window.location.href = "/lessons" }}
                                                          style={buttonStyle}
                                                        >
                                                          Open Lessons Page
                                                        </button>
                                                      </div>
                                                    </div>
                                                  ) : null}

                                                  {item.description ? (
                                                    <div style={{ color: "#4b5563", lineHeight: 1.5 }}>{item.description}</div>
                                                  ) : null}

                                                  {item.resource_url ? (
                                                    <a href={item.resource_url} target="_blank" rel="noreferrer" style={resourceLinkStyle}>
                                                      Open Resource
                                                    </a>
                                                  ) : null}

                                                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                                    <button
                                                      type="button"
                                                      onClick={() => moveLearningPathItem(pathItem.id, item.id, "up")}
                                                      disabled={movingLearningPathItemKey === `${item.id}-up`}
                                                      style={buttonStyle}
                                                    >
                                                      {movingLearningPathItemKey === `${item.id}-up` ? "Moving..." : "↑ Move Up"}
                                                    </button>

                                                    <button
                                                      type="button"
                                                      onClick={() => moveLearningPathItem(pathItem.id, item.id, "down")}
                                                      disabled={movingLearningPathItemKey === `${item.id}-down`}
                                                      style={buttonStyle}
                                                    >
                                                      {movingLearningPathItemKey === `${item.id}-down` ? "Moving..." : "↓ Move Down"}
                                                    </button>

                                                    <button type="button" onClick={() => startEditingLearningPathItem(item)} style={buttonStyle}>
                                                      Edit
                                                    </button>

                                                    <button
                                                      type="button"
                                                      onClick={() => deleteLearningPathItem(pathItem.id, item)}
                                                      disabled={deletingItemId === item.id}
                                                      style={buttonStyle}
                                                    >
                                                      {deletingItemId === item.id ? "Deleting..." : "Delete Item"}
                                                    </button>
                                                  </div>
                                                </>
                                              )}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-start" }}>
                                  <button
                                    type="button"
                                    onClick={() => moveLearningPath(course.id, pathItem.id, "up")}
                                    disabled={movingLearningPathKey === `${pathItem.id}-up`}
                                    style={buttonStyle}
                                  >
                                    {movingLearningPathKey === `${pathItem.id}-up` ? "Moving..." : "↑ Move Up"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => moveLearningPath(course.id, pathItem.id, "down")}
                                    disabled={movingLearningPathKey === `${pathItem.id}-down`}
                                    style={buttonStyle}
                                  >
                                    {movingLearningPathKey === `${pathItem.id}-down` ? "Moving..." : "↓ Move Down"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => duplicateLearningPath(course.id, pathItem)}
                                    disabled={duplicatingLearningPathId === pathItem.id}
                                    style={buttonStyle}
                                  >
                                    {duplicatingLearningPathId === pathItem.id ? "Duplicating..." : "Duplicate"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => deleteLearningPath(course.id, pathItem)}
                                    disabled={deletingLearningPathId === pathItem.id}
                                    style={buttonStyle}
                                  >
                                    {deletingLearningPathId === pathItem.id ? "Deleting..." : "Delete"}
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {isImportOpen ? (
                    <div style={rosterBoxStyle}>
                      <h3 style={{ marginTop: 0, marginBottom: "8px" }}>Import Students into {courseName}</h3>

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

                      <div style={{ border: "1px solid #d7dce5", borderRadius: "12px", padding: "12px", background: "#f8fafc", marginTop: "12px", marginBottom: "12px" }}>
                        <div style={{ fontWeight: 900, marginBottom: "6px" }}>
                          Enroll From Master Directory
                        </div>

                        <div style={{ color: "#4b5563", lineHeight: 1.5, marginBottom: "10px" }}>
                          Use this after importing the Master Student Directory. For Pre-Calculus 11, this will enroll current Grade 11 students into this course roster.
                        </div>

                        <button
                          type="button"
                          onClick={() => enrollFromMasterDirectory(course, 11)}
                          disabled={courseImportingCourseId === course.id}
                          style={primaryButtonStyle}
                        >
                          {courseImportingCourseId === course.id ? "Enrolling..." : "Enroll Grade 11 From Master Directory"}
                        </button>
                      </div>

                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={(event) => handleCourseRosterFile(course, event.target.files?.[0])}
                        style={inputStyle}
                      />

                      {courseImportFileName ? (
                        <div style={{ marginTop: "8px", fontWeight: 800 }}>Loaded file: {courseImportFileName}</div>
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

                        <button type="button" disabled={courseImportingCourseId === course.id} onClick={() => setActiveImportCourseId(null)} style={buttonStyle}>
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

      <FloatingTeacherCoach
        open={teacherCoachOpen}
        guideKey={teacherCoachGuide}
        stepIndex={teacherCoachStep}
        recommendation={getTeacherCoachRecommendation()}
        onTakeMeThere={(recommendation) => {
          const targetCourseId = recommendation?.courseId

          if (!targetCourseId) {
            return
          }

          window.localStorage.setItem("super-lms-last-course-id", String(targetCourseId))
          window.history.replaceState(null, "", `/courses?courseId=${targetCourseId}`)

          const scrollToTargetCourse = () => {
            window.setTimeout(() => {
              const target = document.getElementById(`course-${targetCourseId}`)
              if (target) {
                target.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            }, 250)
          }

          if (recommendation?.target === "competencies") {
            loadCompetencies(targetCourseId, { forceOpen: true })
            scrollToTargetCourse()
          }

          if (recommendation?.target === "templates") {
            loadTemplateLibrary(targetCourseId)
            scrollToTargetCourse()
          }

          if (recommendation?.target === "import") {
            const targetCourse = courses.find((course) => Number(course.id) === Number(targetCourseId))
            if (targetCourse) {
              openCourseImport(targetCourse)
            }
            scrollToTargetCourse()
          }

          if (recommendation?.target === "assignments") {
            window.location.href = `/assignments?classId=${targetCourseId}`
          }
        }}
        onToggle={() => setTeacherCoachOpen((current) => !current)}
        onClose={() => setTeacherCoachOpen(false)}
        onSelectGuide={(nextGuideKey) => {
          setTeacherCoachGuide(nextGuideKey)
          setTeacherCoachStep(0)
          setTeacherCoachOpen(true)
        }}
        onBack={() => setTeacherCoachStep((current) => Math.max(0, current - 1))}
        onNext={(stepCount) =>
          setTeacherCoachStep((current) => Math.min(stepCount - 1, current + 1))
        }
        onRestart={() => setTeacherCoachStep(0)}
      />
    </div>
  )
}

function FloatingTeacherCoach({
  open,
  guideKey,
  stepIndex,
  recommendation,
  onTakeMeThere,
  onToggle,
  onClose,
  onSelectGuide,
  onBack,
  onNext,
  onRestart,
}) {
  const guides = {
    first_course: {
      title: "Set Up Your First Course",
      steps: [
        {
          title: "Create or choose a course",
          body: "Start by clicking Create Course, or open a course card that already exists. Give the course a clear name that matches the class you teach.",
          action: "Use the Create Course button at the top of this page.",
        },
        {
          title: "Choose a setup method",
          body: "Use a template if you already saved one, or choose Start Blank / Custom Course if you want to build the structure yourself.",
          action: "Open Template Library or Course Structure.",
        },
        {
          title: "Create Grading Pathways",
          body: "Grading Pathways are the major grading areas for the course. Their weights should add up to 100%. Examples: Tests, Projects, Assignments, Exams, or competency areas.",
          action: "Click Course Structure, then add Grading Pathways.",
        },
        {
          title: "Create Evidence Tiers",
          body: "Evidence Tiers sit inside Grading Pathways. Assignments connect to Evidence Tiers so the gradebook knows where each mark belongs.",
          action: "Inside each pathway, add tiers such as Major Evidence, Developing Evidence, Daily Evidence, or KDU Rubric Assessments.",
        },
        {
          title: "Import students",
          body: "Import students before grading so the roster and gradebook are ready.",
          action: "Click Import Students on the course card.",
        },
        {
          title: "Create the first assignment",
          body: "After the structure exists, create an assignment and link it to an Evidence Tier. This connection makes the grade flow into the course percentage.",
          action: "Go to Assignments and create the first assignment.",
        },
        {
          title: "Mark the first assignment",
          body: "Open the assignment grading page, enter KDU scores or raw section marks, save, and then check the Gradebook.",
          action: "Use Save & Next Student while grading, then review the Gradebook.",
        },
      ],
    },
    assignment: {
      title: "Create an Assignment",
      steps: [
        {
          title: "Open Assignments",
          body: "Go to the Assignments page and choose the course you are working with.",
          action: "Use the Assignments page from the main navigation.",
        },
        {
          title: "Create the assignment",
          body: "Enter the assignment title, description, due date, and choose the correct Evidence Tier.",
          action: "Make sure the assignment is linked to the right pathway and tier.",
        },
        {
          title: "Add sections if needed",
          body: "For exams or projects with multiple parts, use the Exam Section Builder to create raw-mark sections.",
          action: "Use Edit Assignment to add KNOW, DO, and UNDERSTAND sections.",
        },
        {
          title: "Open grading",
          body: "After saving the assignment, open the grading screen and enter student marks.",
          action: "Use Save & Next Student to move quickly.",
        },
      ],
    },
    templates: {
      title: "Use Course Templates",
      steps: [
        {
          title: "Save a strong course structure",
          body: "Once a course has good Grading Pathways and Evidence Tiers, save it as a template.",
          action: "Click Save Structure as Template on the course card.",
        },
        {
          title: "Apply a template",
          body: "Open another course and use Template Library to copy the saved structure into that course.",
          action: "Click Template Library, then Apply Template.",
        },
        {
          title: "Review before teaching",
          body: "After applying a template, check pathway weights and evidence tiers before adding assignments.",
          action: "Open Course Structure and confirm the setup.",
        },
      ],
    },
    grading: {
      title: "Mark an Assignment",
      steps: [
        {
          title: "Open the assignment grading page",
          body: "Choose the assignment you want to mark and open its grading screen.",
          action: "Use the assignment's grading button.",
        },
        {
          title: "Enter KDU scores or raw marks",
          body: "Use rubric scores for KDU grading or raw section marks for exams and multi-part tasks.",
          action: "Save each student's work before moving on.",
        },
        {
          title: "Check the Gradebook",
          body: "After marking, open the Gradebook to confirm the assignment percentage and course percentage updated.",
          action: "Review student progress and competency patterns.",
        },
      ],
    },
    reports: {
      title: "Prepare Reports",
      steps: [
        {
          title: "Review course data",
          body: "Before printing reports, check that assignments are marked and Gradebook data looks correct.",
          action: "Open the Gradebook for the course.",
        },
        {
          title: "Check student details",
          body: "Review individual student progress, missing work, strengths, and concerns.",
          action: "Use student detail views where available.",
        },
        {
          title: "Print or export",
          body: "Use report tools after confirming the data is accurate.",
          action: "Print only after the gradebook is reviewed.",
        },
      ],
    },
  }

  const guide = guides[guideKey] || guides.first_course
  const steps = guide.steps || []
  const safeStepIndex = Math.min(Math.max(stepIndex, 0), Math.max(steps.length - 1, 0))
  const currentStep = steps[safeStepIndex] || steps[0]
  const progressText = `${safeStepIndex + 1} of ${steps.length}`

  return (
    <div style={teacherCoachShellStyle}>
      {open ? (
        <div style={teacherCoachPanelStyle}>
          <div style={teacherCoachHeaderStyle}>
            <div>
              <div style={{ fontWeight: 900 }}>Teacher Coach</div>
              <div style={{ fontSize: "0.9rem", color: "#4b5563" }}>{guide.title}</div>
            </div>

            <button type="button" onClick={onClose} style={teacherCoachSmallButtonStyle}>
              Close
            </button>
          </div>

          {recommendation ? (
            <div
              style={{
                marginTop: "12px",
                border: "2px solid #111827",
                borderRadius: "12px",
                padding: "12px",
                background: "#f8fafc",
                lineHeight: 1.45,
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: "6px" }}>
                SUPER LMS Recommends
              </div>
              <div>
                <strong>Next Step:</strong> {recommendation.title}
              </div>
              <div style={{ marginTop: "6px", color: "#4b5563" }}>
                <strong>Reason:</strong> {recommendation.reason}
              </div>
              <div style={{ marginTop: "6px" }}>
                <strong>Do this:</strong> {recommendation.action}
              </div>

              {recommendation.target ? (
                <div style={{ marginTop: "10px" }}>
                  <button
                    type="button"
                    onClick={() => onTakeMeThere(recommendation)}
                    style={primaryButtonStyle}
                  >
                    Take Me There
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={{ marginTop: "12px" }}>
            <label style={labelStyle}>Choose a guide</label>
            <select
              value={guideKey}
              onChange={(event) => onSelectGuide(event.target.value)}
              style={inputStyle}
            >
              <option value="first_course">Set Up Your First Course</option>
              <option value="assignment">Create an Assignment</option>
              <option value="templates">Use Course Templates</option>
              <option value="grading">Mark an Assignment</option>
              <option value="reports">Prepare Reports</option>
            </select>
          </div>

          <div style={teacherCoachStepStyle}>
            <div style={{ fontWeight: 900, marginBottom: "6px" }}>
              Step {progressText}: {currentStep.title}
            </div>

            <div style={{ color: "#111827", lineHeight: 1.5 }}>
              {currentStep.body}
            </div>

            <div
              style={{
                marginTop: "10px",
                border: "1px solid #d7dce5",
                borderRadius: "10px",
                padding: "10px",
                background: "#f8fafc",
                lineHeight: 1.45,
              }}
            >
              <strong>Do this:</strong> {currentStep.action}
            </div>
          </div>

          <div style={teacherCoachFooterStyle}>
            <button
              type="button"
              onClick={onBack}
              disabled={safeStepIndex === 0}
              style={teacherCoachSmallButtonStyle}
            >
              Back
            </button>

            <button type="button" onClick={onRestart} style={teacherCoachSmallButtonStyle}>
              Restart
            </button>

            <button
              type="button"
              onClick={() => onNext(steps.length)}
              disabled={safeStepIndex >= steps.length - 1}
              style={primaryButtonStyle}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <button type="button" onClick={onToggle} style={teacherCoachButtonStyle}>
        {open ? "Hide Coach" : "Need Help?"}
      </button>
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

const teacherCoachShellStyle = {
  position: "fixed",
  right: "16px",
  bottom: "16px",
  zIndex: 1000,
  display: "grid",
  gap: "8px",
  justifyItems: "end",
}

const teacherCoachPanelStyle = {
  width: "min(340px, calc(100vw - 32px))",
  border: "2px solid #111827",
  borderRadius: "14px",
  padding: "12px",
  background: "#ffffff",
  boxShadow: "0 14px 32px rgba(0, 0, 0, 0.2)",
}

const teacherCoachHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "10px",
}

const teacherCoachStepStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "10px",
  padding: "10px",
  marginTop: "10px",
  background: "#ffffff",
}

const teacherCoachFooterStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  justifyContent: "space-between",
  marginTop: "10px",
}

const teacherCoachButtonStyle = {
  padding: "10px 14px",
  borderRadius: "999px",
  border: "2px solid #111827",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(0, 0, 0, 0.2)",
}

const teacherCoachSmallButtonStyle = {
  padding: "7px 9px",
  borderRadius: "9px",
  border: "1px solid #d7dce5",
  background: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
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

const linkedAssignmentStyle = {
  border: "1px solid #111827",
  borderRadius: "10px",
  padding: "8px 10px",
  background: "#ffffff",
  fontWeight: 900,
  width: "fit-content",
}

const resourceLinkStyle = {
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
