import { useEffect, useState } from "react"
import { useAuth } from "../AuthContext.jsx"
import authFetch from "../services/authFetch"

export default function ObserverDashboardPage() {
  const { user } = useAuth()

  const [dashboardData, setDashboardData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState("")

  useEffect(() => {
    const loadObserverDashboard = async () => {
      if (!user?.email) {
        setDashboardData(null)
        setMessage("Observer email not found.")
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setMessage("Loading observer dashboard...")

      try {
        const dashboardResponse = await authFetch(
          `/api/observers/${encodeURIComponent(user.email)}/dashboard`
        )

        const dashboardJson = await dashboardResponse.json()

        if (!dashboardResponse.ok) {
          throw new Error(dashboardJson.error || "Failed to load observer dashboard.")
        }

        setDashboardData(dashboardJson)
        setMessage("")
      } catch (error) {
        console.error("Error loading observer dashboard:", error)
        setDashboardData(null)
        setMessage(error.message || "Failed to load observer dashboard.")
      } finally {
        setIsLoading(false)
      }
    }

    loadObserverDashboard()
  }, [user?.email])

  return (
    <div>
      <div style={sectionStyle}>
        <h1 style={pageTitleStyle}>Parent / Observer Portal</h1>
        <p style={introTextStyle}>
          View linked students, classes, submissions, grades, feedback, and attachments.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Observer Access</h2>

        <div style={summaryBoxStyle}>
          <div><strong>Observer Email:</strong> {user?.email || "-"}</div>
          <div><strong>Name:</strong> {user?.name || "-"}</div>
          <div><strong>Role:</strong> {user?.role || "-"}</div>
          <div><strong>Status:</strong> {isLoading ? "Loading..." : (message || "Ready")}</div>
        </div>
      </div>

      {message && !isLoading ? (
        <div style={sectionStyle}>
          <p style={emptyTextStyle}>{message}</p>
        </div>
      ) : null}

      {dashboardData?.observer ? (
        <div style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Linked Students</h2>
          {Array.isArray(dashboardData.students) && dashboardData.students.length > 0 ? (
            <div style={cardGridStyle}>
              {dashboardData.students.map((student) => (
                <div key={student.email || student.id || student.name} style={cardStyle}>
                  <h3 style={cardTitleStyle}>{student.name || "Student"}</h3>
                  <p style={cardTextStyle}><strong>Email:</strong> {student.email || "-"}</p>
                  <p style={cardTextStyle}><strong>Grade:</strong> {student.grade || "-"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p style={emptyTextStyle}>No linked students found.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

const sectionStyle = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "20px",
  marginBottom: "20px",
}

const pageTitleStyle = {
  fontSize: "28px",
  fontWeight: "700",
  margin: "0 0 8px 0",
  color: "#111827",
}

const introTextStyle = {
  fontSize: "15px",
  color: "#4b5563",
  margin: 0,
}

const sectionTitleStyle = {
  fontSize: "20px",
  fontWeight: "700",
  margin: "0 0 14px 0",
  color: "#111827",
}

const summaryBoxStyle = {
  display: "grid",
  gap: "8px",
  fontSize: "15px",
  color: "#374151",
}

const emptyTextStyle = {
  fontSize: "15px",
  color: "#6b7280",
  margin: 0,
}

const cardGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "14px",
}

const cardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  padding: "14px",
  background: "#f9fafb",
}

const cardTitleStyle = {
  fontSize: "17px",
  fontWeight: "700",
  margin: "0 0 8px 0",
  color: "#111827",
}

const cardTextStyle = {
  fontSize: "14px",
  margin: "4px 0",
  color: "#374151",
}
