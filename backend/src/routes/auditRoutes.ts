import { Router } from "express";
import { exportAudit, listAudit } from "../controllers/auditController.js";

// Mounted under /api/admin (requireAuth + requireAdmin). Read-only: logs can't be edited or deleted via the API.
const router = Router();

router.get("/", listAudit);
router.get("/export", exportAudit);

export default router;
