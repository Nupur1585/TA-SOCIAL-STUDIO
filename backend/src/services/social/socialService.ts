import mongoose from "mongoose";
import Brand from "../../models/Brand.js";
import type { PlatformKey } from "../../models/Media.js";
import OAuthState from "../../models/OAuthState.js";
import SocialAccount from "../../models/SocialAccount.js";
import { decryptSecret, encryptionConfigured, encryptSecret, randomToken, sha256 } from "../../utils/crypto.js";
import {
  PROVIDERS,
  pkceChallenge,
  ProviderError,
  providerForPlatform,
  type AccountData,
  type ProviderId,
  type TokenSet,
} from "./providers.js";

const STATE_TTL_MS = 10 * 60 * 1000;
// Treat a token as expired slightly early so a request never starts with one about to lapse.
const SKEW_MS = 60 * 1000;

export type AccountDoc = mongoose.HydratedDocument<mongoose.InferSchemaType<typeof SocialAccount.schema>>;

/** The only shape ever sent to the browser. Token fields are deliberately absent. */
export function serializeAccount(a: AccountDoc) {
  const expired = a.status === "Connected" && a.tokenExpiresAt != null && a.tokenExpiresAt.getTime() <= Date.now();
  return {
    id: String(a._id),
    brandId: String(a.brandId),
    platform: a.platform,
    platformAccountId: a.platformAccountId,
    username: a.username,
    displayName: a.displayName,
    profileImageUrl: a.profileImageUrl,
    status: expired ? "Expired" : a.status,
    scopes: a.scopes,
    tokenExpiresAt: a.tokenExpiresAt ?? null,
    connectedAt: a.connectedAt ?? null,
    lastCheckedAt: a.lastCheckedAt ?? null,
    lastError: a.lastError,
    // Only a short allowlist of non-secret metadata.
    metadata: { ...(a.metadata?.get("pageName") ? { pageName: a.metadata.get("pageName") as string } : {}) },
  };
}

/** Which providers can be used right now, for the UI. Never includes credentials. */
export function providerStatus() {
  const encryption = encryptionConfigured();
  return (["instagram", "facebook", "youtube", "linkedin", "x"] as PlatformKey[]).map((platform) => {
    const p = providerForPlatform(platform);
    const missing = p.env.filter((n) => !(process.env[n] ?? "").trim());
    return {
      platform,
      provider: p.id,
      label: p.label,
      configured: encryption && missing.length === 0,
      missing: encryption ? missing : ["TOKEN_ENCRYPTION_KEY", ...missing],
      notes: p.notes,
    };
  });
}

function assertReady(provider: (typeof PROVIDERS)[ProviderId]) {
  if (!encryptionConfigured()) {
    throw new ProviderError(503, "Token encryption is not configured on the server (TOKEN_ENCRYPTION_KEY).");
  }
  if (!provider.configured()) {
    throw new ProviderError(503, `${provider.label} is not configured on the server. Add its credentials to backend/.env.`);
  }
}

export async function startConnect(userId: string, brandId: string, platform: PlatformKey): Promise<string> {
  const provider = providerForPlatform(platform);
  assertReady(provider);
  const brand = mongoose.isValidObjectId(brandId) ? await Brand.findById(brandId) : null;
  if (!brand) throw new ProviderError(404, "Brand not found");
  if (brand.status !== "Active") throw new ProviderError(400, `${brand.name} is inactive. Activate the brand first.`);

  const state = randomToken(32);
  const verifier = provider.pkce ? randomToken(48) : undefined;
  await OAuthState.create({
    stateHash: sha256(state),
    userId: new mongoose.Types.ObjectId(userId),
    brandId: brand._id,
    platform,
    ...(verifier ? { codeVerifierEnc: encryptSecret(verifier) } : {}),
    expiresAt: new Date(Date.now() + STATE_TTL_MS),
  });
  return provider.authUrl({ platform, state, ...(verifier ? { codeChallenge: pkceChallenge(verifier) } : {}) });
}

