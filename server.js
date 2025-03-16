require("dotenv").config();
const express = require("express");
const { createServer } = require("http");
const cors = require("cors");

const connectDB = require("./config/connection");

const app = express();
const PORT = process.env.PORT || 3000;
// Connect to MongoDB
connectDB();
// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:4200",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Routes
// Routes
app.get("/", (req, res) => {
  res.json({ message: "Welcome to DevBridge API!" });
});
// Create an HTTP server
const httpServer = createServer(app);

// Start the HTTP server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
