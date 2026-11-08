function evidenceNumber(value) {
  if (typeof value !== "number" && typeof value !== "string") return null
  if (typeof value === "string" && value.trim() === "") return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function getKduCellLabel(value) {
  const numeric = evidenceNumber(value)
  return numeric === null ? "—" : numeric.toFixed(1)
}

export function getKduCellDescriptor(value) {
  const numeric = evidenceNumber(value)
  if (numeric === null) return "No evidence"
  if (numeric >= 5.5) return "Extending"
  if (numeric >= 4) return "Proficient"
  if (numeric >= 2.5) return "Developing"
  return "Emerging"
}
