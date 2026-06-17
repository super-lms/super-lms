import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../AuthContext.jsx"

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, authReady } = useAuth()
  const location = useLocation()

  if (!authReady) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === "student") {
      return <Navigate to="/student" replace />
    }

    if (user.role === "teacher" || user.role === "admin") {
      return <Navigate to="/dashboard" replace />
    }

    return <Navigate to="/login" replace />
  }

  return children
}
