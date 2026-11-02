import "dotenv/config";
import { describeMongoTarget } from "../utils/dbTarget.js";

/** Reads a required environment variable at call time, failing loudly if missing. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not defined`);
  }
  return value;
}

export const isProduction = () => process.env.NODE_ENV === "production";

export const frontendOrigin = () =>
  process.env.FRONTEND_ORIGIN || "http://localhost:5173";

/** Refuse to run with a weak or placeholder JWT secret. */
export function getJwtSecret(): string {
  const secret = requireEnv("JWT_SECRET");
  if (secret.length < 32 || /replace_with/i.test(secret)) {
    throw new Error(
      "JWT_SECRET must be a random string of at least 32 characters"
    );
  }
  return secret;
}

/**
 * Number of trusted reverse-proxy hops in front of the app (TRUST_PROXY=1 for one proxy such as a
 * platform load balancer). Unset or invalid means no proxy is trusted, so X-Forwarded-* headers are ignored
 * and req.ip is the direct peer. Never set this when the app is reachable directly from the internet.
 */
export function trustProxyHops(): number | false {
  const raw = (process.env["TRUST_PROXY"] ?? "").trim();
  if (!/^\d+$/.test(raw)) return false;
  const hops = Number(raw);
  return hops > 0 ? hops : false;
}

const isHttps = (value: string) => /^https:\/\//i.test(value.trim());
const isLocalHost = (value: string) => /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(value.trim());

/** Pairs of (client id variable, redirect variable) for each OAuth provider. */
const OAUTH_PROVIDERS: [string, string][] = [
  ["META_APP_ID", "META_REDIRECT_URI"],
  ["GOOGLE_CLIENT_ID", "GOOGLE_REDIRECT_URI"],
  ["LINKEDIN_CLIENT_ID", "LINKEDIN_REDIRECT_URI"],
  ["X_CLIENT_ID", "X_REDIRECT_URI"],
];

/**
 * In production, refuse to start with settings that would silently break login or OAuth.
 * Only variable names appear in messages; values are never printed. Development is not affected.
 */
export function assertProductionConfig(): void {
  if (!isProduction()) return;
  const problems: string[] = [];
  const origin = process.env["FRONTEND_ORIGIN"] ?? "";
  if (!origin.trim()) problems.push("FRONTEND_ORIGIN must be set to the public https URL of the app");
  else if (!isHttps(origin) || isLocalHost(origin)) problems.push("FRONTEND_ORIGIN must be a public https URL, not localhost");

  for (const [idVar, redirectVar] of OAUTH_PROVIDERS) {
    if (!(process.env[idVar] ?? "").trim()) continue; // provider not configured
    const redirect = process.env[redirectVar] ?? "";
    if (!isHttps(redirect) || isLocalHost(redirect)) problems.push(`${redirectVar} must be a public https URL when ${idVar} is set`);
  }

  const target = describeMongoTarget(process.env["MONGODB_URI"]);
  if (target.scheme === "unknown") problems.push("MONGODB_URI must be a mongodb:// or mongodb+srv:// connection string");
  else if (!target.database) problems.push("MONGODB_URI must name the database after the host (otherwise MongoDB uses 'test')");

  if (problems.length > 0) throw new Error(`Invalid production configuration: ${problems.join("; ")}`);

  if (target.local) console.warn("MONGODB_URI points at localhost: fine only if MongoDB runs on this same server.");
  if (!(process.env["UPLOAD_DIR"] ?? "").trim()) {
    console.warn("UPLOAD_DIR is not set: uploads and reports go to a folder that may be wiped on redeploy. Point it at persistent storage.");
  }

  const base = process.env["PUBLIC_BASE_URL"] ?? "";
  if (!isHttps(base) || isLocalHost(base)) {
    console.warn("PUBLIC_BASE_URL is not a public https URL: Instagram publishing will be unavailable.");
  }
}
