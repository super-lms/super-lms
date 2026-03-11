// Course Database Model

const { pool } = require("../db");

async function getCourses() {
  const result = await pool.query(
    "SELECT * FROM courses ORDER BY id ASC"
  );
  return result.rows;
}

async function insertCourse(course) {
  const { title, description, instructor_id } = course;

  const result = await pool.query(
    `INSERT INTO courses (title, description, instructor_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [title, description, instructor_id]
  );

  return result.rows[0];
}

module.exports = {
  getCourses,
  insertCourse
};
