const { pool } = require("../db");

async function getAssignments() {
  const result = await pool.query(
    "SELECT * FROM assignments ORDER BY id ASC"
  );
  return result.rows;
}

async function insertAssignment(assignment) {
  const { lesson_id, title, description, due_date } = assignment;

  const result = await pool.query(
    `INSERT INTO assignments (lesson_id, title, description, due_date)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [lesson_id, title, description, due_date]
  );

  return result.rows[0];
}

module.exports = {
  getAssignments,
  insertAssignment
};
