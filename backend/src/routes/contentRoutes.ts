import { Router } from "express";
import {
  changeStatus,
  createContent,
  deleteContent,
  duplicateContent,
  getContent,
  listContent,
  publishNow,
  reschedule,
  updateContent,
} from "../controllers/contentController.js";

// Mounted under /api/admin, which already enforces requireAuth + requireAdmin.
const router = Router();

router.get("/", listContent);
router.post("/", createContent);
router.get("/:id", getContent);
router.patch("/:id", updateContent);
router.post("/:id/status", changeStatus);
router.post("/:id/reschedule", reschedule);
router.post("/:id/publish-now", publishNow);
router.post("/:id/duplicate", duplicateContent);
router.delete("/:id", deleteContent);

export default router;
