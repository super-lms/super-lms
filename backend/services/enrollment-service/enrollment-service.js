const enrollmentModel = require("../../database/enrollments/enrollment-model");

async function getAllEnrollments() {
  return await enrollmentModel.getEnrollments();
}

async function createEnrollment(enrollment) {
  return await enrollmentModel.insertEnrollment(enrollment);
}

module.exports = {
  getAllEnrollments,
  createEnrollment
};
