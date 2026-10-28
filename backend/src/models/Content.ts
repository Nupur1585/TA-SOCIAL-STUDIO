import mongoose from "mongoose";
import { PLATFORMS } from "./Media.js";

export const CONTENT_TYPES = ["Image", "Reel", "Carousel", "Video", "Short", "Text"] as const;
export const CONTENT_STATUSES = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Scheduled",
  "Publishing",
  "Published",
  "Failed",
  "Cancelled",
  "Rejected",
] as const;
export const TARGET_STATUSES = ["Pending", "Publishing", "Published", "Failed"] as const;

/** One social account a post is meant for, with its own publishing result. */
const targetSchema = new mongoose.Schema(
  {
    socialAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "SocialAccount", required: true },
    platform: { type: String, enum: PLATFORMS, required: true },
    status: { type: String, enum: TARGET_STATUSES, default: "Pending" },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    publishedAt: { type: Date },
    // The platform's own id / link for the live post. Set only after the platform confirms.
    publishedId: { type: String, maxlength: 200 },
    publishedUrl: { type: String, maxlength: 500 },
    // Short, safe message. Raw provider responses are never stored.
    error: { type: String, maxlength: 300 },
  },
  { _id: true }
);

const contentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    caption: { type: String, default: "", maxlength: 5000 },
    hashtags: [{ type: String }],
    brandId: { type: String, required: true, index: true },
    // Derived from `targets` once any are chosen; kept for existing filters and the UI.
    platforms: [{ type: String, enum: PLATFORMS }],
    targets: [targetSchema],
    type: { type: String, enum: CONTENT_TYPES, required: true },
    // Only changed through the guarded transition endpoints, never from request bodies.
    status: { type: String, enum: CONTENT_STATUSES, default: "Draft", index: true },
    scheduledAt: { type: Date, index: true },
    publishStartedAt: { type: Date },
    // Earliest time the scheduler may retry after a transient failure.
    nextAttemptAt: { type: Date },
    publishedAt: { type: Date },
    mediaIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Media" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Content = mongoose.model("Content", contentSchema);
export default Content;
