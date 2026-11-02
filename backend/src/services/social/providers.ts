import crypto from "node:crypto";
import type { PlatformKey } from "../../models/Media.js";

export type ProviderId = "meta" | "instagram" | "google" | "linkedin" | "x";

/** An error whose message is safe to show to the admin. Provider response bodies never go in here. */
export class ProviderError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string | undefined;
  expiresAt?: Date | undefined;
  scopes: string[];
}

export interface AccountData {
  platform: PlatformKey;
  platformAccountId: string;
  username: string;
  displayName: string;
  profileImageUrl: string;
  tokens: TokenSet;
  metadata: Record<string, string>;
}

export interface Profile {
  id?: string;
  username?: string;
  displayName?: string;
  profileImageUrl?: string;
}

export interface Provider {
  id: ProviderId;
  label: string;
  platforms: PlatformKey[];
  /** Environment variables that must be set for this provider. */
  env: string[];
  /** True when the provider hands back a PKCE-protected flow. */
  pkce: boolean;
  /** Plain-language limits shown to the admin. */
  notes: string;
  configured(): boolean;
  redirectUri(): string;
  authUrl(a: { platform: PlatformKey; state: string; codeChallenge?: string }): string;
  connect(a: { platform: PlatformKey; code: string; codeVerifier?: string | undefined }): Promise<AccountData[]>;
  refresh?(refreshToken: string): Promise<TokenSet>;
  check(a: { platform: PlatformKey; accountId: string; accessToken: string }): Promise<Profile>;
}

const env = (name: string) => process.env[name] ?? "";
const allSet = (names: string[]) => names.every((n) => env(n).trim() !== "");
const expiry = (seconds: unknown) => (typeof seconds === "number" && seconds > 0 ? new Date(Date.now() + seconds * 1000) : undefined);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** fetch + JSON with a timeout. Failures become generic ProviderErrors; the body is never exposed or logged. */
async function http(provider: string, url: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  } catch {
    throw new ProviderError(502, `Could not reach ${provider}. Check your connection and try again.`);
  }
  if (!res.ok) {
    console.error(`[social] ${provider} request failed with HTTP ${res.status}`);
    if (res.status === 429) throw new ProviderError(429, `${provider} is rate limiting requests. Try again in a few minutes.`);
    if (res.status === 401 || res.status === 403) throw new ProviderError(401, `${provider} rejected the credentials or permissions.`);
    throw new ProviderError(502, `${provider} returned an error (HTTP ${res.status}).`);
  }
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    throw new ProviderError(502, `${provider} returned an unreadable response.`);
  }
}

const form = (data: Record<string, string>) => ({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
  body: new URLSearchParams(data).toString(),
});

// ───────────────────────── Meta: Instagram + Facebook ─────────────────────────

const metaScopes: Partial<Record<PlatformKey, string[]>> = {
  facebook: ["public_profile", "pages_show_list", "pages_read_engagement", "pages_manage_posts"],
  instagram: ["public_profile", "pages_show_list", "pages_read_engagement", "instagram_basic", "instagram_content_publish"],
};

const graph = () => `https://graph.facebook.com/${env("META_GRAPH_VERSION") || "v21.0"}`;

