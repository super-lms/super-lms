import authFetch, { getAuthToken } from "./authFetch"
import { getWorkspaceMode } from "./workspaceMode"
import { createTeacherDashboardReader } from "./teacherDashboardRead.js"

const readDashboard = createTeacherDashboardReader(authFetch)

export function loadTeacherDashboard(teacherId) {
  const path = window.location.pathname
  // Match authFetch's effective workspace header, and isolate signed-in sessions.
  const adminWorkspace = path === "/admin" || path.startsWith("/admin/") || getWorkspaceMode() === "admin"
  const scope = JSON.stringify([getAuthToken(), adminWorkspace || path === "/login" ? "admin" : "teacher"])
  return readDashboard(teacherId, scope)
}

export async function loadTeacherDashboardLite(teacherId) {
  const response = await authFetch(`/api/teachers/${teacherId}/dashboard-lite`)
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`)
  return response.json()
}
