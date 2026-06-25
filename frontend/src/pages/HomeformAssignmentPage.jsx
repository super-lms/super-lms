import { useEffect, useMemo, useState } from "react"
import API_BASE from "../apiBase"

const HOMEFORMS_BY_GRADE = {
  10: ["10A", "10B", "10C"],
  11: ["11A", "11B", "11C"],
  12: ["12A", "12B", "12C"],
}

export default function HomeformAssignmentPage() {
  const [summary, setSummary] = useState([])
  const [students, setStudents] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [gradeFilter, setGradeFilter] = useState("11")
  const [searchText, setSearchText] = useState("")
  const [targetHomeform, setTargetHomeform] = useState("11A")
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const availableHomeforms = HOMEFORMS_BY_GRADE[Number(gradeFilter)] || []

  const filteredStudents = useMemo(() => {
    const search = searchText.trim().toLowerCase()

    return students.filter((student) => {
      if (String(student.next_year_grade || "") !== String(gradeFilter)) {
        return false
      }

      if (!search) {
        return true
      }

      const haystack = [
        student.display_name,
        student.student_email,
        student.student_id,
        student.pen,
        student.current_homeform,
        student.next_year_homeform,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(search)
    })
  }, [students, gradeFilter, searchText])

  const selectedVisibleCount = filteredStudents.filter((student) =>
    selectedIds.includes(student.id)
  ).length

  useEffect(() => {
    loadPageData()
  }, [])

  useEffect(() => {
    const homeforms = HOMEFORMS_BY_GRADE[Number(gradeFilter)] || []
    if (homeforms.length > 0 && !homeforms.includes(targetHomeform)) {
      setTargetHomeform(homeforms[0])
    }
    setSelectedIds([])
  }, [gradeFilter, targetHomeform])

  async function loadPageData() {
    setIsLoading(true)
    setMessage("")
    setError("")

    try {
      const [summaryResponse, studentsResponse] = await Promise.all([
        fetch(`${API_BASE}/api/master-students/homeform-summary`),
        fetch(`${API_BASE}/api/master-students`),
      ])

      const summaryData = await summaryResponse.json()
      const studentsData = await studentsResponse.json()

      if (!summaryResponse.ok) {
        throw new Error(summaryData?.error || "Failed to load homeform summary.")
      }

      if (!studentsResponse.ok) {
        throw new Error(studentsData?.error || "Failed to load master students.")
      }

      setSummary(Array.isArray(summaryData.groups) ? summaryData.groups : [])
      setStudents(Array.isArray(studentsData.students) ? studentsData.students : [])
    } catch (err) {
      setError(err.message || "Failed to load homeform assignment data.")
    } finally {
      setIsLoading(false)
    }
  }

  function toggleStudent(studentId) {
    setSelectedIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    )
  }

  function selectAllVisible() {
    const visibleIds = filteredStudents.map((student) => student.id)
    setSelectedIds((current) => Array.from(new Set([...current, ...visibleIds])))
  }

  function clearSelection() {
    setSelectedIds([])
  }

  async function assignHomeform() {
    if (selectedIds.length === 0) {
      setError("Select at least one student first.")
      return
    }

    if (!targetHomeform) {
      setError("Choose a homeform first.")
      return
    }

    const confirmed = window.confirm(
      `Assign ${selectedIds.length} selected student(s) to ${targetHomeform}?`
    )

    if (!confirmed) {
      return
    }

    setIsSaving(true)
    setMessage("")
    setError("")

    try {
      const response = await fetch(`${API_BASE}/api/master-students/assign-next-year-homeform`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_ids: selectedIds,
          next_year_homeform: targetHomeform,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Failed to assign homeform.")
      }

      setMessage(`${data.updated_count || 0} student(s) assigned to ${targetHomeform}.`)
      setSelectedIds([])
      await loadPageData()
    } catch (err) {
      setError(err.message || "Failed to assign homeform.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={pageStyle}>
      <section style={cardStyle}>
        <h1 style={titleStyle}>Homeform Assignment V1</h1>
        <p style={subtitleStyle}>
          Assign students from the Master Student Directory into next-year homeforms such as 10A,
          10B, 11A, 11B, 12A, and 12B. This prepares course roster building for the new school year.
        </p>

        <div style={noticeStyle}>
          <strong>School setup rule:</strong> Admin assigns next-year homeforms here. Teachers later
          build course rosters from homeforms or individual student selections.
        </div>

        {message && <div style={successStyle}>{message}</div>}
        {error && <div style={errorStyle}>{error}</div>}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Next-Year Homeform Summary</h2>

        {isLoading ? (
          <p style={subtitleStyle}>Loading homeform data...</p>
        ) : (
          <div style={summaryGridStyle}>
            {summary.length === 0 ? (
              <SummaryCard label="No groups yet" value="0" />
            ) : (
              summary.map((group) => (
                <SummaryCard
                  key={`${group.next_year_grade}-${group.next_year_homeform}`}
                  label={`Grade ${group.next_year_grade || "?"} — ${group.next_year_homeform || "Unassigned"}`}
                  value={group.student_count || 0}
                />
              ))
            )}
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Assign Students</h2>

        <div style={controlGridStyle}>
          <label style={labelStyle}>
            Next Year Grade
            <select
              value={gradeFilter}
              onChange={(event) => setGradeFilter(event.target.value)}
              style={inputStyle}
            >
              <option value="10">Grade 10</option>
              <option value="11">Grade 11</option>
              <option value="12">Grade 12</option>
            </select>
          </label>

          <label style={labelStyle}>
            Search
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search name, email, PEN, homeform"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            Assign Selected To
            <select
              value={targetHomeform}
              onChange={(event) => setTargetHomeform(event.target.value)}
              style={inputStyle}
            >
              {availableHomeforms.map((homeform) => (
                <option key={homeform} value={homeform}>
                  {homeform}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={buttonRowStyle}>
          <button type="button" onClick={selectAllVisible} disabled={filteredStudents.length === 0 || isSaving} style={buttonStyle}>
            Select All Visible
          </button>

          <button type="button" onClick={clearSelection} disabled={selectedIds.length === 0 || isSaving} style={buttonStyle}>
            Clear Selection
          </button>

          <button type="button" onClick={assignHomeform} disabled={selectedIds.length === 0 || isSaving} style={primaryButtonStyle}>
            {isSaving ? "Assigning..." : `Assign ${selectedIds.length} to ${targetHomeform}`}
          </button>

          <button type="button" onClick={loadPageData} disabled={isLoading || isSaving} style={buttonStyle}>
            Refresh
          </button>
        </div>

        <p style={subtitleStyle}>
          Showing {filteredStudents.length} student(s). Selected: {selectedIds.length}. Selected visible: {selectedVisibleCount}.
        </p>

        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Select</th>
                <th style={thStyle}>Student</th>
                <th style={thStyle}>Current Grade</th>
                <th style={thStyle}>Current Homeform</th>
                <th style={thStyle}>Next Year Grade</th>
                <th style={thStyle}>Next Year Homeform</th>
                <th style={thStyle}>Email</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id}>
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(student.id)}
                      onChange={() => toggleStudent(student.id)}
                    />
                  </td>
                  <td style={tdStyle}>
                    <strong>{student.display_name || "Unnamed student"}</strong>
                    <div style={smallTextStyle}>PEN: {student.pen || "Missing"}</div>
                  </td>
                  <td style={tdStyle}>{student.current_grade || "—"}</td>
                  <td style={tdStyle}>{student.current_homeform || "—"}</td>
                  <td style={tdStyle}>{student.next_year_grade || "—"}</td>
                  <td style={tdStyle}>{student.next_year_homeform || "Unassigned"}</td>
                  <td style={tdStyle}>{student.student_email || "No email"}</td>
                </tr>
              ))}

              {filteredStudents.length === 0 && (
                <tr>
                  <td style={tdStyle} colSpan="7">
                    No students match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryValueStyle}>{value}</div>
      <div style={summaryLabelStyle}>{label}</div>
    </div>
  )
}

const pageStyle = {
  padding: "24px",
  display: "grid",
  gap: "18px",
}

const cardStyle = {
  background: "white",
  border: "1px solid #d7dce5",
  borderRadius: "14px",
  padding: "18px",
  boxShadow: "0 8px 22px rgba(15, 23, 42, 0.08)",
}

const titleStyle = {
  margin: 0,
  fontSize: "2rem",
}

const subtitleStyle = {
  color: "#4b5563",
  lineHeight: 1.5,
}

const sectionTitleStyle = {
  marginTop: 0,
}

const noticeStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  padding: "12px",
  background: "#f8fafc",
  color: "#1f2937",
}

const successStyle = {
  marginTop: "12px",
  border: "1px solid #9ca3af",
  borderRadius: "12px",
  padding: "12px",
  background: "#f3f4f6",
  color: "#111827",
  fontWeight: 800,
}

const errorStyle = {
  marginTop: "12px",
  border: "1px solid #9ca3af",
  borderRadius: "12px",
  padding: "12px",
  background: "#f9fafb",
  color: "#111827",
  fontWeight: 800,
}

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "12px",
}

const summaryCardStyle = {
  border: "1px solid #d7dce5",
  borderRadius: "12px",
  padding: "14px",
  background: "#f8fafc",
}

const summaryValueStyle = {
  fontSize: "1.6rem",
  fontWeight: 900,
}

const summaryLabelStyle = {
  color: "#4b5563",
  marginTop: "4px",
}

const controlGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
}

const labelStyle = {
  display: "grid",
  gap: "6px",
  fontWeight: 800,
}

const inputStyle = {
  padding: "10px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  fontSize: "1rem",
}

const buttonRowStyle = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
  marginTop: "14px",
}

const buttonStyle = {
  border: "1px solid #111827",
  borderRadius: "10px",
  padding: "10px 14px",
  background: "white",
  color: "#111827",
  fontWeight: 800,
  cursor: "pointer",
}

const primaryButtonStyle = {
  ...buttonStyle,
  background: "#111827",
  color: "white",
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: "12px",
}

const thStyle = {
  textAlign: "left",
  borderBottom: "1px solid #d7dce5",
  padding: "10px",
  background: "#f8fafc",
}

const tdStyle = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px",
  verticalAlign: "top",
}

const smallTextStyle = {
  color: "#6b7280",
  fontSize: "0.85rem",
  marginTop: "4px",
}
