import { useCallback, useEffect, useState } from "react"
import authFetch from "../services/authFetch"

const button = { border: "1px solid #111827", borderRadius: 9, padding: "9px 13px", background: "white", fontWeight: 800, cursor: "pointer" }
const primary = { ...button, background: "#111827", color: "white" }

export default function RepositoryFilePicker({ courseId, open, onClose, onSelect, title = "Add File" }) {
  const [resources, setResources] = useState([])
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!courseId || !open) return
    setError("")
    const response = await authFetch(`/api/courses/${courseId}/resources`)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setError(data.error || "Repository could not be loaded")
    setResources(Array.isArray(data.resources) ? data.resources : [])
  }, [courseId, open])

  useEffect(() => { load() }, [load])
  if (!open) return null

  async function upload() {
    if (!files.length) return setError("Choose at least one file")
    setBusy(true); setError("")
    try {
      const form = new FormData()
      files.forEach((file) => form.append("files", file))
      const response = await authFetch(`/api/courses/${courseId}/resources`, { method: "POST", body: form })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Files could not be uploaded")
      setFiles([])
      await load()
    } catch (uploadError) { setError(uploadError.message) }
    finally { setBusy(false) }
  }

  return <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.55)", display: "grid", placeItems: "center", padding: 20 }}>
    <div style={{ width: "min(720px, 96vw)", maxHeight: "88vh", overflow: "auto", background: "white", borderRadius: 16, padding: 22, boxShadow: "0 24px 60px rgba(0,0,0,.25)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}><h2 style={{ margin: 0 }}>{title}</h2><button type="button" style={button} onClick={onClose}>Close</button></div>
      <p style={{ color: "#475569" }}>Choose a file already in this course repository.</p>
      {error ? <div style={{ padding: 12, background: "#fef2f2", color: "#991b1b", borderRadius: 9, marginBottom: 12 }}>{error}</div> : null}
      <div style={{ display: "grid", gap: 8 }}>
        {resources.map((resource) => <div key={resource.id} style={{ border: "1px solid #dbe3ed", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><span style={{ overflowWrap: "anywhere" }}>{resource.original_name}</span><button type="button" style={primary} onClick={() => onSelect(resource)}>Add</button></div>)}
        {!resources.length ? <div style={{ color: "#64748b" }}>No files in the repository yet.</div> : null}
      </div>
      <div style={{ borderTop: "1px solid #e2e8f0", marginTop: 20, paddingTop: 18 }}>
        <h3 style={{ marginTop: 0 }}>Upload File</h3>
        <input type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} />
        <button type="button" disabled={busy || !files.length} style={{ ...primary, marginTop: 12, display: "block" }} onClick={upload}>{busy ? "Uploading..." : `Upload ${files.length || ""} File${files.length === 1 ? "" : "s"}`}</button>
      </div>
    </div>
  </div>
}
