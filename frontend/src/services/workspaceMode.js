export const WORKSPACE_MODE_KEY = "super_lms_workspace_mode"

export function getWorkspaceMode() {
  return window.localStorage.getItem(WORKSPACE_MODE_KEY) === "teacher"
    ? "teacher"
    : "admin"
}

export function setWorkspaceMode(mode) {
  const safeMode = mode === "teacher" ? "teacher" : "admin"
  window.localStorage.setItem(WORKSPACE_MODE_KEY, safeMode)
  return safeMode
}

export function clearWorkspaceMode() {
  window.localStorage.removeItem(WORKSPACE_MODE_KEY)
}
