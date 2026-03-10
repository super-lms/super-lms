// Super LMS API Routes

const express = require("express");

const router = express.Router();

// Auth
router.get("/auth", (req, res) => {
  res.send("Auth API");
});

// Users
router.get("/users", (req, res) => {
  res.send("User API");
});

// Courses
router.get("/courses", (req, res) => {
  res.send("Course API");
});

// Enrollments
router.get("/enrollments", (req, res) => {
  res.send("Enrollment API");
});

// Grading
router.get("/grading", (req, res) => {
  res.send("Grading API");
});

// AI
router.get("/ai", (req, res) => {
  res.send("AI API");
});

module.exports = router;
