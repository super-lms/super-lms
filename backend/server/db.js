const { Pool } = require("pg");

const baseConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
        // Railway can silently drop idle PostgreSQL sockets. Keep them alive and
        // never let an API request wait forever for a usable pooled connection.
        keepAlive: true,
        connectionTimeoutMillis: 4000,
        query_timeout: 15000,
        statement_timeout: 14000,
        lock_timeout: 4000,
        idle_in_transaction_session_timeout: 15000,
        idleTimeoutMillis: 30000,
      }
    : {
        user: "postgres",
        host: "localhost",
        database: "super_lms",
        password: "",
        port: 5432,
        keepAlive: true,
        connectionTimeoutMillis: 4000,
        query_timeout: 15000,
        statement_timeout: 14000,
        lock_timeout: 4000,
        idle_in_transaction_session_timeout: 15000,
        idleTimeoutMillis: 30000,
      };

// Keep authentication capacity separate from dashboard, reporting, file, and
// bulk-approval traffic. Railway may briefly run two application instances, so
// both pools stay deliberately small enough for overlapping deployments.
const pool = new Pool({ ...baseConfig, max: Math.min(Number(process.env.DB_POOL_MAX || 6), 8) });
const authPool = new Pool({ ...baseConfig, max: 2, connectionTimeoutMillis: 4000, query_timeout: 10000, statement_timeout: 9000 });
pool.authPool = authPool;

pool.on("error", (error) => {
  // Prevent an idle client error from terminating the whole web service.
  console.error("Unexpected PostgreSQL pool error:", error);
});
authPool.on("error", (error) => {
  console.error("Unexpected PostgreSQL authentication pool error:", error);
});

module.exports = pool;
