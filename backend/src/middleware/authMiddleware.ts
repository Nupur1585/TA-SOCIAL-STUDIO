import type { NextFunction, Request, Response } from "express";
import User from "../models/User.js";
import { AUTH_COOKIE, verifyAuthToken } from "../utils/generateToken.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string; email: string; role: "admin" };
  }
}

const unauthorized = (res: Response) =>
  res.status(401).json({ success: false, message: "Authentication required" });

/** Verifies the session cookie and loads the user fresh from MongoDB on every request. */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.cookies?.[AUTH_COOKIE];
    if (typeof token !== "string" || !token) {
      return unauthorized(res);
    }

    let payload;
    try {
      payload = verifyAuthToken(token);
    } catch {
      return unauthorized(res);
    }

    const user = await User.findById(payload.sub).lean();
    if (!user || !user.isActive || user.tokenVersion !== payload.tv) {
      return unauthorized(res);
    }

    req.user = { id: String(user._id), email: user.email, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
}

/** Must run after requireAuth. Role comes from the database, never from the client. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Administrator access required" });
  }
  next();
}
