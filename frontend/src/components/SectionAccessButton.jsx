export default function SectionAccessButton({ section, busy, onClick, style }) {
  const isLive = section.is_live !== false
  const name = section.normalized_title || section.title || `Section ${section.id}`
  const action = isLive ? "Turn off student access" : "Make live for students"
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
      aria-label={`${action} — ${name}`}
      style={style}
    >
      {busy ? "Updating student access…" : action}
    </button>
  )
}
