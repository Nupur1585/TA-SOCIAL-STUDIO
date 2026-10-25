import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import connectDB from "./config/db.js";
import { frontendOrigin, getJwtSecret } from "./config/env.js";
import { requireAdmin, requireAuth } from "./middleware/authMiddleware.js";
import auditRoutes from "./routes/auditRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import contentRoutes from "./routes/contentRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

// Fail fast if the signing secret is missing or weak.
getJwtSecret();

const app = express();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: frontendOrigin(),
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Connect MongoDB
connectDB();

// Health check (public)
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

// Auth (login is public; me/logout are guarded inside the router)
app.use("/api/auth", authRoutes);

// Every other API route must be mounted under here so it is admin-only by default.
app.use("/api/admin", requireAuth, requireAdmin);
app.use("/api/admin/media", mediaRoutes);
app.use("/api/admin/content", contentRoutes);
app.use("/api/admin/reports", reportRoutes);
app.use("/api/admin/audit", auditRoutes);

// Unknown routes and errors: JSON, no stack traces.
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Not found" });
});
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ success: false, message: "Something went wrong" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
