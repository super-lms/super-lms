const express = require("express");
const router = express.Router();

const userService = require("../services/user-service");
const courseService = require("../services/course-service/course-service");
const lessonService = require("../services/lesson-service/lesson-service");


// =========================
// USER ROUTES
// =========================

// GET all users
router.get("/users", async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// CREATE user
router.post("/users", async (req, res) => {
  try {
    const newUser = await userService.createUser(req.body);
    res.json(newUser);
  } catch (error) {
    res.status(500).json({ error: "Failed to create user" });
  }
});


// =========================
// COURSE ROUTES
// =========================

// GET all courses
router.get("/courses", async (req, res) => {
  try {
    const courses = await courseService.getAllCourses();
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

// CREATE course
router.post("/courses", async (req, res) => {
  try {
    const newCourse = await courseService.createCourse(req.body);
    res.json(newCourse);
  } catch (error) {
    res.status(500).json({ error: "Failed to create course" });
  }
});


// =========================
// LESSON ROUTES
// =========================

// GET all lessons
router.get("/lessons", async (req, res) => {
  try {
    const lessons = await lessonService.getAllLessons();
    res.json(lessons);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch lessons" });
  }
});

// CREATE lesson
router.post("/lessons", async (req, res) => {
  try {
    const newLesson = await lessonService.createLesson(req.body);
    res.json(newLesson);
  } catch (error) {
    res.status(500).json({ error: "Failed to create lesson" });
  }
});

module.exports = router;
