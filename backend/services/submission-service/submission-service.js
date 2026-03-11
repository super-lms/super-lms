const submissionModel = require("../../database/submissions/submission-model");

async function getAllSubmissions() {
  return await submissionModel.getSubmissions();
}

async function createSubmission(submission) {
  return await submissionModel.insertSubmission(submission);
}

module.exports = {
  getAllSubmissions,
  createSubmission
};
