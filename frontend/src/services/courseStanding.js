export function weightedCourseStanding(assignments, submissionStates) {
  const groups = new Map()
  for (const assignment of assignments || []) {
    const score = submissionStates?.[String(assignment.id)]?.submission?.score
    const subcategoryId = assignment.subcategory_id
    if (!subcategoryId || score === null || score === undefined || score === '' || !Number.isFinite(Number(score))) continue
    const key = String(subcategoryId)
    if (!groups.has(key)) {
      const explicit = Number(assignment.course_weight_percent)
      const category = Number(assignment.category_weight_percent)
      const tier = Number(assignment.weight_percent_of_parent)
      groups.set(key, {
        weight: Number.isFinite(explicit) && explicit > 0 ? explicit : category * tier / 100,
        scores: [],
      })
    }
    groups.get(key).scores.push(Number(score))
  }
  let earned = 0
  let gradedWeight = 0
  for (const group of groups.values()) {
    if (!group.scores.length || !Number.isFinite(group.weight) || group.weight <= 0) continue
    const average = group.scores.reduce((sum, score) => sum + score, 0) / group.scores.length
    earned += average * group.weight / 100
    gradedWeight += group.weight
  }
  return gradedWeight > 0 ? Number((earned / gradedWeight * 100).toFixed(2)) : null
}
