const { Pool } = require("pg");

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
        // Railway can silently drop idle PostgreSQL sockets. Keep them alive and
        // never let an API request wait forever for a usable pooled connection.
        keepAlive: true,
        connectionTimeoutMillis: 8000,
        idleTimeoutMillis: 30000,
        max: Number(process.env.DB_POOL_MAX || 15),
      }
    : {
        user: "postgres",
        host: "localhost",
        database: "super_lms",
        password: "",
        port: 5432,
        keepAlive: true,
        connectionTimeoutMillis: 8000,
        idleTimeoutMillis: 30000,
        max: Number(process.env.DB_POOL_MAX || 15),
      }
);

pool.on("error", (error) => {
  // Prevent an idle client error from terminating the whole web service.
  console.error("Unexpected PostgreSQL pool error:", error);
});

module.exports = pool;
