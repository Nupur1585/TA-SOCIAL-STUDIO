import { Router } from "express";
import {
  createReport,
  deleteReport,
  downloadReport,
  getReport,
  listReports,
} from "../controllers/reportController.js";

// Mounted under /api/admin, which already enforces requireAuth + requireAdmin.
const router = Router();

router.get("/", listReports);
router.post("/", createReport);
router.get("/:id", getReport);
router.get("/:id/download", downloadReport);
router.delete("/:id", deleteReport);

export default router;
