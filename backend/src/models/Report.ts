import mongoose from "mongoose";
import { PLATFORMS } from "./Media.js";

export const REPORT_TYPES = ["Content Summary", "Schedule Overview", "Media Inventory"] as const;
export const REPORT_FORMATS = ["PDF", "CSV"] as const;
// "Scheduled" is reserved for recurring reports; nothing creates it yet.
export const REPORT_STATUSES = ["Ready", "Processing", "Scheduled", "Failed"] as const;

const reportSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    brandId: { type: String, required: true, index: true },
    // Display name supplied by the client (brands are not stored server-side yet).
    brandName: { type: String, required: true, maxlength: 100 },
    type: { type: String, enum: REPORT_TYPES, required: true },
    format: { type: String, enum: REPORT_FORMATS, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    platforms: [{ type: String, enum: PLATFORMS }],
    status: { type: String, enum: REPORT_STATUSES, default: "Processing", index: true },
    // File name inside UPLOAD_DIR/reports; set only once the file really exists.
    filename: { type: String },
    size: { type: Number },
    rowCount: { type: Number },
    error: { type: String, maxlength: 300 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdByEmail: { type: String, required: true },
  },
  { timestamps: true }
);

export const Report = mongoose.model("Report", reportSchema);
export default Report;
