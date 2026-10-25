import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import User from "../models/User.js";
import { audit } from "../utils/audit.js";
import {
  AUTH_COOKIE,
  authCookieOptions,
  clearCookieOptions,
  signAuthToken,
} from "../utils/generateToken.js";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
  remember: z.boolean().optional(),
});

// Compared against when the email is unknown so response time doesn't reveal account existence.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

const INVALID = {
  success: false,
  message: "Invalid email or password",
};

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(INVALID);
    }
    const { email, password, remember = false } = parsed.data;

    const user = await User.findOne({ email }).select("+passwordHash");
    const passwordOk = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_HASH
    );

    if (!user || !passwordOk || !user.isActive || user.role !== "admin") {
      await audit(req, { action: "Failed login attempt", category: "Authentication", result: "Failed", actorEmail: email });
      return res.status(401).json(INVALID);
    }

    user.lastLoginAt = new Date();
    await user.save();

    req.user = { id: String(user._id), email: user.email, role: user.role };
    await audit(req, { action: "Logged in", category: "Authentication" });
    const token = signAuthToken(String(user._id), user.tokenVersion, remember);
    res.cookie(AUTH_COOKIE, token, authCookieOptions(remember));

    return res.json({
      success: true,
      user: { id: String(user._id), email: user.email, role: user.role },
    });
  } catch (error) {
    next(error);
  }
}

export function me(req: Request, res: Response) {
  return res.json({ success: true, user: req.user });
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    // Bump the token version so the old token is rejected even if it was copied.
    if (req.user) {
      await audit(req, { action: "Logged out", category: "Authentication" });
      await User.updateOne({ _id: req.user.id }, { $inc: { tokenVersion: 1 } });
    }
    res.clearCookie(AUTH_COOKIE, clearCookieOptions());
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
}
