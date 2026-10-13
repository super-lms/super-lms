import {observerCourseText, observerAttentionItems, observerWorkStatus, observerCourseLabel} from '../services/observerCourseView.js'
import {beijingDateTime} from '../services/assignmentTime.js'
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../AuthContext.jsx"
import authFetch from "../services/authFetch"
import API_BASE from "../apiBase"
import { openRtiStudentSupport as openRtiLogin } from "../services/openRti.js"

function toArray(value) {
  return Array.isArray(value) ? value : []
}

function Card({ children, onClick, disabled = false, active = false }) {
  const Tag = onClick ? "button" : "div"

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      style={{
        border: active ? "2px solid #111827" : "1px solid #d7dce5",
        borderRadius: "16px",
        padding: "16px",
        background: "#ffffff",
        textAlign: "left",
        font: "inherit",
        cursor: onClick ? "pointer" : "default",
        boxShadow: "0 1px 2px rgba(16, 24, 40, 0.05)",
        width: "100%",
      }}
    >
      {children}
    </Tag>
  )
}

function MetricCard({ title, value, onClick, disabled = false }) {
  return (
    <Card onClick={onClick} disabled={disabled}>
      <div style={{ fontWeight: 800, marginBottom: "8px" }}>{title}</div>
      <div style={{ fontSize: "2rem", fontWeight: 900 }}>{value}</div>
    </Card>
  )
}

function InfoLine({ label, value }) {
  return (
    <div style={{ marginBottom: "6px" }}>
      <strong>{label}:</strong> {value || "-"}
    </div>
  )
}

function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || value === "") return "N/A"
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? `${numericValue.toFixed(digits)}%` : "N/A"
}

function formatKdu(value) {
  if (value === null || value === undefined || value === "") return "—"
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : "—"
}

const translations = {
  en: {
    observerPortal: "Observer Portal",
    parentPortal: "Parent Portal",
    homeroomTeacherPortal: "Homeroom Teacher Portal",
    observerSubtitle: "Review linked students, course progress, teacher feedback, assignments, and learning evidence.",
    parentSubtitle: "Review your linked student's course progress, teacher feedback, assignments, and learning evidence.",
    homeroomTeacherSubtitle: "Monitor your homeroom students' course progress, teacher feedback, assignments, and learning evidence.",
    logout: "Logout",
    loadingPortal: "Loading observer portal...",
    observerDashboard: "Observer Dashboard",
    parentDashboard: "Parent Dashboard",
    homeroomTeacherDashboard: "Homeroom Teacher Dashboard",
    welcomeBack: "Welcome back",
    linkedStudents: "Linked Students",
    visibleAssignments: "Visible Assignments",
    needsAttention: "Missing / Needs Attention",
    averageScore: "Average Score",
    quickActions: "Quick Actions",
    viewStudents: "View Students",
    viewStudentsHelp: "Open the full list of linked students.",
    openStudents: "Open Students →",
    needsAttentionTitle: "Needs Attention",
    needsAttentionHelp: "Review missing, ungraded, or needs-attention work for linked students.",
    reviewStudents: "Review",
    recentFeedback: "Recent Feedback",
    recentFeedbackHelp: "Review the latest teacher feedback across linked students.",
    viewFeedback: "View Feedback →",
    manageHomeroom: "Manage My Homeroom",
    manageHomeroomHelp: "Select homeroom students from the official grade roster.",
    openHomeroom: "Open Homeroom →",
    rtiStudentSupport: "RTI / Student Support",
    rtiStudentSupportHelp: "Open the intervention and student-support workspace.",
    openRti: "Open RTI →",
    recentActivity: "Recent Activity",
    noRecentActivity: "No recent student work or feedback is visible yet.",
    course: "Course",
    assignment: "Assignment",
    feedback: "Feedback",
    studentActivityRecorded: "Student activity recorded.",

    backToDashboard: "← Back to Dashboard",
    backToStudents: "← Back to Students",
    backToCourses: "← Back to Courses",

    myStudents: "My Students",
    communicationTools: "Communication Tools",
    studentWorkSection: "Student Work, Grades, Feedback, and Attachments",

    language: "Language",
    english: "English",
    chinese: "简体中文",
  },
  zh: {
    observerPortal: "家长 / 班主任观察门户",
    parentPortal: "家长门户",
    homeroomTeacherPortal: "班主任门户",
    observerSubtitle: "查看关联学生、课程进度、教师反馈、作业和学习表现证据。",
    parentSubtitle: "查看您孩子的课程进度、教师反馈、作业和学习表现证据。",
    homeroomTeacherSubtitle: "查看本班学生的课程进度、教师反馈、作业和学习表现证据。",
    logout: "退出登录",
    loadingPortal: "正在加载观察门户...",
    observerDashboard: "观察者仪表盘",
    parentDashboard: "家长仪表盘",
    homeroomTeacherDashboard: "班主任仪表盘",
    welcomeBack: "欢迎回来",
    linkedStudents: "关联学生",
    visibleAssignments: "可查看作业",
    needsAttention: "缺交 / 需要关注",
    averageScore: "平均分",
    quickActions: "快捷操作",
    viewStudents: "查看学生",
    viewStudentsHelp: "打开完整的关联学生列表。",
    openStudents: "打开学生列表 →",
    needsAttentionTitle: "需要关注",
    needsAttentionHelp: "只查看缺交、未评分或需要关注的学生作业。",
    reviewStudents: "查看",
    recentFeedback: "最近反馈",
    recentFeedbackHelp: "查看关联学生的最新教师反馈。",
    viewFeedback: "查看反馈 →",
    manageHomeroom: "管理我的班级",
    manageHomeroomHelp: "从官方年级名单中选择本班学生。",
    openHomeroom: "打开班级管理 →",
    rtiStudentSupport: "RTI / 学生支持",
    rtiStudentSupportHelp: "打开干预与学生支持工作区。",
    openRti: "打开 RTI →",
    recentActivity: "最近活动",
    noRecentActivity: "目前还没有可查看的学生作业或反馈。",
    course: "课程",
    assignment: "作业",
    feedback: "反馈",
    studentActivityRecorded: "已记录学生学习活动。",

    backToDashboard: "← 返回观察者仪表盘",
    backToStudents: "← 返回学生列表",
    backToCourses: "← 返回课程列表",

    myStudents: "我的学生",
    communicationTools: "沟通工具",
    studentWorkSection: "学生作业、成绩、教师反馈与附件",

    language: "语言",
    english: "English",
    chinese: "简体中文",
  },
}

