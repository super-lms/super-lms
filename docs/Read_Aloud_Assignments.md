# Read Aloud assignments

Read Aloud adds student audio recording and word accuracy assessment to an existing course assignment. Recordings may be up to three minutes. This first version supports English text and calculates reading accuracy, not pronunciation or fluency.

## Teacher workflow

1. Create a new assignment through the usual course workspace. Set its title, assessment pathway, evidence tier, points, available date, deadline and publication status.
2. Open Edit Assignment. In Read Aloud, paste the reference passage and choose 1 to 10 attempts (default 3). Save Read Aloud settings. Use a passage of at most 300 normalized words.
3. Students open the assignment, record or upload audio, listen, and submit for accuracy marking. Audio is converted to 16 kHz mono PCM WAV in the browser before upload. A submitted attempt counts toward the allowance.
4. Open Edit Assignment or Grade Now to review recordings and results. Grade Now follows the selected cohort; teachers see only students in their teaching classes. The best assessed attempt is labelled.
5. Listen, inspect the word comparison, and select a reviewed percentage. Low-confidence, unrecognized or adjusted marks require a review note. Publish the reviewed mark to the existing gradebook. Publication replaces that student's current mark for the assignment and records the attempt, teacher, percentage and reason. Publication is manual in this first version.

The passage is locked after the first attempt. Create a new assignment if the reading text changes. Increasing the attempt allowance gives students additional attempts. A duplicated assignment needs its own Read Aloud setup.

## Student workflow

Record reading, stop (automatically at three minutes), listen and submit. Uploading an existing audio file is also supported when the browser can decode it. Files must be under 30 MB before conversion, at most three minutes and at most 6 MB after conversion. The saved attempt appears immediately; results refresh while assessment is processing. The student sees recognized text, word comparison, calculated percentage, equivalent assignment marks, and publication status. Generic text/file submissions cannot replace the required audio workflow.

## Scoring rules

Accuracy = 100 x max(0, 1 - (missed words + changed words + added words) / reference word count).

The comparison uses minimum word edit distance. Case and punctuation are ignored. Whole numbers from 0 to 9999 and common unambiguous contractions are normalized to words. Repetitions count as additions. Self-corrections follow the same rule; teachers may adjust the reviewed percentage with a reason. Scores are not generated when transcription fails. A confidence below 0.80, or unavailable confidence, marks the result as requiring review.

Recognition runs without supplying the passage as a recognition hint. This avoids using the expected passage to fill in what the student might have said. Recognition can still make mistakes; teachers should review before publication. The initial version does not automatically publish marks.

## Server setup

Use Node.js 22 or later (production already uses Node 22). Set these variables on the Super-LMS backend Railway service, using an Azure Speech resource:

- AZURE_SPEECH_KEY: the resource subscription key
- AZURE_SPEECH_REGION: the resource region, for example eastus

Keys remain on the backend. They are not sent to students or embedded in browser files. Until both settings are present, the interface explains that automatic assessment is not connected and disables student submission. Teachers may prepare passages while setup is pending. Azure service billing and the school's audio processing arrangements must be in place before enabling real student use.

The official Microsoft Speech SDK uses continuous recognition so readings longer than one minute are processed across all utterances. Saved attempts are assessed through a queue with one worker to match the Azure Free tier concurrency limit. Recordings and their passage snapshots are stored in PostgreSQL. Recognition errors or timeouts leave saved recordings available for review and reassessment; they never automatically create a zero mark. After a server restart, an unfinished attempt can be reassessed by a teacher once its five-minute processing window has elapsed. Existing late-deadline approval checks and acceptance audit records apply to Read Aloud submissions.

Schema creation is idempotent on first request. The new tables are read_aloud_settings and read_aloud_attempts. Existing assignments, submissions and gradebook calculations are reused. Recordings are served only through authenticated routes, with student ownership, course enrollment and teacher access checks.

## Verification and pilot

Automated checks cover word alignment, three-minute WAV boundaries, two-minute conversion and multi-utterance recognition, authorization, deadlines, attempt caps, recording retention after provider failure, passage locking, reviewed mark publication and rollback on audit failure. Recognition tests use an injected test provider; they do not establish real Azure performance.

Before classroom use, configure the Azure variables and test a real two- to three-minute recording. Confirm all spoken sentences are transcribed, the recording plays back, expected errors are highlighted, and the teacher can publish the reviewed mark into the correct course/cohort gradebook. Compare several accented and noisy recordings with teacher judgement before relying on automatic percentages. This live pilot has not yet been performed.

Microsoft reference: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-recognize-speech?pivots=programming-language-javascript
