import path from "node:path";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import { uploadDir } from "../middleware/upload.js";
import Media from "../models/Media.js";
import { verifyMediaSignature } from "../services/publishing/mediaUrl.js";

/**
 * The only unauthenticated route that serves uploads. It exists so Instagram can download the one file
 * being published. Access needs a valid HMAC signature for that media id and an unexpired timestamp.
 */
const router = Router();

router.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false }));

router.get("/media/:id", async (req, res) => {
  const id = String(req.params["id"]);
  const exp = typeof req.query["exp"] === "string" ? req.query["exp"] : "";
  const sig = typeof req.query["sig"] === "string" ? req.query["sig"] : "";
  // Same response for every failure so ids can't be probed.
  const deny = () => res.status(404).json({ success: false, message: "Not found" });
  if (!mongoose.isValidObjectId(id) || !exp || !sig || !verifyMediaSignature(id, exp, sig)) return deny();
  const media = await Media.findById(id).select("filename").lean();
  if (!media) return deny();
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, max-age=300");
  res.sendFile(path.join(uploadDir, path.basename(media.filename)), (error) => {
    if (error && !res.headersSent) deny();
  });
});

export default router;
