# SUPER LMS
# Pilot Operations Manual V1

## Pilot Candidate Build

Status: Pilot Candidate Build 1

Teacher Workflow: Stable
Student Visibility: Stable
Parent Visibility: Stable

---

# Daily Startup Procedure

## Backend Server Terminal

cd ~/Documents/GitHub/super-lms/backend

npm start

---

## Frontend Server Terminal

cd ~/Documents/GitHub/super-lms/frontend

npm run dev

---

Verify:

Frontend:
http://localhost:5173

Backend:
http://localhost:3000

---

# Daily Shutdown Procedure

Backend Server Terminal

CTRL+C

Frontend Server Terminal

CTRL+C

---

# Database Backup Procedure

Create backup folder:

mkdir -p ~/Documents/SUPER-LMS-BACKUPS

Create backup:

pg_dump -U postgres postgres > \
~/Documents/SUPER-LMS-BACKUPS/super-lms-backup.sql

Verify file exists before continuing.

---

# Database Restore Procedure

Restore:

psql -U postgres postgres < \
~/Documents/SUPER-LMS-BACKUPS/super-lms-backup.sql

Verify:

- Login works
- Courses load
- Gradebook loads

---

# Frontend Recovery Procedure

1. Restore last stable backup file

Example:

cp backup.jsx original.jsx

2. Build

cd ~/Documents/GitHub/super-lms/frontend

npm run build

3. Verify

- Login
- Dashboard
- Courses
- Gradebook

4. Resume operation

---

# Backend Recovery Procedure

1. Restore stable backend file

Example:

cp app.backup.js app.js

2. Syntax check

node --check server/app.js

3. Start backend

npm start

4. Verify

- Login
- Course load
- Gradebook load

---

# Emergency Rollback Procedure

STOP

BACKUP CURRENT STATE

RESTORE LAST STABLE VERSION

VERIFY BUILD

VERIFY LOGIN

VERIFY COURSE LOAD

VERIFY GRADEBOOK

VERIFY STUDENT SNAPSHOT

RESUME OPERATION

---

# Pilot Launch Checklist

□ Course exists

□ Students enrolled

□ Assessment pathways total 100%

□ Evidence tiers total 100%

□ Assignment exists

□ Assignment Health Check passing

□ Course Health Check passing

□ Gradebook opens

□ Student Snapshot opens

□ At-Risk Intelligence visible

---

# Pilot Success Criteria

After Week 1:

□ Teacher can create assignments

□ Teacher can edit assignments

□ Teacher can grade

□ Student progress visible

□ Parent Snapshot visible

□ No data loss

□ No emergency rollback required

---

# Pilot Candidate Designation

SUPER LMS

Pilot Candidate Build 1

Ready For Controlled Pilot Deployment
