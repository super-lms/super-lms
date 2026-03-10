// Super LMS Backend Server

const express = require("express");
const routes = require("./routes");
const db = require("../database/db");

const app = express();

app.use(express.json());

// Connect database
db.connectDatabase();

// Load API routes
app.use("/api", routes);

// Health check
app.get("/", (req, res) => {
  res.send("Super LMS Backend Running");
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Super LMS backend running on port ${PORT}`);
});
