import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import authFetch from "../services/authFetch"
import { FormattedText, RichTextEditor } from "../components/RichText.jsx"
import CourseModulesView from "../components/CourseModulesView.jsx"

const card = { border: "1px solid #d7dce5", borderRadius: 14, padding: 18, background: "white" }
const button = { border: "1px solid #111827", borderRadius: 9, padding: "9px 13px", background: "white", fontWeight: 800, cursor: "pointer" }
const primary = { ...button, background: "#111827", color: "white" }
const input = { width: "100%", border: "1px solid #cbd5e1", borderRadius: 9, padding: "10px 12px", font: "inherit", boxSizing: "border-box" }

export default function CourseModulesPage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const [course, setCourse] = useState(null)
  const [modules, setModules] = useState([])
  const [sources, setSources] = useState({ lesson: [], assignment: [], resource: [] })
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [drafts, setDrafts] = useState({})
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError("")
    try {
      const responses = await Promise.all([
        authFetch("/api/courses"), authFetch(`/api/courses/${courseId}/modules`),
        authFetch("/api/lessons"), authFetch("/api/assignments"), authFetch(`/api/courses/${courseId}/resources`),
      ])
      const data = await Promise.all(responses.map((response) => response.json()))
      if (!responses.every((response) => response.ok)) throw new Error(data.find((entry) => entry?.error)?.error || "The module workspace could not be loaded.")
      const selected = (data[0] || []).find((item) => String(item.id) === String(courseId))
      const contentId = selected?.content_course_id || selected?.master_course_id || selected?.id || courseId
      setCourse(selected || { id: courseId, title: "Course" })
      setModules(data[1] || [])
      setSources({
        lesson: (data[2] || []).filter((item) => String(item.course_id) === String(contentId)),
        assignment: (data[3] || []).filter((item) => String(item.class_id || item.course_id) === String(contentId)),
        resource: data[4] || [],
      })
    } catch (loadError) { setError(loadError.message) }
  }, [courseId])

  useEffect(() => { load() }, [load])
  const publishedModules = useMemo(() => modules.filter((module) => module.is_published), [modules])
  const draftFor = (moduleId) => drafts[moduleId] || { item_type: "heading", title: "", description: "", source_id: "" }
  const patchDraft = (moduleId, values) => setDrafts((current) => ({ ...current, [moduleId]: { ...draftFor(moduleId), ...values } }))

  async function request(url, options, fallback) {
    setBusy(true); setError(""); setMessage("")
    try {
      const response = await authFetch(url, options)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || fallback)
      return data
    } catch (requestError) { setError(requestError.message); return null }
    finally { setBusy(false) }
  }

  async function createModule(event) {
    event.preventDefault()
    if (!title.trim()) return setError("Enter a module title.")
    const created = await request(`/api/courses/${courseId}/modules`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description }) }, "Module could not be created")
    if (created) { setTitle(""); setDescription(""); setMessage("Module created."); await load() }
  }

  async function updateModule(module, values) {
    const updated = await request(`/api/modules/${module.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }, "Module could not be updated")
    if (updated) { setMessage(values.is_published === true ? "Module published for students." : values.is_published === false ? "Module returned to draft." : "Module updated."); await load() }
  }

  async function addItem(module) {
    const draft = draftFor(module.id)
    const linked = ["lesson", "assignment", "resource"].includes(draft.item_type)
    if ((linked && !draft.source_id) || (!linked && !(draft.title || draft.description))) return setError("Complete the item before adding it.")
    const body = { item_type: draft.item_type, title: draft.title, description: draft.description }
    if (linked) body[`${draft.item_type === "resource" ? "course_resource" : draft.item_type}_id`] = Number(draft.source_id)
    const created = await request(`/api/modules/${module.id}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, "Item could not be added")
    if (created) { patchDraft(module.id, { item_type: "heading", title: "", description: "", source_id: "" }); setMessage("Item added."); await load() }
  }

  async function reorder(url, ids) {
    const result = await request(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ids) }, "The order could not be changed")
    if (result) await load()
  }
  function moved(list, index, direction) { const copy = [...list]; const target = index + direction; if (target < 0 || target >= copy.length) return null; [copy[index], copy[target]] = [copy[target], copy[index]]; return copy }

  return <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
    <button type="button" style={button} onClick={() => navigate(`/courses?courseId=${courseId}`)}>← Back to Course</button>
    <h1 style={{ marginBottom: 4 }}>Modules</h1>
    <p style={{ color: "#475569", marginTop: 0 }}>{course?.title || course?.class_name} — organize lessons, assignments, instructions, and files in one clear sequence.</p>
    {error ? <div style={{ ...card, borderColor: "#dc2626", background: "#fef2f2", color: "#991b1b", marginBottom: 14 }}>{error}</div> : null}
    {message ? <div style={{ ...card, borderColor: "#60a5fa", background: "#eff6ff", marginBottom: 14 }}>{message}</div> : null}
    <form onSubmit={createModule} style={{ ...card, marginBottom: 18 }}>
      <h2 style={{ marginTop: 0 }}>Create a Module</h2>
      <input style={input} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Unit 1 — Foundations" />
      <div style={{ marginTop: 12 }}><RichTextEditor value={description} onChange={setDescription} placeholder="Optional learning goals or overview" /></div>
      <button disabled={busy} style={{ ...primary, marginTop: 12 }} type="submit">Create Module</button>
    </form>
    <div style={{ display: "grid", gap: 18 }}>{modules.map((module, moduleIndex) => {
      const draft = draftFor(module.id); const options = sources[draft.item_type] || []
      return <section key={module.id} style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
          <div><h2 style={{ margin: 0 }}>{module.title}</h2><FormattedText value={module.description} /></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={button} disabled={moduleIndex === 0} onClick={() => { const next = moved(modules, moduleIndex, -1); if (next) reorder(`/api/courses/${courseId}/modules/reorder`, { module_ids: next.map((item) => item.id) }) }}>Module ↑</button>
            <button type="button" style={button} disabled={moduleIndex === modules.length - 1} onClick={() => { const next = moved(modules, moduleIndex, 1); if (next) reorder(`/api/courses/${courseId}/modules/reorder`, { module_ids: next.map((item) => item.id) }) }}>Module ↓</button>
            <button type="button" style={button} onClick={() => { const next = window.prompt("Module title", module.title); if (next?.trim()) updateModule(module, { title: next.trim() }) }}>Rename</button>
            <button type="button" style={module.is_published ? button : primary} onClick={() => updateModule(module, { is_published: !module.is_published })}>{module.is_published ? "Unpublish" : "Publish"}</button>
            <button type="button" style={{ ...button, color: "#b91c1c" }} onClick={async () => { if (window.confirm("Delete this module? Original lessons, assignments, and files will remain.")) { const deleted = await request(`/api/modules/${module.id}`, { method: "DELETE" }, "Module could not be deleted"); if (deleted) await load() } }}>Delete</button>
          </div>
        </div>
        <div style={{ marginTop: 14, display: "grid", gap: 8 }}>{(module.items || []).map((item, index) => <div key={item.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div><strong>{item.item_type === "lesson" ? item.lesson_title : item.item_type === "assignment" ? item.assignment_title : item.item_type === "resource" ? item.resource_name : item.title || "Instructions"}</strong><div style={{ color: "#64748b", fontSize: 13, textTransform: "capitalize" }}>{item.item_type}</div></div>
          <div style={{ display: "flex", gap: 6 }}><button type="button" style={button} disabled={index === 0} onClick={() => { const next = moved(module.items, index, -1); if (next) reorder(`/api/modules/${module.id}/items/reorder`, { item_ids: next.map((entry) => entry.id) }) }}>↑</button><button type="button" style={button} disabled={index === module.items.length - 1} onClick={() => { const next = moved(module.items, index, 1); if (next) reorder(`/api/modules/${module.id}/items/reorder`, { item_ids: next.map((entry) => entry.id) }) }}>↓</button><button type="button" style={{ ...button, color: "#b91c1c" }} onClick={async () => { if (window.confirm("Remove this link from the module?")) { const deleted = await request(`/api/module-items/${item.id}`, { method: "DELETE" }, "Item could not be removed"); if (deleted) await load() } }}>Remove</button></div>
        </div>)}</div>
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
          <h3>Add to This Module</h3>
          <select style={input} value={draft.item_type} onChange={(event) => patchDraft(module.id, { item_type: event.target.value, title: "", description: "", source_id: "" })}><option value="heading">Section heading</option><option value="instruction">Instructions</option><option value="lesson">Existing lesson</option><option value="assignment">Existing assignment</option><option value="resource">Repository file</option></select>
          {["lesson", "assignment", "resource"].includes(draft.item_type) ? <select style={{ ...input, marginTop: 10 }} value={draft.source_id} onChange={(event) => patchDraft(module.id, { source_id: event.target.value })}><option value="">Choose existing {draft.item_type}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.title || option.original_name}</option>)}</select> : draft.item_type === "heading" ? <input style={{ ...input, marginTop: 10 }} value={draft.title} onChange={(event) => patchDraft(module.id, { title: event.target.value })} placeholder="Heading" /> : <div style={{ marginTop: 10 }}><RichTextEditor value={draft.description} onChange={(value) => patchDraft(module.id, { description: value })} placeholder="Instructions for students" /></div>}
          <button type="button" disabled={busy} style={{ ...primary, marginTop: 10 }} onClick={() => addItem(module)}>Add Item</button>
        </div>
      </section>
    })}</div>
    {modules.length ? <section style={{ marginTop: 24 }}><h2>Student Preview</h2><CourseModulesView modules={publishedModules} /></section> : null}
  </div>
}
