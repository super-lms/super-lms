export function isExcusedMark(match) {
  return match?.rubric_selection?.excused === true;
}

export function isExcusedEntry(value) {
  return typeof value === "string" && value.trim().toUpperCase() === "EX";
}

export function getPointsPossible(assignment) {
  const total = Number(assignment?.points_possible);
  return Number.isFinite(total) && total > 0 ? total : 100;
}

export function getEarnedPoints(assignment, match) {
  if (isExcusedMark(match)) return "EX";
  if (match?.score === null || match?.score === undefined || match.score === "") return "";
  const rubric = match?.rubric_selection || {};
  if (rubric.pointsEarned !== null && rubric.pointsEarned !== undefined && rubric.pointsEarned !== "" &&
      Number.isFinite(Number(rubric.pointsEarned))) return Number(rubric.pointsEarned);
  // Checklist imports also retain the teacher's original points.
  if (rubric.importedChecklistMark !== null && rubric.importedChecklistMark !== undefined &&
      rubric.importedChecklistMark !== "" && Number.isFinite(Number(rubric.importedChecklistMark))) {
    return Number(rubric.importedChecklistMark);
  }
  // Older direct marks retain the original percentage in the rubric JSON.
  const percentage = rubric.overallScore ?? rubric.overall_score ?? match.score;
  const points = Number(percentage) * getPointsPossible(assignment) / 100;
  if (!Number.isFinite(points)) return "";
  // Legacy percentages are rounded to two decimals. Recover a whole point only
  // if it produces exactly that saved percentage; never round exact raw marks.
  const total = getPointsPossible(assignment);
  const whole = Math.round(points);
  if (rubric.overallScore == null && rubric.overall_score == null && total < 10000 &&
      Number((whole / total * 100).toFixed(2)) === Number(percentage)) return whole;
  return Number(points.toFixed(4));
}

export function pointsToPercentage(value, assignment) {
  const total = getPointsPossible(assignment);
  const points = Number(value);
  if (value === null || value === undefined || String(value).trim() === "" ||
      !Number.isFinite(points) || points < 0 || points > total) {
    throw new Error(`Enter a score from 0 to ${total}`);
  }
  return points / total * 100;
}

export function fillAssignmentPercentage(students, assignment, drafts, value) {
  const percentage = Number(value);
  if (value === null || value === undefined || String(value).trim() === "" ||
      !Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error("Enter a percentage from 0 to 100");
  }
  const points = Number((percentage * getPointsPossible(assignment) / 100).toPrecision(12));
  const updates = {};
  for (const student of students) {
    const match = (student.assignment_scores || []).find(item => Number(item.assignment_id) === Number(assignment.id));
    // A shared gradebook can include students outside this assignment's cohort.
    if (!match) continue;
    const key = `${student.student_email}:${assignment.id}`;
    if (isExcusedEntry(drafts[key] ?? getEarnedPoints(assignment, match))) continue;
    updates[key] = String(points);
  }
  return updates;
}
