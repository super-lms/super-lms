import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Plus, X } from "lucide-react"
import { useAuth } from "../AuthContext.jsx"
import authFetch from "../services/authFetch.js"

const audienceOptions = [
  ["bc_teacher", "BC Teachers"],
  ["chinese_homeroom_teacher", "Chinese Homeroom Teachers"],
  ["parent", "Parents"],
  ["observer", "Observers"],
]

const defaultAudiences = audienceOptions.map(([key]) => key)
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
const dateKey = (value) => new Date(value).toLocaleDateString("en-CA")
const localInputValue = (value) => {
  const date = value ? new Date(value) : new Date()
  const pad = (number) => String(number).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function blankEvent(date = new Date()) {
  const start = new Date(date)
  start.setHours(9, 0, 0, 0)
  const end = new Date(start)
  end.setHours(10, 0, 0, 0)
  return { title: "", description: "", starts_at: localInputValue(start), ends_at: localInputValue(end), all_day: false, location: "", color: "#2563eb", audiences: defaultAudiences }
}

function displayTime(event) {
  if (event.all_day) return "All day"
  return new Date(event.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export default function SchoolCalendarPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = String(user?.role || "").toLowerCase() === "admin"
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [draft, setDraft] = useState(blankEvent())
  const [saving, setSaving] = useState(false)

  const range = useMemo(() => {
    const first = new Date(month)
    first.setDate(first.getDate() - first.getDay())
    const end = new Date(first)
    end.setDate(end.getDate() + 42)
    return { first, end }
  }, [month])

  async function loadEvents() {
    setLoading(true)
    try {
      const response = await authFetch(`/api/calendar/events?from=${encodeURIComponent(range.first.toISOString())}&to=${encodeURIComponent(range.end.toISOString())}`)
      if (!response.ok) throw new Error("The school calendar could not be loaded.")
      const data = await response.json()
      setEvents(Array.isArray(data.events) ? data.events : [])
      setError("")
    } catch (loadError) {
      setError(loadError.message || "The school calendar could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadEvents() }, [range.first.getTime(), range.end.getTime()])

  const eventsByDay = useMemo(() => {
    const grouped = new Map()
    for (const event of events) {
      const firstDay = new Date(event.starts_at)
      firstDay.setHours(0, 0, 0, 0)
      const lastDay = new Date(event.ends_at)
      lastDay.setHours(0, 0, 0, 0)

      for (let day = new Date(firstDay); day <= lastDay; day.setDate(day.getDate() + 1)) {
        const key = dateKey(day)
        const segment = {
          event,
          continuesBefore: day.getTime() > firstDay.getTime(),
          continuesAfter: day.getTime() < lastDay.getTime(),
          showLabel: day.getTime() === firstDay.getTime() || day.getDay() === 0,
        }
        grouped.set(key, [...(grouped.get(key) || []), segment])
      }
    }
    return grouped
  }, [events])

  const days = useMemo(() => Array.from({ length: 42 }, (_, index) => {
    const date = new Date(range.first)
    date.setDate(date.getDate() + index)
    return date
  }), [range])

  function openNewEvent(date = new Date()) {
    setDraft(blankEvent(date))
    setSelectedEvent(null)
    setEditorOpen(true)
  }

  function openEditEvent(event) {
    setDraft({ ...event, starts_at: localInputValue(event.starts_at), ends_at: localInputValue(event.ends_at), audiences: Array.isArray(event.audiences) ? event.audiences : defaultAudiences })
    setSelectedEvent(event)
    setEditorOpen(true)
  }

  async function saveEvent(event) {
    event.preventDefault()
    setSaving(true)
    try {
      const editing = Boolean(selectedEvent?.id)
      const response = await authFetch(editing ? `/api/calendar/events/${selectedEvent.id}` : "/api/calendar/events", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, starts_at: new Date(draft.starts_at).toISOString(), ends_at: new Date(draft.ends_at).toISOString() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "The event could not be saved.")
      setEditorOpen(false)
      setSelectedEvent(null)
      await loadEvents()
    } catch (saveError) {
      setError(saveError.message || "The event could not be saved.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteEvent() {
    if (!selectedEvent?.id || !window.confirm(`Remove “${selectedEvent.title}” from the school calendar?`)) return
    setSaving(true)
    try {
      const response = await authFetch(`/api/calendar/events/${selectedEvent.id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("The event could not be removed.")
      setEditorOpen(false)
      setSelectedEvent(null)
      await loadEvents()
    } catch (deleteError) {
      setError(deleteError.message || "The event could not be removed.")
    } finally { setSaving(false) }
  }

  return (
    <main style={pageStyle}>
      <div style={topBarStyle}>
        <div>
          <div style={eyebrowStyle}>Super‑LMS · School calendar</div>
          <h1 style={{ margin: "4px 0 0", fontSize: "28px" }}>School Calendar</h1>
          <p style={{ margin: "8px 0 0", color: "#536174" }}>School events and key dates for your community.</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={() => navigate(String(user?.role).toLowerCase() === "parent" ? "/parent" : String(user?.role).toLowerCase() === "observer" ? "/observer" : "/dashboard")} style={secondaryButtonStyle}>Back to portal</button>
          {isAdmin ? <button type="button" onClick={() => openNewEvent()} style={primaryButtonStyle}><Plus size={17} /> New event</button> : null}
        </div>
      </div>

      {error ? <div style={errorStyle}>{error}</div> : null}
      <section style={calendarCardStyle}>
        <div style={calendarToolbarStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={iconButtonStyle}><ChevronLeft size={20} /></button>
            <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={iconButtonStyle}><ChevronRight size={20} /></button>
            <button type="button" onClick={() => setMonth(startOfMonth(new Date()))} style={secondaryButtonStyle}>Today</button>
          </div>
          <h2 style={{ margin: 0, fontSize: "20px" }}>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
          <div style={audienceNoteStyle}><CalendarDays size={16} /> {isAdmin ? "Admin view · all audiences" : "Read-only school calendar"}</div>
        </div>
        <div style={gridStyle}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} style={weekdayStyle}>{day}</div>)}
          {days.map((date) => {
            const key = dateKey(date)
            const dayEvents = eventsByDay.get(key) || []
            const today = key === dateKey(new Date())
            return <div key={key} style={{ ...dayStyle, background: date.getMonth() === month.getMonth() ? "#fff" : "#f8fafc" }}>
              <button type="button" onClick={() => isAdmin && openNewEvent(date)} style={{ ...dayNumberStyle, background: today ? "#1d4ed8" : "transparent", color: today ? "#fff" : "#1e293b", cursor: isAdmin ? "pointer" : "default" }}>{date.getDate()}</button>
              <div style={{ display: "grid", gap: "4px", marginTop: "4px" }}>
                {dayEvents.slice(0, 3).map(({ event, continuesBefore, continuesAfter, showLabel }) => <button type="button" key={`${event.id}-${key}`} onClick={() => isAdmin ? openEditEvent(event) : setSelectedEvent(event)} style={{ ...eventChipStyle, borderLeftColor: event.color || "#2563eb", marginLeft: continuesBefore ? "-9px" : 0, marginRight: continuesAfter ? "-9px" : 0, borderRadius: continuesBefore ? "0" : "4px 0 0 4px", borderRight: continuesAfter ? "0" : undefined, position: "relative", zIndex: 1 }} title={event.title} aria-label={`${event.title}, ${new Date(event.starts_at).toLocaleDateString()} to ${new Date(event.ends_at).toLocaleDateString()}`}>{showLabel ? <><span>{event.all_day ? "" : displayTime(event)}</span> {event.title}</> : " "}</button>)}
                {dayEvents.length > 3 ? <div style={{ fontSize: "12px", color: "#64748b", paddingLeft: "4px" }}>+{dayEvents.length - 3} more</div> : null}
              </div>
            </div>
          })}
        </div>
      </section>

      {!editorOpen && selectedEvent ? <aside style={detailStyle}><button type="button" aria-label="Close event details" onClick={() => setSelectedEvent(null)} style={{ ...iconButtonStyle, float: "right" }}><X size={18} /></button><div style={{ color: selectedEvent.color || "#2563eb", fontWeight: 800, fontSize: "13px" }}>{displayTime(selectedEvent)} · {new Date(selectedEvent.starts_at).toLocaleDateString()}</div><h2 style={{ margin: "8px 28px 8px 0" }}>{selectedEvent.title}</h2>{selectedEvent.location ? <p style={{ margin: "0 0 8px", color: "#475569" }}><MapPin size={15} style={{ verticalAlign: "-2px" }} /> {selectedEvent.location}</p> : null}{selectedEvent.description ? <p style={{ margin: 0, lineHeight: 1.55, color: "#334155" }}>{selectedEvent.description}</p> : null}</aside> : null}

      {editorOpen ? <div style={modalBackdropStyle}><form onSubmit={saveEvent} style={modalStyle}><div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}><h2 style={{ margin: 0 }}>{selectedEvent ? "Edit event" : "New school event"}</h2><button type="button" onClick={() => setEditorOpen(false)} style={iconButtonStyle}><X size={19} /></button></div><label style={labelStyle}>Event title<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} style={inputStyle} placeholder="e.g., Parent–teacher conferences" /></label><div style={twoColumnStyle}><label style={labelStyle}>Starts<input required type="datetime-local" value={draft.starts_at} onChange={(event) => setDraft({ ...draft, starts_at: event.target.value })} style={inputStyle} /></label><label style={labelStyle}>Ends<input required type="datetime-local" value={draft.ends_at} onChange={(event) => setDraft({ ...draft, ends_at: event.target.value })} style={inputStyle} /></label></div><label style={checkboxLabelStyle}><input type="checkbox" checked={draft.all_day} onChange={(event) => setDraft({ ...draft, all_day: event.target.checked })} /> All-day event</label><div style={twoColumnStyle}><label style={labelStyle}>Location<input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} style={inputStyle} placeholder="School gym / Online" /></label><label style={labelStyle}>Colour<input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} style={{ ...inputStyle, height: "42px", padding: "4px" }} /></label></div><label style={labelStyle}>Details<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} style={{ ...inputStyle, minHeight: "84px", resize: "vertical" }} placeholder="What should families and staff know?" /></label><fieldset style={fieldsetStyle}><legend>Show this event to</legend><div style={audienceGridStyle}>{audienceOptions.map(([key, label]) => <label key={key} style={checkboxLabelStyle}><input type="checkbox" checked={draft.audiences.includes(key)} onChange={(event) => setDraft({ ...draft, audiences: event.target.checked ? [...draft.audiences, key] : draft.audiences.filter((item) => item !== key) })} /> {label}</label>)}</div></fieldset><div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginTop: "8px" }}>{selectedEvent ? <button type="button" onClick={deleteEvent} disabled={saving} style={dangerButtonStyle}>Delete event</button> : <span /> }<button disabled={saving || draft.audiences.length === 0} type="submit" style={primaryButtonStyle}>{saving ? "Saving…" : "Save event"}</button></div></form></div> : null}
      {loading ? <div style={loadingStyle}>Loading school calendar…</div> : null}
    </main>
  )
}

const pageStyle = { minHeight: "100vh", background: "#f5f7fb", padding: "28px", color: "#172033", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif", boxSizing: "border-box" }
const topBarStyle = { maxWidth: "1280px", margin: "0 auto 20px", display: "flex", justifyContent: "space-between", gap: "18px", alignItems: "flex-start", flexWrap: "wrap" }
const eyebrowStyle = { fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", color: "#526985" }
const primaryButtonStyle = { border: 0, borderRadius: "9px", background: "#175cd3", color: "#fff", padding: "10px 14px", display: "inline-flex", alignItems: "center", gap: "7px", fontWeight: 750, cursor: "pointer", fontSize: "14px" }
const secondaryButtonStyle = { border: "1px solid #cbd5e1", borderRadius: "9px", background: "#fff", color: "#24344d", padding: "9px 12px", fontWeight: 650, cursor: "pointer", fontSize: "14px" }
const iconButtonStyle = { border: "1px solid #d6dee9", background: "#fff", borderRadius: "8px", color: "#334155", height: "36px", width: "36px", display: "inline-grid", placeItems: "center", cursor: "pointer" }
const calendarCardStyle = { maxWidth: "1280px", margin: "0 auto", border: "1px solid #dce3ed", borderRadius: "14px", background: "#fff", overflow: "hidden", boxShadow: "0 4px 16px rgba(25, 52, 93, .06)" }
const calendarToolbarStyle = { padding: "18px 20px", borderBottom: "1px solid #e4e9f0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }
const audienceNoteStyle = { color: "#526278", fontSize: "13px", display: "inline-flex", gap: "6px", alignItems: "center" }
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(7, minmax(118px, 1fr))", overflowX: "auto" }
const weekdayStyle = { padding: "10px 12px", background: "#f8fafc", borderBottom: "1px solid #e4e9f0", color: "#64748b", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em" }
const dayStyle = { minHeight: "124px", borderRight: "1px solid #e8edf3", borderBottom: "1px solid #e8edf3", padding: "8px", boxSizing: "border-box" }
const dayNumberStyle = { border: 0, borderRadius: "50%", width: "28px", height: "28px", fontWeight: 750, fontSize: "13px", padding: 0 }
const eventChipStyle = { border: 0, borderLeft: "3px solid", background: "#eff5ff", color: "#20324b", borderRadius: "4px", padding: "4px 6px", textAlign: "left", fontSize: "12px", lineHeight: 1.25, cursor: "pointer", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }
const errorStyle = { maxWidth: "1280px", margin: "0 auto 16px", background: "#fff1f2", border: "1px solid #fecdd3", color: "#9f1239", padding: "12px 14px", borderRadius: "10px" }
const detailStyle = { maxWidth: "720px", margin: "20px auto", padding: "18px 20px", borderRadius: "12px", background: "#fff", border: "1px solid #dce3ed", boxShadow: "0 4px 16px rgba(25, 52, 93, .05)" }
const modalBackdropStyle = { position: "fixed", inset: 0, background: "rgba(15, 23, 42, .45)", display: "grid", placeItems: "center", padding: "20px", zIndex: 30 }
const modalStyle = { width: "min(680px, 100%)", maxHeight: "calc(100vh - 40px)", overflowY: "auto", boxSizing: "border-box", background: "#fff", borderRadius: "14px", padding: "22px", boxShadow: "0 20px 60px rgba(15, 23, 42, .25)" }
const labelStyle = { display: "grid", gap: "6px", color: "#34445c", fontSize: "13px", fontWeight: 750, marginTop: "14px" }
const inputStyle = { boxSizing: "border-box", width: "100%", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "10px", font: "inherit", color: "#172033", background: "#fff" }
const twoColumnStyle = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }
const checkboxLabelStyle = { display: "flex", gap: "8px", alignItems: "center", fontSize: "14px", color: "#334155", cursor: "pointer" }
const fieldsetStyle = { border: "1px solid #d7e0eb", borderRadius: "9px", margin: "16px 0 0", padding: "12px" }
const audienceGridStyle = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginTop: "6px" }
const dangerButtonStyle = { border: "1px solid #fecaca", borderRadius: "9px", background: "#fff", color: "#b42318", padding: "10px 14px", fontWeight: 750, cursor: "pointer" }
const loadingStyle = { position: "fixed", right: "20px", bottom: "20px", background: "#172033", color: "#fff", padding: "10px 13px", borderRadius: "9px", fontSize: "14px", boxShadow: "0 6px 22px rgba(15, 23, 42, .22)" }
