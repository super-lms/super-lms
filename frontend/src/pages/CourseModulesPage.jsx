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
  const [lessons, setLessons] = useState([])
  const [assignments, setAssignments] = useState([])
  const [resources, setResources] = useState([])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState({})

  const load = useCallback(async () => {
    setError("")
    try {
      const [coursesRes, modulesRes, lessonsRes, assignmentsRes, resourcesRes] = await Promise.all([
        authFetch("/api/courses"), authFetch(`/api/courses/${courseId}/modules`), authFetch("/api/lessons"), authFetch("/api/assignments"), authFetch(`/api/courses/${courseId}/resources`),
      ])
      const [coursesData, modulesData, lessonsData, assignmentsData, resourcesData] = await Promise.all([coursesRes.json(), modulesRes.json(), lessonsRes.json(), assignmentsRes.json(), resourcesRes.json()])
      if (![coursesRes, modulesRes, lessonsRes, assignmentsRes, resourcesRes].every((res) => res.ok)) throw new Error("The module workspace could not be loaded.")
      const selected = (coursesData || []).find((item) => String(item.id) === String(courseId))
      const contentId = selected?.content_course_id || selected?.master_course_id || selected?.id || courseId
      setCourse(selected || { id: courseId, title: "Course" })
      setModules(modulesData || [])
      setLessons((lessonsData || []).filter((item) => String(item.course_id) === String(contentId)))
      setAssignments((assignmentsData || []).filter((item) => String(item.class_id) === String(contentId)))
      setResources(resourcesData || [])
    } catch (err) { setError(err.message) }
  }, [courseId])

  useEffect(() => { load() }, [load])

  const sourceOptions = useMemo(() => ({ lesson: lessons, assignment: assignments, resource: resources }), [lessons, assignments, resources])
  const patchDraft = (moduleId, values) => setDrafts((current) => ({ ...current, [moduleId]: { item_type: "heading", title: "", description: "", source_id: "", ...(current[moduleId] || {}), ...values } }))

  async function createModule(event) {
    event.preventDefault(); if (!title.trim()) return
    setBusy(true); setError(""); setMessage("")
    const response = await authFetch(`/api/courses/${courseId}/modules`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description }) })
    setBusy(false)
    if (!response.ok) return setError((await response.json()).error || "Module could not be created")
    setTitle(""); setDescription(""); setMessage("Module created."); await load()
  }

  async function updateModule(module, values) {
    setBusy(true)
    const response = await authFetch(`/api/modules/${module.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) })
    setBusy(false); if (!response.ok) return setError("Module could not be updated")
    setMessage(values.is_published === true ? "Module published for students." : values.is_published === false ? "Module returned to draft." : "Module updated."); await load()
  }

  async function addItem(module) {
    const draft = drafts[module.id] || { item_type: "heading" }
    const body = { item_type: draft.item_type, title: draft.title || "", description: draft.description || "" }
    if (["lesson", "assignment", "resource"].includes(draft.item_type)) body[`${draft.item_type === "resource" ? "course_resource" : draft.item_type}_id`] = Number(draft.source_id)
    if ((["heading", "instruction"].includes(draft.item_type) && !(draft.title || draft.description)) || (["lesson", "assignment", "resource"].includes(draft.item_type) && !draft.source_id)) return setError("Complete the item before adding it.")
    setBusy(true); const response = await authFetch(`/api/modules/${module.id}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); setBusy(false)
    if (!response.ok) return setError((await response.json()).error || "Item could not be added")
    patchDraft(module.id, { item_type: "heading", title: "", description: "", source_id: "" }); setMessage("Item added to the module."); await load()
  }

  async function removeItem(itemId) { if (!window.confirm("Remove this link from the module? The original content will not be deleted.")) return; await authFetch(`/api/module-items/${itemId}`, { method: "DELETE" }); await load() }
  async function removeModule(moduleId) { if (!window.confirm("Delete this module? Linked lessons, assignments, and files will remain in the LMS.")) return; await authFetch(`/api/modules/${moduleId}`, { method: "DELETE" }); await load() }
  async function moveModule(module, direction) { const ordered = [...modules]; const index = ordered.findIndex((entry) => entry.id === module.id); const target = index + direction; if (target < 0 || target >= ordered.length) return; [ordered[index], ordered[target]] = [ordered[target], ordered[index]]; await authFetch(`/api/courses/${courseId}/modules/reorder`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ module_ids: ordered.map((entry) => entry.id) }) }); await load() }
  async function move(module, item, direction) { const items = [...module.items]; const index = items.findIndex((entry) => entry.id === item.id); const target = index + direction; if (target < 0 || target >= items.length) return; [items[index], items[target]] = [items[target], items[index]]; await authFetch(`/api/modules/${module.id}/items/reorder`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_ids: items.map((entry) => entry.id) }) }); await load() }

  return <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}>
    <button type="button" style={button} onClick={() => navigate(`/courses?courseId=${courseId}`)}>← Back to Course</button>
    <h1 style={{ marginBottom: 4 }}>Modules</h1><p style={{ color: "#475569", marginTop: 0 }}>{course?.title || course?.class_name} — organize the learning sequence once and share it with every linked section.</p>
    {error ? <div style={{ ...card, borderColor: "#dc2626", background: "#fef2f2", color: "#991b1b", marginBottom: 14 }}>{error}</div> : null}
    {message ? <div style={{ ...card, borderColor: "#60a5fa", background: "#eff6ff", marginBottom: 14 }}>{message}</div> : null}
    <form onSubmit={createModule} style={{ ...card, marginBottom: 18 }}><h2 style={{ marginTop: 0 }}>Create a Module</h2><input style={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Example: Unit 1 — Foundations" /><div style={{ marginTop: 12 }}><RichTextEditor value={description} onChange={setDescription} placeholder="Optional module overview or learning goals" /></div><button disabled={busy} style={{ ...primary, marginTop: 12 }} type="submit">Create Module</button></form>
    <div style={{ display: "grid", gap: 18 }}>{modules.map((module, moduleIndex) => { const draft = drafts[module.id] || { item_type: "heading", title: "", description: "", source_id: "" }; const options = sourceOptions[draft.item_type] || []; return <section key={module.id} style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}><div><h2 style={{ margin: 0 }}>{module.title}</h2><FormattedText value={module.description} /></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button style={button} disabled={moduleIndex === 0} onClick={() => moveModule(module, -1)}>Move Module ↑</button><button style={button} disabled={moduleIndex === modules.length - 1} onClick={() => moveModule(module, 1)}>Move Module ↓</button><button style={button} onClick={() => { const nextTitle = window.prompt("Module title", module.title); if (nextTitle?.trim()) updateModule(module, { title: nextTitle.trim() }) }}>Rename</button><button style={module.is_published ? button : primary} onClick={() => updateModule(module, { is_published: !module.is_published })}>{module.is_published ? "Unpublish" : "Publish"}</button><button style={{ ...button, color: "#b91c1c" }} onClick={() => removeModule(module.id)}>Delete</button></div></div>
      <div style={{ marginTop: 14, display: "grid", gap: 8 }}>{(module.items || []).map((item, index) => <div key={item.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><div><strong>{item.item_type === "lesson" ? item.lesson_title : item.item_type === "assignment" ? item.assignment_title : item.item_type === "resource" ? item.resource_name : item.title || "Instructions"}</strong><div style={{ color: "#64748b", fontSize: 13, textTransform: "capitalize" }}>{item.item_type}</div></div><div style={{ display: "flex", gap: 6 }}><button style={button} disabled={index === 0} onClick={() => move(module, item, -1)}>↑</button><button style={button} disabled={index === module.items.length - 1} onClick={() => move(module, item, 1)}>↓</button><button style={{ ...button, color: "#b91c1c" }} onClick={() => removeItem(item.id)}>Remove</button></div></div>)}</div>
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}><h3>Add to This Module</h3><select style={input} value={draft.item_type} onChange={(e) => patchDraft(module.id, { item_type: e.target.value, title: "", description: "", source_id: "" })}><option value="heading">Section heading</option><option value="instruction">Instructions</option><option value="lesson">Existing lesson</option><option value="assignment">Existing assignment</option><option value="resource">Repository file</option></select>
      {["lesson", "assignment", "resource"].includes(draft.item_type) ? <select style={{ ...input, marginTop: 10 }} value={draft.source_id} onChange={(e) => patchDraft(module.id, { source_id: e.target.value })}><option value="">Choose existing {draft.item_type}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.title || option.original_name}</option>)}</select> : draft.item_type === "heading" ? <input style={{ ...input, marginTop: 10 }} value={draft.title} onChange={(e) => patchDraft(module.id, { title: e.target.value })} placeholder="Heading" /> : <div style={{ marginTop: 10 }}><RichTextEditor value={draft.description} onChange={(value) => patchDraft(module.id, { description: value })} placeholder="Instructions for students" /></div>}
      <button disabled={busy} style={{ ...primary, marginTop: 10 }} onClick={() => addItem(module)}>Add Item</button></div>
    </section>})}</div>
    {modules.length ? <section style={{ marginTop: 24 }}><h2>Student Preview</h2><CourseModulesView modules={modules.filter((module) => module.is_published)} /></section> : null}
  </div>
}
