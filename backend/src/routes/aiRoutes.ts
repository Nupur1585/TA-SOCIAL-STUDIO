import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { aiStatus, deleteGeneration, generate, getGeneration, listGenerations } from "../controllers/aiController.js";
import {
  checkSlots,
  createPlan,
  generatePlanContent,
  getPlan,
  listPlans,
  regenerate,
  savePlan,
} from "../controllers/aiPlanController.js";

// Mounted under /api/admin, which already enforces requireAuth + requireAdmin.
const router = Router();

// Generation costs money and takes seconds: 10 per minute per signed-in admin (AI_RATE_LIMIT_PER_MINUTE to change).
// Plans, regeneration and caption batches all draw from the same allowance as single generations.
const generateLimiter = rateLimit({
  windowMs: 60_000,
  limit: Math.max(1, Number(process.env["AI_RATE_LIMIT_PER_MINUTE"]) || 10),
  keyGenerator: (req) => req.user?.id ?? "anonymous",
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many AI requests. Please wait a minute and try again." },
});

router.get("/status", aiStatus);
router.post("/generate", generateLimiter, generate);
router.get("/generations", listGenerations);
router.get("/generations/:id", getGeneration);
// Deleting works for both captions and plans (same history collection).
router.delete("/generations/:id", deleteGeneration);

router.post("/plans", generateLimiter, createPlan);
router.get("/plans", listPlans);
router.get("/plans/:id", getPlan);
router.put("/plans/:id", savePlan);
router.post("/plans/:id/regenerate", generateLimiter, regenerate);
router.post("/plans/:id/generate-content", generateLimiter, generatePlanContent);
router.post("/slots/check", checkSlots);

export default router;
