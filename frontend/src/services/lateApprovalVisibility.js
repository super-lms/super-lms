// A future deadline is not an approval request. Keep actual held/declined work
// accessible if it was received under an earlier deadline.
export function lateApprovalState(data, now = Date.now()) {
  if (!data || data.submission_required === false) return 'hidden';
  const hasHeldWork = (data.held_work?.length || 0) > 0 || (data.retained_work?.length || 0) > 0;
  const deadline = data.due_date ? Date.parse(data.due_date) : NaN;
  if (Number.isFinite(deadline) && now > deadline) return hasHeldWork || data.decline ? 'overdue' : 'permission_only';
  return hasHeldWork || data.decline ? 'previous_work' : 'hidden';
}
