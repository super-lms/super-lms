import authFetch from "./authFetch"
import { setWorkspaceMode } from "./workspaceMode"

export async function openAdminCourseBuilder(courseId, navigate, section = "") {
  const response = await authFetch(`/api/admin/courses/${courseId}/assign-to-me`, {
    method: "PUT",
  })
  const data = await response.json()

  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || "Failed to open the course builder")
  }

  setWorkspaceMode("teacher")

  const params = new URLSearchParams({ courseId: String(courseId) })
  if (section) params.set("open", section)

  navigate(`/courses?${params.toString()}`)
  return data
}
