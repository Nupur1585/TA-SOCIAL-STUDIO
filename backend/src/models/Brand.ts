import mongoose from "mongoose";
import { PLATFORMS } from "./Media.js";

export const BRAND_STATUSES = ["Active", "Inactive"] as const;

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    tagline: { type: String, default: "", trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, minlength: 5, maxlength: 500 },
    status: { type: String, enum: BRAND_STATUSES, default: "Active", index: true },
    hashtags: [{ type: String, maxlength: 51 }],
    timezone: { type: String, required: true, trim: true, maxlength: 60 },
    // Platforms the brand plans to use. This is NOT proof of a connected account:
    // real connections will live in a separate SocialAccount model (Instagram phase).
    platforms: [{ type: String, enum: PLATFORMS }],
    assignedUsers: { type: Number, default: 1, min: 0, max: 1000 },
    // Picks the banner/logo gradient on the frontend (no uploaded logo yet).
    paletteIndex: { type: Number, default: 0, min: 0, max: 2 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Case-insensitive unique name ("Tech Amdavad" and "tech amdavad" collide).
brandSchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export const Brand = mongoose.model("Brand", brandSchema);
export default Brand;