const meta: Provider = {
  id: "meta",
  label: "Meta (Facebook & Instagram)",
  platforms: ["instagram", "facebook"],
  env: ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI"],
  pkce: false,
  notes:
    "Instagram needs a Business or Creator account linked to a Facebook Page. Publishing permissions require Meta App Review before accounts other than your own app testers can use them. In Meta for Developers the app's use case must include these permissions (Use cases > Customize), the redirect URI must be listed under Valid OAuth Redirect URIs, and you must hold a role on the app while it is in Development mode.",
  configured: () => allSet(meta.env),
  redirectUri: () => env("META_REDIRECT_URI"),
  authUrl: ({ platform, state }) =>
    "https://www.facebook.com/" +
    `${env("META_GRAPH_VERSION") || "v21.0"}/dialog/oauth?` +
    new URLSearchParams({
      client_id: env("META_APP_ID"),
      redirect_uri: meta.redirectUri(),
      state,
      response_type: "code",
      scope: (metaScopes[platform] ?? []).join(","),
    }).toString(),
  async connect({ platform, code }) {
    const q = (p: Record<string, string>) => new URLSearchParams(p).toString();
    const short = await http("Meta", `${graph()}/oauth/access_token?${q({ client_id: env("META_APP_ID"), client_secret: env("META_APP_SECRET"), redirect_uri: meta.redirectUri(), code })}`);
    const shortToken = str(short["access_token"]);
    if (!shortToken) throw new ProviderError(502, "Meta did not return an access token.");
    // Long-lived user token; Page tokens derived from it do not expire.
    const long = await http("Meta", `${graph()}/oauth/access_token?${q({ grant_type: "fb_exchange_token", client_id: env("META_APP_ID"), client_secret: env("META_APP_SECRET"), fb_exchange_token: shortToken })}`);
    const userToken = str(long["access_token"]) || shortToken;
    // Only Instagram needs the linked Instagram account. Facebook asks for Page basics alone, so it neither depends
    // on instagram_* access nor reads Instagram data it does not use.
    const pageFields =
      platform === "instagram"
        ? "id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}"
        : "id,name,access_token,picture{url}";
    const pages = await http("Meta", `${graph()}/me/accounts?${q({ fields: pageFields, limit: "100", access_token: userToken })}`);
    const list = Array.isArray(pages["data"]) ? (pages["data"] as Record<string, unknown>[]) : [];
    const scopes = metaScopes[platform] ?? [];
    const out: AccountData[] = [];
    for (const page of list) {
      const pageId = str(page["id"]);
      const pageToken = str(page["access_token"]);
      if (!pageId || !pageToken) continue;
      if (platform === "facebook") {
        const pic = (page["picture"] as { data?: { url?: string } } | undefined)?.data?.url;
        out.push({
          platform,
          platformAccountId: pageId,
          username: "",
          displayName: str(page["name"]),
          profileImageUrl: str(pic),
          tokens: { accessToken: pageToken, scopes },
          metadata: {},
        });
      } else {
        const ig = page["instagram_business_account"] as Record<string, unknown> | undefined;
        const igId = str(ig?.["id"]);
        if (!ig || !igId) continue;
        out.push({
          platform,
          platformAccountId: igId,
          username: str(ig["username"]),
          displayName: str(ig["name"]) || str(ig["username"]),
          profileImageUrl: str(ig["profile_picture_url"]),
          tokens: { accessToken: pageToken, scopes },
          metadata: { pageId, pageName: str(page["name"]) },
        });
      }
    }
    if (out.length === 0) {
      throw new ProviderError(
        400,
        platform === "instagram"
          ? "No Instagram Business or Creator account linked to a Facebook Page was found. Link one to a Page you manage, then try again."
          : "No Facebook Pages were granted. Select at least one Page in the Facebook permission dialog.",
      );
    }
    return out;
  },
  async check({ platform, accountId, accessToken }) {
    const fields = platform === "instagram" ? "id,username,name,profile_picture_url" : "id,name,picture{url}";
    const r = await http("Meta", `${graph()}/${encodeURIComponent(accountId)}?${new URLSearchParams({ fields, access_token: accessToken })}`);
    const pic = platform === "instagram" ? str(r["profile_picture_url"]) : str((r["picture"] as { data?: { url?: string } } | undefined)?.data?.url);
    return { username: str(r["username"]), displayName: str(r["name"]), profileImageUrl: pic };
  },
};

// ───────────── Instagram: Facebook Login for Business (config_id, system-user token) ─────────────
//
// Separate from the `meta` provider above, which keeps serving Facebook (and the older scope-based Instagram flow).
// Permissions come from the saved configuration (INSTAGRAM_CONFIG_ID), not from a `scope` parameter. The code is
// exchanged for a business-integration system-user token, which has no refresh token and normally never expires.

const instagramScopes = ["instagram_basic", "instagram_content_publish"];

