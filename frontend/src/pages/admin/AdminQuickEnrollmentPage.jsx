import { useEffect, useMemo, useState } from "react"
import authFetch from "../../services/authFetch"

const blocks = ["block1", "block2", "block3", "block4"]
const emptySlots = () => Object.fromEntries(["semester1", "semester2"].flatMap((semester) => blocks.map((block) => [`${semester}-${block}`, { category: "", courseIds: [] }])))

function categoryFor(title = "") {
  const value = title.toLowerCase()
  if (/(english|elsl|efp|social|pgeo|geography|composition|writing|spoken|new media|drama)/.test(value)) return "Humanities"
  if (/(math|fmp|pre-calc|precalc|calculus|physics|chem|science)/.test(value)) return "Math & Science"
  return "Electives / Other"
}

export default function AdminQuickEnrollmentPage() {
  const [courses, setCourses] = useState([])
  const [form, setForm] = useState({ name: "", email: "", grade: "10", section: "A" })
  const [slots, setSlots] = useState(emptySlots)
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    authFetch("/api/admin/quick-enrollment-options").then(async (response) => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Unable to load courses")
      setCourses(data.courses || [])
    }).catch((error) => setMessage(error.message))
  }, [])

  const eligible = useMemo(() => courses.filter((course) => {
    const title = String(course.title || "")
    const grade = form.grade
    const section = form.section
    const explicitSection = String(course.section_code || "").toUpperCase()
    const matchesSection = explicitSection ? explicitSection === section : new RegExp(`${grade}\\s*${section}(?:\\b|$)`, "i").test(title)
    const standalone = !explicitSection && !course.master_course_id && new RegExp(`(?:^|\\D)${grade}(?:\\D|$)`).test(title)
    return matchesSection || standalone
  }), [courses, form.grade, form.section])

  function updateSlot(key, patch) { setSlots((current) => ({ ...current, [key]: { ...current[key], ...patch } })) }

  async function submit(event) {
    event.preventDefault(); setSaving(true); setMessage("")
    try {
      const courseIds = Object.values(slots).flatMap((slot) => slot.courseIds)
      const response = await authFetch("/api/admin/quick-enroll-student", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, grade: Number(form.grade), course_ids: courseIds }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Enrollment failed")
      setMessage(`Complete: ${data.added} course enrollment(s) added; ${data.already_enrolled} already existed.`)
      setForm((current) => ({ ...current, name: "", email: "" })); setSlots(emptySlots())
    } catch (error) { setMessage(error.message) } finally { setSaving(false) }
  }

  return <form onSubmit={submit} style={{ display: "grid", gap: 22 }}>
    <section style={card}><h1 style={{ marginTop: 0 }}>Quick Student Registration & Schedule Enrollment</h1>
      <div style={grid4}>
        <Field label="Student Name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input} /></Field>
        <Field label="Student Email"><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={input} /></Field>
        <Field label="Grade"><select value={form.grade} onChange={(e) => { const grade=e.target.value; setForm({ ...form, grade, section: grade === "10" ? form.section : form.section === "D" ? "A" : form.section }); setSlots(emptySlots()) }} style={input}><option>10</option><option>11</option><option>12</option></select></Field>
        <Field label="Section"><select value={form.section} onChange={(e) => { setForm({ ...form, section: e.target.value }); setSlots(emptySlots()) }} style={input}>{["A","B","C",...(form.grade === "10" ? ["D"] : [])].map((x)=><option key={x}>{x}</option>)}</select></Field>
      </div>
    </section>
    {["semester1", "semester2"].map((semester) => <section key={semester} style={card}>
      <h2 style={{ marginTop: 0 }}>{semester === "semester1" ? "Semester 1" : "Semester 2"}</h2>
      <div style={grid4}>{blocks.map((block, index) => { const key=`${semester}-${block}`; const slot=slots[key]; const choices=eligible.filter((c) => !slot.category || categoryFor(c.title) === slot.category).filter((c) => c.semester === "unassigned" || c.semester === semester || c.semester === "full_year").filter((c) => c.block_key === "unassigned" || c.block_key === block); return <div key={key} style={slotCard}>
        <strong>Block {index+1}</strong>
        <select value={slot.category} onChange={(e)=>updateSlot(key,{category:e.target.value,courseIds:[]})} style={input}><option value="">All departments</option><option>Humanities</option><option>Math & Science</option><option>Electives / Other</option></select>
        <select multiple value={slot.courseIds.map(String)} onChange={(e)=>updateSlot(key,{courseIds:Array.from(e.target.selectedOptions, (o)=>Number(o.value))})} style={{...input,height:120}}>
          {choices.map((course)=><option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
        <small>Use Command-click to select two half-semester courses.</small>
      </div> })}</div>
    </section>)}
    {message && <div style={{ ...card, background: message.startsWith("Complete") ? "#ecfdf5" : "#fef2f2" }}>{message}</div>}
    <button disabled={saving} style={button}>{saving ? "Saving…" : "Create Student and Enroll in Selected Courses"}</button>
  </form>
}

function Field({ label, children }) { return <label style={{ display:"grid", gap:7, fontWeight:700 }}>{label}{children}</label> }
const card={background:"white",border:"1px solid #d7dce5",borderRadius:14,padding:22}
const grid4={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:14}
const slotCard={display:"grid",gap:10,border:"1px solid #d7dce5",borderRadius:12,padding:14,alignContent:"start"}
const input={boxSizing:"border-box",width:"100%",padding:"11px 12px",border:"1px solid #aeb8c8",borderRadius:8,fontSize:16,background:"white"}
const button={padding:"15px 20px",border:0,borderRadius:10,background:"#111827",color:"white",fontSize:17,fontWeight:700,cursor:"pointer"}
