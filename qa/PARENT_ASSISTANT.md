# Parent question assistant

Implemented on `feature/parent-question-assistant` from current main `c30bfd1`.

Parents can type common Chinese or English questions, or tap eight suggestions. A child must be chosen when more than one is linked; scope can be one course or all linked courses. Typing Chinese switches the portal to Chinese.

Supported questions cover overdue missing assignments, lower-mark work samples, attendance dates, the next seven days of deadlines, available teacher feedback, weighted grades, learning materials, and the school calendar. Course links open the relevant section. This is a bounded record-query assistant, not a general language model. Student work and teacher comments remain in their original language; translation is not implemented. Feedback has no timestamps in the existing response and is not presented as newest-first.

Missing means past due, unsubmitted, and ungraded. Submitted work awaiting marking or late-work approval is excluded; zero marks are valid grades. Lower-mark evidence shows the three lowest available marks and any stored submission text/files, with an explicit message when work is unavailable. Attendance reads the actual enrolled course, shows all saved dates, and distinguishes Present, Absent, Late and Excused. Counts are per class/date, not unique school days. Empty attendance data never implies presence. Partial course failures are identified as incomplete answers.

The existing `/observer` parent portal and the legacy `/parent` route use the same bilingual page. Data endpoints authenticate the current observer identity, and the attendance endpoint checks both the student and course link. Existing access to original submission files is reused. No student data is sent to a language-model provider. No migrations or new external dependencies are required.

## Validation

- Production frontend build passed.
- All 57 frontend service tests passed.
- Five attendance access/filtering tests passed.
- Backend syntax and diff checks passed.
- Browser preview verified Chinese missing-work, work-sample and attendance questions using fictional records only.

Run the frontend development server and open `/qa/parent-assistant-preview.html` to inspect the fictional demo. The demo is not the school portal and is not included in the production entry point.

Not deployed. Live database integration and production parent accounts have not been exercised. Deploying requires both the backend attendance endpoint and frontend changes.
