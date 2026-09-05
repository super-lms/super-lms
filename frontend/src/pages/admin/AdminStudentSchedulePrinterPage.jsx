import { useEffect, useMemo, useState } from "react"
import { Pencil, Printer, RefreshCw, Save, Trash2 } from "lucide-react"
import authFetch from "../../services/authFetch"

const BLOCKS = [
  { key: "block1", label: "Block 1", time: "8:45–9:45 AM" },
  { key: "block2", label: "Block 2", time: "9:50–10:50 AM" },
  { key: "block3", label: "Block 3", time: "11:00–11:59 AM" },
  { key: "block4", label: "Block 4", time: "2:00–3:00 PM" },
  { key: "after_school", label: "BC Calculus", time: "3:00–4:00 PM" },
]

const SEMESTER_OPTIONS = [
  { value: "unassigned", label: "Not assigned" },
  { value: "semester1", label: "Semester 1" },
  { value: "semester2", label: "Semester 2" },
  { value: "full_year", label: "Full year" },
]

const BLOCK_OPTIONS = [
  { value: "unassigned", label: "Not assigned" },
  ...BLOCKS.map((block) => ({ value: block.key, label: `${block.label} — ${block.time}` })),
]

function compactCourseTitle(title) {
  return String(title || "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

function timetableTeacherName(value) {
  const original = String(value || "").trim()
  const key = original.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "")
  const aliases = [
    [["carriefang", "drcarrie", "carrie"], "Dr. Carrie"],
    [["michaelsamuels", "mrsamuels", "samuels"], "Mr. Samuels"],
    [["nicolinevanderwatt", "msvanderwatt", "vanderwatt"], "Ms. Van der Watt"],
    [["davidcheng", "mrcheng", "cheng"], "Mr. Cheng"],
    [["mrfeng", "feng"], "Mr. Feng"],
    [["mrrobinson", "robinson"], "Mr. Robinson"],
    [["msmoses", "moses"], "Ms. Moses"],
    [["msboyd", "boyd"], "Ms. Boyd"],
    [["drdvainer", "drvainer", "vainer"], "Dr. D. Vainer"],
    [["mrpniu", "peteniu", "pniu"], "Mr. P. Niu"],
    [["drbrecht", "davidbrecht", "drb"], "Dr. B"],
    [["mrnhansen", "nhansen", "hansen"], "Mr. N. Hansen"],
    [["academicplanning12teacher"], "Academic Planning 12 Teacher"],
  ]

  return aliases.find(([matches]) => matches.some((match) => key === match || key.includes(match)))?.[1] || original || "Teacher TBA"
}

function defaultScheduleForCourse(title) {
  const key = compactCourseTitle(title)
  const section = key.match(/([abcd])$/)?.[1]?.toUpperCase() || ""
  const bySection = (semester, blocks) => blocks[section] ? { semester, block_key: blocks[section] } : null

  if (key.startsWith("bccalculus12")) return { semester: "semester2", block_key: "after_school" }

  if (key.startsWith("cts10")) return bySection("semester1", { A: "block1", B: "block2", C: "block3", D: "block4" })
  if (key.startsWith("pe10")) return bySection("semester1", { A: "block4", B: "block1", C: "block2", D: "block3" })
  if (key.startsWith("elsl11")) return bySection("semester1", { A: "block3", B: "block2", C: "block1" })
  if (key.startsWith("efp12")) return bySection("semester1", { A: "block1", B: "block2", C: "block3" })
  if (key.startsWith("physics12")) return bySection("semester1", { A: "block3", B: "block1", C: "block2" })
  if (key.startsWith("physics11") && section === "A") return { semester: "semester1", block_key: "block1" }
  if (key.startsWith("precalculus11")) return bySection(section === "A" ? "semester2" : "semester1", { A: "block1", B: "block3", C: "block4" })
  if (key.startsWith("physicalgeography11") || key.startsWith("pgeo11")) return bySection(section === "A" ? "semester2" : "semester1", { A: "block3", B: "block1", C: "block2" })
  if (key.startsWith("socialstudies10")) return bySection(["A", "B"].includes(section) ? "semester1" : "semester2", { A: "block3", B: "block4", C: "block2", D: "block4" })
  if (key.startsWith("science10")) return bySection(section === "D" ? "semester1" : "semester2", { A: "block4", B: "block2", C: "block1", D: "block2" })
  if (key.startsWith("fmp10")) return bySection(section === "C" ? "semester1" : "semester2", { A: "block1", B: "block3", C: "block1", D: "block3" })
  if (key.startsWith("spokenlanguage10") || key.startsWith("newmedia10")) return bySection("semester1", { A: "block2", B: "block3", C: "block4", D: "block1" })
  if (key.startsWith("chemistry11") || key.startsWith("chem11")) return bySection(section === "B" ? "semester2" : "semester1", { A: "block4", B: "block1", C: "block3" })
  if (key.startsWith("chemistry12") || key.startsWith("chem12")) return bySection(section === "C" ? "semester1" : "semester2", { A: "block3", B: "block2", C: "block1" })
  if (key.startsWith("accounting11")) return bySection(section === "C" ? "semester2" : "semester1", { A: "block2", B: "block4", C: "block2" })
  if (key.startsWith("clc12")) return { semester: "semester1", block_key: "block4" }
  if (key.startsWith("academicplanning12") || key.startsWith("avademicplanning12")) {
    return bySection(section === "C" ? "semester2" : "semester1", { A: "block2", B: "block3", C: "block1" })
  }

  if (key.startsWith("composition10") || key.startsWith("creativewriting10")) return bySection("semester2", { A: "block3", B: "block1", C: "block4", D: "block2" })
  if (key.startsWith("physics11")) return bySection("semester2", { B: "block2", C: "block3" })
  if (key.startsWith("fitnessandconditioning1112")) return { semester: "semester2", block_key: "block4" }
  if (key.startsWith("precalculus12")) return bySection("semester2", { A: "block1", B: "block3", C: "block2" })
  if (key.startsWith("composition11")) return bySection("semester2", { A: "block2", B: "block3", C: "block1" })
  if (key.startsWith("marketingandpromotion11")) return { semester: "semester2", block_key: "block4" }
  if (key.startsWith("englishstudies12") || key.startsWith("enst12")) return bySection("semester2", { A: "block2", B: "block1", C: "block3" })
  if (key.startsWith("drama10")) return bySection("semester2", { A: "block2", B: "block4", C: "block3", D: "block1" })
  if (key.startsWith("economictheory12")) return { semester: "semester2", block_key: "block4" }
  if (key.includes("computergamebuilding")) return { semester: "semester2", block_key: "block4" }

  return null
}

function inferCohort(studentId, courseTitles) {
  const temporaryIdMatch = String(studentId || "").toUpperCase().match(/^G(10[ABCD])-/)
  if (temporaryIdMatch) return temporaryIdMatch[1]

  const counts = new Map()
  courseTitles.forEach((title) => {
    const match = String(title || "").trim().match(/(?:^|\s)(10|11|12)([A-D])$/i)
    if (!match) return
    const cohort = `${match[1]}${match[2].toUpperCase()}`
    counts.set(cohort, (counts.get(cohort) || 0) + 1)
  })

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unassigned"
}

function buildData(rows) {
  const courseMap = new Map()
  const studentMap = new Map()

  rows.forEach((row) => {
    const courseId = Number(row.course_id)
    if (!courseMap.has(courseId)) {
      const screenshotDefault = defaultScheduleForCourse(row.course_title)
      const storedSemester = row.semester || "unassigned"
      const storedBlock = row.block_key || "unassigned"
      courseMap.set(courseId, {
        id: courseId,
        title: row.course_title || `Course ${courseId}`,
        teacher: timetableTeacherName(row.teacher_name),
        teacherEmail: row.teacher_email || "",
        description: row.course_description || "",
        enrolledStudentCount: 0,
        semester: storedSemester === "unassigned" && screenshotDefault ? screenshotDefault.semester : storedSemester,
        block_key: storedBlock === "unassigned" && screenshotDefault ? screenshotDefault.block_key : storedBlock,
        room: row.room || "TBA",
      })
    }

    if (!row.student_user_id) return

    const studentId = Number(row.student_user_id)
    if (!studentMap.has(studentId)) {
      studentMap.set(studentId, {
        id: studentId,
        name: row.student_name || row.student_email || "Unnamed Student",
        email: row.student_email || "",
        student_id: row.student_id || "",
        courseIds: [],
      })
    }

    studentMap.get(studentId).courseIds.push(courseId)
    courseMap.get(courseId).enrolledStudentCount += 1
  })

  const courses = Array.from(courseMap.values()).sort((a, b) => a.title.localeCompare(b.title))
  const students = Array.from(studentMap.values())
    .map((student) => ({
      ...student,
      cohort: inferCohort(
        student.student_id,
        student.courseIds.map((courseId) => courseMap.get(courseId)?.title)
      ),
    }))
    .sort((a, b) => a.cohort.localeCompare(b.cohort) || a.name.localeCompare(b.name))

  return { courses, students }
}

function requiredGrade12Courses(cohort, semester, courses) {
  const match = String(cohort || "").toUpperCase().match(/^12([ABC])$/)
  if (!match) return []

  const section = match[1].toLowerCase()
  const findSection = (prefixes) => courses.find((course) => {
    const key = compactCourseTitle(course.title)
    return prefixes.some((prefix) => key === `${prefix}${section}`)
  })
  const forceCourse = (course, fallback, blockKey) => ({
    ...(course || fallback),
    semester,
    block_key: blockKey,
  })
  const academicPlanningCourse = courses.find((course) => {
    const key = compactCourseTitle(course.title)
    return key.includes(`planning12${section}`)
  })

  if (semester === "semester2") {
    if (match[1] !== "C") return []
    return [forceCourse(academicPlanningCourse, {
      id: `required-academic-planning-${cohort}`,
      title: `Academic Planning ${cohort}`,
      teacher: "Academic Planning 12 Teacher",
      room: "TBA",
    }, "block1")]
  }

  if (semester !== "semester1") return []

  const clcCourse = findSection(["clc12"])
    || courses.find((course) => compactCourseTitle(course.title).startsWith("clc12"))
  const blockOneCourse = match[1] === "C"
    ? forceCourse(findSection(["chemistry12", "chem12"]), {
        id: `required-chemistry-${cohort}`,
        title: `Chemistry ${cohort}`,
        teacher: "Dr. D. Vainer",
        room: "TBA",
      }, "block1")
    : null
  const academicPlanning = match[1] === "C" ? null : forceCourse(academicPlanningCourse, {
    id: `required-academic-planning-${cohort}`,
    title: `Academic Planning ${cohort}`,
    teacher: "Academic Planning 12 Teacher",
    room: "TBA",
  }, { A: "block2", B: "block3" }[match[1]])

  return [
    blockOneCourse,
    academicPlanning,
    forceCourse(findSection(["physics12"]), {
      id: `required-physics-${cohort}`,
      title: `Physics ${cohort}`,
      teacher: "Mr. Robinson",
      room: "TBA",
    }, { A: "block3", B: "block1", C: "block2" }[match[1]]),
    forceCourse(findSection(["efp12"]), {
      id: `required-efp-${cohort}`,
      title: `EFP ${cohort}`,
      teacher: "Ms. Moses",
      room: "TBA",
    }, { A: "block1", B: "block2", C: "block3" }[match[1]]),
    forceCourse(clcCourse, {
      id: `required-clc-${cohort}`,
      title: "CLC 12A / 12B / 12C",
      teacher: "Dr. B",
      room: "TBA",
    }, "block4"),
  ].filter(Boolean)
}

export default function AdminStudentSchedulePrinterPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [semester, setSemester] = useState("semester1")
  const [cohort, setCohort] = useState("all")
  const [studentId, setStudentId] = useState("all")
  const [courseSearch, setCourseSearch] = useState("")
  const [savingCourseId, setSavingCourseId] = useState(null)
  const [editingCourseId, setEditingCourseId] = useState(null)
  const [deletingCourseId, setDeletingCourseId] = useState(null)

  const { courses, students } = useMemo(() => buildData(rows), [rows])
  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses])

  async function loadSchedules() {
    try {
      setLoading(true)
      setError("")
      const response = await authFetch("/api/admin/student-schedules")
      const data = await response.json()
      if (!response.ok || data?.success === false) throw new Error(data?.error || "Failed to load schedules")
      setRows(Array.isArray(data?.rows) ? data.rows : [])
    } catch (err) {
      setError(err.message || "Failed to load schedules")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSchedules()
  }, [])

  const cohorts = useMemo(
    () => Array.from(new Set(students.map((student) => student.cohort))).sort(),
    [students]
  )

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (cohort !== "all" && student.cohort !== cohort) return false
      if (studentId !== "all" && String(student.id) !== studentId) return false
      return true
    })
  }, [students, cohort, studentId])

  const visibleCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase()
    return courses.filter((course) => !query || course.title.toLowerCase().includes(query))
  }, [courses, courseSearch])

  const unassignedCount = courses.filter(
    (course) => course.semester === "unassigned" || course.block_key === "unassigned"
  ).length

  async function saveCourse(course, changes) {
    const nextCourse = { ...course, ...changes }
    try {
      setSavingCourseId(course.id)
      setMessage("")
      const response = await authFetch(`/api/admin/student-schedules/courses/${course.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semester: nextCourse.semester,
          block_key: nextCourse.block_key,
          room: nextCourse.room || "TBA",
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || "Failed to save course schedule")

      setRows((currentRows) =>
        currentRows.map((row) =>
          Number(row.course_id) === course.id
            ? { ...row, semester: nextCourse.semester, block_key: nextCourse.block_key, room: nextCourse.room || "TBA" }
            : row
        )
      )
      setMessage(`${course.title} schedule saved.`)
    } catch (err) {
      setError(err.message || "Failed to save course schedule")
    } finally {
      setSavingCourseId(null)
    }
  }

  async function editCourse(course) {
    const title = window.prompt("Course name:", course.title)
    if (title === null) return
    if (!title.trim()) {
      setError("Course name cannot be blank.")
      return
    }

    const teacherEmail = window.prompt(
      "Teacher email (leave blank to make the teacher unassigned):",
      course.teacherEmail
    )
    if (teacherEmail === null) return

    try {
      setEditingCourseId(course.id)
      setError("")
      setMessage("")
      const response = await authFetch(`/api/courses/${course.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: course.description,
          teacher_email: teacherEmail.trim(),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || "Failed to edit course")
      setMessage(`${title.trim()} was updated.`)
      await loadSchedules()
    } catch (err) {
      setError(err.message || "Failed to edit course")
    } finally {
      setEditingCourseId(null)
    }
  }

  async function deleteCourse(course) {
    const enrollmentNote = course.enrolledStudentCount
      ? ` This will also remove it from ${course.enrolledStudentCount} student schedule${course.enrolledStudentCount === 1 ? "" : "s"}.`
      : ""
    if (!window.confirm(`Delete “${course.title}” and its schedule setting?${enrollmentNote}`)) return

    try {
      setDeletingCourseId(course.id)
      setError("")
      setMessage("")
      const response = await authFetch(`/api/courses/${course.id}`, { method: "DELETE" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || "Failed to delete course")
      setMessage(`${course.title} was deleted and removed from student schedules.`)
      await loadSchedules()
    } catch (err) {
      setError(err.message || "Failed to delete course")
    } finally {
      setDeletingCourseId(null)
    }
  }

  function scheduleForStudent(student) {
    const enrolledEntries = student.courseIds
      .map((courseId) => courseById.get(courseId))
      .filter(Boolean)
      .filter((course) => course.semester === semester || course.semester === "full_year")
      .filter((course) => !(
        student.cohort === "12C"
        && semester === "semester1"
        && compactCourseTitle(course.title).includes("planning12c")
      ))

    const requiredEntries = requiredGrade12Courses(student.cohort, semester, courses)
    const entries = Array.from(
      new Map([...enrolledEntries, ...requiredEntries].map((course) => [course.id, course])).values()
    )

    return BLOCKS.map((block) => ({
      ...block,
      courses: combineLinkedCourses(entries.filter((course) => course.block_key === block.key)),
    }))
  }

  return (
    <div>
      <style>{printCss}</style>

      <div className="schedule-controls">
        <div style={heroStyle}>
          <div>
            <h1 style={{ margin: 0, fontSize: "30px", color: "#111827" }}>Student Schedule Printer</h1>
            <p style={{ margin: "10px 0 0", color: "#4b5563", lineHeight: 1.55 }}>
              Monday–Thursday schedules. Assign each course to a semester and block once, then print one page per student.
            </p>
          </div>
          <button type="button" onClick={loadSchedules} style={secondaryButtonStyle}>
            <RefreshCw size={17} /> Refresh
          </button>
        </div>

        {loading ? <div style={noticeStyle}>Loading school enrollments…</div> : null}
        {error ? <div style={errorStyle}>{error}</div> : null}
        {message ? <div style={successStyle}>{message}</div> : null}

        {!loading && !error ? (
          <>
            <div style={summaryGridStyle}>
              <SummaryCard label="Students" value={students.length} />
              <SummaryCard label="Courses" value={courses.length} />
              <SummaryCard label="Schedules Selected" value={filteredStudents.length} />
              <SummaryCard label="Courses Needing a Block" value={unassignedCount} warning={unassignedCount > 0} />
            </div>

            <details style={setupStyle} open={unassignedCount > 0}>
              <summary style={setupSummaryStyle}>1. Course Schedule Setup</summary>
              <p style={{ color: "#4b5563", lineHeight: 1.5 }}>
                Choose the semester and block for each section. Rooms may stay as TBA and can be updated later.
              </p>
              <input
                value={courseSearch}
                onChange={(event) => setCourseSearch(event.target.value)}
                placeholder="Search courses"
                style={searchStyle}
              />
              <div style={courseTableStyle}>
                <div style={courseHeaderStyle}>
                  <div>Course and Teacher</div><div>Semester</div><div>Block</div><div>Room</div><div>Status and Actions</div>
                </div>
                {visibleCourses.map((course) => (
                  <div key={course.id} style={courseRowStyle}>
                    <div><strong>{course.title}</strong><div style={mutedStyle}>{course.teacher}</div></div>
                    <select value={course.semester} onChange={(e) => saveCourse(course, { semester: e.target.value })} style={selectStyle}>
                      {SEMESTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <select value={course.block_key} onChange={(e) => saveCourse(course, { block_key: e.target.value })} style={selectStyle}>
                      {BLOCK_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <input
                      value={course.room}
                      onChange={(event) => {
                        const room = event.target.value
                        setRows((current) => current.map((row) => Number(row.course_id) === course.id ? { ...row, room } : row))
                      }}
                      onBlur={(event) => saveCourse({ ...course, room: event.target.value }, {})}
                      placeholder="TBA"
                      style={selectStyle}
                    />
                    <div style={actionColumnStyle}>
                      <div style={mutedStyle}>{savingCourseId === course.id ? "Saving…" : <><Save size={15} /> Saved</>}</div>
                      <div style={actionRowStyle}>
                        <button type="button" onClick={() => editCourse(course)} disabled={editingCourseId === course.id || deletingCourseId === course.id} style={smallButtonStyle}>
                          <Pencil size={14} /> {editingCourseId === course.id ? "Editing…" : "Edit"}
                        </button>
                        <button type="button" onClick={() => deleteCourse(course)} disabled={deletingCourseId === course.id || editingCourseId === course.id} style={deleteButtonStyle}>
                          <Trash2 size={14} /> {deletingCourseId === course.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>

            <div style={printSetupStyle}>
              <h2 style={{ margin: 0, fontSize: "22px" }}>2. Choose Schedules to Print</h2>
              <div style={filterGridStyle}>
                <label style={labelStyle}>Semester<select value={semester} onChange={(e) => setSemester(e.target.value)} style={selectStyle}><option value="semester1">Semester 1</option><option value="semester2">Semester 2</option></select></label>
                <label style={labelStyle}>Cohort<select value={cohort} onChange={(e) => { setCohort(e.target.value); setStudentId("all") }} style={selectStyle}><option value="all">All cohorts</option>{cohorts.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label style={labelStyle}>Student<select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={selectStyle}><option value="all">All selected students</option>{students.filter((s) => cohort === "all" || s.cohort === cohort).map((student) => <option key={student.id} value={student.id}>{student.name} — {student.cohort}</option>)}</select></label>
              </div>
              <button type="button" onClick={() => window.print()} disabled={filteredStudents.length === 0} style={primaryButtonStyle}>
                <Printer size={18} /> Print {filteredStudents.length} Student Schedule{filteredStudents.length === 1 ? "" : "s"} / Save as PDF
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div className="schedule-print-area">
        {filteredStudents.map((student) => (
          <StudentSchedulePage
            key={student.id}
            student={student}
            semester={semester}
            schedule={scheduleForStudent(student)}
          />
        ))}
      </div>
    </div>
  )
}

function combineLinkedCourses(courses) {
  const remaining = [...courses]
  const combined = []

  function combinePair(firstPattern, secondPattern, label, note = "") {
    const firstIndex = remaining.findIndex((course) => firstPattern.test(course.title))
    const secondIndex = remaining.findIndex((course) => secondPattern.test(course.title))
    if (firstIndex < 0 || secondIndex < 0) return

    const first = remaining[firstIndex]
    const second = remaining[secondIndex]
    const section = String(first.title).match(/([A-D])$/i)?.[1]?.toUpperCase() || ""
    combined.push({ ...first, id: `${first.id}-${second.id}`, title: `${label}${section ? ` ${section}` : ""}`, note })
    remaining.splice(Math.max(firstIndex, secondIndex), 1)
    remaining.splice(Math.min(firstIndex, secondIndex), 1)
  }

  combinePair(/^Composition 10[A-D]$/i, /^Creative Writing 10[A-D]$/i, "English 10")
  combinePair(
    /^Spoken Language 10[A-D]$/i,
    /^New Media 10[A-D]$/i,
    "Spoken Language / New Media 10",
    "First half / Second half"
  )

  return [...combined, ...remaining].sort((a, b) => a.title.localeCompare(b.title))
}

function StudentSchedulePage({ student, semester, schedule }) {
  return (
    <section className="student-schedule-page">
      <div className="print-brand">SUPER-LMS</div>
      <h1>Student Class Schedule</h1>
      <div className="student-details">
        <div><span>Student</span><strong>{student.name}</strong></div>
        <div><span>Cohort</span><strong>{student.cohort}</strong></div>
        <div><span>Term</span><strong>{semester === "semester1" ? "Semester 1" : "Semester 2"}</strong></div>
        <div><span>Days</span><strong>Monday–Thursday</strong></div>
      </div>
      <table>
        <thead><tr><th>Block</th><th>Time</th><th>Course</th><th>Teacher</th><th>Room</th></tr></thead>
        <tbody>
          {schedule.map((block) => (
            <tr key={block.key}>
              <td>{block.label}</td><td>{block.time}</td>
              <td>{block.courses.length ? block.courses.map((course) => <div className="schedule-cell-item" key={course.id}><strong>{course.title}</strong>{course.note ? <small>{course.note}</small> : null}</div>) : "—"}</td>
              <td>{block.courses.length ? block.courses.map((course) => <div className="schedule-cell-item" key={course.id}>{course.teacher}</div>) : "—"}</td>
              <td>{block.courses.length ? block.courses.map((course) => <div className="schedule-cell-item" key={course.id}>{course.room || "TBA"}</div>) : "TBA"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="schedule-note">Classrooms shown as TBA will be updated when room assignments are finalized.</p>
    </section>
  )
}

function SummaryCard({ label, value, warning }) {
  return <div style={{ ...summaryCardStyle, borderColor: warning ? "#f59e0b" : "#d7d7d7" }}><div style={mutedStyle}>{label}</div><div style={{ fontSize: "28px", fontWeight: 800, marginTop: "5px" }}>{value}</div></div>
}

const heroStyle = { display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", background: "white", border: "1px solid #d7d7d7", borderRadius: "14px", padding: "22px", marginBottom: "16px" }
const noticeStyle = { padding: "16px", background: "white", border: "1px solid #d7d7d7", borderRadius: "12px" }
const errorStyle = { ...noticeStyle, color: "#991b1b", background: "#fef2f2", borderColor: "#fecaca" }
const successStyle = { ...noticeStyle, color: "#166534", background: "#f0fdf4", borderColor: "#bbf7d0", marginBottom: "12px" }
const summaryGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", marginBottom: "18px" }
const summaryCardStyle = { background: "white", border: "1px solid #d7d7d7", borderRadius: "12px", padding: "16px" }
const setupStyle = { background: "white", border: "1px solid #d7d7d7", borderRadius: "14px", padding: "18px", marginBottom: "18px" }
const setupSummaryStyle = { fontSize: "22px", fontWeight: 800, cursor: "pointer" }
const searchStyle = { width: "min(520px, 100%)", boxSizing: "border-box", padding: "11px", border: "1px solid #d1d5db", borderRadius: "9px", fontSize: "15px", marginBottom: "12px" }
const courseTableStyle = { border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }
const courseHeaderStyle = { display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr .8fr 1.35fr", gap: "10px", padding: "11px", background: "#f9fafb", fontWeight: 800 }
const courseRowStyle = { ...courseHeaderStyle, background: "white", fontWeight: 400, borderTop: "1px solid #f1f5f9", alignItems: "center" }
const selectStyle = { width: "100%", boxSizing: "border-box", padding: "10px", border: "1px solid #d1d5db", borderRadius: "8px", background: "white", fontSize: "14px" }
const mutedStyle = { color: "#6b7280", fontSize: "13px", display: "flex", gap: "5px", alignItems: "center" }
const actionColumnStyle = { display: "grid", gap: "8px" }
const actionRowStyle = { display: "flex", flexWrap: "wrap", gap: "6px" }
const smallButtonStyle = { display: "inline-flex", alignItems: "center", gap: "5px", padding: "7px 9px", border: "1px solid #9ca3af", borderRadius: "7px", background: "white", color: "#111827", fontWeight: 700, cursor: "pointer" }
const deleteButtonStyle = { ...smallButtonStyle, borderColor: "#fca5a5", color: "#991b1b", background: "#fff7f7" }
const printSetupStyle = { background: "white", border: "1px solid #d7d7d7", borderRadius: "14px", padding: "20px", marginBottom: "18px" }
const filterGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "14px", margin: "16px 0" }
const labelStyle = { display: "grid", gap: "7px", fontWeight: 700, color: "#374151" }
const primaryButtonStyle = { display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 16px", border: 0, borderRadius: "9px", color: "white", background: "#111827", fontWeight: 800, cursor: "pointer" }
const secondaryButtonStyle = { ...primaryButtonStyle, color: "#111827", background: "white", border: "1px solid #d1d5db" }

const printCss = `
  .schedule-print-area { display: none; }
  @media print {
    @page { size: A4 portrait; margin: 12mm; }
    body { background: white !important; }
    .schedule-controls, .admin-sidebar, .admin-workspace-header, aside, nav { display: none !important; }
    .admin-workspace-main { padding: 0 !important; }
    .admin-workspace-main, .admin-workspace-main > div { width: 100% !important; max-width: none !important; margin: 0 !important; }
    .schedule-print-area { display: block !important; }
    .student-schedule-page { display: block; box-sizing: border-box; min-height: 270mm; padding: 5mm; break-after: page; page-break-after: always; color: #111827; font-family: Arial, sans-serif; }
    .student-schedule-page:last-child { break-after: auto; page-break-after: auto; }
    .student-schedule-page h1 { font-size: 26px; margin: 8px 0 18px; }
    .print-brand { font-size: 13px; font-weight: 900; letter-spacing: 1.5px; color: #4b5563; }
    .student-details { display: grid; grid-template-columns: 1.4fr .7fr .8fr 1fr; gap: 10px; margin-bottom: 20px; }
    .student-details div { border: 1px solid #d1d5db; border-radius: 7px; padding: 10px; }
    .student-details span { display: block; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 5px; }
    .student-details strong { font-size: 15px; }
    .student-schedule-page table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .student-schedule-page th { background: #111827; color: white; text-align: left; padding: 11px 9px; font-size: 13px; }
    .student-schedule-page td { border: 1px solid #d1d5db; padding: 13px 8px; font-size: 12px; vertical-align: top; line-height: 1.35; overflow-wrap: anywhere; word-break: normal; }
    .student-schedule-page th:nth-child(1) { width: 12%; }
    .student-schedule-page th:nth-child(2) { width: 19%; }
    .student-schedule-page th:nth-child(3) { width: 34%; }
    .student-schedule-page th:nth-child(4) { width: 23%; }
    .student-schedule-page th:nth-child(5) { width: 12%; }
    .schedule-cell-item + .schedule-cell-item { margin-top: 7px; padding-top: 7px; border-top: 1px solid #e5e7eb; }
    .schedule-cell-item small { display: block; margin-top: 3px; color: #6b7280; font-size: 10px; font-weight: 400; }
    .schedule-note { margin-top: 18px; color: #6b7280; font-size: 12px; }
  }
`
