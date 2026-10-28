import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for OAuth tokens stored in MongoDB.
 * TOKEN_ENCRYPTION_KEY must be 32 random bytes as 64 hex chars or base64.
 * Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

let cachedKey: Buffer | null | undefined;

function parseKey(raw: string): Buffer | null {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  const b = Buffer.from(raw, "base64");
  return b.length === 32 ? b : null;
}

/** Returns the key, or null when it is not configured. Throws when it is set but malformed. */
export function getEncryptionKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env["TOKEN_ENCRYPTION_KEY"];
  if (!raw) return (cachedKey = null);
  const key = parseKey(raw.trim());
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 random bytes (64 hex characters or base64)");
  }
  return (cachedKey = key);
}

export const encryptionConfigured = () => getEncryptionKey() !== null;

function requireKey(): Buffer {
  const key = getEncryptionKey();
  if (!key) throw new Error("TOKEN_ENCRYPTION_KEY is not configured");
  return key;
}

/** Output format: v1.<iv>.<tag>.<ciphertext> (base64url). A fresh random IV is used every time. */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", requireKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
}

/** Returns null (never throws) when the value is corrupt or was encrypted with another key. */
export function decryptSecret(payload: string): string | null {
  try {
    const [version, iv, tag, data] = payload.split(".");
    if (version !== "v1" || !iv || !tag || !data) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", requireKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");
