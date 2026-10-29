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
