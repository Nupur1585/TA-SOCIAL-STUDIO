import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Never returned by default; select explicitly with .select("+passwordHash").
    passwordHash: { type: String, required: true, select: false },
    // Role is only ever assigned server-side (seed script), never from request bodies.
    role: { type: String, enum: ["admin"], default: "admin", required: true },
    isActive: { type: Boolean, default: true },
    // Incrementing this invalidates every token issued earlier (logout / password reset).
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
export default User;
