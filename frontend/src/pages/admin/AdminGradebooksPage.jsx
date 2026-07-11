import { useEffect, useMemo, useState } from "react"
import authFetch from "../../services/authFetch"

export default function AdminGradebooksPage() {
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [gradebook, setGradebook] = useState(null)
  const [status, setStatus] = useState("loading")
  const [gradebookStatus, setGradebookStatus] = useState("idle")
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function loadClasses() {
      try {
        setStatus("loading")
        const response = await authFetch("/api/classes")
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to load classes")
        }

        if (isMounted) {
          const classList = Array.isArray(data) ? data : []
          setClasses(classList)
          setSelectedClassId(classList[0]?.id ? String(classList[0].id) : "")
          setStatus("ready")
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load classes")
          setStatus("error")
        }
      }
    }

    loadClasses()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!selectedClassId) return

    let isMounted = true

    async function loadGradebook() {
      try {
        setGradebookStatus("loading")
        const response = await authFetch(`/api/classes/${selectedClassId}/gradebook`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to load gradebook")
        }

        if (isMounted) {
          setGradebook(data)
          setGradebookStatus("ready")
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load gradebook")
          setGradebookStatus("error")
        }
      }
    }

    loadGradebook()

    return () => {
      isMounted = false
    }
  }, [selectedClassId])

  const selectedClass = useMemo(() => {
    return classes.find((course) => String(course.id) === String(selectedClassId)) || null
  }, [classes, selectedClassId])

  const assignments = Array.isArray(gradebook?.assignments) ? gradebook.assignments : []
  const students = Array.isArray(gradebook?.students) ? gradebook.students : []

  const gradedStudents = students.filter((student) => Number(student.final_percent || student.average || 0) > 0).length
  const classAverage = students.length
    ? Math.round(
        students.reduce((sum, student) => sum + Number(student.final_percent || student.average || 0), 0) /
          students.length
      )
    : 0

  return (
    <div>
      <div style={{ marginBottom: "22px" }}>
        <h1 style={{ margin: 0, fontSize: "28px" }}>School Gradebooks</h1>
        <p style={{ margin: "8px 0 0", fontSize: "16px", color: "#4b5563", lineHeight: 1.6 }}>
          Admin view of course gradebooks using the existing class gradebook endpoint.
        </p>
      </div>

      {status === "error" && (
        <div style={{ background: "white", border: "1px solid #b91c1c", borderRadius: "14px", padding: "18px" }}>
          <strong>Unable to load gradebooks.</strong>
          <div style={{ marginTop: "8px", color: "#7f1d1d" }}>{error}</div>
        </div>
      )}

      {status !== "error" && (
        <>
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
              Select Course Gradebook
            </label>
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                padding: "12px",
                fontSize: "15px",
                background: "white",
              }}
            >
              {classes.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title || course.class_name || `Course ${course.id}`}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "14px",
              marginBottom: "18px",
            }}
          >
            <SummaryCard label="Selected Course" value={selectedClass?.title || selectedClass?.class_name || "None"} small />
            <SummaryCard label="Students" value={students.length} />
            <SummaryCard label="Assignments" value={assignments.length} />
            <SummaryCard label="Class Average" value={`${classAverage}%`} />
            <SummaryCard label="Students With Grades" value={gradedStudents} />
          </div>

          {gradebookStatus === "loading" && (
            <div style={{ background: "white", border: "1px solid #d7d7d7", borderRadius: "14px", padding: "18px" }}>
              Loading selected gradebook...
            </div>
          )}

          {gradebookStatus === "error" && (
            <div style={{ background: "white", border: "1px solid #b91c1c", borderRadius: "14px", padding: "18px" }}>
              <strong>Unable to load selected gradebook.</strong>
              <div style={{ marginTop: "8px", color: "#7f1d1d" }}>{error}</div>
            </div>
          )}

          {gradebookStatus === "ready" && (
            <div
              style={{
                background: "white",
                border: "1px solid #d7d7d7",
                borderRadius: "14px",
                overflow: "auto",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "240px 110px 120px 120px",
                  gap: "12px",
                  minWidth: "620px",
                  padding: "12px 16px",
                  background: "#f8fafc",
                  borderBottom: "1px solid #d7d7d7",
                  fontWeight: 800,
                  fontSize: "14px",
                }}
              >
                <div>Student</div>
                <div>Student ID</div>
                <div>Average</div>
                <div>Final %</div>
              </div>

              {students.length === 0 ? (
                <div style={{ padding: "18px", color: "#4b5563" }}>
                  No students found in this gradebook.
                </div>
              ) : (
                students.map((student) => (
                  <div
                    key={student.student_user_id || student.student_email}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "240px 110px 120px 120px",
                      gap: "12px",
                      minWidth: "620px",
                      padding: "14px 16px",
                      borderBottom: "1px solid #e5e7eb",
                      alignItems: "center",
                      fontSize: "15px",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{student.student_name || "Unnamed Student"}</div>
                    <div>{student.student_id || "—"}</div>
                    <div style={{ fontWeight: 800 }}>{Number(student.average || 0)}%</div>
                    <div style={{ fontWeight: 800 }}>{Number(student.final_percent || 0)}%</div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, small = false }) {
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
      <div style={{ fontSize: small ? "18px" : "26px", fontWeight: 800, lineHeight: 1.25 }}>{value}</div>
    </div>
  )
}
