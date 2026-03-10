// Super LMS Backend Server

const express = require("express");
const routes = require("./routes");

const app = express();

app.use(express.json());

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
