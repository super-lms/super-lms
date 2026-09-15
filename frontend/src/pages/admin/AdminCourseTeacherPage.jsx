import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import authFetch from "../../services/authFetch"
import { useAuth } from "../../AuthContext"

export default function AdminCourseTeacherPage() {
  const { courseId } = useParams()
  const { user } = useAuth()

  const [course, setCourse] = useState(null)
  const [teacher, setTeacher] = useState(null)
  const [coTeachers, setCoTeachers] = useState([])
  const [teachers, setTeachers] = useState([])
  const [selectedTeacherId, setSelectedTeacherId] = useState("")
  const [selectedCoTeacherId, setSelectedCoTeacherId] = useState("")
  const [hasTeacherWorkspaceAccess, setHasTeacherWorkspaceAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [assignStatus, setAssignStatus] = useState("idle")
  const [assignMessage, setAssignMessage] = useState("")

  useEffect(() => {
    let isCancelled = false

    async function loadTeacher() {
      try {
        setLoading(true)
        setError("")

        const [teacherResponse, teachersResponse] = await Promise.all([
          authFetch(`/api/admin/courses/${courseId}/teacher`),
          authFetch("/api/admin/teachers"),
        ])
        const [data, teachersData] = await Promise.all([teacherResponse.json(), teachersResponse.json()])

        if (!teacherResponse.ok || data?.success === false) {
          throw new Error(data?.error || "Failed to load course teacher")
        }
        if (!teachersResponse.ok || teachersData?.success === false) {
          throw new Error(teachersData?.error || "Failed to load teachers")
        }

        if (!isCancelled) {
          setCourse(data?.course || null)
          setTeacher(data?.teacher || null)
          setCoTeachers(Array.isArray(data?.coTeachers) ? data.coTeachers : [])
          setTeachers(Array.isArray(teachersData?.teachers) ? teachersData.teachers : [])
          setSelectedTeacherId(data?.teacher?.id ? String(data.teacher.id) : "")
          setHasTeacherWorkspaceAccess(Boolean(data?.viewerHasTeacherAccess))
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || "Failed to load course teacher")
          setCourse(null)
          setTeacher(null)
          setHasTeacherWorkspaceAccess(false)
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadTeacher()

    return () => {
      isCancelled = true
    }
  }, [courseId])

  const courseTitle = course?.title || `Course ${courseId}`
  const hasTeacher = teacher && (teacher.name || teacher.email)
  const isAssignedToMe =
    hasTeacherWorkspaceAccess ||
    Number(teacher?.id) === Number(user?.id) ||
    String(teacher?.email || "").toLowerCase() === String(user?.email || "").toLowerCase()

  async function assignToMe() {
    try {
      setAssignStatus("saving")
      setAssignMessage("")

      const response = await authFetch(`/api/admin/courses/${courseId}/assign-to-me`, {
        method: "PUT",
      })
      const data = await response.json()

      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || "Failed to assign this course")
      }

      setCourse(data?.course || course)
      setHasTeacherWorkspaceAccess(Boolean(data?.viewerHasTeacherAccess))
      setAssignStatus("saved")
      setAssignMessage("This course is now available in your Teacher Workspace.")
    } catch (err) {
      setAssignStatus("error")
      setAssignMessage(err.message || "Failed to assign this course")
    }
  }

  async function replaceTeacher() {
    if (!selectedTeacherId || Number(selectedTeacherId) === Number(teacher?.id)) return
    try {
      setAssignStatus("saving")
      setAssignMessage("")
      const response = await authFetch(`/api/admin/courses/${courseId}/teacher`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id: Number(selectedTeacherId) }),
      })
      const data = await response.json()
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || "Failed to replace course teacher")
      }
      setCourse(data?.course || course)
      setTeacher(data?.teacher || null)
      setAssignStatus("saved")
      setAssignMessage("Course teacher updated.")
    } catch (err) {
      setAssignStatus("error")
      setAssignMessage(err.message || "Failed to replace course teacher")
    }
  }

  async function addCoTeacher() {
    if (!selectedCoTeacherId) return
    try {
      setAssignStatus("saving")
      setAssignMessage("")
      const response = await authFetch(`/api/admin/courses/${courseId}/co-teachers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id: Number(selectedCoTeacherId) }),
      })
      const data = await response.json()
      if (!response.ok || data?.success === false) throw new Error(data?.error || "Failed to add co-teacher")
      setCoTeachers((current) => current.some((item) => Number(item.id) === Number(data.teacher?.id))
        ? current
        : [...current, data.teacher])
      setSelectedCoTeacherId("")
      setAssignStatus("saved")
      setAssignMessage("Co-teacher added.")
    } catch (err) {
      setAssignStatus("error")
      setAssignMessage(err.message || "Failed to add co-teacher")
    }
  }

  return (
    <div>
      <Link to={`/admin/courses/${encodeURIComponent(String(courseId))}`} style={backLinkStyle}>
        ← Back to Course Workspace
      </Link>

      <div style={heroStyle}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#6b7280", marginBottom: "8px" }}>
          Administrator Course Workspace
        </div>

        <h1 style={{ margin: 0, fontSize: "30px", color: "#111827" }}>
          Teacher
        </h1>

        <p style={{ margin: "10px 0 0 0", color: "#4b5563", fontSize: "16px", lineHeight: 1.5 }}>
          {courseTitle}
        </p>
      </div>

      {loading ? <div style={noticeStyle}>Loading teacher...</div> : null}

      {error ? <div style={errorStyle}>{error}</div> : null}

      {!loading && !error ? (
        <div style={assignmentActionStyle}>
          <div>
            <div style={{ fontWeight: 800, color: "#111827" }}>Share This Course</div>
            <div style={{ marginTop: "5px", color: "#4b5563", lineHeight: 1.5 }}>
              Add another teacher without changing the primary teacher.
            </div>
          </div>
          <select value={selectedCoTeacherId} onChange={(event) => setSelectedCoTeacherId(event.target.value)} disabled={assignStatus === "saving"} style={teacherSelectStyle}>
            <option value="">Select a co-teacher</option>
            {teachers.filter((item) => Number(item.id) !== Number(teacher?.id) && !coTeachers.some((coTeacher) => Number(coTeacher.id) === Number(item.id))).map((availableTeacher) => (
              <option key={availableTeacher.id} value={availableTeacher.id}>
                {availableTeacher.name || availableTeacher.email} {availableTeacher.email ? `(${availableTeacher.email})` : ""}
              </option>
            ))}
          </select>
          <button type="button" onClick={addCoTeacher} disabled={!selectedCoTeacherId || assignStatus === "saving"} style={assignButtonStyle}>
            {assignStatus === "saving" ? "Saving..." : "Add Co-Teacher"}
          </button>
          {coTeachers.length > 0 ? (
            <div style={actionSuccessStyle}>Co-teachers: {coTeachers.map((item) => item.name || item.email).join(", ")}</div>
          ) : null}
        </div>
      ) : null}

      {!loading && !error ? (
        <div style={assignmentActionStyle}>
          <div>
            <div style={{ fontWeight: 800, color: "#111827" }}>Change Course Teacher</div>
            <div style={{ marginTop: "5px", color: "#4b5563", lineHeight: 1.5 }}>
              Select the teacher responsible for this course.
            </div>
          </div>
          <select
            value={selectedTeacherId}
            onChange={(event) => setSelectedTeacherId(event.target.value)}
            disabled={assignStatus === "saving"}
            style={teacherSelectStyle}
          >
            <option value="">Select a teacher</option>
            {teachers.map((availableTeacher) => (
              <option key={availableTeacher.id} value={availableTeacher.id}>
                {availableTeacher.name || availableTeacher.email} {availableTeacher.email ? `(${availableTeacher.email})` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={replaceTeacher}
            disabled={!selectedTeacherId || Number(selectedTeacherId) === Number(teacher?.id) || assignStatus === "saving"}
            style={assignButtonStyle}
          >
            {assignStatus === "saving" ? "Saving..." : "Replace Teacher"}
          </button>
          {assignMessage ? (
            <div style={assignStatus === "error" ? actionErrorStyle : actionSuccessStyle}>
              {assignMessage}
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && !error ? (
        <div style={assignmentActionStyle}>
          <div>
            <div style={{ fontWeight: 800, color: "#111827" }}>Your Teaching Workspace</div>
            <div style={{ marginTop: "5px", color: "#4b5563", lineHeight: 1.5 }}>
              Add this course to your Teacher Workspace to manage its learning paths,
              lessons, assignments, gradebook, and reports. The currently assigned
              course teacher will remain in place.
            </div>
          </div>
          <button
            type="button"
            onClick={assignToMe}
            disabled={isAssignedToMe || assignStatus === "saving"}
            style={{
              ...assignButtonStyle,
              opacity: isAssignedToMe || assignStatus === "saving" ? 0.65 : 1,
              cursor: isAssignedToMe || assignStatus === "saving" ? "default" : "pointer",
            }}
          >
            {isAssignedToMe
              ? "Assigned to You"
              : assignStatus === "saving"
                ? "Assigning..."
                : "Add to My Teacher Workspace"}
          </button>
          {assignMessage ? (
            <div style={assignStatus === "error" ? actionErrorStyle : actionSuccessStyle}>
              {assignMessage}
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && !error ? (
        hasTeacher ? (
          <div style={teacherCardStyle}>
            <div style={labelStyle}>Assigned Teacher</div>

            <h2 style={{ margin: "8px 0 0 0", fontSize: "26px", color: "#111827" }}>
              {teacher.name || "Unnamed Teacher"}
            </h2>

            <div style={infoGridStyle}>
              <InfoItem label="Email" value={teacher.email || "No email recorded"} />
              <InfoItem label="Role" value={teacher.role || "Teacher"} />
              <InfoItem label="Teacher User ID" value={teacher.id || "—"} />
            </div>

            <div style={noteStyle}>
              Teacher Workspace expansion will later show this teacher's other courses,
              recent activity, assignments, learning paths, and administrator notes.
            </div>
          </div>
        ) : (
          <div style={noticeStyle}>No teacher is currently assigned to this course.</div>
        )
      ) : null}
    </div>
  )
}

function InfoItem({ label, value }) {
  return (
    <div style={infoItemStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={{ marginTop: "6px", fontWeight: 800, color: "#111827" }}>{value}</div>
    </div>
  )
}

const backLinkStyle = {
  display: "inline-block",
  marginBottom: "18px",
  color: "#111827",
  textDecoration: "none",
  fontWeight: 700,
}

const heroStyle = {
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "16px",
  padding: "24px",
}

const noticeStyle = {
  marginTop: "18px",
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "12px",
  padding: "14px",
  color: "#374151",
}

const errorStyle = {
  ...noticeStyle,
  border: "1px solid #d1a1a1",
  background: "#fff8f8",
  color: "#7f1d1d",
}

const teacherCardStyle = {
  marginTop: "20px",
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "16px",
  padding: "24px",
}

const infoGridStyle = {
  marginTop: "20px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
}

const infoItemStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "14px",
  background: "#fafafa",
}

const labelStyle = {
  fontSize: "13px",
  fontWeight: 800,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
}

const noteStyle = {
  marginTop: "20px",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "14px",
  background: "#f9fafb",
  color: "#4b5563",
  lineHeight: 1.5,
}

const assignmentActionStyle = {
  marginTop: "20px",
  background: "white",
  border: "1px solid #d7d7d7",
  borderRadius: "16px",
  padding: "20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
}

const assignButtonStyle = {
  border: "1px solid #111827",
  borderRadius: "10px",
  background: "#111827",
  color: "white",
  padding: "11px 16px",
  fontWeight: 800,
}

const teacherSelectStyle = {
  minWidth: "260px",
  maxWidth: "100%",
  border: "1px solid #9ca3af",
  borderRadius: "10px",
  background: "white",
  color: "#111827",
  padding: "11px 12px",
  fontWeight: 700,
}

const actionSuccessStyle = {
  flexBasis: "100%",
  border: "1px solid #86b995",
  borderRadius: "10px",
  background: "#f0fdf4",
  color: "#166534",
  padding: "11px 13px",
  fontWeight: 700,
}

const actionErrorStyle = {
  ...actionSuccessStyle,
  border: "1px solid #d1a1a1",
  background: "#fff8f8",
  color: "#7f1d1d",
}
