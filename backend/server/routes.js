const express = require("express");
const router = express.Router();

const userService = require("../services/user-service");

// GET all users
router.get("/users", (req, res) => {
  const users = userService.getAllUsers();
  res.json(users);
});

// CREATE user
router.post("/users", (req, res) => {
  const newUser = userService.createUser(req.body);
  res.json(newUser);
});

module.exports = router;
