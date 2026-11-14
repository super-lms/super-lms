function startDatabaseWatchdog(pool, options = {}) {
  const intervalMs = Number(options.intervalMs || process.env.DB_WATCHDOG_INTERVAL_MS || 15000);
  const failureLimit = Number(options.failureLimit || process.env.DB_WATCHDOG_FAILURE_LIMIT || 2);
  const queryTimeoutMs = Number(options.queryTimeoutMs || process.env.DB_WATCHDOG_QUERY_TIMEOUT_MS || 4000);
  const exit = options.exit || ((code) => process.exit(code));
  const logger = options.logger || console;
  const onStateChange = options.onStateChange || (() => {});
  const probeText = options.probeText || "SELECT id FROM users ORDER BY id LIMIT 1";

  let consecutiveFailures = 0;
  let checking = false;
  let restartRequested = false;
  let state = "starting";

  const setState = (nextState, error = null) => {
    if (state === nextState && !error) return;
    state = nextState;
    onStateChange({
      state,
      consecutiveFailures,
      restartRequested,
      errorCode: error?.code || null,
      checkedAt: new Date().toISOString(),
    });
  };

  const check = async () => {
    if (checking) return;
    checking = true;

    try {
      await pool.query({
        // SELECT 1 does not touch a table, so it stays green while an
        // AccessExclusiveLock makes login and dashboards unusable. Probe the
        // users table because every role depends on it and it is read-only.
        text: probeText,
        query_timeout: queryTimeoutMs,
      });

      if (consecutiveFailures > 0) {
        logger.info("PostgreSQL connection recovered.");
      }
      consecutiveFailures = 0;
      restartRequested = false;
      setState("healthy");
    } catch (error) {
      consecutiveFailures += 1;
      setState("repairing", error);
      logger.error(
        `PostgreSQL watchdog failure ${consecutiveFailures}/${failureLimit}:`,
        error
      );

      if (consecutiveFailures >= failureLimit && !restartRequested) {
        restartRequested = true;
        setState("restarting", error);
        logger.error(
          "PostgreSQL critical-table probe remained unavailable; exiting so Railway can restart the service and release stuck sessions."
        );
        exit(1);
      }
    } finally {
      checking = false;
    }
  };

  const timer = setInterval(check, intervalMs);
  timer.unref?.();

  return {
    check,
    stop: () => clearInterval(timer),
    getConsecutiveFailures: () => consecutiveFailures,
    getStatus: () => ({ state, consecutiveFailures, restartRequested }),
  };
}

module.exports = { startDatabaseWatchdog };
