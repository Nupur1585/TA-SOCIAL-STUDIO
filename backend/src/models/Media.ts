import mongoose from "mongoose";

export const PLATFORMS = ["instagram", "facebook", "youtube", "linkedin", "x"] as const;
export const MEDIA_KINDS = ["Image", "Video", "Reel", "Short", "Carousel"] as const;

const mediaSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    originalName: { type: String, required: true },
    // Name of the file inside UPLOAD_DIR. Generated server-side, never from the client.
    filename: { type: String, required: true, unique: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    kind: { type: String, enum: MEDIA_KINDS, required: true },
    // Brands live in the frontend for now, so this is a validated string, not a reference.
    brandId: { type: String, required: true, index: true },
    platforms: [{ type: String, enum: PLATFORMS }],
    // Seconds, reported by the browser for videos.
    duration: { type: Number, min: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Media = mongoose.model("Media", mediaSchema);
export default Media;
