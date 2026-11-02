import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import { assertProductionConfig, frontendOrigin, getJwtSecret, trustProxyHops } from "./config/env.js";
import { requireAdmin, requireAuth } from "./middleware/authMiddleware.js";
import aiRoutes from "./routes/aiRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import brandRoutes from "./routes/brandRoutes.js";
import contentRoutes from "./routes/contentRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import { brandSocialRouter, callbackRouter, providerRouter } from "./routes/socialRoutes.js";
import publicMediaRoutes from "./routes/publicMediaRoutes.js";
import { startScheduler } from "./services/publishing/scheduler.js";
import { installShutdown } from "./utils/shutdown.js";
import { getEncryptionKey } from "./utils/crypto.js";

// Fail fast if the signing secret is missing or weak.
getJwtSecret();
// In production, fail fast on localhost/non-https settings that would break login or OAuth.
assertProductionConfig();
// Throws if TOKEN_ENCRYPTION_KEY is set but malformed; warns (and disables connecting) if it is missing.
if (!getEncryptionKey()) {
  console.warn("TOKEN_ENCRYPTION_KEY is not set: social account connections are disabled.");
}

const app = express();

const PORT = process.env.PORT || 5000;

// Only trust X-Forwarded-* when TRUST_PROXY names how many proxies sit in front (see config/env.ts).
const proxyHops = trustProxyHops();
if (proxyHops) app.set("trust proxy", proxyHops);

// The built React app (frontend/dist) is served from this same origin when it exists.
// This file is backend/src or backend/dist, so ../../frontend/dist resolves to the same folder either way.
const frontendDist = path.resolve(
  process.env["FRONTEND_DIST"] || path.join(path.dirname(fileURLToPath(import.meta.url)), "../../frontend/dist")
);
const serveFrontend = fs.existsSync(path.join(frontendDist, "index.html"));

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // Thumbnails and previews use blob: URLs; connected-account avatars come from the platforms' https hosts.
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "media-src": ["'self'", "blob:"],
        // Only force https when the app is actually served over https, so a local http test still loads.
        "upgrade-insecure-requests": /^https:\/\//i.test(frontendOrigin()) ? [] : null,
      },
    },
  })
);
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

// Health check (public). 503 while MongoDB is not connected so a host's health probe sees the real state.
app.get("/api/health", (_req, res) => {
  const database = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.status(database === "connected" ? 200 : 503).json({
    success: database === "connected",
    message: database === "connected" ? "TA Social Studio Backend Connected" : "TA Social Studio Backend running, database unavailable",
    database,
    timestamp: new Date().toISOString(),
  });
});

// Root route (with a frontend build, "/" is the React app instead)
if (!serveFrontend) {
  app.get("/", (_req, res) => {
    res.json({
      message: "TA Social Studio API is running",
    });
  });
}

// Auth (login is public; me/logout are guarded inside the router)
app.use("/api/auth", authRoutes);

// Signed, expiring links for the files being published (no session; see publicMediaRoutes).
app.use("/api/public", publicMediaRoutes);

// OAuth redirect target: needs the admin session cookie, so it is protected like everything else.
app.use("/api/social", requireAuth, requireAdmin, callbackRouter);

// Every other API route must be mounted under here so it is admin-only by default.
app.use("/api/admin", requireAuth, requireAdmin);
app.use("/api/admin/ai", aiRoutes);
app.use("/api/admin/brands/:brandId/social-accounts", brandSocialRouter);
app.use("/api/admin/social-providers", providerRouter);
app.use("/api/admin/brands", brandRoutes);
app.use("/api/admin/media", mediaRoutes);
app.use("/api/admin/content", contentRoutes);
app.use("/api/admin/reports", reportRoutes);
app.use("/api/admin/audit", auditRoutes);

// Built React app: hashed assets are cached long, index.html never. Registered after every API route.
if (serveFrontend) {
  app.use(
    express.static(frontendDist, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        else res.setHeader("Cache-Control", "no-cache");
      },
    })
  );
  // SPA fallback for page navigations only: never for /api, other methods, or file-like paths (missing assets stay 404).
  app.use((req, res, next) => {
    const isApi = req.path === "/api" || req.path.startsWith("/api/");
    if ((req.method !== "GET" && req.method !== "HEAD") || isApi || path.extname(req.path)) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// Unknown routes and errors: JSON, no stack traces.
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Not found" });
});
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ success: false, message: "Something went wrong" });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  // Publishing happens in the backend, so it keeps working with no browser open.
  mongoose.connection.once("open", () => void startScheduler());
  if (mongoose.connection.readyState === 1) void startScheduler();
});
installShutdown(server);