/** Like http(), but keeps Meta's short error message and code so the admin can see why a step failed. */
async function metaCall(url: string): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  } catch {
    throw new ProviderError(502, "Could not reach Meta. Check your connection and try again.");
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  if (!res.ok) {
    console.error(`[social] Meta request failed with HTTP ${res.status}`);
    const e = (body["error"] ?? {}) as Record<string, unknown>;
    const message = typeof e["message"] === "string" ? e["message"].replace(/[A-Za-z0-9_|-]{40,}/g, "…").slice(0, 160) : "";
    const code = typeof e["code"] === "number" ? ` (code ${e["code"]})` : "";
    const status = res.status === 429 ? 429 : res.status === 401 || res.status === 403 ? 401 : 502;
    throw new ProviderError(status, `Meta rejected the request${code}${message ? `: ${message}` : ` (HTTP ${res.status})`}.`);
  }
  return body;
}

/** Instagram account ids the person granted in the Business Login dialog. Each strategy is tried in turn. */
async function discoverInstagramIds(token: string, businessId: string): Promise<string[]> {
  const g = graph();
  const q = (p: Record<string, string>) => new URLSearchParams(p).toString();
  const strategies: [string, () => Promise<string[]>][] = [
    [
      "debug_token",
      async () => {
        const r = await metaCall(`${g}/debug_token?${q({ input_token: token, access_token: `${env("META_APP_ID")}|${env("META_APP_SECRET")}` })}`);
        const data = (r["data"] ?? {}) as Record<string, unknown>;
        const granular = Array.isArray(data["granular_scopes"]) ? (data["granular_scopes"] as Record<string, unknown>[]) : [];
        // Names and counts only, never ids or tokens. Meta omits target_ids when a permission "applies to all".
        console.log(
          `[social] Instagram token: type=${str(data["type"]) || "?"} valid=${String(data["is_valid"])} scopes=[${Array.isArray(data["scopes"]) ? (data["scopes"] as unknown[]).map(str).join(",") : ""}] ` +
            `granular=[${granular.map((gs) => `${str(gs["scope"])}:${Array.isArray(gs["target_ids"]) ? (gs["target_ids"] as unknown[]).length : "all"}`).join(",")}]`,
        );
        return granular
          .filter((gs) => str(gs["scope"]).startsWith("instagram"))
          .flatMap((gs) => (Array.isArray(gs["target_ids"]) ? (gs["target_ids"] as unknown[]).map(str) : []));
      },
    ],
    [
      "business accounts",
      async () => {
        if (!businessId) return [];
        const r = await metaCall(`${g}/${encodeURIComponent(businessId)}/instagram_business_accounts?${q({ fields: "id", limit: "100", access_token: token })}`);
        return (Array.isArray(r["data"]) ? (r["data"] as Record<string, unknown>[]) : []).map((a) => str(a["id"]));
      },
    ],
    [
      // Business node edge described as "Instagram accounts this business has access to" (assets shared with it).
      "business shared accounts",
      async () => {
        if (!businessId) return [];
        const r = await metaCall(`${g}/${encodeURIComponent(businessId)}/instagram_accounts?${q({ fields: "id", limit: "100", access_token: token })}`);
        return (Array.isArray(r["data"]) ? (r["data"] as Record<string, unknown>[]) : []).map((a) => str(a["id"]));
      },
    ],
    [
      "pages",
      async () => {
        const r = await metaCall(`${g}/me/accounts?${q({ fields: "id,instagram_business_account{id}", limit: "100", access_token: token })}`);
        return (Array.isArray(r["data"]) ? (r["data"] as Record<string, unknown>[]) : [])
          .map((p) => str(((p["instagram_business_account"] ?? {}) as Record<string, unknown>)["id"]));
      },
    ],
  ];
  // One line per method, so the admin (and the log) can see which request failed and which just came back empty.
  // Messages come from metaCall(), which has already redacted anything token-like.
  const outcomes: string[] = [];
  for (const [name, run] of strategies) {
    try {
      const ids = [...new Set((await run()).filter(Boolean))];
      if (ids.length > 0) {
        console.log(`[social] Instagram discovery "${name}" found ${ids.length} account(s)`);
        return ids;
      }
      outcomes.push(`${name}: returned no accounts`);
      console.warn(`[social] Instagram discovery "${name}" returned no accounts`);
    } catch (e) {
      const reason = e instanceof ProviderError ? e.message.replace(/^Meta rejected the request /, "") : "failed";
      outcomes.push(`${name}: ${reason}`);
      console.warn(`[social] Instagram discovery "${name}" failed: ${reason}`);
    }
  }
  throw new ProviderError(
    400,
    "Meta did not report any Instagram account for this login. In the Facebook Login for Business configuration, include the Instagram account asset, and select an account that belongs to your business portfolio in the dialog. " +
      `Details: ${outcomes.join(" | ")}`,
  );
}

