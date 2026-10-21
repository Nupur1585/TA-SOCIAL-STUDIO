import mongoose from "mongoose";
import { PLATFORMS } from "./Media.js";

export const CONTENT_TYPES = ["Image", "Reel", "Carousel", "Video", "Short", "Text"] as const;
export const CONTENT_STATUSES = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Scheduled",
  "Published",
  "Rejected",
] as const;

const contentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    caption: { type: String, default: "", maxlength: 2200 },
    hashtags: [{ type: String }],
    brandId: { type: String, required: true, index: true },
    platforms: [{ type: String, enum: PLATFORMS }],
    type: { type: String, enum: CONTENT_TYPES, required: true },
    // Only changed through the guarded transition endpoint, never from request bodies.
    status: { type: String, enum: CONTENT_STATUSES, default: "Draft", index: true },
    scheduledAt: { type: Date },
    mediaIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Media" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Content = mongoose.model("Content", contentSchema);
export default Content;
