import { createContext, useContext, useEffect, useMemo, useState } from "react"

const AuthContext = createContext()
const STORAGE_KEY = "super_lms_user"
const STORAGE_VERSION = "v2"

function clearStoredUser() {
  localStorage.removeItem(STORAGE_KEY)
}

function isValidStoredUser(user) {
  return Boolean(
    user &&
      typeof user === "object" &&
      user.__v === STORAGE_VERSION &&
      typeof user.email === "string" &&
      user.email.trim() &&
      typeof user.role === "string" &&
      user.role.trim()
  )
}

function getStoredUser() {
  const storedUser = localStorage.getItem(STORAGE_KEY)

  if (!storedUser) {
    return null
  }

  try {
    const parsed = JSON.parse(storedUser)

    if (!isValidStoredUser(parsed)) {
      clearStoredUser()
      return null
    }

    return parsed
  } catch {
    clearStoredUser()
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const restoredUser = getStoredUser()
    setUser(restoredUser)
    setAuthReady(true)
  }, [])

  function login(userData) {
    if (!userData || typeof userData !== "object") {
      return
    }

    const safeUser = {
      ...userData,
      __v: STORAGE_VERSION,
    }

    if (!isValidStoredUser(safeUser)) {
      clearStoredUser()
      setUser(null)
      return
    }

    setUser(safeUser)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUser))
  }

  function logout() {
    setUser(null)
    clearStoredUser()
    window.location.replace("/login")
  }

  const value = useMemo(() => {
    return {
      user,
      authReady,
      isLoggedIn: Boolean(user),
      login,
      logout,
    }
  }, [user, authReady])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}