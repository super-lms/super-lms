// Share concurrent reads only. Completed or failed results are never cached.
export function createTeacherDashboardReader(request) {
  const pending = new Map()
  return function readTeacherDashboard(teacherId, scope = "") {
    const key = JSON.stringify([String(teacherId), scope])
    if (pending.has(key)) return pending.get(key)
    const promise = (async () => {
      const response = await request(`/api/teachers/${teacherId}/dashboard`)
      if (!response.ok) throw new Error(`Request failed with status ${response.status}`)
      return response.json()
    })().finally(() => pending.delete(key))
    pending.set(key, promise)
    return promise
  }
}
