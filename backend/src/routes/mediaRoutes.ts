import { Router } from "express";
import {
  deleteMedia,
  getMedia,
  getMediaFile,
  listMedia,
  updateMedia,
  uploadMedia,
} from "../controllers/mediaController.js";
import { singleUpload } from "../middleware/upload.js";

// Mounted under /api/admin, which already enforces requireAuth + requireAdmin.
const router = Router();

router.get("/", listMedia);
router.post("/", singleUpload, uploadMedia);
router.get("/:id", getMedia);
router.get("/:id/file", getMediaFile);
router.patch("/:id", updateMedia);
router.delete("/:id", deleteMedia);

export default router;