export interface ConnectResult {
  platform: PlatformKey;
  brandId: string;
  connected: number;
  skipped: string[];
}

/** Handles the provider redirect. Validates state, exchanges the code, stores encrypted tokens. */
export async function completeConnect(
  userId: string,
  providerId: ProviderId,
  state: string,
  code: string,
): Promise<ConnectResult> {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new ProviderError(400, "Unknown provider");
  assertReady(provider);

  // Single use: the state is consumed whether or not the rest succeeds.
  const record = await OAuthState.findOneAndDelete({ stateHash: sha256(state) });
  if (!record || record.expiresAt.getTime() < Date.now() || String(record.userId) !== userId) {
    throw new ProviderError(400, "This connection request is invalid or has expired. Please start again.");
  }
  const platform = record.platform;
  if (providerForPlatform(platform).id !== providerId) {
    throw new ProviderError(400, "This connection request does not match the platform. Please start again.");
  }
  const brand = await Brand.findById(record.brandId);
  if (!brand) throw new ProviderError(404, "The brand no longer exists.");

  const verifier = record.codeVerifierEnc ? (decryptSecret(record.codeVerifierEnc) ?? undefined) : undefined;
  const accounts = await provider.connect({ platform, code, codeVerifier: verifier });

  let connected = 0;
  const skipped: string[] = [];
  for (const a of accounts) {
    const result = await saveAccount(brand._id, userId, a);
    if (result === "ok") connected += 1;
    else skipped.push(a.displayName || a.username || a.platformAccountId);
  }
  if (connected === 0) {
    throw new ProviderError(409, `Already connected to another brand: ${skipped.join(", ")}. Disconnect it there first.`);
  }
  return { platform, brandId: String(brand._id), connected, skipped };
}

async function saveAccount(brandId: mongoose.Types.ObjectId, userId: string, a: AccountData): Promise<"ok" | "taken"> {
  const existing = await SocialAccount.findOne({ platform: a.platform, platformAccountId: a.platformAccountId });
  // An account can belong to one brand. A live connection elsewhere blocks it; a disconnected one can move.
  if (existing && !existing.brandId.equals(brandId) && existing.status !== "Disconnected") return "taken";

  const fields = {
    brandId,
    username: a.username,
    displayName: a.displayName,
    profileImageUrl: a.profileImageUrl,
    accessTokenEnc: encryptSecret(a.tokens.accessToken),
    scopes: a.tokens.scopes,
    status: "Connected" as const,
    connectedAt: new Date(),
    lastCheckedAt: new Date(),
    lastError: "",
    connectedBy: new mongoose.Types.ObjectId(userId),
    metadata: a.metadata,
  };
  const doc = existing ?? new SocialAccount({ platform: a.platform, platformAccountId: a.platformAccountId });
  doc.set(fields);
  doc.set("tokenExpiresAt", a.tokens.expiresAt ?? undefined);
  // Keep an older refresh token if the provider did not send a new one.
  if (a.tokens.refreshToken) doc.set("refreshTokenEnc", encryptSecret(a.tokens.refreshToken));
  await doc.save();
  return "ok";
}

async function loadWithTokens(id: string): Promise<AccountDoc | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  return SocialAccount.findById(id).select("+accessTokenEnc +refreshTokenEnc");
}

function applyTokens(doc: AccountDoc, t: TokenSet) {
  doc.set("accessTokenEnc", encryptSecret(t.accessToken));
  if (t.refreshToken) doc.set("refreshTokenEnc", encryptSecret(t.refreshToken));
  doc.set("tokenExpiresAt", t.expiresAt ?? undefined);
  if (t.scopes.length) doc.set("scopes", t.scopes);
}

