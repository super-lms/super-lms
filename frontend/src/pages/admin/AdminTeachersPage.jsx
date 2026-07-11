import { useEffect, useMemo, useState } from "react"
import authFetch from "../../services/authFetch"

export default function AdminTeachersPage() {
  const [users, setUsers] = useState([])
  const [courses, setCourses] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [status, setStatus] = useState("loading")
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function loadFacultyData() {
      try {
        setStatus("loading")
        setError("")

        const [usersResponse, coursesResponse] = await Promise.all([
          authFetch("/api/users"),
          authFetch("/api/courses"),
        ])

        const usersData = await usersResponse.json()
        const coursesData = await coursesResponse.json()

        if (!usersResponse.ok) {
          throw new Error(usersData.error || "Failed to load users")
        }

        if (!coursesResponse.ok) {
          throw new Error(coursesData.error || "Failed to load courses")
        }

        if (isMounted) {
          setUsers(Array.isArray(usersData) ? usersData : [])
          setCourses(Array.isArray(coursesData) ? coursesData : [])
          setStatus("ready")
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load faculty directory")
          setStatus("error")
        }
      }
    }

    loadFacultyData()

    return () => {
      isMounted = false
    }
  }, [])

  const teachers = useMemo(() => {
    return users
      .filter((user) => String(user.role || "").toLowerCase() === "teacher" || courses.some((course) => Number(course.teacher_id) === Number(user.id)))
      .map((teacher) => {
        const teacherCourses = courses.filter((course) => Number(course.teacher_id) === Number(teacher.id))
        const totalStudents = teacherCourses.reduce((sum, course) => sum + Number(course.student_count || 0), 0)

        return {
          ...teacher,
          courses: teacherCourses,
          courseCount: teacherCourses.length,
          totalStudents,
        }
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
  }, [users, courses])

  const filteredTeachers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    if (!term) {
      return teachers
    }

    return teachers.filter((teacher) => {
      const name = String(teacher.name || "").toLowerCase()
      const email = String(teacher.email || "").toLowerCase()
      const id = String(teacher.id || "").toLowerCase()
      const courseTitles = teacher.courses.map((course) => course.title).join(" ").toLowerCase()

      return name.includes(term) || email.includes(term) || id.includes(term) || courseTitles.includes(term)
    })
  }, [teachers, searchTerm])

  const emailCount = teachers.filter((teacher) => teacher.email).length
  const activeCourseCount = courses.filter((course) => course.teacher_id).length
  const totalStudentSeats = teachers.reduce((sum, teacher) => sum + teacher.totalStudents, 0)

  return (
    <div>
      <div style={{ marginBottom: "22px" }}>
        <h1 style={{ margin: 0, fontSize: "28px" }}>Faculty Directory</h1>
        <p style={{ margin: "8px 0 0", fontSize: "16px", color: "#4b5563", lineHeight: 1.6 }}>
          Live faculty management view using existing teacher, course, and enrollment data.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
          marginBottom: "18px",
        }}
      >
        <SummaryCard label="Faculty Members" value={teachers.length} />
        <SummaryCard label="Email Accounts" value={emailCount} />
        <SummaryCard label="Active Courses" value={activeCourseCount} />
        <SummaryCard label="Student Seats" value={totalStudentSeats} />
      </div>

      <div
        style={{
          background: "white",
          border: "1px solid #d7d7d7",
          borderRadius: "14px",
          padding: "16px",
          marginBottom: "18px",
        }}
      >
        <label style={{ display: "block", fontWeight: 800, marginBottom: "8px" }}>
          Search Faculty
        </label>
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by name, email, user ID, or course"
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid #cbd5e1",
            borderRadius: "10px",
            padding: "12px",
            fontSize: "15px",
          }}
        />
      </div>

      {status === "loading" && (
        <div style={{ background: "white", border: "1px solid #d7d7d7", borderRadius: "14px", padding: "18px" }}>
          Loading faculty directory...
        </div>
      )}

      {status === "error" && (
        <div style={{ background: "white", border: "1px solid #b91c1c", borderRadius: "14px", padding: "18px" }}>
          <strong>Unable to load faculty directory.</strong>
          <div style={{ marginTop: "8px", color: "#7f1d1d" }}>{error}</div>
        </div>
      )}

      {status === "ready" && (
        <div
          style={{
            background: "white",
            border: "1px solid #d7d7d7",
            borderRadius: "14px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "80px 1.2fr 1.5fr 110px 120px 2fr",
              gap: "12px",
              padding: "12px 16px",
              background: "#f8fafc",
              borderBottom: "1px solid #d7d7d7",
              fontWeight: 800,
              fontSize: "14px",
            }}
          >
            <div>ID</div>
            <div>Name</div>
            <div>Email</div>
            <div>Courses</div>
            <div>Students</div>
            <div>Active Courses</div>
          </div>

          {filteredTeachers.length === 0 ? (
            <div style={{ padding: "18px", color: "#4b5563" }}>
              No faculty members match the current search.
            </div>
          ) : (
            filteredTeachers.map((teacher) => (
              <div
                key={teacher.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1.2fr 1.5fr 110px 120px 2fr",
                  gap: "12px",
                  padding: "14px 16px",
                  borderBottom: "1px solid #e5e7eb",
                  alignItems: "start",
                  fontSize: "15px",
                }}
              >
                <div style={{ fontWeight: 800 }}>{teacher.id}</div>
                <div style={{ fontWeight: 700 }}>{teacher.name || "Unnamed Teacher"}</div>
                <div style={{ color: "#374151", overflowWrap: "anywhere" }}>
                  {teacher.email || "No email listed"}
                </div>
                <div style={{ fontWeight: 800 }}>{teacher.courseCount}</div>
                <div style={{ fontWeight: 800 }}>{teacher.totalStudents}</div>
                <div>
                  {teacher.courses.length === 0 ? (
                    <span style={{ color: "#6b7280" }}>No active courses</span>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {teacher.courses.map((course) => (
                        <div key={course.id} style={{ lineHeight: 1.35 }}>
                          <strong>{course.title}</strong>
                          <span style={{ color: "#6b7280" }}> · {Number(course.student_count || 0)} students</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #d7d7d7",
        borderRadius: "12px",
        padding: "16px",
      }}
    >
      <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "26px", fontWeight: 800 }}>{value}</div>
    </div>
  )
}
