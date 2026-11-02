import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import { isProduction, requireEnv } from "../config/env.js";
import User from "../models/User.js";
import { describeMongoTarget } from "../utils/dbTarget.js";

/**
 * Creates the initial administrator from ADMIN_EMAIL / ADMIN_PASSWORD.
 * Idempotent: an existing account is left untouched unless --reset-password is passed.
 *
 * Flags:
 *   --dry-run         connect read-only, show the target database and what would happen, change nothing
 *   --reset-password  replace the password of the existing admin (signs out every session)
 *   --confirm-reset   also required for --reset-password when NODE_ENV=production or the database is not local
 *
 * It always prints which database it is aimed at (host and name only, never credentials) before touching it.
 * It is never run by the server on startup.
 */
async function main() {
  const resetPassword = process.argv.includes("--reset-password");
  const dryRun = process.argv.includes("--dry-run");
  const confirmReset = process.argv.includes("--confirm-reset");

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

  const uri = requireEnv("MONGODB_URI");
  const target = describeMongoTarget(uri);
  if (!target.database) {
    throw new Error("MONGODB_URI does not name a database (MongoDB would use 'test'). Add it after the host.");
  }
  console.log(
    `Target database: ${target.host} / "${target.database}" (${target.local ? "local" : "REMOTE"}), NODE_ENV=${process.env["NODE_ENV"] ?? "unset"}`
  );
  const guarded = isProduction() || !target.local;
  if (resetPassword && guarded && !confirmReset && !dryRun) {
    throw new Error(
      "Refusing to reset a password on a production or remote database. Check the target above, then re-run with --confirm-reset."
    );
  }

  await mongoose.connect(uri);

  const existing = await User.findOne({ email });
  if (dryRun) {
    console.log(
      existing
        ? resetPassword
          ? `Dry run: would reset the password for ${email}.`
          : `Dry run: administrator ${email} exists; nothing would change.`
        : `Dry run: would create administrator ${email}.`
    );
  } else if (existing && !resetPassword) {
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
