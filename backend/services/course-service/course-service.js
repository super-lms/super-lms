// Course Service

const courseModel = require("../database/courses/course-model");

async function getAllCourses() {
  return await courseModel.getCourses();
}

async function createCourse(course) {
  return await courseModel.insertCourse(course);
}

module.exports = {
  getAllCourses,
  createCourse
};
