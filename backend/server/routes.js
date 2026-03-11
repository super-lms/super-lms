const express = require("express");
const router = express.Router();

const userService = require("../services/user-service");
const courseService = require("../services/course-service/course-service");
const lessonService = require("../services/lesson-service/lesson-service");
const enrollmentService = require("../services/enrollment-service/enrollment-service");
const assignmentService = require("../services/assignment-service/assignment-service");

// =========================
// USER ROUTES
// =========================

router.get("/users", async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

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

router.get("/courses", async (req, res) => {
  try {
    const courses = await courseService.getAllCourses();
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

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

router.get("/lessons", async (req, res) => {
  try {
    const lessons = await lessonService.getAllLessons();
    res.json(lessons);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch lessons" });
  }
});

router.post("/lessons", async (req, res) => {
  try {
    const newLesson = await lessonService.createLesson(req.body);
    res.json(newLesson);
  } catch (error) {
    res.status(500).json({ error: "Failed to create lesson" });
  }
});

// =========================
// ENROLLMENT ROUTES
// =========================

router.get("/enrollments", async (req, res) => {
  try {
    const enrollments = await enrollmentService.getAllEnrollments();
    res.json(enrollments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch enrollments" });
  }
});

router.post("/enrollments", async (req, res) => {
  try {
    const newEnrollment = await enrollmentService.createEnrollment(req.body);
    res.json(newEnrollment);
  } catch (error) {
    res.status(500).json({ error: "Failed to create enrollment" });
  }
});

// =========================
// ASSIGNMENT ROUTES
// =========================

router.get("/assignments", async (req, res) => {
  try {
    const assignments = await assignmentService.getAllAssignments();
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
});

router.post("/assignments", async (req, res) => {
  try {
    const newAssignment = await assignmentService.createAssignment(req.body);
    res.json(newAssignment);
  } catch (error) {
    res.status(500).json({ error: "Failed to create assignment" });
  }
});

module.exports = router;
