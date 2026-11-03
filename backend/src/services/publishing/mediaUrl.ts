import crypto from "node:crypto";
import { getJwtSecret } from "../../config/env.js";

/**
 * Short-lived signed links so a platform (Instagram) can fetch a private upload.
 * The link works only for one media id until it expires; nothing else is exposed.
 */
const TTL_SECONDS = 2 * 60 * 60;

const key = () => crypto.createHash("sha256").update(`media-url:${getJwtSecret()}`).digest();
// A variant (e.g. the Instagram JPEG) is part of what is signed, so a link for one cannot fetch the other.
const sign = (id: string, exp: number, variant = "") =>
  crypto.createHmac("sha256", key()).update(variant ? `${id}.${exp}.${variant}` : `${id}.${exp}`).digest("base64url");

export const publicBaseUrl = () => (process.env["PUBLIC_BASE_URL"] ?? "").trim().replace(/\/+$/, "");

/** True when the base URL is something an external platform could plausibly reach. */
export function publicBaseIsReachable(): boolean {
  const base = publicBaseUrl();
  if (!/^https:\/\//i.test(base)) return false;
  return !/^https:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(base);
}

export function signedMediaUrl(mediaId: string, variant = ""): string {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const v = variant ? `&v=${variant}` : "";
  return `${publicBaseUrl()}/api/public/media/${mediaId}?exp=${exp}${v}&sig=${sign(mediaId, exp, variant)}`;
}

export function verifyMediaSignature(mediaId: string, exp: string, sig: string, variant = ""): boolean {
  const e = Number(exp);
  if (!Number.isFinite(e) || e < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(sign(mediaId, e, variant));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
