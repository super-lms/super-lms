const { pool } = require("../db");

async function getGrades() {
  const result = await pool.query(
    "SELECT * FROM grades ORDER BY id ASC"
  );
  return result.rows;
}

async function insertGrade(grade) {
  const { submission_id, score, feedback } = grade;

  const result = await pool.query(
    `INSERT INTO grades (submission_id, score, feedback)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [submission_id, score, feedback]
  );

  return result.rows[0];
}

module.exports = {
  getGrades,
  insertGrade
};
