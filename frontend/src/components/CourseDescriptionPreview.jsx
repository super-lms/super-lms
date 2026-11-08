import { sanitizeRichText } from "../services/richText"

const fallback = "Open this course workspace to manage assignments, students, learning paths, and grading."

export default function CourseDescriptionPreview({ value }) {
  // Render plain text inside the card button: rich-text links must not become
  // nested interactive controls. The original overview stays in the workspace.
  const safeHtml = sanitizeRichText(value).replace(/<br\s*\/?>|<\/(?:p|h2|h3|li)>/gi, " ")
  const parsed = new window.DOMParser().parseFromString(safeHtml, "text/html")
  const text = parsed.body.textContent.replace(/\s+/g, " ").trim() || fallback
  const characters = Array.from(text)
  const preview = characters.length > 220 ? `${characters.slice(0, 220).join("").trimEnd()}…` : text

  return (
    <div style={{ color: "#4b5563", lineHeight: 1.5, overflowWrap: "anywhere" }}>
      <p style={{ margin: 0 }}>{preview}</p>
      {String(value || "").trim() ? <p style={{ margin: "8px 0 0", fontSize: "0.85rem", fontWeight: 700 }}>Full overview in course workspace</p> : null}
    </div>
  )
}
