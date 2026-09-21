export function getPointsPossible(assignment) {
  const total = Number(assignment?.points_possible);
  return Number.isFinite(total) && total > 0 ? total : 100;
}

export function getEarnedPoints(assignment, match) {
  if (match?.score === null || match?.score === undefined || match.score === "") return "";
  const points = Number(match.score) * getPointsPossible(assignment) / 100;
  return Number.isFinite(points) ? Number(points.toFixed(4)) : "";
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
