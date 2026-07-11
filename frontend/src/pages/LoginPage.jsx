import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../AuthContext.jsx"
import API_BASE from "../apiBase"

function getRedirectPathForRole(role) {
  const normalizedRole = String(role || "").trim().toLowerCase()

  if (normalizedRole === "student") {
    return "/student"
  }

  if (normalizedRole === "teacher" || normalizedRole === "admin") {
    return "/dashboard"
  }

  if (normalizedRole === "observer" || normalizedRole === "parent") {
    return "/observer"
  }

  return "/login"
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [setupPassword, setSetupPassword] = useState("")
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState("")
  const [mode, setMode] = useState("login")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  function resetMessages() {
    setError("")
    setMessage("")
  }

  function handleSuccessfulLogin(user, token = "") {
    login(user, token)

    const requestedPath = location.state?.from?.pathname
    const normalizedRole = String(user.role || "").trim().toLowerCase()

    if (
      requestedPath &&
      requestedPath !== "/login" &&
      ((normalizedRole === "teacher" || normalizedRole === "admin") ||
        (normalizedRole === "student" && requestedPath.startsWith("/student")) ||
        ((normalizedRole === "observer" || normalizedRole === "parent") && requestedPath.startsWith("/observer")))
    ) {
      navigate(requestedPath, { replace: true })
      return
    }

    navigate(getRedirectPathForRole(user.role), { replace: true })
  }

  async function handleLogin(e) {
    e.preventDefault()

    const cleanEmail = String(email || "").trim().toLowerCase()

    if (!cleanEmail) {
      setError("Email is required")
      return
    }

    if (!password) {
      setError("Password is required")
      return
    }

    try {
      resetMessages()
      setLoading(true)

      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: cleanEmail, password }),
      })

      const data = await response.json().catch(() => ({}))

      if (data.code === "PASSWORD_SETUP_REQUIRED") {
        setMode("setup")
        setMessage("Please create your password to activate this account.")
        setPassword("")
        return
      }

      if (!response.ok) {
        throw new Error(data.error || "Login failed")
      }

      if (!data.user) {
        throw new Error("Login response did not include a user")
      }

      handleSuccessfulLogin(data.user, data.token || "")
    } catch (err) {
      setError(err.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  async function handleSetupPassword(e) {
    e.preventDefault()

    const cleanEmail = String(email || "").trim().toLowerCase()

    if (!cleanEmail) {
      setError("Email is required")
      return
    }

    if (!setupPassword) {
      setError("New password is required")
      return
    }

    if (setupPassword.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    if (setupPassword !== setupPasswordConfirm) {
      setError("Passwords do not match")
      return
    }

    try {
      resetMessages()
      setLoading(true)

      const response = await fetch(`${API_BASE}/api/auth/setup-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: cleanEmail, password: setupPassword }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || "Password setup failed")
      }

      setMode("login")
      setPassword("")
      setSetupPassword("")
      setSetupPasswordConfirm("")
      setMessage(data.message || "Password created successfully. Please log in.")
    } catch (err) {
      setError(err.message || "Password setup failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        boxSizing: "border-box",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "980px",
          display: "grid",
          gridTemplateColumns: "1.15fr 0.85fr",
          gap: "24px",
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            borderRadius: "18px",
            border: "1px solid #d7d7d7",
            background: "#ffffff",
            padding: "32px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ marginBottom: "28px" }}>
            <h1 style={{ margin: 0, fontSize: "2.4rem", lineHeight: 1.1 }}>
              Super LMS Login
            </h1>

            <p style={{ margin: "12px 0 0 0", fontSize: "1rem", lineHeight: 1.6, color: "#4b5563", maxWidth: "620px" }}>
              Sign in with your school email and password to enter the correct workspace for your role.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px", marginBottom: "28px" }}>
            <RoleInfoCard title="Teacher/Admin" heading="Dashboard Access" body="Teachers and admins go directly to the main LMS workspace." />
            <RoleInfoCard title="Student" heading="Student Portal" body="Students are redirected into their own learning view automatically." />
            <RoleInfoCard title="Parent/Observer" heading="Observer Portal" body="Parents and observers see linked student progress and learning evidence." />
          </div>

          {mode === "setup" ? (
            <form onSubmit={handleSetupPassword}>
              <h2 style={{ marginTop: 0, marginBottom: "10px", fontSize: "1.35rem" }}>
                Create Your Password
              </h2>

              <p style={{ marginTop: 0, marginBottom: "18px", color: "#4b5563", lineHeight: 1.5 }}>
                This account exists but does not have a password yet. Create a password, then log in normally.
              </p>

              <label htmlFor="email" style={{ display: "block", fontSize: "0.95rem", fontWeight: 700, marginBottom: "8px" }}>
                School Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your school email"
                style={inputStyle}
              />

              <label htmlFor="setupPassword" style={labelStyle}>
                New Password
              </label>

              <input
                id="setupPassword"
                type="password"
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                placeholder="At least 8 characters"
                style={inputStyle}
              />

              <label htmlFor="setupPasswordConfirm" style={labelStyle}>
                Confirm New Password
              </label>

              <input
                id="setupPasswordConfirm"
                type="password"
                value={setupPasswordConfirm}
                onChange={(e) => setSetupPasswordConfirm(e.target.value)}
                placeholder="Re-enter your new password"
                style={inputStyle}
              />

              <button type="submit" disabled={loading} style={buttonStyle}>
                {loading ? "Creating Password..." : "Create Password"}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setMode("login")
                  setSetupPassword("")
                  setSetupPasswordConfirm("")
                  resetMessages()
                }}
                style={secondaryButtonStyle}
              >
                Back to Login
              </button>

              <StatusMessages error={error} message={message} />
            </form>
          ) : (
            <form onSubmit={handleLogin}>
              <label htmlFor="email" style={{ display: "block", fontSize: "0.95rem", fontWeight: 700, marginBottom: "8px" }}>
                School Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your school email"
                style={inputStyle}
              />

              <label htmlFor="password" style={labelStyle}>
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={inputStyle}
              />

              <button type="submit" disabled={loading} style={buttonStyle}>
                {loading ? "Signing In..." : "Login"}
              </button>

              <StatusMessages error={error} message={message} />
            </form>
          )}
        </div>

        <div
          style={{
            borderRadius: "18px",
            border: "1px solid #d7d7d7",
            background: "#ffffff",
            padding: "28px",
            boxSizing: "border-box",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: "10px", fontSize: "1.4rem" }}>
            Production Access
          </h2>

          <p style={{ marginTop: 0, marginBottom: "18px", fontSize: "0.98rem", lineHeight: 1.6, color: "#4b5563" }}>
            SUPER LMS now uses real school accounts from the production user directory.
          </p>

          <div style={{ display: "grid", gap: "12px", marginBottom: "22px" }}>
            <ProductionNote title="Students" body="Use the student DingTalk or school email connected to the Master Student Directory." />
            <ProductionNote title="Teachers" body="Use the teacher account assigned to your courses." />
            <ProductionNote title="Parents / Observers" body="Use the observer account linked to one or more students." />
          </div>

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "18px" }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6b7280", marginBottom: "10px" }}>
              Login Behavior
            </div>

            <div style={{ display: "grid", gap: "10px" }}>
              <div style={{ color: "#4b5563", lineHeight: 1.5, fontSize: "0.95rem" }}>
                <strong>Teacher/Admin:</strong> redirected to the requested teacher page first, otherwise dashboard.
              </div>
              <div style={{ color: "#4b5563", lineHeight: 1.5, fontSize: "0.95rem" }}>
                <strong>Student:</strong> redirected to the student portal.
              </div>
              <div style={{ color: "#4b5563", lineHeight: 1.5, fontSize: "0.95rem" }}>
                <strong>Parent/Observer:</strong> redirected to the observer portal.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const labelStyle = {
  display: "block",
  fontSize: "0.95rem",
  fontWeight: 700,
  marginBottom: "8px",
}

const inputStyle = {
  width: "100%",
  padding: "14px 16px",
  marginBottom: "16px",
  borderRadius: "10px",
  border: "1px solid #c7cdd4",
  boxSizing: "border-box",
  fontSize: "1rem",
  background: "#ffffff",
}

const buttonStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "10px",
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#ffffff",
  fontSize: "1rem",
  fontWeight: 700,
  cursor: "pointer",
}

const secondaryButtonStyle = {
  width: "100%",
  padding: "14px 16px",
  marginTop: "10px",
  borderRadius: "10px",
  border: "1px solid #c7cdd4",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "1rem",
  fontWeight: 700,
  cursor: "pointer",
}

function StatusMessages({ error, message }) {
  if (!error && !message) {
    return null
  }

  return (
    <div
      style={{
        marginTop: "16px",
        padding: "12px 14px",
        border: error ? "1px solid #d9b3b3" : "1px solid #b7d7b7",
        borderRadius: "10px",
        background: error ? "#fff8f8" : "#f7fff7",
        color: error ? "#7a1f1f" : "#1f6f2f",
        lineHeight: 1.5,
      }}
    >
      {error || message}
    </div>
  )
}

function RoleInfoCard({ title, heading, body }) {
  return (
    <div style={{ border: "1px solid #d7d7d7", borderRadius: "12px", padding: "16px", background: "#ffffff" }}>
      <div style={{ fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6b7280", marginBottom: "8px" }}>
        {title}
      </div>
      <div style={{ fontWeight: 700, marginBottom: "6px" }}>{heading}</div>
      <div style={{ color: "#4b5563", lineHeight: 1.5, fontSize: "0.95rem" }}>{body}</div>
    </div>
  )
}

function ProductionNote({ title, body }) {
  return (
    <div style={{ border: "1px solid #d7d7d7", borderRadius: "12px", padding: "14px", background: "#f8fafc" }}>
      <div style={{ fontWeight: 800, marginBottom: "6px" }}>{title}</div>
      <div style={{ color: "#4b5563", lineHeight: 1.5, fontSize: "0.95rem" }}>{body}</div>
    </div>
  )
}
