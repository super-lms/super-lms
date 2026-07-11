import { useEffect, useMemo, useState } from "react"
import authFetch from "../../services/authFetch"

export default function AdminStudentsPage() {
  const [students, setStudents] = useState([])
  const [search, setSearch] = useState("")
  const [gradeFilter, setGradeFilter] = useState("all")
  const [message, setMessage] = useState("Loading students...")

  useEffect(() => {
    async function loadStudents() {
      try {
        const response = await authFetch("/api/master-students")
        const data = await response.json()

        if (!response.ok || data?.success === false) {
          throw new Error(data?.error || "Failed to load students")
        }

        const rows = Array.isArray(data?.students) ? data.students : []
        setStudents(rows)
        setMessage("")
      } catch (err) {
        console.error("Admin students load failed:", err)
        setStudents([])
        setMessage("Unable to load the master student directory.")
      }
    }

    loadStudents()
  }, [])

  const grades = useMemo(() => {
    const uniqueGrades = new Set()
    students.forEach((student) => {
      if (student.current_grade !== null && student.current_grade !== undefined) {
        uniqueGrades.add(String(student.current_grade))
      }
    })
    return Array.from(uniqueGrades).sort((a, b) => Number(a) - Number(b))
  }, [students])

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase()

    return students.filter((student) => {
      const matchesGrade =
        gradeFilter === "all" || String(student.current_grade || "") === gradeFilter

      const haystack = [
        student.display_name,
        student.legal_first_name,
        student.legal_last_name,
        student.student_id,
        student.pen,
        student.student_email,
        student.current_homeform,
        student.next_year_homeform,
        student.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      const matchesSearch = !term || haystack.includes(term)

      return matchesGrade && matchesSearch
    })
  }, [students, search, gradeFilter])

  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: "28px" }}>Students</h1>

      <p style={{ fontSize: "16px", color: "#4b5563", lineHeight: 1.6 }}>
        Master Student Directory for school-wide student verification and course roster support.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginTop: "18px" }}>
        <SummaryCard label="Total Students" value={students.length} />
        <SummaryCard label="Visible Students" value={filteredStudents.length} />
        <SummaryCard label="Grade Levels" value={grades.length} />
      </div>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "20px", marginBottom: "16px" }}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, PEN, student ID, email, or homeform"
          style={{
            flex: "1 1 360px",
            padding: "12px",
            border: "1px solid #d7d7d7",
            borderRadius: "10px",
            fontSize: "15px",
          }}
        />

        <select
          value={gradeFilter}
          onChange={(event) => setGradeFilter(event.target.value)}
          style={{
            padding: "12px",
            border: "1px solid #d7d7d7",
            borderRadius: "10px",
            fontSize: "15px",
            background: "white",
          }}
        >
          <option value="all">All Grades</option>
          {grades.map((grade) => (
            <option key={grade} value={grade}>
              Grade {grade}
            </option>
          ))}
        </select>
      </div>

      {message ? (
        <div style={{ background: "white", border: "1px solid #d7d7d7", borderRadius: "12px", padding: "18px" }}>
          {message}
        </div>
      ) : (
        <div style={{ background: "white", border: "1px solid #d7d7d7", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr 1.8fr 1fr", gap: "10px", padding: "12px 14px", fontWeight: 800, background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            <div>Student</div>
            <div>Grade</div>
            <div>Homeform</div>
            <div>Student ID</div>
            <div>Email</div>
            <div>Status</div>
          </div>

          {filteredStudents.length === 0 ? (
            <div style={{ padding: "16px" }}>No students match the current filters.</div>
          ) : (
            filteredStudents.map((student) => (
              <div
                key={student.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1.2fr 1.8fr 1fr",
                  gap: "10px",
                  padding: "12px 14px",
                  borderBottom: "1px solid #f1f5f9",
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 800 }}>{student.display_name || `${student.legal_first_name || ""} ${student.legal_last_name || ""}`.trim() || "Unnamed Student"}</div>
                <div>{student.current_grade || "—"}</div>
                <div>{student.current_homeform || "—"}</div>
                <div>{student.student_id || "—"}</div>
                <div>{student.student_email || "—"}</div>
                <div>{student.status || "—"}</div>
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
    <div style={{ background: "white", border: "1px solid #d7d7d7", borderRadius: "12px", padding: "16px" }}>
      <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "26px", fontWeight: 800 }}>{value}</div>
    </div>
  )
}
