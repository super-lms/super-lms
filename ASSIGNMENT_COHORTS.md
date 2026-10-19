# Assignment audiences

Assignments keep `class_id` as the shared content course so assessment pathways remain connected. The nullable `cohort_id` identifies one student cohort; NULL means a shared assignment. Backend startup adds this column and index without changing existing assignments.

Creating an assignment from a cohort workspace explicitly sends that cohort's ID, including the root cohort (such as 10A). Creating from the master workspace sends NULL. Duplication preserves the audience. Older clients that send a child cohort ID also retain that cohort; an older client sending the root ID retains the previous shared default.

Teacher assignment cards include an **Assigned to** selector. This is also the correction mechanism for assignments created before cohort ownership was stored. Choose the intended cohort for each existing cohort-specific assignment. The change updates only the audience and timestamp: assignment IDs, submissions, attachments, feedback and marks stay intact. Existing assignments are deliberately not reassigned based on title suffixes.

Cohort lists include shared work plus their own assignments. The master assignment view includes the union. Student and observer lists, course dashboards, grading rosters, batch downloads, checklist imports, learning-path assignment items and reports respect the audience. All-section grading of a cohort-specific assignment resolves to its own cohort. Reports for all cohorts exclude non-applicable assignments from each student's scores.

Validation: frontend tests and production build; backend tests; disposable PostgreSQL integration covering explicit root-cohort creation, child cohorts, shared work, student access, scoped rosters/counts, invalid audience rejection, and audience corrections preserving submitted work and scores. To run database checks, set POSTGRES_TEST_BIN to a local PostgreSQL binaries directory and run the backend tests. These tests create their own temporary database and never use the school connection settings.
