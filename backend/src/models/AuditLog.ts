import mongoose from "mongoose";

export const AUDIT_CATEGORIES = [
  "Authentication",
  "Content",
  "Media",
  "Brands",
  "Scheduling",
  "Reports",
  "Settings",
  "User Management",
] as const;
export const AUDIT_RESULTS = ["Success", "Failed", "Warning"] as const;

const auditSchema = new mongoose.Schema(
  {
    // Email is stored (not just the id) so the record stays readable if the user is removed.
    actorEmail: { type: String, required: true, maxlength: 254 },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true, maxlength: 120 },
    category: { type: String, enum: AUDIT_CATEGORIES, required: true, index: true },
    resource: { type: String, default: "", maxlength: 200 },
    resourceId: { type: String, default: "", maxlength: 64 },
    result: { type: String, enum: AUDIT_RESULTS, required: true, index: true },
    // Only short scalar values; see utils/audit.ts. Never secrets.
    metadata: { type: Map, of: String },
    ip: { type: String, maxlength: 64 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
auditSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditSchema);
export default AuditLog;
