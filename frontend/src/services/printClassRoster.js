export function printClassRoster(course, roster) {
  const printWindow = window.open("", "_blank")
  if (!printWindow) {
    throw new Error("Please allow pop-ups for this site, then select Print Class Roster again.")
  }

  const doc = printWindow.document
  doc.title = `${course.title || "Course"} — Class Roster`
  doc.documentElement.lang = "en"
  const style = doc.createElement("style")
  style.textContent = `
    @page { size: landscape; margin: 12mm; }
    body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { margin: 6px 0 12px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
    th, td { border: 1px solid #aaa; padding: 7px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    th { background: #eee; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    button { margin-bottom: 16px; padding: 8px 14px; }
    @media print { body { margin: 0; } button { display: none; } }
  `
  doc.head.append(style)

  function appendText(parent, tag, text) {
    const element = doc.createElement(tag)
    element.textContent = text
    parent.append(element)
    return element
  }

  const printButton = appendText(doc.body, "button", "Print Class Roster")
  printButton.type = "button"
  printButton.addEventListener("click", () => printWindow.print())
  appendText(doc.body, "h1", course.title || "Course")
  appendText(doc.body, "p", roster.isMasterRoster ? "Master Course Roster" : "Class Roster")
  if (roster.isMasterRoster && roster.sections?.length) {
    appendText(doc.body, "p", `Combined from ${roster.sections.map((section) => section.title).join(", ")}`)
  }
  const students = roster.students || []
  appendText(doc.body, "p", `${students.length} enrolled student${students.length === 1 ? "" : "s"}`)
  const columns = [
    ["Student", "name"],
    ...(roster.isMasterRoster ? [["Section", "section_title"]] : []),
    ["Email", "email"],
    ["Parent Email", "parent_email"],
    ["Student ID", "student_id"],
  ]
  const table = appendText(doc.body, "table", "")
  const header = appendText(appendText(table, "thead", ""), "tr", "")
  columns.forEach(([label]) => {
    appendText(header, "th", label).scope = "col"
  })
  const body = appendText(table, "tbody", "")
  students.forEach((student) => {
    const row = appendText(body, "tr", "")
    columns.forEach(([, key]) => appendText(row, "td", student[key] || "—"))
  })
  if (!students.length) appendText(doc.body, "p", "No students are enrolled in this course yet.")
  printWindow.focus()
  // Let the new document finish laying out before opening the print dialog.
  printWindow.setTimeout(() => {
    if (!printWindow.closed) printWindow.print()
  }, 300)
}