export default function ObserverPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [snapshotMessage, setSnapshotMessage] = useState("")
  const [observerData, setObserverData] = useState({
    observer: null,
    students: [],
    submissions: [],
  })
  const [courseDashboard, setCourseDashboard] = useState(null)
  const [courseDashboardLoading, setCourseDashboardLoading] = useState(false)
  const [courseDashboardError, setCourseDashboardError] = useState("")

  const [selectedStudentEmail, setSelectedStudentEmail] = useState("")
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [viewMode, setViewMode] = useState("dashboard")
  const [language, setLanguage] = useState(() => {
    try {return localStorage.getItem("super-lms-observer-language") === "zh" ? "zh" : "en"} catch {return "en"}
  })
  useEffect(() => {try {localStorage.setItem("super-lms-observer-language", language)} catch {}}, [language])
  const t = {...(translations[language] || translations.en), ...(observerCourseText[language] || observerCourseText.en)}
  const dueText = value => value ? `${beijingDateTime(value).replace("T", " ")} ${language === "zh" ? "北京时间" : "Beijing time"}` : t.noDueDate
  function openCourseSection(id) {
    const section = document.getElementById(id)
    section?.scrollIntoView({behavior:"smooth", block:"start"})
    section?.querySelector("h2")?.focus({preventScroll:true})
  }
  const [homeroomRoster, setHomeroomRoster] = useState([])
  const [homeroomSearch, setHomeroomSearch] = useState("")
  const [homeroomGrade, setHomeroomGrade] = useState("")
  const [selectedHomeroomIds, setSelectedHomeroomIds] = useState([])
  const [homeroomLoading, setHomeroomLoading] = useState(false)
  const [homeroomSaving, setHomeroomSaving] = useState(false)
  const [homeroomMessage, setHomeroomMessage] = useState("")
  const [homeroomError, setHomeroomError] = useState("")

  function handleLogout() {
    logout()
    navigate("/login", { replace: true })
  }

  async function openRtiStudentSupport() {
    try {
      await openRtiLogin("/observer")
    } catch (error) {
      window.alert(error.message)
    }
  }

  useEffect(() => {
    async function loadObserverData() {
      if (!user?.email) {
        setError("No observer email found.")
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError("")

        const response = await authFetch(
          `/api/observers/${encodeURIComponent(user.email)}/dashboard`
        )

        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error((data && data.error) || "Failed to load observer dashboard")
        }

        setObserverData({
          observer: data?.observer || null,
          students: toArray(data?.students),
          submissions: toArray(data?.submissions),
        })
      } catch (err) {
        setError(err.message || "Failed to load observer dashboard")
      } finally {
        setLoading(false)
      }
    }

    loadObserverData()
  }, [user?.email])

  async function refreshObserverDashboard() {
    if (!user?.email) return

    const response = await authFetch(
      `/api/observers/${encodeURIComponent(user.email)}/dashboard`
    )

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error((data && data.error) || "Failed to refresh observer dashboard")
    }

    setObserverData({
      observer: data?.observer || null,
      students: toArray(data?.students),
      submissions: toArray(data?.submissions),
    })
  }

  async function loadHomeroomRoster() {
    if (!user?.email) return

    try {
      setHomeroomLoading(true)
      setHomeroomError("")
      setHomeroomMessage("")

      const response = await authFetch(
        `/api/observers/${encodeURIComponent(user.email)}/grade-roster?current_grade=11`
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error((data && data.error) || "Failed to load homeroom roster")
      }

      const roster = toArray(data?.students)
      setHomeroomRoster(roster)
      setHomeroomGrade(String(data?.current_grade || "11"))
      setSelectedHomeroomIds(
        roster
          .filter((student) => student.already_linked)
          .map((student) => String(student.master_student_id))
      )
    } catch (err) {
      setHomeroomError(err.message || "Failed to load homeroom roster")
      setHomeroomRoster([])
      setSelectedHomeroomIds([])
    } finally {
      setHomeroomLoading(false)
    }
  }

  const uniqueStudents = useMemo(() => {
    const map = new Map()

    observerData.students.forEach((student) => {
      const email = String(student.student_email || "").trim().toLowerCase()
      if (!email) return

      if (!map.has(email)) {
        map.set(email, {
          student_name: student.student_name || email,
          student_email: email,
          student_id: student.student_id || "",
        })
      }
    })

    return Array.from(map.values()).sort((a, b) =>
      String(a.student_name || "").localeCompare(String(b.student_name || ""))
    )
  }, [observerData.students])

  const selectedStudent = useMemo(() => {
    return uniqueStudents.find((student) => student.student_email === selectedStudentEmail) || null
  }, [uniqueStudents, selectedStudentEmail])

  const coursesForSelectedStudent = useMemo(() => {
    const map = new Map()

    observerData.students.forEach((student) => {
      const email = String(student.student_email || "").trim().toLowerCase()
      if (email !== selectedStudentEmail) return

      const classId = String(student.class_id || "")
      if (!classId) return

      map.set(classId, {
        class_id: classId,
        class_name: student.class_name || `Course ${classId}`,
        teacher_user_id: student.teacher_user_id || null,
        teacher_name: student.teacher_name || "",
        teacher_email: student.teacher_email || "",
      })
    })

    return Array.from(map.values()).sort((a, b) =>
      String(a.class_name || "").localeCompare(String(b.class_name || ""))
    )
  }, [observerData.students, selectedStudentEmail])

  const selectedCourse = useMemo(() => {
    return coursesForSelectedStudent.find((course) => String(course.class_id) === String(selectedCourseId)) || null
  }, [coursesForSelectedStudent, selectedCourseId])

  const isChineseHomeroomTeacher =
    String(observerData.observer?.relationship || "").trim().toLowerCase() ===
    "chinese_homeroom_teacher"
  const isParent =
    String(observerData.observer?.relationship || "").trim().toLowerCase() === "parent"
  const portalTitle = isChineseHomeroomTeacher
    ? t.homeroomTeacherPortal
    : isParent
      ? t.parentPortal
      : t.observerPortal
  const portalSubtitle = isChineseHomeroomTeacher
    ? t.homeroomTeacherSubtitle
    : isParent
      ? t.parentSubtitle
      : t.observerSubtitle
  const dashboardTitle = isChineseHomeroomTeacher
    ? t.homeroomTeacherDashboard
    : isParent
      ? t.parentDashboard
      : t.observerDashboard

  const courseSubmissions = useMemo(() => {
    return observerData.submissions.filter((submission) => {
      return (
        String(submission.student_email || "").trim().toLowerCase() === selectedStudentEmail &&
        String(submission.class_id || "") === String(selectedCourseId)
      )
    })
  }, [observerData.submissions, selectedStudentEmail, selectedCourseId])

  useEffect(() => {
    async function loadReadOnlyCourseDashboard() {
      if (viewMode !== "progress" || !user?.email || !selectedStudentEmail || !selectedCourseId) {
        return
      }

      try {
        setCourseDashboardLoading(true)
        setCourseDashboardError("")
        setCourseDashboard(null)
        const response = await authFetch(
          `/api/observers/${encodeURIComponent(user.email)}/students/${encodeURIComponent(selectedStudentEmail)}/courses/${encodeURIComponent(selectedCourseId)}/dashboard`
        )
        const data = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error((data && data.error) || "Failed to load this student course")
        }
        setCourseDashboard(data)
      } catch (err) {
        setCourseDashboardError(err.message || "Failed to load this student course")
      } finally {
        setCourseDashboardLoading(false)
      }
    }

    loadReadOnlyCourseDashboard()
  }, [viewMode, user?.email, selectedStudentEmail, selectedCourseId])

  const readOnlyCourseItems = useMemo(() => {
    return toArray(courseDashboard?.assignments).map((assignment) => {
      const state = courseDashboard?.submissionStatesByAssignmentId?.[String(assignment.id)] || {}
      return { assignment, submission: state.submission || null, submissionStatus: state.submission_status || "not_submitted" }
    })
  }, [courseDashboard])

  const readOnlyGradedItems = readOnlyCourseItems.filter(({ submission }) =>
    submission?.score !== null && submission?.score !== undefined && submission?.score !== ""
  )
  const readOnlyMissingItems = observerAttentionItems(readOnlyCourseItems)
  const courseDashboardReady = !courseDashboardLoading && !courseDashboardError && courseDashboard !== null
  const readOnlyAverageScore = readOnlyGradedItems.length
    ? Math.round(readOnlyGradedItems.reduce((sum, item) => sum + Number(item.submission.score || 0), 0) / readOnlyGradedItems.length)
    : null
  const readOnlyGradebook = courseDashboard?.gradebook || null
  const readOnlyCurrentStanding = readOnlyGradebook?.current_percent ?? readOnlyAverageScore

  function openReadOnlyGradebook() {
    openCourseSection("observer-student-gradebook")
  }

  const allVisibleSubmissions = observerData.submissions

  const allGradedSubmissions = allVisibleSubmissions.filter((submission) => {
    return submission.score !== null && submission.score !== undefined && submission.score !== ""
  })

  const allMissingSubmissions = allVisibleSubmissions.filter((submission) => {
    return submission.score === null || submission.score === undefined || submission.score === ""
  })

  const allAverageScore =
    allGradedSubmissions.length > 0
      ? Math.round(
          allGradedSubmissions.reduce((sum, submission) => sum + Number(submission.score || 0), 0) /
            allGradedSubmissions.length
        )
      : null

  const gradedSubmissions = courseSubmissions.filter((submission) => {
    return submission.score !== null && submission.score !== undefined && submission.score !== ""
  })

  const missingSubmissions = courseSubmissions.filter((submission) => {
    return submission.score === null || submission.score === undefined || submission.score === ""
  })

  const averageScore =
    gradedSubmissions.length > 0
      ? Math.round(
          gradedSubmissions.reduce((sum, submission) => sum + Number(submission.score || 0), 0) /
            gradedSubmissions.length
        )
      : null

  const attentionStudents = useMemo(() => {
    const map = new Map()

    allMissingSubmissions.forEach((submission) => {
      const email = String(submission.student_email || "").trim().toLowerCase()
      if (!email) return

      const current = map.get(email) || {
        student_name: submission.student_name || email,
        student_email: email,
        count: 0,
        courses: new Set(),
      }

      current.count += 1
      if (submission.class_name) current.courses.add(submission.class_name)
      map.set(email, current)
    })

    return Array.from(map.values()).sort((a, b) =>
      String(a.student_name || "").localeCompare(String(b.student_name || ""))
    )
  }, [allMissingSubmissions])

  const feedbackItems = useMemo(() => {
    return allVisibleSubmissions
      .filter((submission) => String(submission.feedback || "").trim().length > 0)
      .slice(0, 20)
  }, [allVisibleSubmissions])

  const recentActivity = allVisibleSubmissions.slice(0, 8)

  const filteredHomeroomRoster = useMemo(() => {
    const query = homeroomSearch.trim().toLowerCase()

    if (!query) return homeroomRoster

    return homeroomRoster.filter((student) => {
      const searchable = [
        student.display_name,
        student.student_email,
        student.student_id,
        student.pen,
        student.current_homeform,
      ]
        .join(" ")
        .toLowerCase()

      return searchable.includes(query)
    })
  }, [homeroomRoster, homeroomSearch])

  function buildStudentSnapshot() {
    const feedbackLines = courseSubmissions
      .filter((submission) => String(submission.feedback || "").trim().length > 0)
      .slice(0, 6)
      .map((submission) => {
        return `• ${submission.assignment_title || "Assignment"}: ${submission.feedback}`
      })

    const missingLines = missingSubmissions.slice(0, 8).map((submission) => {
      return `• ${submission.assignment_title || "Assignment"}`
    })

    return [
      "Student Progress Snapshot",
      "",
      `Student: ${selectedStudent?.student_name || "Student"}`,
      `Student Email: ${selectedStudent?.student_email || "N/A"}`,
      `Course: ${selectedCourse?.class_name || "Course"}`,
      "",
      `Visible Assignments: ${courseSubmissions.length}`,
      `Average Score: ${averageScore === null ? "N/A" : `${averageScore}%`}`,
      `Missing / Needs Attention: ${missingSubmissions.length}`,
      "",
      "Missing Work / Needs Attention:",
      missingLines.length > 0 ? missingLines.join("\n") : "No missing or ungraded work found for this course.",
      "",
      "Recent Teacher Feedback:",
      feedbackLines.length > 0 ? feedbackLines.join("\n") : "No teacher feedback is visible yet.",
      "",
      "Generated from SUPER LMS Observer Portal",
    ].join("\n")
  }

  async function copyStudentSnapshot() {
    const snapshot = buildStudentSnapshot()

    try {
      await navigator.clipboard.writeText(snapshot)
      setSnapshotMessage("Student snapshot copied to clipboard.")
    } catch {
      setSnapshotMessage("Copy was not available in this browser. Please use Email or Print instead.")
    }
  }

  async function emailStudentSnapshot() {
    const subject = `Student Progress Update - ${selectedStudent?.student_name || "Student"} - ${selectedCourse?.class_name || "Course"}`
    const body = [
      `Subject: ${subject}`,
      "",
      "Dear Parent,",
      "",
      "I hope you are doing well.",
      "",
      `Below is a progress update for ${selectedStudent?.student_name || "your child"} in ${selectedCourse?.class_name || "this course"}.`,
      "",
      "Course Summary",
      `- Visible Assignments: ${courseSubmissions.length}`,
      `- Average Score: ${averageScore === null ? "N/A" : `${averageScore}%`}`,
      `- Missing / Needs Attention: ${missingSubmissions.length}`,
      "",
      "Missing Work / Needs Attention",
      missingSubmissions.length > 0
        ? missingSubmissions.map((submission) => `- ${submission.assignment_title || "Assignment"}`).join("\n")
        : "No missing or ungraded work found for this course.",
      "",
      "Recent Teacher Feedback",
      courseSubmissions.filter((submission) => String(submission.feedback || "").trim().length > 0).length > 0
        ? courseSubmissions
            .filter((submission) => String(submission.feedback || "").trim().length > 0)
            .slice(0, 6)
            .map((submission) => `- ${submission.assignment_title || "Assignment"}: ${submission.feedback}`)
            .join("\n")
        : "No teacher feedback is visible yet.",
      "",
      "If you have any questions regarding your child's progress, please contact the course teacher or your Chinese Homeroom Teacher.",
      "",
      "Kind regards,",
      "",
      "CBC Wenzhou",
    ].join("\n")

    try {
      await navigator.clipboard.writeText(body)
      setSnapshotMessage("Email for Outlook copied. Open Outlook, create a new email, and paste.")
    } catch {
      setSnapshotMessage("Copy was not available in this browser. Please use Copy Student Snapshot instead.")
    }
  }

  function buildCourseTeacherMessage() {
    const feedbackLines = courseSubmissions
      .filter((submission) => String(submission.feedback || "").trim().length > 0)
      .slice(0, 3)
      .map((submission) => `- ${submission.assignment_title || "Assignment"}: ${submission.feedback}`)

    return [
      `Hello ${selectedCourse?.teacher_name || "Course Teacher"},`,
      "",
      `I am following up regarding ${selectedStudent?.student_name || "this student"} in ${selectedCourse?.class_name || "your course"}.`,
      "",
      `Visible assignments: ${courseSubmissions.length}`,
      `Average score: ${averageScore === null ? "N/A" : `${averageScore}%`}`,
      `Missing / needs attention: ${missingSubmissions.length}`,
      "",
      "Recent teacher feedback:",
      feedbackLines.length > 0 ? feedbackLines.join("\n") : "No recent feedback is visible.",
      "",
      "Please let me know if there are concerns or recommended next steps.",
      "",
      "Thank you.",
    ].join("\n")
  }

  function emailCourseTeacher() {
    const teacherEmail = String(selectedCourse?.teacher_email || "").trim()

    if (!teacherEmail) {
      setSnapshotMessage("No course teacher email is assigned to this course.")
      return
    }

    const subject = `Student Progress Follow-up - ${selectedStudent?.student_name || "Student"} - ${selectedCourse?.class_name || "Course"}`
    const body = buildCourseTeacherMessage()
    window.location.href = `mailto:${encodeURIComponent(teacherEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  async function copyTeacherEmail() {
    const teacherEmail = String(selectedCourse?.teacher_email || "").trim()

    if (!teacherEmail) {
      setSnapshotMessage("No course teacher email is assigned to this course.")
      return
    }

    try {
      await navigator.clipboard.writeText(teacherEmail)
      setSnapshotMessage("Course teacher email copied.")
    } catch {
      setSnapshotMessage("Copy was not available in this browser.")
    }
  }

  async function copyWeChatMessage() {
    try {
      await navigator.clipboard.writeText(buildCourseTeacherMessage())
      setSnapshotMessage("WeChat message copied. Open WeChat, select the course teacher, and paste.")
    } catch {
      setSnapshotMessage("Copy was not available in this browser.")
    }
  }

  function printStudentSnapshot() {
    const snapshot = buildStudentSnapshot()
    const printWindow = window.open("", "_blank", "width=900,height=700")

    if (!printWindow) {
      setSnapshotMessage("Print window was blocked. Please allow popups for this site and try again.")
      return
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Student Progress Snapshot</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 32px;
              color: #111827;
              line-height: 1.5;
            }
            h1 {
              margin-top: 0;
            }
            pre {
              white-space: pre-wrap;
              font-family: Arial, sans-serif;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <h1>SUPER LMS Student Progress Snapshot</h1>
          <pre>${snapshot.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
    setSnapshotMessage("Print snapshot opened.")
  }

  function openStudent(student) {
    setSelectedStudentEmail(student.student_email)
    setSelectedCourseId("")
    setViewMode("courses")
    setSnapshotMessage("")
  }

  function openStudentByEmail(studentEmail) {
    const student = uniqueStudents.find((item) => item.student_email === studentEmail)
    if (student) openStudent(student)
  }

  function openCourse(course) {
    setSelectedCourseId(course.class_id)
    setViewMode("progress")
    setSnapshotMessage("")
    setCourseDashboard(null)
    setCourseDashboardError("")
  }

  function backToDashboard() {
    setViewMode("dashboard")
    setSelectedStudentEmail("")
    setSelectedCourseId("")
    setSnapshotMessage("")
  }

  function viewStudents() {
    setViewMode("students")
    setSelectedStudentEmail("")
    setSelectedCourseId("")
    setSnapshotMessage("")
  }

  function viewAttention() {
    setViewMode("attention")
    setSelectedStudentEmail("")
    setSelectedCourseId("")
    setSnapshotMessage("")
  }

  function viewFeedback() {
    setViewMode("feedback")
    setSelectedStudentEmail("")
    setSelectedCourseId("")
    setSnapshotMessage("")
  }

  function viewManageHomeroom() {
    setViewMode("manageHomeroom")
    setSelectedStudentEmail("")
    setSelectedCourseId("")
    setSnapshotMessage("")
    loadHomeroomRoster()
  }

  function toggleHomeroomStudent(masterStudentId) {
    const cleanId = String(masterStudentId)

    setSelectedHomeroomIds((current) => {
      if (current.includes(cleanId)) {
        return current.filter((id) => id !== cleanId)
      }

      return [...current, cleanId]
    })

    setHomeroomMessage("")
    setHomeroomError("")
  }

  async function saveHomeroomRoster() {
    if (!user?.email) return

    try {
      setHomeroomSaving(true)
      setHomeroomMessage("")
      setHomeroomError("")

      const response = await authFetch(
        `/api/observers/${encodeURIComponent(user.email)}/grade-roster-links`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            current_grade: Number(homeroomGrade || 11),
            masterStudentIds: selectedHomeroomIds.map(Number).filter(Boolean),
          }),
        }
      )

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error((data && data.error) || "Failed to save homeroom")
      }

      setHomeroomMessage(`Homeroom saved. ${data?.linkedCount ?? selectedHomeroomIds.length} student(s) linked.`)
      await refreshObserverDashboard()
      await loadHomeroomRoster()
    } catch (err) {
      setHomeroomError(err.message || "Failed to save homeroom")
    } finally {
      setHomeroomSaving(false)
    }
  }

  function backToStudents() {
    setViewMode("students")
    setSelectedStudentEmail("")
    setSelectedCourseId("")
    setSnapshotMessage("")
  }

  function backToCourses() {
    setViewMode("courses")
    setSelectedCourseId("")
    setSnapshotMessage("")
  }

  return (
    <div className="page">
      <div style={topBarStyle}>
        <div>
          <h1 style={{ marginBottom: "6px" }}>{portalTitle}</h1>
          <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.5 }}>
            {portalSubtitle}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontWeight: 800 }}>{t.language}</label>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            style={languageSelectStyle}
          >
            <option value="en">{t.english}</option>
            <option value="zh">{t.chinese}</option>
          </select>

          <button type="button" onClick={() => navigate("/calendar")} style={logoutButtonStyle}>
            {language === "zh" ? "学校日历" : "School Calendar"}
          </button>

          <button type="button" onClick={handleLogout} style={logoutButtonStyle}>
            {t.logout}
          </button>
        </div>
      </div>

      {loading ? <p>{t.loadingPortal}</p> : null}
      {error ? <p style={{ color: "#991b1b" }}>{error}</p> : null}

      {!loading && !error && viewMode === "dashboard" ? (
        <div style={{ display: "grid", gap: "18px" }}>
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>{dashboardTitle}</h2>
            <p style={{ marginTop: 0, color: "#4b5563", lineHeight: 1.5 }}>
              {t.welcomeBack}, {observerData.observer?.name || user?.email || "Observer"}.
            </p>

            <div style={metricGridStyle}>
              <MetricCard title={t.linkedStudents} value={uniqueStudents.length} onClick={() => setViewMode("students")} />
              <MetricCard title={t.visibleAssignments} value={allVisibleSubmissions.length} onClick={() => setViewMode("students")} />
              <MetricCard title={t.needsAttention} value={allMissingSubmissions.length} onClick={() => setViewMode("attention")} />
              <MetricCard title={t.averageScore} value={allAverageScore === null ? "N/A" : `${allAverageScore}%`} />
            </div>
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>{t.quickActions}</h2>
            <div style={cardGridStyle}>
              <Card onClick={viewStudents}>
                <div style={{ fontSize: "1.15rem", fontWeight: 900 }}>{t.viewStudents}</div>
                <div style={{ marginTop: "8px", color: "#4b5563" }}>
                  {t.viewStudentsHelp}
                </div>
                <div style={{ marginTop: "12px", fontWeight: 800 }}>{t.openStudents}</div>
              </Card>

              <Card onClick={viewAttention}>
                <div style={{ fontSize: "1.15rem", fontWeight: 900 }}>{t.needsAttentionTitle}</div>
                <div style={{ marginTop: "8px", color: "#4b5563" }}>
                  {t.needsAttentionHelp}
                </div>
                <div style={{ marginTop: "12px", fontWeight: 800 }}>{t.reviewStudents} {attentionStudents.length} {language === "zh" ? "名学生" : `Student${attentionStudents.length === 1 ? "" : "s"}`} →</div>
              </Card>

              <Card onClick={viewFeedback}>
                <div style={{ fontSize: "1.15rem", fontWeight: 900 }}>{t.recentFeedback}</div>
                <div style={{ marginTop: "8px", color: "#4b5563" }}>
                  {t.recentFeedbackHelp}
                </div>
                <div style={{ marginTop: "12px", fontWeight: 800 }}>{t.viewFeedback}</div>
              </Card>

              {isChineseHomeroomTeacher ? (
                <>
                  <Card onClick={openRtiStudentSupport}>
                    <div style={{ fontSize: "1.15rem", fontWeight: 900 }}>{t.rtiStudentSupport}</div>
                    <div style={{ marginTop: "8px", color: "#4b5563" }}>
                      {t.rtiStudentSupportHelp}
                    </div>
                    <div style={{ marginTop: "12px", fontWeight: 800 }}>{t.openRti}</div>
                  </Card>

                  <Card onClick={viewManageHomeroom}>
                    <div style={{ fontSize: "1.15rem", fontWeight: 900 }}>{t.manageHomeroom}</div>
                    <div style={{ marginTop: "8px", color: "#4b5563" }}>
                      {t.manageHomeroomHelp}
                    </div>
                    <div style={{ marginTop: "12px", fontWeight: 800 }}>{t.openHomeroom}</div>
                  </Card>
                </>
              ) : null}
            </div>
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>{t.recentActivity}</h2>

            {recentActivity.length === 0 ? (
              <p>{t.noRecentActivity}</p>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {recentActivity.map((submission) => (
                  <Card key={`activity-${submission.id}`}>
                    <div style={{ fontWeight: 900 }}>{submission.student_name || "Student"}</div>
                    <div style={{ marginTop: "4px", color: "#4b5563" }}>
                      {submission.class_name || t.course} • {submission.assignment_title || t.assignment}
                    </div>
                    <div style={{ marginTop: "6px" }}>
                      {submission.feedback ? `${t.feedback}: ${submission.feedback}` : submission.content || t.studentActivityRecorded}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {!loading && !error && viewMode === "attention" ? (
        <section style={sectionStyle}>
          <button type="button" onClick={backToDashboard} style={backButtonStyle}>
            {t.backToDashboard}
          </button>

          <h2 style={sectionTitleStyle}>{t.needsAttentionTitle}</h2>

          {attentionStudents.length === 0 ? (
            <p>{t.noAttention}</p>
          ) : (
            <div style={cardGridStyle}>
              {attentionStudents.map((student) => (
                <Card key={student.student_email} onClick={() => openStudentByEmail(student.student_email)}>
                  <div style={{ fontSize: "1.2rem", fontWeight: 900 }}>{student.student_name}</div>
                  <div style={{ marginTop: "6px", color: "#4b5563" }}>
                    {language === "zh" ? `${student.count} 项作业需要关注` : `${student.count} item${student.count === 1 ? "" : "s"} need attention`}
                  </div>
                  <div style={{ marginTop: "6px", color: "#4b5563" }}>
                    {Array.from(student.courses).slice(0, 2).map(name => observerCourseLabel(name, language)).join(", ") || (language === "zh" ? "可查看课程详情" : "Course details available")}
                  </div>
                  <div style={{ marginTop: "12px", fontWeight: 800 }}>{t.openStudent}</div>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!loading && !error && viewMode === "feedback" ? (
        <section style={sectionStyle}>
          <button type="button" onClick={backToDashboard} style={backButtonStyle}>
            {t.backToDashboard}
          </button>

          <h2 style={sectionTitleStyle}>{t.recentFeedback}</h2>

          {feedbackItems.length === 0 ? (
            <div style={emptyStateStyle}>
              <div style={emptyStateTitleStyle}>No teacher feedback is visible yet.</div>
              <p style={emptyStateTextStyle}>Feedback will appear here after teachers enter comments for linked student work.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {feedbackItems.map((submission) => (
                <Card key={`feedback-${submission.id}`} onClick={() => openStudentByEmail(String(submission.student_email || "").trim().toLowerCase())}>
                  <div style={{ fontSize: "1.1rem", fontWeight: 900 }}>{submission.student_name || "Student"}</div>
                  <div style={{ marginTop: "4px", color: "#4b5563" }}>
                    {submission.class_name || t.course} • {submission.assignment_title || t.assignment}
                  </div>
                  <div style={{ marginTop: "8px", lineHeight: 1.5 }}>
                    {submission.feedback}
                  </div>
                  <div style={{ marginTop: "12px", fontWeight: 800 }}>{t.openStudent}</div>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!loading && !error && viewMode === "manageHomeroom" ? (
        <section style={sectionStyle}>
          <button type="button" onClick={backToDashboard} style={backButtonStyle}>
            {t.backToDashboard}
          </button>

          <h2 style={sectionTitleStyle}>{t.manageHomeroom}</h2>

          <p style={{ marginTop: 0, color: "#4b5563", lineHeight: 1.5 }}>
            Select students from the official Grade {homeroomGrade || "11"} roster. This updates your linked student list.
          </p>

          <div style={metricGridStyle}>
            <MetricCard title="Current Grade" value={homeroomGrade || "11"} />
            <MetricCard title="Roster Students" value={homeroomRoster.length} />
            <MetricCard title="Selected Students" value={selectedHomeroomIds.length} />
          </div>

          <div style={{ marginTop: "18px", marginBottom: "18px" }}>
            <label style={{ display: "block", fontWeight: 800, marginBottom: "8px" }}>
              Search Grade {homeroomGrade || "11"} Students
            </label>
            <input
              value={homeroomSearch}
              onChange={(event) => setHomeroomSearch(event.target.value)}
              placeholder="Search by name, email, student ID, PEN, or homeform..."
              style={searchInputStyle}
            />
          </div>

          {homeroomLoading ? <p>Loading homeroom roster...</p> : null}
          {homeroomError ? <p style={{ color: "#991b1b", fontWeight: 800 }}>{homeroomError}</p> : null}
          {homeroomMessage ? <p style={{ color: "#14532d", fontWeight: 800 }}>{homeroomMessage}</p> : null}

          {!homeroomLoading && filteredHomeroomRoster.length === 0 ? (
            <div style={emptyStateStyle}>
              <div style={emptyStateTitleStyle}>No roster students found.</div>
              <p style={emptyStateTextStyle}>Try adjusting the search terms, student ID, PEN, or homeform filter.</p>
            </div>
          ) : null}

          {!homeroomLoading && filteredHomeroomRoster.length > 0 ? (
            <div style={{ display: "grid", gap: "10px" }}>
              {filteredHomeroomRoster.map((student) => {
                const id = String(student.master_student_id)
                const checked = selectedHomeroomIds.includes(id)

                return (
                  <label key={id} style={checkboxCardStyle}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleHomeroomStudent(id)}
                      style={{ width: "18px", height: "18px", marginTop: "3px" }}
                    />

                    <div>
                      <div style={{ fontSize: "1.05rem", fontWeight: 900 }}>
                        {student.display_name || student.student_email || "Unnamed Student"}
                      </div>
                      <div style={{ marginTop: "4px", color: "#4b5563" }}>
                        {student.student_email || "No email"} {student.current_homeform ? `• ${student.current_homeform}` : ""}
                      </div>
                      <div style={{ marginTop: "4px", color: "#6b7280", fontSize: "0.9rem" }}>
                        Student ID: {student.student_id || "—"} • PEN: {student.pen || "—"}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          ) : null}

          <div style={{ marginTop: "18px" }}>
            <button
              type="button"
              onClick={saveHomeroomRoster}
              disabled={homeroomSaving || homeroomLoading}
              style={actionButtonStyle}
            >
              {homeroomSaving ? "Saving Homeroom..." : "Save My Homeroom"}
            </button>
          </div>
        </section>
      ) : null}

      {!loading && !error && viewMode === "students" ? (
        <section style={sectionStyle}>
          <button type="button" onClick={backToDashboard} style={backButtonStyle}>
            {t.backToDashboard}
          </button>

          <h2 style={sectionTitleStyle}>{t.myStudents}</h2>

          {uniqueStudents.length === 0 ? (
            <div style={emptyStateStyle}>
              <div style={emptyStateTitleStyle}>{t.noStudents}</div>
              <p style={emptyStateTextStyle}>{t.noStudentsHelp}</p>
            </div>
          ) : (
            <div style={cardGridStyle}>
              {uniqueStudents.map((student) => (
                <Card key={student.student_email} onClick={() => openStudent(student)}>
                  <div style={{ fontSize: "1.2rem", fontWeight: 900 }}>{student.student_name}</div>
                  <div style={{ marginTop: "6px", color: "#4b5563" }}>{student.student_email}</div>
                  <div style={{ marginTop: "12px", fontWeight: 800 }}>{t.openStudent}</div>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!loading && !error && viewMode === "courses" && selectedStudent ? (
        <section style={sectionStyle}>
          <button type="button" onClick={backToStudents} style={backButtonStyle}>
            {t.backToStudents}
          </button>

          <div style={contextLabelStyle}>{t.student}</div>
          <h2 style={sectionTitleStyle}>{selectedStudent.student_name}</h2>
          <p style={{ marginTop: 0, color: "#4b5563" }}>
            {t.chooseCourse}
          </p>

          {coursesForSelectedStudent.length === 0 ? (
            <div style={emptyStateStyle}>
              <div style={emptyStateTitleStyle}>{t.noCourses}</div>
              <p style={emptyStateTextStyle}>{t.noCoursesHelp}</p>
            </div>
          ) : (
            <div style={cardGridStyle}>
              {coursesForSelectedStudent.map((course) => (
                <Card key={course.class_id} onClick={() => openCourse(course)}>
                  <div style={{ fontSize: "1.2rem", fontWeight: 900 }}>{observerCourseLabel(course.class_name, language)}</div>
                  <div style={{ marginTop: "8px", color: "#4b5563" }}>
                    {t.courseEvidence}
                  </div>
                  <div style={{ marginTop: "12px", fontWeight: 800 }}>{t.openCourse}</div>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!loading && !error && viewMode === "progress" && selectedStudent && selectedCourse ? (
        <div style={{ display: "grid", gap: "18px" }}>
          <section style={sectionStyle}>
            <div style={backButtonRowStyle}>
              <button type="button" onClick={backToCourses} style={backButtonStyle}>
                {t.backToCourses}
              </button>
              <button type="button" onClick={backToStudents} style={backButtonStyle}>
                {t.backToStudents}
              </button>
            </div>

            <div style={contextLabelStyle}>{t.course}</div>
            <h2 style={sectionTitleStyle}>{observerCourseLabel(selectedCourse.class_name, language)}</h2>
            <div style={{ marginBottom: "12px" }}>
              <div style={contextLabelStyle}>{t.student}</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 900 }}>{selectedStudent.student_name}</div>
            </div>
            <p style={{ marginTop: 0, color: "#4b5563" }}>
              {t.courseIntro}
            </p>

            <div style={metricGridStyle}>
              <MetricCard title={t.visibleAssignments} value={courseDashboardReady ? readOnlyCourseItems.length : "—"} disabled={!courseDashboardReady} onClick={() => openCourseSection("observer-student-work")} />
              <MetricCard title={t.needsAttention} value={courseDashboardReady ? readOnlyMissingItems.length : "—"} disabled={!courseDashboardReady} onClick={() => openCourseSection("observer-student-attention")} />
              <MetricCard title={t.currentStanding} value={readOnlyCurrentStanding === null ? t.notAvailable : formatPercent(readOnlyCurrentStanding)} disabled={!courseDashboardReady} onClick={openReadOnlyGradebook} />
              <MetricCard title={t.lessons} value={toArray(courseDashboard?.lessons).length} disabled={!courseDashboardReady} onClick={() => openCourseSection("observer-student-lessons")} />
            </div>

            <p style={{color:"#4b5563"}}>{t.attentionHelp}</p>
            <div style={{ ...buttonRowStyle, marginTop: "16px" }}>
              <button type="button" onClick={openReadOnlyGradebook} style={actionButtonStyle}>
                {t.openGradebook}
              </button>
            </div>

            {courseDashboardLoading ? <p style={{ fontWeight: 800 }}>{t.loadingCourse}</p> : null}
            {courseDashboardError ? (
              <div style={{ ...emptyStateStyle, borderColor: "#fca5a5", background: "#fff7f7" }}>
                <div style={{ ...emptyStateTitleStyle, color: "#991b1b" }}>{t.courseLoadError}</div>
                <p style={emptyStateTextStyle}>{courseDashboardError}</p>
                <p style={emptyStateTextStyle}>{t.retryHelp}</p>
              </div>
            ) : null}
          </section>

          <section id="observer-student-gradebook" style={{ ...sectionStyle, scrollMarginTop: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
              <div>
                <h2 tabIndex={-1} style={sectionTitleStyle}>{t.gradebookTitle}</h2>
                <p style={{ marginTop: 0, color: "#4b5563", lineHeight: 1.5 }}>
                  {t.gradebookHelp}
                </p>
              </div>
              <button type="button" onClick={() => window.print()} style={backButtonStyle}>
                {t.printGradebook}
              </button>
            </div>

            {!courseDashboardReady ? (
              <div style={emptyStateStyle}>
                <div style={emptyStateTitleStyle}>{t.waitingGradebook}</div>
                <p style={emptyStateTextStyle}>{t.waitingGradebookHelp}</p>
              </div>
            ) : (
              <>
                <div style={metricGridStyle}>
                  <MetricCard title={t.currentStanding} value={readOnlyGradebook?.current_percent == null ? "N/A" : formatPercent(readOnlyGradebook.current_percent)} />
                  <MetricCard title={t.proficiency} value={t[readOnlyGradebook?.proficiency] || readOnlyGradebook?.proficiency || t.notAvailable} />
                  <MetricCard title={t.gradedWeight} value={formatPercent(readOnlyGradebook?.graded_weight_percent || 0)} />
                  <MetricCard title={t.earnedPoints} value={formatPercent(readOnlyGradebook?.earned_course_points || 0)} />
                </div>

                <p style={{color:"#4b5563",lineHeight:1.6}}>{language === "zh" ? "当前课程成绩仅根据已评分的作业计算。已评分权重表示这些作业占整门课程的比例；课程加权分表示已计入总成绩的分数。尚未评分不等于零分。" : "Current standing uses graded work only. Graded weight is the share of the course already assessed; earned course points are its contribution to the full course. Unmarked work is not a zero."}</p>
                <div style={{ marginTop: "18px" }}>
                  <h3 style={{ margin: "0 0 10px", fontSize: "1.15rem" }}>{t.kduSnapshot}</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                    {[
                      ["KNOW", readOnlyGradebook?.kdu_summary?.KNOW],
                      ["DO", readOnlyGradebook?.kdu_summary?.DO],
                      ["UNDERSTAND", readOnlyGradebook?.kdu_summary?.UNDERSTAND],
                    ].map(([label, value]) => (
                      <Card key={label}>
                        <div style={{ fontWeight: 900 }}>{t[label] || label}</div>
                        <div style={{ marginTop: "6px", fontSize: "1.5rem", fontWeight: 900 }}>{formatKdu(value)}</div>
                        <div style={{ marginTop: "4px", color: "#4b5563" }}>{t.kduHelp}</div>
                      </Card>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: "20px" }}>
                  <h3 style={{ margin: "0 0 10px", fontSize: "1.15rem" }}>{t.pathways}</h3>
                  {toArray(readOnlyGradebook?.group_breakdown).length === 0 ? (
                    <div style={emptyStateStyle}>
                      <div style={emptyStateTitleStyle}>{t.noPathways}</div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: "10px" }}>
                      {readOnlyGradebook.group_breakdown.map((group) => (
                        <Card key={`gradebook-group-${group.subcategory_id}`}>
                          <div style={{ fontWeight: 900, fontSize: "1.05rem" }}>{group.category_name}</div>
                          <div style={{ marginTop: "4px", color: "#4b5563", fontWeight: 700 }}>{group.subcategory_name}</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: "8px", marginTop: "12px" }}>
                            <InfoLine label={t.courseWeight} value={formatPercent(group.course_weight_percent)} />
                            <InfoLine label={t.gradedAssignments} value={`${group.graded_assignment_count} ${t.of} ${group.assignment_count}`} />
                            <InfoLine label={t.tierAverage} value={group.average_score == null ? t.notGraded : formatPercent(group.average_score)} />
                            <InfoLine label={t.courseContribution} value={formatPercent(group.earned_course_points)} />
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>{t.communicationTools}</h2>
            <p style={{ marginTop: 0, color: "#4b5563", lineHeight: 1.5 }}>
              Create a quick student progress snapshot for parent communication.
            </p>

            {isChineseHomeroomTeacher ? (
              <div
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: "14px",
                  padding: "16px",
                  marginBottom: "16px",
                  background: "#f8fafc",
                }}
              >
                <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>
                  {t.contactTeacher}
                </h3>

                {selectedCourse.teacher_email ? (
                  <>
                    <div style={{ marginBottom: "12px", color: "#374151", lineHeight: 1.5 }}>
                      <strong>{selectedCourse.teacher_name || t.courseTeacher}</strong>
                      <br />
                      {selectedCourse.teacher_email}
                    </div>

                    <div style={buttonRowStyle}>
                      <button type="button" onClick={emailCourseTeacher} style={actionButtonStyle}>
                        {t.emailTeacher}
                      </button>
                      <button type="button" onClick={copyTeacherEmail} style={actionButtonStyle}>
                        {t.copyTeacherEmail}
                      </button>
                      <button type="button" onClick={copyWeChatMessage} style={actionButtonStyle}>
                        {t.copyWechat}
                      </button>
                    </div>
                  </>
                ) : (
                  <p style={{ margin: 0, color: "#4b5563" }}>
                    {t.noTeacherContact}
                  </p>
                )}
              </div>
            ) : null}

            <div style={buttonRowStyle}>
              <button type="button" onClick={copyStudentSnapshot} style={actionButtonStyle}>
                {t.copySnapshot}
              </button>
              <button type="button" onClick={emailStudentSnapshot} style={actionButtonStyle}>
                {t.copyOutlook}
              </button>
              <button type="button" onClick={printStudentSnapshot} style={actionButtonStyle}>
                {t.printSnapshot}
              </button>
            </div>

            {snapshotMessage ? (
              <p style={{ marginBottom: 0, fontWeight: 800 }}>{snapshotMessage}</p>
            ) : null}
          </section>

          <section id="observer-student-attention" style={{...sectionStyle,scrollMarginTop:20}}>
            <h2 tabIndex={-1} style={sectionTitleStyle}>{t.needsAttention}</h2>

            {!courseDashboardReady ? (
              <div style={emptyStateStyle}>
                <div style={emptyStateTitleStyle}>{t.waitingCourse}</div>
                <p style={emptyStateTextStyle}>{t.waitingAssignments}</p>
              </div>
            ) : readOnlyMissingItems.length === 0 ? (
              <div style={emptyStateStyle}>
              <div style={emptyStateTitleStyle}>{t.noAttention}</div>
              <p style={emptyStateTextStyle}>{t.noAttentionHelp}</p>
            </div>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {readOnlyMissingItems.map(({ assignment, submission, submissionStatus }) => (
                  <Card key={`missing-${assignment.id}`}>
                    <div style={{ fontWeight: 900 }}>{assignment.title || "Assignment"}</div>
                    <InfoLine label={t.due} value={dueText(assignment.due_date)} />
                    <InfoLine label={t.attentionReason} value={t[observerWorkStatus({assignment, submission, submissionStatus})]} />
                    <InfoLine label={t.feedback} value={submission?.feedback || t.noFeedback} />
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section id="observer-student-work" style={{...sectionStyle,scrollMarginTop:20}}>
            <h2 tabIndex={-1} style={sectionTitleStyle}>{t.studentWorkSection}</h2>

            {!courseDashboardReady ? (
              <div style={emptyStateStyle}>
                <div style={emptyStateTitleStyle}>{t.waitingCourse}</div>
                <p style={emptyStateTextStyle}>{t.waitingWork}</p>
              </div>
            ) : readOnlyCourseItems.length === 0 ? (
              <div style={emptyStateStyle}>
              <div style={emptyStateTitleStyle}>{t.noWork}</div>
              <p style={emptyStateTextStyle}>{t.noWorkHelp}</p>
            </div>
            ) : (
              <div style={{ display: "grid", gap: "14px" }}>
                {readOnlyCourseItems.map(({ assignment, submission, submissionStatus }) => (
                  <Card key={assignment.id}>
                    <div style={{ fontSize: "1.1rem", fontWeight: 900, marginBottom: "8px" }}>
                      {assignment.title || "Assignment"}
                    </div>

                    <InfoLine label={t.due} value={dueText(assignment.due_date)} />
                    <InfoLine label={t.assessmentPathway} value={assignment.category_name || t.notAssigned} />
                    <InfoLine label={t.evidenceTier} value={assignment.subcategory_name || t.notAssigned} />
                    <InfoLine label={t.submission} value={submissionStatus === "submitted" ? t.submitted : t[observerWorkStatus({assignment, submission, submissionStatus})]} />

                    <InfoLine
                      label={t.score}
                      value={
                        submission?.score !== null && submission?.score !== undefined && submission?.score !== ""
                          ? String(submission.score)
                          : t.notGraded
                      }
                    />
                    <InfoLine label={t.grade} value={submission?.grade || t.notGraded} />
                    <InfoLine label={t.feedback} value={submission?.feedback || t.noFeedback} />

                    {toArray(submission?.files).length > 0 ? (
                      <div style={{ marginTop: "10px" }}>
                        <strong>{t.attachments}:</strong>
                        <div style={{ display: "grid", gap: "6px", marginTop: "6px" }}>
                          {submission.files.map((file) => (
                            <a
                              key={file.id}
                              href={`${API_BASE}${file.file_path}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: "#111827",
                                textDecoration: "underline",
                                fontWeight: 700,
                              }}
                            >
                              {file.file_name || t.attachedFile}
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section id="observer-student-lessons" style={{...sectionStyle,scrollMarginTop:20}}>
            <h2 tabIndex={-1} style={sectionTitleStyle}>{t.lessonMaterials}</h2>
            {!courseDashboardReady ? (
              <div style={emptyStateStyle}>
                <div style={emptyStateTitleStyle}>{t.waitingLessons}</div>
                <p style={emptyStateTextStyle}>{t.waitingLessonsHelp}</p>
              </div>
            ) : toArray(courseDashboard?.lessons).length === 0 ? (
              <div style={emptyStateStyle}>
                <div style={emptyStateTitleStyle}>{t.noLessons}</div>
                <p style={emptyStateTextStyle}>{t.noLessonsHelp}</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {courseDashboard.lessons.map((lesson) => (
                  <Card key={`lesson-${lesson.id}`}>
                    <div style={{ fontSize: "1.1rem", fontWeight: 900, marginBottom: "8px" }}>{lesson.title}</div>
                    <div style={{ color: "#4b5563", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                      {lesson.content || t.noLessonDescription}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>{t.courseSummary}</h2>
            <p style={{ margin: 0, color: "#4b5563", lineHeight: 1.55 }}>
              {t.courseSummaryHelp}
            </p>
          </section>
        </div>
      ) : null}
    </div>
  )
}

const topBarStyle = {
  marginBottom: "24px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
}

const sectionStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "18px",
  padding: "18px",
  background: "#f8fafc",
}

const sectionTitleStyle = {
  marginTop: 0,
  marginBottom: "14px",
  fontSize: "1.35rem",
}

const contextLabelStyle = {
  color: "#4b5563",
  fontSize: "0.78rem",
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: "4px",
}

const emptyStateStyle = {
  border: "1px dashed #cbd5e1",
  borderRadius: "14px",
  padding: "16px",
  background: "#ffffff",
}

const emptyStateTitleStyle = {
  fontWeight: 900,
  marginBottom: "6px",
}

const emptyStateTextStyle = {
  margin: 0,
  color: "#4b5563",
  lineHeight: 1.5,
}

const cardGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "14px",
}

const metricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
}

const buttonRowStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
}

const backButtonRowStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
}

const actionButtonStyle = {
  border: "1px solid #111827",
  background: "#111827",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
}

const searchInputStyle = {
  width: "100%",
  maxWidth: "620px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "11px 12px",
  fontSize: "16px",
  boxSizing: "border-box",
}

const checkboxCardStyle = {
  display: "flex",
  gap: "12px",
  alignItems: "flex-start",
  border: "1px solid #d7dce5",
  borderRadius: "14px",
  padding: "14px",
  background: "#ffffff",
  cursor: "pointer",
}

const languageSelectStyle = {
  border: "1px solid #111827",
  background: "#ffffff",
  color: "#111827",
  borderRadius: "10px",
  padding: "9px 12px",
  fontWeight: 800,
  cursor: "pointer",
}

const logoutButtonStyle = {
  border: "1px solid #111",
  background: "#ffffff",
  color: "#111",
  borderRadius: "10px",
  padding: "10px 14px",
  fontWeight: 800,
  cursor: "pointer",
}

const backButtonStyle = {
  border: "1px solid #111827",
  background: "#ffffff",
  color: "#111827",
  borderRadius: "10px",
  padding: "8px 12px",
  fontWeight: 800,
  cursor: "pointer",
  marginBottom: "14px",
}
