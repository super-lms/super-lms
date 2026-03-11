// User Service

const userModel = require("../database/users/user-model");

function getAllUsers() {
  return userModel.getUsers();
}

function createUser(user) {
  return userModel.insertUser(user);
}

module.exports = {
  getAllUsers,
  createUser
};
