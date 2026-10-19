import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { login, logout, me } from "../controllers/authController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
});

const router = Router();

router.post("/login", loginLimiter, login);
router.get("/me", requireAuth, requireAdmin, me);
router.post("/logout", requireAuth, logout);

export default router;
