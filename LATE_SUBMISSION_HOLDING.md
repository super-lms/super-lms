# Late submission holding

Standard assignment text and file uploads after the deadline are saved in
`assignment_held_work` until the teacher approves them. Held work does not replace
an existing submission or enter the gradebook. Students see “Awaiting teacher
approval” and can see the names of their held files when reopening the assignment.

Teachers open “Review / approve student”, review held text or download held files,
and choose “Approve saved work for marking”. Approval releases the saved text and
files, records late acceptance, clears the notice, and refreshes the grading view.
Students can also resubmit after approval until it is revoked. Revocation holds
new late revisions and leaves already accepted work in place.

Approval, promotion, and acceptance auditing are one transaction. Per-student
locks prevent duplicate releases during repeated/concurrent approvals and handle
uploads finishing while approval is being granted. Mark entry is blocked while
held work is pending.

The table and index are created automatically on first use, following the existing
late-submission schema initialization. Deploy the backend and frontend together.
Existing notices for work rejected by the old flow have no saved content to
recover. The separate read-aloud assessment flow retains its existing approval
policy; this change covers standard written responses and attached files.

Validation:

- Backend regression suite: `node --test` from `backend`.
- Frontend service tests and production build: `npm test` and `npm run build` from `frontend`.
- Real database tests use an isolated temporary PostgreSQL cluster; they never
  use the application's database configuration. Run from `backend` with
  `POSTGRES_TEST_BIN=/path/to/postgres/bin node --test test/heldSubmissions.postgres.test.js`.
  Without this explicit path, that test is skipped.

## Declining late work

Teachers can decline from a past-due notice or the student's late-approval panel:

- **Decline and keep saved work** archives the pending text and files outside the gradebook. They remain available for teacher review. A later approval releases the retained work for marking.
- **Decline and delete saved work** requires confirmation and permanently deletes only unapproved held work. Earlier submissions, attachments and marks remain untouched. A later approval allows the student to submit again.

Both choices remove all pending notices for that assignment/student, create an in-app student message saying “Your submission has been declined. You must see your teacher.”, and prevent further submissions or grading until the teacher approves. Extending a deadline alone does not override an active decline. The message appears on the student portal and the assignment status reads “Declined — see your teacher”. No email is sent.

Decision audit, permission change, held-work disposition and message commit in the same transaction under the existing per-assignment/student advisory lock. Repeated declines are idempotent. Approval resolves the active decline and its message in the same transaction that promotes any retained work. Pending uploads recheck the decline after acquiring the lock.

Validation includes isolated PostgreSQL cases for keep/delete, preserved earlier marks, notification privacy, idempotence, rejection after deadline extension, in-flight upload rejection, approval after a conversation and transactional failure rollback.
