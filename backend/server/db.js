const { Pool } = require("pg");

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      }
    : {
        user: "postgres",
        host: "localhost",
        database: "super_lms",
        password: "",
        port: 5432,
      }
);

module.exports = pool;
