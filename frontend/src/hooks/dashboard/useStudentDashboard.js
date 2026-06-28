import { useCallback, useEffect, useMemo, useState } from "react"
import API_BASE from "../../apiBase"

function normalizeStudentEmail(email) {
  return String(email || "").trim().toLowerCase()
}

function normalizeDashboardPayload(payload, fallbackCourseId = "") {
  const course = payload?.course || null
  const assignments = Array.isArray(payload?.assignments) ? payload.assignments : []
  const lessons = Array.isArray(payload?.lessons) ? payload.lessons : []
  const submissionStatesByAssignmentId =
    payload?.submissionStatesByAssignmentId && typeof payload.submissionStatesByAssignmentId === "object"
      ? payload.submissionStatesByAssignmentId
      : {}

  return {
    course,
    courseId: course?.id || fallbackCourseId || "",
    assignments,
    lessons,
    submissionStatesByAssignmentId,
    raw: payload || {},
  }
}

export default function useStudentDashboard(userEmail) {
  const studentEmail = useMemo(() => normalizeStudentEmail(userEmail), [userEmail])

  const [courses, setCourses] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [dashboard, setDashboard] = useState(null)

  const [coursesLoading, setCoursesLoading] = useState(false)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [errorText, setErrorText] = useState("")

  const selectedCourse = useMemo(() => {
    return courses.find((course) => String(course.id) === String(selectedCourseId)) || dashboard?.course || null
  }, [courses, dashboard?.course, selectedCourseId])

  const loadCourses = useCallback(async () => {
    if (!studentEmail) {
      setCourses([])
      setSelectedCourseId("")
      setDashboard(null)
      setErrorText("Student email is missing.")
      return []
    }

    setCoursesLoading(true)
    setErrorText("")

    try {
      const response = await fetch(`${API_BASE}/api/students/${encodeURIComponent(studentEmail)}/classes`)
      const data = await response.json().catch(() => [])

      if (!response.ok) {
        throw new Error(data?.error || "Could not load student courses.")
      }

      const nextCourses = Array.isArray(data) ? data : []
      setCourses(nextCourses)

      if (nextCourses.length === 0) {
        setSelectedCourseId("")
        setDashboard(null)
        return nextCourses
      }

      setSelectedCourseId((currentCourseId) => {
        const currentStillExists = nextCourses.some((course) => String(course.id) === String(currentCourseId))
        return currentStillExists ? currentCourseId : String(nextCourses[0].id)
      })

      return nextCourses
    } catch (err) {
      console.error("useStudentDashboard loadCourses failed:", err)
      setCourses([])
      setSelectedCourseId("")
      setDashboard(null)
      setErrorText("Could not load your courses.")
      return []
    } finally {
      setCoursesLoading(false)
    }
  }, [studentEmail])

  const loadCourseDashboard = useCallback(
    async (courseId) => {
      const nextCourseId = String(courseId || "").trim()

      if (!studentEmail || !nextCourseId) {
        setDashboard(null)
        return null
      }

      setDashboardLoading(true)
      setErrorText("")

      try {
        const response = await fetch(
          `${API_BASE}/api/students/${encodeURIComponent(studentEmail)}/courses/${encodeURIComponent(nextCourseId)}/dashboard`
        )
        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data?.error || "Could not load selected course dashboard.")
        }

        const normalizedDashboard = normalizeDashboardPayload(data, nextCourseId)
        setDashboard(normalizedDashboard)
        setSelectedCourseId(String(normalizedDashboard.courseId || nextCourseId))
        return normalizedDashboard
      } catch (err) {
        console.error("useStudentDashboard loadCourseDashboard failed:", err)
        setDashboard(null)
        setErrorText("Could not load the selected course dashboard.")
        return null
      } finally {
        setDashboardLoading(false)
      }
    },
    [studentEmail]
  )

  const selectCourse = useCallback(
    async (courseId) => {
      const nextCourseId = String(courseId || "").trim()
      setSelectedCourseId(nextCourseId)

      if (!nextCourseId) {
        setDashboard(null)
        return null
      }

      return loadCourseDashboard(nextCourseId)
    },
    [loadCourseDashboard]
  )

  const setSubmissionStateByAssignmentId = useCallback((updater) => {
    setDashboard((currentDashboard) => {
      const currentStates = currentDashboard?.submissionStatesByAssignmentId || {}
      const nextStates =
        typeof updater === "function" ? updater(currentStates) : updater && typeof updater === "object" ? updater : currentStates

      return {
        ...(currentDashboard || {}),
        course: currentDashboard?.course || null,
        courseId: currentDashboard?.courseId || "",
        assignments: Array.isArray(currentDashboard?.assignments) ? currentDashboard.assignments : [],
        lessons: Array.isArray(currentDashboard?.lessons) ? currentDashboard.lessons : [],
        submissionStatesByAssignmentId: nextStates || {},
        raw: currentDashboard?.raw || {},
      }
    })
  }, [])

  useEffect(() => {
    let isActive = true

    async function bootStudentDashboard() {
      const loadedCourses = await loadCourses()

      if (!isActive || loadedCourses.length === 0) {
        return
      }

      const firstCourseId = loadedCourses[0]?.id
      if (firstCourseId) {
        await loadCourseDashboard(firstCourseId)
      }
    }

    bootStudentDashboard()

    return () => {
      isActive = false
    }
  }, [loadCourses, loadCourseDashboard])

  const assignments = dashboard?.assignments || []
  const lessons = dashboard?.lessons || []
  const submissionStatesByAssignmentId = dashboard?.submissionStatesByAssignmentId || {}

  return {
    studentEmail,
    courses,
    selectedCourse,
    selectedCourseId,
    dashboard,
    assignments,
    lessons,
    submissionStatesByAssignmentId,
    setSubmissionStateByAssignmentId,
    coursesLoading,
    dashboardLoading,
    loading: coursesLoading || dashboardLoading,
    errorText,
    setErrorText,
    loadCourses,
    loadCourseDashboard,
    selectCourse,
  }
}
