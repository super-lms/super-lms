import API_BASE from "../apiBase"

const TOKEN_STORAGE_KEY = "super_lms_token"

export function getAuthToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY) || ""
}

export function buildApiUrl(pathOrUrl) {
  const value = String(pathOrUrl || "")

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value
  }

  if (value.startsWith("/api/")) {
    return `${API_BASE}${value}`
  }

  return value
}

export async function authFetch(pathOrUrl, options = {}) {
  const token = getAuthToken()
  const existingHeaders = options.headers || {}

  const headers = {
    ...existingHeaders,
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return fetch(buildApiUrl(pathOrUrl), {
    ...options,
    headers,
  })
}

export default authFetch
