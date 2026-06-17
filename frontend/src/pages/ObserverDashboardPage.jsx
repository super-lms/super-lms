import { useEffect, useState } from "react"
import { useAuth } from "../AuthContext.jsx"

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
        const dashboardResponse = await fetch(
          `http://localhost:3000/api/observers/${encodeURIComponent(user.email)}/dashboard`
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
          <h2 style={sectionTitle