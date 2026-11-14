const test = require("node:test");
const assert = require("node:assert/strict");
const { startDatabaseWatchdog } = require("../server/databaseWatchdog");

const quietLogger = { info() {}, error() {} };

test("database watchdog resets its failure count after recovery", async () => {
  let attempt = 0;
  const pool = {
    query: async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("temporary database failure");
    },
  };
  let exitCode;
  const watchdog = startDatabaseWatchdog(pool, {
    intervalMs: 60000,
    failureLimit: 3,
    logger: quietLogger,
    exit: (code) => { exitCode = code; },
  });

  await watchdog.check();
  assert.equal(watchdog.getConsecutiveFailures(), 1);
  await watchdog.check();
  assert.equal(watchdog.getConsecutiveFailures(), 0);
  assert.equal(exitCode, undefined);
  watchdog.stop();
});

test("database watchdog requests a restart after consecutive failures", async () => {
  const pool = { query: async () => { throw new Error("database unavailable"); } };
  const exits = [];
  const watchdog = startDatabaseWatchdog(pool, {
    intervalMs: 60000,
    failureLimit: 3,
    logger: quietLogger,
    exit: (code) => exits.push(code),
  });

  await watchdog.check();
  await watchdog.check();
  assert.deepEqual(exits, []);
  await watchdog.check();
  assert.deepEqual(exits, [1]);
  watchdog.stop();
});

test("database watchdog probes a critical table and reports repair state", async () => {
  const queries = [];
  const states = [];
  const pool = {
    query: async (query) => {
      queries.push(query);
      const error = new Error("canceling statement due to lock timeout");
      error.code = "55P03";
      throw error;
    },
  };
  const watchdog = startDatabaseWatchdog(pool, {
    intervalMs: 60000,
    failureLimit: 2,
    logger: quietLogger,
    exit() {},
    onStateChange: (status) => states.push(status),
  });

  await watchdog.check();
  assert.match(queries[0].text, /FROM users/);
  assert.equal(states.at(-1).state, "repairing");
  assert.equal(states.at(-1).errorCode, "55P03");

  await watchdog.check();
  assert.equal(states.at(-1).state, "restarting");
  assert.equal(watchdog.getStatus().restartRequested, true);
  watchdog.stop();
});
