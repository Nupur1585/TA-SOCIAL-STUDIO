import mongoose from "mongoose";
import { PLATFORMS } from "./Media.js";

export const SOCIAL_STATUSES = ["Connected", "Expired", "Disconnected", "Error"] as const;

const socialAccountSchema = new mongoose.Schema(
  {
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", required: true, index: true },
    platform: { type: String, enum: PLATFORMS, required: true },
    // The account's own id on the platform (Page id, IG user id, channel id, member id, X user id).
    platformAccountId: { type: String, required: true },
    username: { type: String, default: "", maxlength: 200 },
    displayName: { type: String, default: "", maxlength: 200 },
    profileImageUrl: { type: String, default: "", maxlength: 1000 },
    // AES-256-GCM ciphertext. Never selected by default and never serialized to clients.
    accessTokenEnc: { type: String, select: false },
    refreshTokenEnc: { type: String, select: false },
    tokenExpiresAt: { type: Date },
    status: { type: String, enum: SOCIAL_STATUSES, default: "Connected", index: true },
    scopes: [{ type: String, maxlength: 200 }],
    // Small platform-specific extras, e.g. the Facebook Page that owns an Instagram account.
    metadata: { type: Map, of: String },
    connectedAt: { type: Date },
    lastCheckedAt: { type: Date },
    lastError: { type: String, default: "", maxlength: 300 },
    connectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// One platform account can belong to only one brand.
socialAccountSchema.index({ platform: 1, platformAccountId: 1 }, { unique: true });

export const SocialAccount = mongoose.model("SocialAccount", socialAccountSchema);
export default SocialAccount;
