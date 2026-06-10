# SUPER LMS
# Recovery Playbook V1

## Purpose

This document defines the recovery process for SUPER LMS if a deployment, code change, database issue, or operational failure occurs during pilot operation.

---

# Recovery Principles

1. Stop
2. Preserve
3. Restore
4. Verify
5. Resume

Never continue making changes while the system is unstable.

---

# Level 1 Recovery
## Frontend Issue

Symptoms:

- White screen
- React error
- Build failure
- Page not loading

Procedure:

1. Stop frontend server

CTRL+C

2. Restore last known good backup

Example:

cp backup.jsx target.jsx

3. Build

cd ~/Documents/GitHub/super-lms/frontend

npm run build

4. Verify:

□ Login

□ Dashboard

□ Courses

□ Gradebook

5. Resume

---

# Level 2 Recovery
## Backend Issue

Symptoms:

- API failure
- Server crash
- 500 errors

Procedure:

1. Stop backend

CTRL+C

2. Restore stable backend file

Example:

cp app.backup.js app.js

3. Verify syntax

node --check server/app.js

4. Start backend

npm start

5. Verify:

□ Login

□ Courses

□ Assignments

□ Gradebook

6. Resume

---

# Level 3 Recovery
## Database Issue

Symptoms:

- Missing data
- Corrupted records
- Failed migration

Procedure:

1. Stop backend

2. Backup current database

pg_dump -U postgres postgres > emergency-backup.sql

3. Restore last known good backup

psql -U postgres postgres < super-lms-backup.sql

4. Start backend

5. Verify:

□ Users

□ Courses

□ Assignments

□ Grades

□ Student Snapshot

6. Resume

---

# Emergency Rollback

STOP

BACKUP CURRENT STATE

RESTORE LAST STABLE VERSION

VERIFY:

□ Build

□ Login

□ Course Load

□ Assignments

□ Gradebook

□ Student Snapshot

Only resume once all checks pass.

---

# Pilot Recovery Success Criteria

Recovery is successful when:

□ Teacher can log in

□ Courses load

□ Assignments load

□ Gradebook opens

□ Student Snapshot opens

□ No critical data loss detected

---

# Pilot Candidate Build

SUPER LMS

Pilot Candidate Build 1

Recovery Ready

