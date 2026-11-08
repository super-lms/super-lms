const appearances = {
  submitted: ["submitted", "✓"],
  awaiting_approval: ["attention", "◷"],
  declined: ["error", "!"],
}

export default function StudentStatusBadge({ status, label }) {
  const [tone, symbol] = appearances[status] || ["neutral", "•"]
  return <span className={`student-status student-status-${tone}`}><span aria-hidden="true">{symbol}</span> {label}</span>
}
