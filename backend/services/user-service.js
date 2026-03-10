// User Service

const users = [];

function getAllUsers() {
  return users;
}

function createUser(user) {
  const newUser = {
    id: users.length + 1,
    ...user
  };

  users.push(newUser);

  return newUser;
}

module.exports = {
  getAllUsers,
  createUser
};
