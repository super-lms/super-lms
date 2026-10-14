export function calculateTeacherRubric(rubric, selections = {}) {
  const criteria = rubric?.criteria_json;
  const levels = Number(rubric?.level_count);
  if (![4, 5, 6].includes(levels) || !Array.isArray(criteria) || !criteria.length) {
    throw new Error('Save a teacher rubric with criteria before grading.');
  }
  const buckets = Object.fromEntries(['DO', 'KNOW', 'UNDERSTAND'].map(key => [key, { weight: 0, earned: 0 }]));
  const ids = new Set();
  let totalWeight = 0, earned = 0, selectedCount = 0, unmappedWeight = 0;
  for (const criterion of criteria) {
    const id = String(criterion.id || ''), weight = Number(criterion.weight);
    const bucket = String(criterion.competency_bucket || '').trim().toUpperCase();
    if (!id || ids.has(id) || !Number.isFinite(weight) || weight <= 0) {
      throw new Error('In Edit Assignment, give every criterion a unique ID and a positive weight, then save the teacher rubric.');
    }
    if (bucket && !buckets[bucket]) throw new Error('Choose DO, KNOW or UNDERSTAND for each mapped criterion in Edit Assignment.');
    ids.add(id); totalWeight += weight;
    if (bucket) buckets[bucket].weight += weight;
    else unmappedWeight += weight;
    const selected = selections[id];
    if (selected === undefined || selected === null || selected === '') continue;
    const level = Number(selected);
    if (!Number.isInteger(level) || level < 1 || level > levels) throw new Error('Choose a valid performance level for each criterion.');
    selectedCount++;
    const contribution = level / levels * weight;
    earned += contribution;
    if (bucket) buckets[bucket].earned += contribution;
  }
  if (Math.abs(totalWeight - 100) > 0.01) throw new Error('Criterion weights must total 100% before grading.');
  if (Object.keys(selections).some(id => !ids.has(id))) throw new Error('The rubric has changed. Clear the selections and score the current criteria.');
  const complete = selectedCount === criteria.length, mappingComplete = unmappedWeight === 0;
  return {
    complete, selectedCount, criterionCount: criteria.length,
    partialPercent: Number(earned.toFixed(2)), percent: complete ? Number(earned.toFixed(2)) : null,
    mappingComplete, unmappedWeight,
    // Partial mappings must never produce an apparently complete KDU assessment.
    buckets: Object.fromEntries(Object.entries(buckets).map(([key, value]) => [key, {
      weight: value.weight,
      percent: complete && mappingComplete && value.weight > 0 ? value.earned / value.weight * 100 : null,
      level: complete && mappingComplete && value.weight > 0 ? value.earned / value.weight * 6 : null,
      contribution: complete && mappingComplete ? value.earned : null,
    }])),
  };
}

