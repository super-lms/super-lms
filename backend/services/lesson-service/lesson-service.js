// Lesson Service

const lessonModel = require("../../database/lessons/lesson-model");

async function getAllLessons() {
  return await lessonModel.getLessons();
}

async function createLesson(lesson) {
  return await lessonModel.insertLesson(lesson);
}

module.exports = {
  getAllLessons,
  createLesson
};
