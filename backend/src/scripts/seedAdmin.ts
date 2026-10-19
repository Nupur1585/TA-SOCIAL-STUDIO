import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import { requireEnv } from "../config/env.js";
import User from "../models/User.js";

/**
 * Creates the initial administrator from ADMIN_EMAIL / ADMIN_PASSWORD.
 * Idempotent: an existing account is left untouched unless --reset-password is passed.
 */
async function main() {
  const resetPassword = process.argv.includes("--reset-password");

  const email = z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .parse(requireEnv("ADMIN_EMAIL"));
  const password = z
    .string()
    .min(12, "ADMIN_PASSWORD must be at least 12 characters")
    .refine(
      (v) => !/replace_with/i.test(v),
      "ADMIN_PASSWORD is still a placeholder"
    )
    .parse(requireEnv("ADMIN_PASSWORD"));

  await mongoose.connect(requireEnv("MONGODB_URI"));

  const existing = await User.findOne({ email });
  if (existing && !resetPassword) {
    console.log(
      `Administrator ${email} already exists - nothing changed. ` +
        `Run with --reset-password to set the password from ADMIN_PASSWORD.`
    );
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    if (existing) {
      existing.passwordHash = passwordHash;
      existing.role = "admin";
      existing.isActive = true;
      existing.tokenVersion += 1; // sign out all existing sessions
      await existing.save();
      console.log(`Password reset for administrator ${email}.`);
    } else {
      await User.create({ email, passwordHash, role: "admin" });
      console.log(`Administrator ${email} created.`);
    }
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