/** debug_token data for a token (app token auth). Returns null when Meta will not say; never throws. */
async function inspectToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await metaCall(`${graph()}/debug_token?${new URLSearchParams({ input_token: token, access_token: `${env("META_APP_ID")}|${env("META_APP_SECRET")}` }).toString()}`);
    return (r["data"] ?? null) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

/**
 * User-token path (configuration with a *user* access token): long-lived exchange, then /me/accounts, then the
 * Instagram account linked to each Page. The Page access token is what gets stored. Used only when the token is
 * not a system-user token; the system-user path below is unchanged.
 */
async function connectWithUserToken(shortToken: string, scopesGranted: string[]): Promise<AccountData[]> {
  const q = (p: Record<string, string>) => new URLSearchParams(p).toString();
  let longToken = "";
  let longExpiry: Date | undefined;
  try {
    const l = await metaCall(
      `${graph()}/oauth/access_token?${q({ grant_type: "fb_exchange_token", client_id: env("META_APP_ID"), client_secret: env("META_APP_SECRET"), fb_exchange_token: shortToken })}`,
    );
    longToken = str(l["access_token"]);
    longExpiry = expiry(l["expires_in"]);
  } catch (e) {
    // A short-lived token must not be saved as if it were a lasting connection.
    throw new ProviderError(502, `Could not exchange the login for a long-lived token, so nothing was saved. ${e instanceof ProviderError ? e.message : ""}`.trim());
  }
  if (!longToken) throw new ProviderError(502, "Meta did not return a long-lived token, so nothing was saved.");

  const pages = await metaCall(
    `${graph()}/me/accounts?${q({ fields: "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}", limit: "100", access_token: longToken })}`,
  );
  const list = Array.isArray(pages["data"]) ? (pages["data"] as Record<string, unknown>[]) : [];
  console.log(`[social] Instagram user-token discovery: ${list.length} page(s) returned`);
  const out: AccountData[] = [];
  for (const page of list) {
    const pageId = str(page["id"]);
    const pageToken = str(page["access_token"]);
    const linked = (page["instagram_business_account"] ?? null) as Record<string, unknown> | null;
    const igId = str(linked?.["id"]);
    if (!pageId || !pageToken || !igId) continue;
    let profile: Record<string, unknown>;
    try {
      profile = await metaCall(`${graph()}/${encodeURIComponent(igId)}?${q({ fields: "id,username,name,profile_picture_url", access_token: pageToken })}`);
    } catch {
      console.warn("[social] Instagram profile could not be read for a linked account; skipped");
      continue;
    }
    // Use the expiry Meta reports for this Page token (0 / absent = no expiry). If Meta will not say, fall back to
    // the long-lived user token's expiry rather than assuming the token lasts forever.
    const info = await inspectToken(pageToken);
    const exp = info && typeof info["expires_at"] === "number" ? info["expires_at"] : null;
    const expiresAt = exp === null ? longExpiry : exp > 0 ? new Date(exp * 1000) : undefined;
    out.push({
      platform: "instagram",
      platformAccountId: str(profile["id"]) || igId,
      username: str(profile["username"]),
      displayName: str(profile["name"]) || str(profile["username"]),
      profileImageUrl: str(profile["profile_picture_url"]),
      tokens: { accessToken: pageToken, expiresAt, scopes: scopesGranted.length ? scopesGranted : instagramScopes },
      metadata: { pageId, pageName: str(page["name"]) },
    });
  }
  if (out.length === 0) {
    throw new ProviderError(
      400,
      "No Instagram professional account linked to a Facebook Page you manage was found. Link the Instagram account to a Page, choose that Page in the dialog, and make sure the configuration includes pages_show_list.",
    );
  }
  return out;
}

