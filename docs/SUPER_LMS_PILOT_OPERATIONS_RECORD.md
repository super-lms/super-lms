# SUPER LMS — Pilot Operations Record

## Operational Status

**PILOT RELEASE CANDIDATE CERTIFIED**

**Decision: GO FOR CONTROLLED PILOT OPERATIONS**

SUPER LMS has completed local and Railway production certification across the Administrator, Teacher, Student, and Observer roles.

This record governs the transition from engineering certification to controlled pilot operation.

---

## Certified Release Baseline

- **Certified tag:** `super-lms-pilot-rc1-certified-2026-07-13`
- **Certified commit:** `b6c52394e368413ed96e30afb550f7e7155e8a8b`
- **Commit purpose:** `Show saved KDU grades in observer portal`
- **Production platform:** Railway
- **Production deployment status at certification:** ACTIVE / SUCCESSFUL
- **Four-role production status:** CERTIFIED

The certified release tag is the authoritative code recovery and comparison checkpoint for the controlled pilot.

---

## Pilot Operations Mandate

Operate the certified system.

Protect production stability.

Collect evidence from real educational use.

Do not build speculative features.

Do not reopen certified milestones without verified regression evidence.

Prioritize pilot support, account readiness, onboarding, production continuity, and evidence-driven improvement.

---

## Certified Roles

### Administrator

Certified for authenticated access to the Administrator Workspace, protected user administration, Observer Management, and administrative lifecycle workflows.

### Teacher

Certified for authenticated course access, assignments, grading workflows, KDU evidence persistence, and representative protected teaching workflows.

### Student

Certified for authenticated dashboard access, enrolled-course visibility, assignment/submission workflows, and course-specific instructional access.

### Observer

Certified for authenticated access, relationship-aware authorization, linked-student isolation, homeroom management where authorized, enrolled-course visibility, persisted grades, feedback, and derived missing-work status.

---

## Known Non-Blocking Findings

### PILOT-KNOWN-001 — Vite Chunk-Size Warning

Production builds succeed while Vite reports a JavaScript chunk larger than 500 kB after minification.

**Pilot classification:** Non-blocking optimization item.

No code-splitting or bundling redesign will be performed during controlled pilot operations without measured production evidence.

### PILOT-KNOWN-002 — Learning Paths Terminology

Learning Paths and Learning / Grading Pathways are two distinct certified systems whose names may be confusing to users.

**Pilot classification:** Documentation and future UI-clarity item.

No rename or architectural restructuring during pilot launch.

### PILOT-KNOWN-003 — Student Standalone Learning Paths Selector

The standalone Student Learning Paths page may report that courses cannot be loaded and may present an empty course selector.

Students remain able to see their enrolled courses on the Student Dashboard and access course-specific Learning Paths through the course workflow.

**Existing identifier:** `AUTH-PRC-RC-008A`

**Pilot classification:** Non-blocking.

### PILOT-KNOWN-004 — Grade 11 Roster Label Observation

Manage My Homeroom displays the eligible roster while some visible labels may reflect class or homeroom designations rather than current-grade values.

**Pilot classification:** Data-label/data-quality review item.

No roster-authorization logic change without direct evidence of incorrect filtering.

---

## Pilot Issue Classification

Every pilot report must be classified before code is changed.

### USER SUPPORT

The certified system is working, but the user needs help understanding or completing the workflow.

### ACCOUNT OR DATA ISSUE

The application is operating, but an account state, enrollment, observer link, role, relationship, or production data value requires correction.

### KNOWN NON-BLOCKING FINDING

The issue matches a documented item in this record and does not prevent the intended pilot workflow.

### PRODUCTION DEFECT

A previously certified workflow fails in production and the failure can be reproduced.

### SECURITY OR AUTHORIZATION STOP CONDITION

A user can access a workflow or data scope not permitted for that role, or a permitted user cannot safely authenticate because of a security-contract failure.

### ENHANCEMENT REQUEST

The system is functioning as certified, but the user requests new behavior, design, reporting, automation, or convenience.

Enhancement requests are recorded for evidence-driven backlog review and are not implemented immediately during pilot operations.

---

## Immediate Stop Conditions

Controlled pilot operation must stop or be narrowly restricted if any of the following occurs:

- A role cannot authenticate or reach its required workspace.
- A Student or Observer can access another user's restricted data.
- A Teacher can access unauthorized courses or students.
- A non-administrator can perform an administrator-only lifecycle action.
- Production submissions, grades, feedback, or observer links fail to persist.
- A repeating HTTP 500 error affects a representative pilot workflow.
- A required production table, relation, constraint, or environment assumption is missing.
- The active production deployment cannot be tied to an approved Git checkpoint.
- A release-blocking defect cannot be narrowly repaired and re-certified.

When a stop condition appears:

1. Stop the affected certification or pilot workflow.
2. Assign a narrow repair identifier.
3. Inspect logs, live code, schema, and production data truth.
4. Repair only the proven failure class.
5. Verify locally.
6. Push the exact checkpoint.
7. Wait for Railway deployment success.
8. Browser-certify the failed production workflow.
9. Resume pilot operation only after the workflow passes.

---

## Change-Control Rules

- Terminal-only engineering workflow.
- No VS Code or nano instructions.
- One file and one responsibility per change whenever practical.
- Full-file replacement or safety-checked atomic transformation only.
- Named backup before substantive code changes.
- `npm run build` after frontend changes.
- `node --check` after backend JavaScript changes.
- Inspect `git diff` before commit.
- Browser verification before certification.
- A successful build is not production certification.
- A successful Railway deployment is not browser certification.
- Certified milestones are not reopened unless verification proves it necessary.
- Production secrets must never appear in documentation or chat.
- Stability is more important than speed.
- If a change does not address a proven problem and cannot be verified, do not make it.

---

## Rollback Record

### Code Recovery Point

- **Tag:** `super-lms-pilot-rc1-certified-2026-07-13`
- **Commit:** `b6c52394e368413ed96e30afb550f7e7155e8a8b`

A rollback must consider both application code and production database state.

The production `observer_student_links` table and its persisted links are part of the certified production state. A code rollback must not casually remove or bypass relationship-aware authorization or linked-student isolation.

No rollback is authorized merely because a non-blocking finding or enhancement request is reported.

---

## Pilot Evidence Log

Record meaningful pilot events below.

### Entry Template

- **Date and time:**
- **Role:**
- **User or test account:**
- **Workflow:**
- **Observed result:**
- **Classification:**
- **Evidence:**
- **Decision:**
- **Follow-up identifier, if required:**

---

## Pilot Launch Entry

- **Certified release:** `super-lms-pilot-rc1-certified-2026-07-13`
- **Certified commit:** `b6c52394e368413ed96e30afb550f7e7155e8a8b`
- **Launch decision:** GO
- **Operational mode:** Controlled pilot
- **Primary objective:** Validate educational usability and operational reliability through real-world evidence
- **Engineering objective:** Preserve the certified release while responding narrowly to proven production needs

---

## Next Operational Priorities

1. Confirm the initial pilot participant group.
2. Confirm Administrator, Teacher, Student, and Observer account readiness.
3. Prepare role-specific onboarding and quick-start materials.
4. Establish the pilot support and issue-reporting channel.
5. Define pilot success measures.
6. Begin controlled user onboarding.
7. Review evidence regularly and maintain the post-pilot backlog.

---

## Closing Principle

SUPER LMS has moved from feature development into controlled operation.

The guiding question is no longer:

**What else can we build?**

The guiding questions are:

**Does the certified system support the intended educational work?**

**What does real pilot evidence prove should happen next?**

Forward and Onward Ho.
