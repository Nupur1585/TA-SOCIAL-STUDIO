import { Router } from "express";
import {
  createBrand,
  deleteBrand,
  getBrand,
  listBrands,
  setBrandStatus,
  updateBrand,
} from "../controllers/brandController.js";

// Mounted under /api/admin, which already enforces requireAuth + requireAdmin.
const router = Router();

router.get("/", listBrands);
router.post("/", createBrand);
router.get("/:id", getBrand);
router.patch("/:id", updateBrand);
router.patch("/:id/status", setBrandStatus);
router.delete("/:id", deleteBrand);

export default router;
