function calculateRawMark(value, total) {
  const parsedTotal = Number(total);
  const pointsPossible = Number.isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : 100;
  const pointsEarned = Number(value);
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '' ||
      !Number.isFinite(pointsEarned) || pointsEarned < 0 || pointsEarned > pointsPossible) {
    throw new Error(`Enter a score from 0 to ${pointsPossible}`);
  }
  return { pointsEarned, pointsPossible, percentage: pointsEarned / pointsPossible * 100 };
}
module.exports = { calculateRawMark };
