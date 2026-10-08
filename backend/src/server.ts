// import express from "express";
// import cors from "cors";
// import dotenv from "dotenv";

// dotenv.config();

// const app = express();

// const PORT = process.env.PORT || 5000;

// app.use(
//   cors({
//     origin: "http://localhost:5173",
//     credentials: true,
//   })
// );

// app.use(express.json());

// app.get("/api/health", (_req, res) => {
//   res.json({
//     success: true,
//     message: "TA Social Studio Backend Connected",
//     timestamp: new Date().toISOString(),
//   });
// });

// app.get("/", (_req, res) => {
//   res.json({
//     message: "TA Social Studio API is running",
//   });
// });

// app.listen(PORT, () => {
//   console.log(`🚀 Backend running on http://localhost:${PORT}`);
// });

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

// Connect MongoDB
connectDB();

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "TA Social Studio Backend Connected",
    timestamp: new Date().toISOString(),
  });
});

// Root route
app.get("/", (_req, res) => {
  res.json({
    message: "TA Social Studio API is running",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});