// User Database Model

let users = [];

function getUsers() {
  return users;
}

function insertUser(user) {
  const newUser = {
    id: users.length + 1,
    ...user
  };

  users.push(newUser);

  return newUser;
}

module.exports = {
  getUsers,
  insertUser
};
