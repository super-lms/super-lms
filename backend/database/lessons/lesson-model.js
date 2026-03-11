// Lesson Database Model

const { pool } = require("../db");

async function getLessons() {
  const result = await pool.query(
    "SELECT * FROM lessons ORDER BY id ASC"
  );
  return result.rows;
}

async function insertLesson(lesson) {
  const { course_id, title, content, position } = lesson;

  const result = await pool.query(
    `INSERT INTO lessons (course_id, title, content, position)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [course_id, title, content, position]
  );

  return result.rows[0];
}

module.exports = {
  getLessons,
  insertLesson
};
