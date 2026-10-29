function startDatabaseWatchdog(pool, options = {}) {
  const intervalMs = Number(options.intervalMs || process.env.DB_WATCHDOG_INTERVAL_MS || 60000);
  const failureLimit = Number(options.failureLimit || process.env.DB_WATCHDOG_FAILURE_LIMIT || 3);
  const queryTimeoutMs = Number(options.queryTimeoutMs || process.env.DB_WATCHDOG_QUERY_TIMEOUT_MS || 8000);
  const exit = options.exit || ((code) => process.exit(code));
  const logger = options.logger || console;

  let consecutiveFailures = 0;
  let checking = false;

  const check = async () => {
    if (checking) return;
    checking = true;

    try {
      await pool.query({
        text: "SELECT 1 AS database_health",
        query_timeout: queryTimeoutMs,
      });

      if (consecutiveFailures > 0) {
        logger.info("PostgreSQL connection recovered.");
      }
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      logger.error(
        `PostgreSQL watchdog failure ${consecutiveFailures}/${failureLimit}:`,
        error
      );

      if (consecutiveFailures >= failureLimit) {
        logger.error(
          "PostgreSQL remained unavailable; exiting so Railway can restart the service."
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
  };
}

module.exports = { startDatabaseWatchdog };