const instagram: Provider = {
  id: "instagram",
  label: "Instagram (Facebook Login for Business)",
  platforms: ["instagram"],
  env: ["META_APP_ID", "META_APP_SECRET", "INSTAGRAM_CONFIG_ID", "INSTAGRAM_REDIRECT_URI"],
  pkce: false,
  notes:
    "Uses a Facebook Login for Business configuration (system-user token). In Meta for Developers the configuration must include the Instagram account asset with instagram_basic and instagram_content_publish, and this redirect URI must be listed under Facebook Login for Business > Settings > Valid OAuth Redirect URIs. Publishing also needs PUBLIC_BASE_URL to be a public HTTPS address.",
  configured: () => allSet(instagram.env),
  redirectUri: () => env("INSTAGRAM_REDIRECT_URI"),
  authUrl: ({ state }) =>
    `https://www.facebook.com/${env("META_GRAPH_VERSION") || "v21.0"}/dialog/oauth?` +
    new URLSearchParams({
      client_id: env("META_APP_ID"),
      redirect_uri: instagram.redirectUri(),
      state,
      config_id: env("INSTAGRAM_CONFIG_ID"),
      response_type: "code",
      override_default_response_type: "true",
    }).toString(),
  async connect({ code }) {
    const q = (p: Record<string, string>) => new URLSearchParams(p).toString();
    const t = await metaCall(
      `${graph()}/oauth/access_token?${q({ client_id: env("META_APP_ID"), client_secret: env("META_APP_SECRET"), redirect_uri: instagram.redirectUri(), code })}`,
    );
    const accessToken = str(t["access_token"]);
    if (!accessToken) throw new ProviderError(502, "Meta did not return an access token.");
    console.log(`[social] Instagram token response fields: ${Object.keys(t).join(",")}`);
    // A user token takes the user-token path. Anything else (system-user, or unknown) keeps the original path.
    const inspected = await inspectToken(accessToken);
    if (inspected && str(inspected["type"]).toUpperCase() === "USER") {
      const granted = Array.isArray(inspected["scopes"]) ? (inspected["scopes"] as unknown[]).map(str).filter((x) => x.startsWith("instagram") || x.startsWith("pages_")) : [];
      return connectWithUserToken(accessToken, granted);
    }
    // A system-user token normally has no expiry; honour one if Meta sends it.
    const expiresAt = expiry(t["expires_in"]);

    let businessId = "";
    try {
      const me = await metaCall(`${graph()}/me?${q({ fields: "id,client_business_id", access_token: accessToken })}`);
      businessId = str(me["client_business_id"]);
    } catch {
      // Only used by one discovery strategy; the others do not need it.
    }

    const ids = await discoverInstagramIds(accessToken, businessId);
    const out: AccountData[] = [];
    for (const id of ids) {
      try {
        const r = await metaCall(`${graph()}/${encodeURIComponent(id)}?${q({ fields: "id,username,name,profile_picture_url", access_token: accessToken })}`);
        const igId = str(r["id"]) || id;
        out.push({
          platform: "instagram",
          platformAccountId: igId,
          username: str(r["username"]),
          displayName: str(r["name"]) || str(r["username"]),
          profileImageUrl: str(r["profile_picture_url"]),
          tokens: { accessToken, expiresAt, scopes: instagramScopes },
          metadata: businessId ? { businessId } : {},
        });
      } catch {
        // An id that is not a readable Instagram account (for example a Page id) is skipped.
      }
    }
    if (out.length === 0) {
      throw new ProviderError(400, "Meta granted access, but none of the accounts could be read as an Instagram professional account.");
    }
    return out;
  },
  check: ({ platform, accountId, accessToken }) => meta.check({ platform, accountId, accessToken }),
};

// ───────────────────────── Google: YouTube ─────────────────────────

const googleScopes = ["https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/youtube.upload"];

async function googleTokens(data: Record<string, string>): Promise<TokenSet> {
  const r = await http("Google", "https://oauth2.googleapis.com/token", form(data));
  const accessToken = str(r["access_token"]);
  if (!accessToken) throw new ProviderError(502, "Google did not return an access token.");
  const refresh = str(r["refresh_token"]);
  return {
    accessToken,
    refreshToken: refresh || undefined,
    expiresAt: expiry(r["expires_in"]),
    scopes: str(r["scope"]).split(" ").filter(Boolean),
  };
}

