import mongoose from "mongoose";
import { PLATFORMS } from "./Media.js";

export const PLAN_CONTENT_TYPES = ["Image", "Reel", "Carousel", "Video", "Short", "Text"] as const;
export const PLAN_GOALS = ["Brand awareness", "Engagement", "Product promotion", "Education", "Traffic", "Lead generation"] as const;

/**
 * Saved AI output, for history only. `kind: "content"` is a caption generation; `kind: "plan"` is a content
 * plan. Neither is content: posts are created through the normal Content API when the admin saves them.
 * Never stores the API key or raw provider responses.
 */
const variationSchema = new mongoose.Schema(
  {
    title: { type: String, default: "", maxlength: 200 },
    caption: { type: String, default: "", maxlength: 6000 },
    callToAction: { type: String, default: "", maxlength: 500 },
    shortDescription: { type: String, default: "", maxlength: 500 },
    hashtags: [{ type: String, maxlength: 60 }],
    // Problems found by server-side validation (e.g. over X's 280 limit). Empty means usable.
    issues: [{ type: String, maxlength: 300 }],
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    platform: { type: String, enum: PLATFORMS, required: true },
    variations: [variationSchema],
  },
  { _id: false }
);

/** One suggested post inside a plan. */
const ideaSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, maxlength: 20 },
    idea: { type: String, default: "", maxlength: 400 },
    topic: { type: String, default: "", maxlength: 200 },
    platform: { type: String, enum: PLATFORMS, required: true },
    contentType: { type: String, enum: PLAN_CONTENT_TYPES, default: "Text" },
    captionConcept: { type: String, default: "", maxlength: 600 },
    callToAction: { type: String, default: "", maxlength: 200 },
    hashtags: [{ type: String, maxlength: 60 }],
    // Local calendar date/time in the admin's timezone at planning time (see plan.utcOffsetMinutes).
    date: { type: String, required: true, maxlength: 10 },
    time: { type: String, required: true, maxlength: 5 },
    reason: { type: String, default: "", maxlength: 400 },
    issues: [{ type: String, maxlength: 300 }],
    // Captions produced by the normal AI content generator, editable and not yet a post.
    draft: {
      type: new mongoose.Schema(
        {
          title: { type: String, default: "", maxlength: 200 },
          caption: { type: String, default: "", maxlength: 6000 },
          callToAction: { type: String, default: "", maxlength: 500 },
          hashtags: [{ type: String, maxlength: 60 }],
        },
        { _id: false }
      ),
      default: undefined,
    },
    mediaIds: [{ type: String, maxlength: 24 }],
    // Set once the idea has been saved as a real Content post, so it is never saved twice.
    contentId: { type: String, maxlength: 24 },
  },
  { _id: false }
);

const aiGenerationSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["content", "plan"], default: "content", index: true },
    brandId: { type: String, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    topic: { type: String, required: true, maxlength: 2000 },
    purpose: { type: String, required: true, maxlength: 40 },
    settings: {
      tone: { type: String, maxlength: 40 },
      language: { type: String, maxlength: 40 },
      length: { type: String, maxlength: 20 },
      hashtagCount: { type: Number },
      includeCta: { type: Boolean },
      variations: { type: Number },
    },
    platforms: [{ type: String, enum: PLATFORMS }],
    results: [resultSchema],
    plan: {
      type: new mongoose.Schema(
        {
          goal: { type: String, enum: PLAN_GOALS },
          periodDays: { type: Number },
          postCount: { type: Number },
          startDate: { type: String, maxlength: 10 },
          utcOffsetMinutes: { type: Number },
          preferences: { type: String, maxlength: 300 },
          accountIds: [{ type: String, maxlength: 24 }],
          ideas: [ideaSchema],
        },
        { _id: false }
      ),
      default: undefined,
    },
    model: { type: String, maxlength: 80 },
  },
  { timestamps: true }
);
aiGenerationSchema.index({ createdAt: -1 });

export const AiGeneration = mongoose.model("AiGeneration", aiGenerationSchema);
export default AiGeneration;
