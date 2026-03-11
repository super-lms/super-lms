const gradeModel = require("../../database/grades/grade-model");

async function getAllGrades() {
  return await gradeModel.getGrades();
}

async function createGrade(grade) {
  return await gradeModel.insertGrade(grade);
}

module.exports = {
  getAllGrades,
  createGrade
};
