import type { CookieOptions } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret, isProduction } from "../config/env.js";

export const AUTH_COOKIE = "ta_session";

const SESSION_EXPIRY = "12h";
const REMEMBER_EXPIRY = "30d";
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

export interface AuthTokenPayload {
  sub: string;
  tv: number;
}

export function signAuthToken(
  userId: string,
  tokenVersion: number,
  remember: boolean
): string {
  return jwt.sign({ tv: tokenVersion }, getJwtSecret(), {
    subject: userId,
    algorithm: "HS256",
    expiresIn: remember ? REMEMBER_EXPIRY : SESSION_EXPIRY,
  });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
  if (
    typeof decoded === "string" ||
    typeof decoded.sub !== "string" ||
    typeof decoded["tv"] !== "number"
  ) {
    throw new Error("Malformed token");
  }
  return { sub: decoded.sub, tv: decoded["tv"] };
}

const baseCookie = (): CookieOptions => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: "lax",
  path: "/",
});

/** "Remember me" yields a persistent cookie; otherwise it is a browser-session cookie. */
export function authCookieOptions(remember: boolean): CookieOptions {
  return remember ? { ...baseCookie(), maxAge: REMEMBER_MS } : baseCookie();
}

export function clearCookieOptions(): CookieOptions {
  return baseCookie();
}
