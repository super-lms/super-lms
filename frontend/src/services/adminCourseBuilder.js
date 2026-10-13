import { setWorkspaceMode } from "./workspaceMode.js"

export async function openAdminCourseBuilder(courseId, navigate, section = "") {
  setWorkspaceMode("admin")
  const params = new URLSearchParams({ courseId: String(courseId) })
  if (section) params.set("open", section)
  navigate(`/courses?${params.toString()}`)
  return { success: true }
}
