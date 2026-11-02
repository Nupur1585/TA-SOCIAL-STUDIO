/**
 * Helpers for talking about a MongoDB connection string without ever exposing its credentials.
 * Nothing here returns or logs a user name or password.
 */

export interface MongoTarget {
  scheme: "mongodb" | "mongodb+srv" | "unknown";
  /** Host list as written in the URI (no credentials), e.g. "localhost:27017". */
  host: string;
  /** Database named in the URI path. Empty when missing, in which case the driver would use "test". */
  database: string;
  local: boolean;
}

/** Splits a MongoDB URI into its non-secret parts. Never throws. */
export function describeMongoTarget(uri: string | undefined): MongoTarget {
  const raw = (uri ?? "").trim();
  const m = /^(mongodb(?:\+srv)?):\/\/(.*)$/i.exec(raw);
  if (!m) return { scheme: "unknown", host: "", database: "", local: false };
  const rest = m[2] ?? "";
  const afterCreds = rest.slice(rest.lastIndexOf("@", rest.search(/[/?]/) === -1 ? rest.length : rest.search(/[/?]/)) + 1);
  const hostEnd = afterCreds.search(/[/?]/);
  const host = hostEnd === -1 ? afterCreds : afterCreds.slice(0, hostEnd);
  const pathAndQuery = hostEnd === -1 ? "" : afterCreds.slice(hostEnd);
  const database = decodeURIComponentSafe((/^\/([^?]*)/.exec(pathAndQuery)?.[1] ?? "").trim());
  const hosts = host.split(",").map((h) => h.replace(/:\d+$/, "").toLowerCase());
  const local = hosts.length > 0 && hosts.every((h) => h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "0.0.0.0");
  return { scheme: m[1]!.toLowerCase() as MongoTarget["scheme"], host, database, local };
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Removes any mongodb:// or mongodb+srv:// URI (which may contain a password) from free text such as an error message. */
export function redactMongoUris(text: string): string {
  return text.replace(/mongodb(?:\+srv)?:\/\/\S+/gi, "mongodb://[redacted]");
}
