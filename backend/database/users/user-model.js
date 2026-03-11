// User Database Model

const { pool } = require("../db");

async function getUsers() {
  const result = await pool.query("SELECT * FROM users ORDER BY id ASC");
  return result.rows;
}

async function insertUser(user) {
  const { first_name, last_name, email, password_hash, role, school_id } = user;

  const result = await pool.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, role, school_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [first_name, last_name, email, password_hash, role, school_id]
  );

  return result.rows[0];
}

module.exports = {
  getUsers,
  insertUser
};