/** Refreshes using the stored refresh token. Marks the account Expired when that is impossible. */
export async function refreshAccount(doc: AccountDoc): Promise<void> {
  const provider = providerForPlatform(doc.platform);
  assertReady(provider);
  const refreshToken = doc.refreshTokenEnc ? decryptSecret(doc.refreshTokenEnc) : null;
  if (!provider.refresh || !refreshToken) {
    doc.set({ status: "Expired", lastError: "This connection cannot be refreshed. Reconnect the account." });
    await doc.save();
    throw new ProviderError(409, "This connection cannot be refreshed automatically. Reconnect the account.");
  }
  try {
    applyTokens(doc, await provider.refresh(refreshToken));
    doc.set({ status: "Connected", lastError: "", lastCheckedAt: new Date() });
    await doc.save();
  } catch (e) {
    doc.set({ status: "Expired", lastError: "Token refresh failed. Reconnect the account." });
    await doc.save();
    throw e instanceof ProviderError ? e : new ProviderError(502, "Token refresh failed.");
  }
}

/** Live check against the provider; updates status and profile. */
export async function checkAccount(id: string): Promise<AccountDoc | null> {
  const doc = await loadWithTokens(id);
  if (!doc) return null;
  if (doc.status === "Disconnected") return doc;
  const provider = providerForPlatform(doc.platform);
  assertReady(provider);

  const expired = doc.tokenExpiresAt != null && doc.tokenExpiresAt.getTime() - SKEW_MS <= Date.now();
  if (expired) {
    try {
      await refreshAccount(doc);
    } catch {
      return doc; // refreshAccount already recorded Expired
    }
  }
  const token = doc.accessTokenEnc ? decryptSecret(doc.accessTokenEnc) : null;
  if (!token) {
    doc.set({ status: "Error", lastError: "Stored credentials could not be read. Reconnect the account.", lastCheckedAt: new Date() });
    await doc.save();
    return doc;
  }
  try {
    const profile = await provider.check({ platform: doc.platform, accountId: doc.platformAccountId, accessToken: token });
    doc.set({ status: "Connected", lastError: "", lastCheckedAt: new Date() });
    if (profile.username) doc.set("username", profile.username);
    if (profile.displayName) doc.set("displayName", profile.displayName);
    if (profile.profileImageUrl) doc.set("profileImageUrl", profile.profileImageUrl);
  } catch (e) {
    const rejected = e instanceof ProviderError && e.status === 401;
    doc.set({
      status: rejected ? "Expired" : "Error",
      lastError: e instanceof ProviderError ? e.message.slice(0, 300) : "Connection check failed.",
      lastCheckedAt: new Date(),
    });
  }
  await doc.save();
  return doc;
}

export async function manualRefresh(id: string): Promise<AccountDoc | null> {
  const doc = await loadWithTokens(id);
  if (!doc) return null;
  if (doc.status === "Disconnected") throw new ProviderError(409, "This account is disconnected. Connect it again.");
  await refreshAccount(doc);
  return doc;
}

/** Keeps the row for history but destroys the stored credentials. */
export async function disconnectAccount(id: string): Promise<AccountDoc | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await SocialAccount.findById(id);
  if (!doc) return null;
  doc.set({ status: "Disconnected", lastError: "" });
  doc.set("tokenExpiresAt", undefined);
  await doc.save();
  await SocialAccount.updateOne({ _id: doc._id }, { $unset: { accessTokenEnc: 1, refreshTokenEnc: 1 } });
  return doc;
}

/**
 * For the future publishing code: returns a usable access token, refreshing if needed.
 * Never call this from a route that returns data to the browser.
 */
export async function getUsableAccessToken(id: string): Promise<string> {
  const doc = await loadWithTokens(id);
  if (!doc || doc.status === "Disconnected") throw new ProviderError(409, "Account is not connected");
  if (doc.tokenExpiresAt && doc.tokenExpiresAt.getTime() - SKEW_MS <= Date.now()) await refreshAccount(doc);
  const token = doc.accessTokenEnc ? decryptSecret(doc.accessTokenEnc) : null;
  if (!token) throw new ProviderError(409, "Stored credentials could not be read. Reconnect the account.");
  return token;
}
