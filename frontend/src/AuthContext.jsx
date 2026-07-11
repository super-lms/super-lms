import { createContext, useContext, useEffect, useMemo, useState } from "react"

const AuthContext = createContext()
const STORAGE_KEY = "super_lms_user"
const TOKEN_STORAGE_KEY = "super_lms_token"
const STORAGE_VERSION = "v3"

function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(TOKEN_STORAGE_KEY)
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
      clearStoredAuth()
      return null
    }

    return parsed
  } catch {
    clearStoredAuth()
    return null
  }
}

function getStoredToken() {
  const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY)
  return storedToken && typeof storedToken === "string" ? storedToken : ""
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState("")
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    const restoredUser = getStoredUser()
    const restoredToken = getStoredToken()

    setUser(restoredUser)
    setToken(restoredUser ? restoredToken : "")
    setAuthReady(true)
  }, [])

  function login(userData, tokenValue = "") {
    if (!userData || typeof userData !== "object") {
      return
    }

    const safeUser = {
      ...userData,
      __v: STORAGE_VERSION,
    }

    if (!isValidStoredUser(safeUser)) {
      clearStoredAuth()
      setUser(null)
      setToken("")
      return
    }

    const safeToken = String(tokenValue || "")

    setUser(safeUser)
    setToken(safeToken)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUser))

    if (safeToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, safeToken)
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    }
  }

  function logout() {
    setUser(null)
    setToken("")
    clearStoredAuth()
    window.location.replace("/login")
  }

  const value = useMemo(() => {
    return {
      user,
      token,
      authReady,
      isLoggedIn: Boolean(user),
      login,
      logout,
    }
  }, [user, token, authReady])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
