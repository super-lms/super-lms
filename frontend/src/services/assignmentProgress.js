export function assignmentProgress(assignment, fallbackRoster = 0) {
  const count = value => Math.max(0, Number(value) || 0);
  const roster = count(assignment.roster_count ?? fallbackRoster);
  const submitted = count(assignment.submission_count ?? assignment.submissions_count ?? assignment.submitted_count ?? assignment.submittedCount);
  const graded = count(assignment.graded_count ?? assignment.gradedCount ?? assignment.graded_submissions_count ?? assignment.gradedSubmissionsCount);
  const ungraded = count(assignment.ungraded_count ?? assignment.ungradedCount ?? Math.max(submitted - graded, 0));
  const missing = assignment.submission_required === false ? 0 : count(assignment.not_submitted_count ?? Math.max(roster - submitted, 0));
  let status = 'In Progress';
  if (!roster) status = 'Roster Needed';
  else if (ungraded > 0) status = 'Ready to Grade';
  else if (assignment.submission_required === false && graded < roster) status = 'Ready to Grade';
  else if (!submitted && assignment.submission_required !== false) status = 'No Submissions';
  else if (missing > 0 || graded < roster) status = 'In Progress';
  else if (graded >= roster) status = 'Completed';
  return {status, roster, submitted, graded, ungraded, missing};
}
