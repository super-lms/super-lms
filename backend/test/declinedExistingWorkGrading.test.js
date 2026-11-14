const test = require("node:test");
const assert = require("node:assert/strict");
const { createHeldSubmissions } = require("../server/heldSubmissions");

function makePool({ hasDecline = true, hasExistingSubmission = true } = {}) {
  return {
    async query(sql) {
      const text = String(sql);
      if (text.includes("CREATE TABLE IF NOT EXISTS assignment_held_work")) return { rows: [] };
      if (text.includes("FROM assignment_submission_declines")) {
        return { rows: hasDecline ? [{ exists: 1 }] : [] };
      }
      if (text.includes("FROM submissions WHERE assignment_id")) {
        return { rows: hasExistingSubmission ? [{ exists: 1 }] : [] };
      }
      if (text.includes("FROM assignment_held_work")) return { rows: [] };
      throw new Error(`Unexpected query: ${text}`);
    },
  };
}

function runMiddleware(options) {
  const pool = makePool(options);
  const deadlines = { ensure: async () => {} };
  const middleware = createHeldSubmissions(pool, deadlines, async () => {}).gradeMiddleware;
  const req = {
    params: { assignmentId: "44" },
    body: {
      student_email: "student@example.com",
      ...(options?.gradeExistingWork ? { gradeExistingWork: true } : {}),
    },
  };
  let response = null;
  let nextCalled = false;
  const res = {
    status(status) {
      response = { status };
      return this;
    },
    json(body) {
      response = { ...(response || {}), body };
      return this;
    },
  };
  return middleware(req, res, () => { nextCalled = true; }).then(() => ({ response, nextCalled }));
}

test("declined resubmission still requires explicit teacher authorization", async () => {
  const result = await runMiddleware({ hasDecline: true, hasExistingSubmission: true });
  assert.equal(result.nextCalled, false);
  assert.equal(result.response.status, 409);
  assert.equal(result.response.body.code, "SUBMISSION_DECLINED");
});

test("teacher can grade earlier work without approving the declined resubmission", async () => {
  const result = await runMiddleware({
    hasDecline: true,
    hasExistingSubmission: true,
    gradeExistingWork: true,
  });
  assert.equal(result.nextCalled, true);
  assert.equal(result.response, null);
});

test("override cannot create a grade when no earlier submission exists", async () => {
  const result = await runMiddleware({
    hasDecline: true,
    hasExistingSubmission: false,
    gradeExistingWork: true,
  });
  assert.equal(result.nextCalled, false);
  assert.equal(result.response.status, 409);
  assert.equal(result.response.body.code, "NO_EXISTING_WORK");
});
