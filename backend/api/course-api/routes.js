const express = require("express")
const router = express.Router()

let courses = []

router.get("/", (req, res) => {
  res.json(courses)
})

router.post("/", (req, res) => {
  const { title } = req.body

  if (!title) {
    return res.status(400).json({ error: "Title is required" })
  }

  const newCourse = {
    id: Date.now(),
    title,
  }

  courses.push(newCourse)

  res.json(newCourse)
})

module.exports = router
