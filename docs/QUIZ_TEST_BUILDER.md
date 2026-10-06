# Teacher Quiz & Test Builder

Open **Quiz & Test Builder** from the Teacher Dashboard or sidebar (`/quiz-builder`). Each teacher manages only their own assessments and responses. The administrator survey tool remains available separately.

1. Create a quiz/test or import a searchable PDF with numbered questions. Review suggested types, choices, and rating labels.
2. Assign points to each question. Multiple Choice, Image Choice, Matching, and Ranking require answer keys and are marked automatically using a complete exact match. Other types require teacher marking. Teachers can override automatic scores during review.
3. Save the assessment. Choose **Link gradebook**, select a course/class you teach and one of its grading subcategories, and create the linked assignment. Course sections use their master course for assignment content and their own section roster for student matching.
4. Open the quiz and share its QR code. Students sign in using their existing LMS account and return to the quiz after login. Submissions use their authenticated student ID and account email, and linked quizzes check course enrollment. Answer keys are omitted from student-facing questions.
5. Open Results, review/mark responses, and save marks. Use **Publish selected/filtered marks to gradebook** to publish reviewed results. Unmarked and unenrolled responses are skipped with a reason. The newest selected attempt per student is used. Republish updates the same linked submission instead of creating another entry.
6. Print individual or batch reports, save as PDF in the browser print dialog, or download a Word-compatible document. Teacher reports include marks and feedback. Students receive an ungraded submission receipt; released marks are available through the existing gradebook workflow.

Questions and points are locked once linked to the gradebook or after the first response. Use **Duplicate** to create a revised assessment with fresh question IDs. Close the assessment to stop submissions. PDF import does not perform OCR or import answer keys; teachers supply and review keys before saving.

Gradebook marks follow the existing direct-percentage submission format, retaining points earned and possible in rubric_selection. Teacher publishing is an explicit action; scoring a response does not publish it automatically.

## Validation

Production frontend build; 22 backend survey/quiz/import/gradebook tests; 13 existing frontend gradebook tests. Browser verification used disposable local data for teacher dashboard navigation, points/keys, course and grading subcategory linking, written marking, publishing feedback, and student login returning to the quiz. Production acceptance testing should use a dedicated practice assessment and enrolled student account before real classroom use.
