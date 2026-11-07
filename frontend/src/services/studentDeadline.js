import { beijingDateTime } from "./assignmentTime.js"

// Calendar labels only: submission and late-work decisions remain server-owned.
export function studentDeadlineLabel(value, now = new Date()) {
  if (!value) return "No due date"
  const due = beijingDateTime(value).slice(0, 10)
  const today = beijingDateTime(now.toISOString()).slice(0, 10)
  if (!due) return "Date unavailable"
  if (due < today) return "Past date"
  if (due === today) return "Due today"
  return "Upcoming"
}
