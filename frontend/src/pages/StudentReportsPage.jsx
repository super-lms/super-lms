import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../AuthContext.jsx"
import API_BASE from "../apiBase"

function ActionButton({ children, onClick, quiet = false, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: "10px",
        border: "1px solid #d7dce5",
        background: quiet ? "#ffffff" : "#f3f4f6",
        font: "inherit",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  )
}

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
          <p
            style={{
              margin: "6px 0 0 0",
              fontSize: "0.95rem",
              lineHeight: 1.5,
              color: "#4b5563",
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {action || null}
    </div>
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

export default function StudentReportsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [courses, setCourses] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All Categories")
  const [selectedLevel, setSelectedLevel] = useState("All Levels")
  const [reports, setReports] = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [loadingReports, setLoadingReports] = useState(false)
  const [message, setMessage] = useState("Select a course and generate your report.")

  useEffect(() => {
    let isMounted = true

    async function loadVisibleCourses() {
      const studentEmail = String(user?.email || "").trim().toLowerCase()

      if (!studentEmail) {
        if (!isMounted) return
        setCourses([])
        setSelectedCourseId("")
        setLoadingCourses(false)
        setMessage("Student email is missing from the current session.")
        return
      }

      try {
        const [coursesResponse, enrolledStudentsResponse] = await Promise.all([
          fetch(`${API_BASE}/api/courses`),
          fetch(`${API_BASE}/api/enrolled-students`),
        ])

        if (!coursesResponse.ok || !enrolledStudentsResponse.ok) {
          throw new Error("Could not load courses.")
        }

        const [coursesData, enrolledStudentsData] = await Promise.all([
          coursesResponse.json(),
          enrolledStudentsResponse.json(),
        ])

        if (!isMounted) return

        const safeCourses = Array.isArray(coursesData) ? coursesData : []
        const safeEnrolledStudents = Array.isArray(enrolledStudentsData)
          ? enrolledStudentsData
          : []

        const visibleCourseIds = new Set(
          safeEnrolledStudents
            .filter((student) => {
              const enrolledStudentEmail = String(student.student_email || "")
                .trim()
                .toLowerCase()
              return enrolledStudentEmail === studentEmail
            })
            .map((student) => String(student.class_id || ""))
            .filter((classId) => classId !== "")
        )

        const visibleCourses = safeCourses.filter((course) =>
          visibleCourseIds.has(String(course.id))
        )

        setCourses(visibleCourses)

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
          setMessage("No courses are currently available.")
        }
      } catch (err) {
        console.error("Error loading courses:", err)

        if (!isMounted) return

        setCourses([])
        setSelectedCourseId("")
        setMessage("Could not load courses.")
      } finally {
        if (!isMounted) return
        setLoadingCourses(false)
      }
    }

    loadVisibleCourses()

    return () => {
      isMounted = false
    }
  }, [user?.email])

  const generateReport = () => {
    const studentEmail = String(user?.email || "").trim().toLowerCase()
    const studentName = String(user?.name || "").trim().toLowerCase()

    if (!selectedCourseId) {
      setMessage("Please select a course first.")
      setReports([])
      return
    }

    setLoadingReports(true)
    setMessage("Loading report...")

    fetch(`${API_BASE}/api/reports/${selectedCourseId}`)
      .then((res) => res.json())
      .then((data) => {
        const reportRows = Array.isArray(data) ? data : []

        const visibleRows = reportRows.filter((row) => {
          const rowStudentEmail = String(row.student_email || "")
            .trim()
            .toLowerCase()
          const rowStudentName = String(row.student_name || row.student || "")
            .trim()
            .toLowerCase()

          if (studentEmail && rowStudentEmail) {
            return rowStudentEmail === studentEmail
          }

          if (studentName && rowStudentName) {
            return rowStudentName === studentName
          }

          return false
        })

        setReports(visibleRows)

        if (visibleRows.length === 0) {
          setMessage("No report data found for this course.")
        } else {
          setMessage("Report loaded.")
        }

        setLoadingReports(false)
      })
      .catch((err) => {
        console.error("Error loading report:", err)
        setReports([])
        setMessage("Could not load report.")
        setLoadingReports(false)
      })
  }

  const filteredReports = useMemo(() => {
    return reports.filter((row) => {
      const categoryMatch =
        selectedCategory === "All Categories" ||
        row.category_name === selectedCategory ||
        row.category === selectedCategory

      const levelMatch =
        selectedLevel === "All Levels" ||
        row.level_name === selectedLevel ||
        row.level === selectedLevel

      return categoryMatch && levelMatch
    })
  }, [reports, selectedCategory, selectedLevel])

  const categoryOptions = useMemo(() => {
    const values = reports
      .map((row) => row.category_name || row.category)
      .filter(Boolean)

    return ["All Categories", ...new Set(values)]
  }, [reports])

  const levelOptions = useMemo(() => {
    const values = reports
      .map((row) => row.level_name || row.level)
      .filter(Boolean)

    return ["All Levels", ...new Set(values)]
  }, [reports])

  const exportCsv = () => {
    if (filteredReports.length === 0) {
      alert("There is no report data to export.")
      return
    }

    const headers = [
      "Student",
      "Assignment",
      "Category",
      "Level",
      "Score",
      "Weight",
      "Contribution",
    ]

    const rows = filteredReports.map((row) => [
      row.student_name || row.student || "",
      row.assignment_title || row.assignment || "",
      row.category_name || row.category || "",
      row.level_name || row.level || "",
      row.score ?? "",
      row.weight ?? "",
      row.contribution ?? "",
    ])

    const csvContent = [headers, ...rows]
      .map((line) =>
        line
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", "student-report.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const exportPdf = () => {
    if (filteredReports.length === 0) {
      alert("There is no report data to export.")
      return
    }

    window.print()
  }

  function handleLogout() {
    logout()
    navigate("/login")
  }

  return (
    <>
      <div className="topbar">
        <h1>My Reports</h1>
        <p className="topbar-subtitle">
          Welcome{user?.name ? `, ${user.name}` : ""}. Generate your personal report and export it as PDF or CSV.
        </p>
      </div>

      <div className="content-area">
        <section className="panel">
          <SectionHeader
            title="Student Report Tools"
            subtitle="Move between the main student pages without relying on the browser back button."
            action={
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <ActionButton quiet onClick={() => navigate("/student")}>
                  Dashboard
                </ActionButton>
                <ActionButton quiet onClick={() => navigate("/student-progress")}>
                  Progress
                </ActionButton>
                <ActionButton onClick={handleLogout}>Logout</ActionButton>
              </div>
            }
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "14px",
            }}
          >
            <DetailCard title="Student Name">
              <div>{user?.name || "Student"}</div>
            </DetailCard>

            <DetailCard title="Email">
              <div>{user?.email || "—"}</div>
            </DetailCard>

            <DetailCard title="Selected Course">
              <div>
                {courses.find((course) => String(course.id) === String(selectedCourseId))?.title ||
                  "No course selected"}
              </div>
            </DetailCard>
          </div>
        </section>

        <section className="panel">
          <h2 style={{ marginTop: 0, marginBottom: "20px", fontSize: "28px" }}>
            Generate My Report
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "16px",
              marginBottom: "18px",
            }}
          >
            <div>
              <label style={labelStyle}>Course</label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                style={inputStyle}
                disabled={loadingCourses}
              >
                <option value="">
                  {loadingCourses ? "Loading courses..." : "Select Course"}
                </option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={inputStyle}
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Level</label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                style={inputStyle}
              >
                {levelOptions.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
            <button onClick={generateReport} style={primaryButtonStyle}>
              {loadingReports ? "Loading..." : "Generate My Report"}
            </button>

            <button onClick={exportPdf} style={secondaryButtonStyle}>
              Export PDF
            </button>

            <button onClick={exportCsv} style={secondaryButtonStyle}>
              Export CSV
            </button>
          </div>

          <div style={{ fontSize: "16px", color: "#555" }}>{message}</div>
        </section>

        <section className="panel">
          <h2 style={{ marginTop: 0, marginBottom: "20px", fontSize: "28px" }}>
            Report Results
          </h2>

          {filteredReports.length === 0 ? (
            <p style={{ margin: 0, color: "#666" }}>
              No report data to display yet.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "15px",
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>Student</th>
                    <th style={thStyle}>Assignment</th>
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>Level</th>
                    <th style={thStyle}>Score</th>
                    <th style={thStyle}>Weight</th>
                    <th style={thStyle}>Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((row, index) => (
                    <tr key={row.id || index}>
                      <td style={tdStyle}>{row.student_name || row.student || "-"}</td>
                      <td style={tdStyle}>{row.assignment_title || row.assignment || "-"}</td>
                      <td style={tdStyle}>{row.category_name || row.category || "-"}</td>
                      <td style={tdStyle}>{row.level_name || row.level || "-"}</td>
                      <td style={tdStyle}>{row.score ?? "-"}</td>
                      <td style={tdStyle}>{row.weight ?? "-"}</td>
                      <td style={tdStyle}>{row.contribution ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
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

const primaryButtonStyle = {
  background: "#1e293b",
  color: "white",
  border: "none",
  padding: "14px 22px",
  borderRadius: "10px",
  fontSize: "16px",
  cursor: "pointer",
}

const secondaryButtonStyle = {
  background: "#1e293b",
  color: "white",
  border: "none",
  padding: "14px 22px",
  borderRadius: "10px",
  fontSize: "16px",
  cursor: "pointer",
}

const thStyle = {
  textAlign: "left",
  padding: "12px",
  borderBottom: "1px solid #dbe2ea",
  background: "#f8fafc",
}

const tdStyle = {
  padding: "12px",
  borderBottom: "1px solid #e5e7eb",
}
