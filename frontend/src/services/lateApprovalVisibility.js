// Only recorded late work produces a notice. A passed deadline or permission alone does not.
export function lateApprovalState(data, now = Date.now()) {
  if (!data || data.submission_required === false) return 'hidden';
  const hasHeldWork = (data.held_work?.length || 0) > 0 || (data.retained_work?.length || 0) > 0;
  if (!hasHeldWork) return data.acceptances?.length ? 'accepted_late' : 'hidden';
  const deadline = data.due_date ? Date.parse(data.due_date) : NaN;
  return Number.isFinite(deadline) && now > deadline ? 'overdue' : 'previous_work';
}
