// Super LMS Backend Server

const express = require("express");

const app = express();

app.use(express.json());

// Health check route
app.get("/", (req, res) => {
  res.send("Super LMS Backend Running");
});

// Server port
const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Super LMS backend running on port ${PORT}`);
});
