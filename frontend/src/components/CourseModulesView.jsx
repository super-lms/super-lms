import API_BASE from "../apiBase"
import { FormattedText } from "./RichText.jsx"

const box = { border: "1px solid #d7dce5", borderRadius: 12, padding: 16, background: "#fff" }

export default function CourseModulesView({ modules = [], onOpenAssignment }) {
  if (!modules.length) {
    return <div style={{ ...box, color: "#4b5563" }}>No modules have been published for this course yet.</div>
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {modules.map((module, moduleIndex) => (
        <section key={module.id} style={{ ...box, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", background: "#f8fafc", borderBottom: "1px solid #d7dce5" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em" }}>
              Module {moduleIndex + 1}
            </div>
            <h3 style={{ margin: "4px 0 6px", fontSize: 22 }}>{module.title}</h3>
            <FormattedText value={module.description} />
          </div>
          <div style={{ display: "grid" }}>
            {(module.items || []).map((item, itemIndex) => {
              const borderTop = itemIndex ? "1px solid #e5e7eb" : "none"
              if (item.item_type === "heading") return <h4 key={item.id} style={{ margin: 0, padding: "16px 20px", borderTop, fontSize: 18 }}>{item.title}</h4>
              if (item.item_type === "instruction") return <div key={item.id} style={{ padding: "16px 20px", borderTop, background: "#fffbeb" }}><FormattedText value={item.description || item.title} /></div>
              if (item.item_type === "resource") return <a key={item.id} href={`${API_BASE}${item.resource_path}`} target="_blank" rel="noreferrer" style={{ padding: "16px 20px", borderTop, color: "#1d4ed8", fontWeight: 800, textDecoration: "none" }}>📎 {item.title || item.resource_name}</a>
              if (item.item_type === "assignment") return (
                <div key={item.id} style={{ padding: "16px 20px", borderTop, display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  <div><strong>Assignment: {item.title || item.assignment_title}</strong><FormattedText value={item.description || item.assignment_description} style={{ marginTop: 6 }} /></div>
                  {onOpenAssignment ? <button type="button" onClick={() => onOpenAssignment(item.assignment_id)} style={{ padding: "10px 14px", borderRadius: 9, border: "1px solid #111827", background: "#111827", color: "white", fontWeight: 800 }}>Open Assignment</button> : null}
                </div>
              )
              return (
                <div key={item.id} style={{ padding: "16px 20px", borderTop }}>
                  <strong>Lesson: {item.title || item.lesson_title}</strong>
                  <FormattedText value={item.description || item.lesson_content} style={{ marginTop: 6 }} />
                  {(item.lesson_files || []).length ? <div style={{ display: "grid", gap: 6, marginTop: 10 }}>{item.lesson_files.map((file) => <a key={file.id} href={`${API_BASE}${file.file_path}`} target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", fontWeight: 700 }}>📄 {file.original_name}</a>)}</div> : null}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
