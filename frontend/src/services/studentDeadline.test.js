import test from "node:test"
import assert from "node:assert/strict"
import { studentDeadlineLabel } from "./studentDeadline.js"

test("deadline calendar labels use Beijing's day boundary across browser timezones", () => {
  const original = process.env.TZ
  try {
    for (const zone of ["UTC", "America/Vancouver", "Asia/Shanghai"]) {
      process.env.TZ = zone
      const now = new Date("2026-11-07T16:01:00Z")
      assert.equal(studentDeadlineLabel("2026-11-07T15:59:00Z", now), "Past date")
      assert.equal(studentDeadlineLabel("2026-11-07T16:00:00Z", now), "Due today")
      assert.equal(studentDeadlineLabel("2026-11-08T16:00:00Z", now), "Upcoming")
      assert.equal(studentDeadlineLabel("2026-11-08", now), "Due today")
      assert.equal(studentDeadlineLabel("2026-11-07T16:00:00", now), "Due today")
      assert.equal(studentDeadlineLabel(null, now), "No due date")
      assert.equal(studentDeadlineLabel("invalid", now), "Date unavailable")
    }
  } finally { process.env.TZ = original }
})
