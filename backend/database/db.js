// PostgreSQL Database Connection

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "super_lms"
});

function connectDatabase() {
  pool.connect()
    .then(() => {
      console.log("PostgreSQL database connected");
    })
    .catch(err => {
      console.error("Database connection error:", err);
    });
}

module.exports = {
  pool,
  connectDatabase
};