async function youtubeChannels(accessToken: string) {
  const r = await http("YouTube", "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return Array.isArray(r["items"]) ? (r["items"] as Record<string, unknown>[]) : [];
}

const google: Provider = {
  id: "google",
  label: "Google (YouTube)",
  platforms: ["youtube"],
  env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
  pkce: false,
  notes:
    "While the Google OAuth consent screen is in Testing, only listed test users can connect and refresh tokens expire after 7 days. Production use of the upload scope needs Google verification.",
  configured: () => allSet(google.env),
  redirectUri: () => env("GOOGLE_REDIRECT_URI"),
  authUrl: ({ state }) =>
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      redirect_uri: google.redirectUri(),
      response_type: "code",
      scope: googleScopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    }).toString(),
  async connect({ code }) {
    const tokens = await googleTokens({
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: google.redirectUri(),
      grant_type: "authorization_code",
    });
    const channels = await youtubeChannels(tokens.accessToken);
    if (channels.length === 0) {
      throw new ProviderError(400, "This Google account has no YouTube channel. Create a channel first, then try again.");
    }
    return channels.map((c) => {
      const sn = (c["snippet"] ?? {}) as Record<string, unknown>;
      const thumbs = (sn["thumbnails"] ?? {}) as Record<string, { url?: string }>;
      return {
        platform: "youtube" as const,
        platformAccountId: str(c["id"]),
        username: str(sn["customUrl"]),
        displayName: str(sn["title"]),
        profileImageUrl: str(thumbs["default"]?.url),
        tokens,
        metadata: {},
      };
    });
  },
  refresh: (refreshToken) =>
    googleTokens({
      refresh_token: refreshToken,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  async check({ accountId, accessToken }) {
    const c = (await youtubeChannels(accessToken)).find((x) => str(x["id"]) === accountId);
    if (!c) throw new ProviderError(401, "The YouTube channel is no longer accessible with this connection.");
    const sn = (c["snippet"] ?? {}) as Record<string, unknown>;
    return { username: str(sn["customUrl"]), displayName: str(sn["title"]) };
  },
};

// ───────────────────────── LinkedIn ─────────────────────────

const linkedinScopes = ["openid", "profile", "w_member_social"];

async function linkedinTokens(data: Record<string, string>): Promise<TokenSet> {
  const r = await http("LinkedIn", "https://www.linkedin.com/oauth/v2/accessToken", form(data));
  const accessToken = str(r["access_token"]);
  if (!accessToken) throw new ProviderError(502, "LinkedIn did not return an access token.");
  return {
    accessToken,
    refreshToken: str(r["refresh_token"]) || undefined,
    expiresAt: expiry(r["expires_in"]),
    scopes: str(r["scope"]).split(/[ ,]/).filter(Boolean),
  };
}

const linkedin: Provider = {
  id: "linkedin",
  label: "LinkedIn",
  platforms: ["linkedin"],
  env: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_REDIRECT_URI"],
  pkce: false,
  notes:
    "Connects a personal member profile. Company Pages need LinkedIn's Community Management API, which requires separate approval. Tokens last about 60 days and refresh only for LinkedIn partners, so most connections must be re-authorised.",
  configured: () => allSet(linkedin.env),
  redirectUri: () => env("LINKEDIN_REDIRECT_URI"),
  authUrl: ({ state }) =>
    "https://www.linkedin.com/oauth/v2/authorization?" +
    new URLSearchParams({
      response_type: "code",
      client_id: env("LINKEDIN_CLIENT_ID"),
      redirect_uri: linkedin.redirectUri(),
      state,
      scope: linkedinScopes.join(" "),
    }).toString(),
  async connect({ code }) {
    const tokens = await linkedinTokens({
      grant_type: "authorization_code",
      code,
      client_id: env("LINKEDIN_CLIENT_ID"),
      client_secret: env("LINKEDIN_CLIENT_SECRET"),
      redirect_uri: linkedin.redirectUri(),
    });
    const me = await linkedin.check({ platform: "linkedin", accountId: "", accessToken: tokens.accessToken });
    const sub = me.id;
    if (!sub) throw new ProviderError(502, "LinkedIn did not return a member id.");
    return [
      {
        platform: "linkedin",
        platformAccountId: sub,
        username: "",
        displayName: me.displayName ?? "",
        profileImageUrl: me.profileImageUrl ?? "",
        tokens,
        metadata: {},
      },
    ];
  },
  refresh: (refreshToken) =>
    linkedinTokens({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: env("LINKEDIN_CLIENT_ID"),
      client_secret: env("LINKEDIN_CLIENT_SECRET"),
    }),
  async check({ accessToken }) {
    const r = await http("LinkedIn", "https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
    return { id: str(r["sub"]), displayName: str(r["name"]), profileImageUrl: str(r["picture"]) };
  },
};

// ───────────────────────── X (Twitter) ─────────────────────────

const xScopes = ["tweet.read", "tweet.write", "users.read", "offline.access"];
const xBasic = () => `Basic ${Buffer.from(`${env("X_CLIENT_ID")}:${env("X_CLIENT_SECRET")}`).toString("base64")}`;

async function xTokens(data: Record<string, string>): Promise<TokenSet> {
  const f = form(data);
  const r = await http("X", "https://api.twitter.com/2/oauth2/token", { ...f, headers: { ...f.headers, Authorization: xBasic() } });
  const accessToken = str(r["access_token"]);
  if (!accessToken) throw new ProviderError(502, "X did not return an access token.");
  return {
    accessToken,
    refreshToken: str(r["refresh_token"]) || undefined,
    expiresAt: expiry(r["expires_in"]),
    scopes: str(r["scope"]).split(" ").filter(Boolean),
  };
}

async function xMe(accessToken: string) {
  const r = await http("X", "https://api.twitter.com/2/users/me?user.fields=profile_image_url", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return (r["data"] ?? {}) as Record<string, unknown>;
}

const x: Provider = {
  id: "x",
  label: "X",
  platforms: ["x"],
  env: ["X_CLIENT_ID", "X_CLIENT_SECRET", "X_REDIRECT_URI"],
  pkce: true,
  notes:
    "Uses OAuth 2.0 with PKCE. Reading the account works on any tier, but posting through the API requires a paid X API plan. Refresh tokens rotate, so each refresh replaces the stored one.",
  configured: () => allSet(x.env),
  redirectUri: () => env("X_REDIRECT_URI"),
  authUrl: ({ state, codeChallenge }) =>
    "https://twitter.com/i/oauth2/authorize?" +
    new URLSearchParams({
      response_type: "code",
      client_id: env("X_CLIENT_ID"),
      redirect_uri: x.redirectUri(),
      scope: xScopes.join(" "),
      state,
      code_challenge: codeChallenge ?? "",
      code_challenge_method: "S256",
    }).toString(),
  async connect({ code, codeVerifier }) {
    if (!codeVerifier) throw new ProviderError(400, "The connection request is incomplete. Start again.");
    const tokens = await xTokens({
      grant_type: "authorization_code",
      code,
      redirect_uri: x.redirectUri(),
      code_verifier: codeVerifier,
    });
    const me = await xMe(tokens.accessToken);
    const id = str(me["id"]);
    if (!id) throw new ProviderError(502, "X did not return an account id.");
    return [
      {
        platform: "x",
        platformAccountId: id,
        username: str(me["username"]),
        displayName: str(me["name"]),
        profileImageUrl: str(me["profile_image_url"]),
        tokens,
        metadata: {},
      },
    ];
  },
  refresh: (refreshToken) => xTokens({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: env("X_CLIENT_ID") }),
  async check({ accessToken }) {
    const me = await xMe(accessToken);
    return { username: str(me["username"]), displayName: str(me["name"]), profileImageUrl: str(me["profile_image_url"]) };
  },
};

export const PROVIDERS: Record<ProviderId, Provider> = { meta, instagram, google, linkedin, x };

export const providerForPlatform = (platform: PlatformKey): Provider => {
  // Once INSTAGRAM_CONFIG_ID is set, Instagram uses Facebook Login for Business; unset keeps the older Meta flow.
  if (platform === "instagram" && env("INSTAGRAM_CONFIG_ID").trim()) return instagram;
  const p = Object.values(PROVIDERS).find((pr) => pr.platforms.includes(platform));
  if (!p) throw new ProviderError(400, "Unsupported platform");
  return p;
};

export const pkceChallenge = (verifier: string) => crypto.createHash("sha256").update(verifier).digest("base64url");
