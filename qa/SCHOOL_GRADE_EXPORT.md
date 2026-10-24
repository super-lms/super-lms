# Manual school grade export

Admin → Gradebooks now includes Whole School Grade Report. The editable gradebook has an admin-only shortcut to that page.

Choose master courses/all cohorts or individual classes, a school year, and one or both semesters. Confirm/edit semester boundaries. Generation uses a single read-only repeatable-read database transaction; failure never produces a partial report. Courses and their content masters are restricted to the administrator's school. No marks or enrollment records are modified.

The output is a current-roster snapshot of stored marks, not a historical enrollment reconstruction or a complete disaster-recovery backup. Assignment reporting dates use due date, then availability or creation date in Beijing time. Undated work is visible but excluded from semester grade calculations. Zero grades are preserved; unmarked work remains blank. Semester grade calculations reuse the existing report-card calculation, including its weighting and unweighted fallback rules.

Excel supports modern XLSX and legacy XLS. It includes an index, student summary, assignment detail/feedback, and one matrix per class/semester. Format limits fail explicitly. PDF printing opens a print-ready tab, with landscape tables split into six-assignment panels and course/semester page breaks.

Validation: 70 frontend service tests and four targeted backend export tests passed; production build and syntax checks passed. Excel tests serialize/reopen both formats, checking IDs, Chinese characters, blanks, zeroes and literal text. Backend tests cover cohort/date isolation, latest marks, missing grades, school access denial, read-only transactions and failure rollback. Fictional-data browser preview verified master selection, both semesters, and report generation. The in-app browser security policy blocked opening the print tab; the print HTML was validated by automated tests, but the browser print dialog was not verified.

No recurring schedule, automatic storage, archive move or deletion is enabled.
