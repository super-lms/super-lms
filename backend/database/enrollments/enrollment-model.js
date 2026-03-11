const { pool } = require("../db");

async function getEnrollments() {
  const result = await pool.query(
    "SELECT * FROM enrollments ORDER BY id ASC"
  );
  return result.rows;
}

async function insertEnrollment(enrollment) {
  const { user_id, course_id, role, status } = enrollment;

  const result = await pool.query(
    `INSERT INTO enrollments (user_id, course_id, role, status)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [user_id, course_id, role || "student", status || "active"]
  );

  return result.rows[0];
}

module.exports = {
  getEnrollments,
  insertEnrollment
};
