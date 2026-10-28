import mongoose from "mongoose";
import Brand from "../models/Brand.js";

type Resolved =
  | { ok: true; brand: mongoose.HydratedDocument<mongoose.InferSchemaType<typeof Brand.schema>> }
  | { ok: false; message: string };

/**
 * Server-side check that a client-supplied brandId points at a real brand.
 * Pass requireActive for anything that creates new work for the brand.
 */
export async function resolveBrand(brandId: string, requireActive = false): Promise<Resolved> {
  if (!mongoose.isValidObjectId(brandId)) return { ok: false, message: "Brand not found" };
  const brand = await Brand.findById(brandId);
  if (!brand) return { ok: false, message: "Brand not found" };
  if (requireActive && brand.status !== "Active") {
    return { ok: false, message: `${brand.name} is inactive. Activate the brand first.` };
  }
  return { ok: true, brand };
}
