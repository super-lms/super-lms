const assignmentModel = require("../../database/assignments/assignment-model");

async function getAllAssignments() {
  return await assignmentModel.getAssignments();
}

async function createAssignment(assignment) {
  return await assignmentModel.insertAssignment(assignment);
}

module.exports = {
  getAllAssignments,
  createAssignment
};
