# PE Fitness Unit Tracker

## Set up a unit

1. Open **Fitness Tracker** from the teacher or admin menu.
2. Select the actual PE class/cohort, then **Create fitness unit**.
3. Enter the unit dates. Monday–Thursday and Back + Chest, Arms, Shoulders, Legs are prefilled.
4. Add the teacher's exercise instructions at each station, then create the unit.

The four groups rotate through all four stations each week. Each group's schedule repeats weekly. Unit dates and station plans stay fixed after creation to preserve the meaning of saved history. Create another unit for a different plan or date range.

| Group | Monday | Tuesday | Wednesday | Thursday |
|---|---|---|---|---|
| A | Back + Chest | Arms | Shoulders | Legs |
| B | Arms | Shoulders | Legs | Back + Chest |
| C | Shoulders | Legs | Back + Chest | Arms |
| D | Legs | Back + Chest | Arms | Shoulders |

## Student workout card

Students open **Fitness Workout Card** in their Student Portal, select their PE class/unit, and choose a starting group. They see their own card, today's station, the group's weekly plan, and teacher-confirmed completion history. Group sizes are shown without exposing classmates' names. A teacher can also record a student's chosen group in the class list.

A group locks after any completed workout. This keeps past records and future rotation aligned. Students cannot mark their own completion.

## Daily teacher checks

1. Open the unit and select the workout date (China time).
2. Students appear under their scheduled station. Students without a group are flagged and can be assigned below.
3. Tick students individually, or use **Check all at this station** when appropriate.
4. Click **Save daily checks**. A success message confirms the saved date.

A checkbox can be unchecked and saved to correct a mistake. Only changed checks are submitted. Unchecked means not checked complete; it does not create an absence or a grade. Future dates and days outside the configured unit schedule cannot be marked. The unit summary totals confirmed workouts by station; selecting an earlier date reviews its daily checks.

If another session changed the unit, reload before editing again. A stale save is rejected, rather than overwriting the other session's changes.

## Print cards

**Print / Save workout cards as PDF** opens a separate, plain printable page. Teachers receive cards for the enrolled roster; a student receives only their own card. Use its print button to print or choose Save as PDF. Pop-up windows must be allowed. No printing happens automatically.

## Validation

- Backend rotation and PostgreSQL integration tests cover complete weekly coverage, partial weeks, authorization, student privacy, live course access, transactional saves, and conflicting simultaneous saves.
- Frontend tests cover escaped multilingual printable cards and empty rosters.
- Local preview: `/qa/fitness-tracker-preview.html` (development only; fictional students). This does not load or modify school records.
