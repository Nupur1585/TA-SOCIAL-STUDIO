import mongoose from "mongoose";
import { PLATFORMS } from "./Media.js";

// One row per in-flight connection attempt. Single use, auto-deleted after 10 minutes.
const oauthStateSchema = new mongoose.Schema({
  // SHA-256 of the random state sent to the provider; the raw value is never stored.
  stateHash: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", required: true },
  platform: { type: String, enum: PLATFORMS, required: true },
  // PKCE verifier (X), encrypted.
  codeVerifierEnc: { type: String },
  expiresAt: { type: Date, required: true, expires: 0 },
});

export const OAuthState = mongoose.model("OAuthState", oauthStateSchema);
export default OAuthState;
