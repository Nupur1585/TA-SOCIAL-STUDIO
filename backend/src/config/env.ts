import "dotenv/config";

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
