import fs from "node:fs/promises";
import path from "node:path";
import { uploadDir } from "../../middleware/upload.js";
import type { PlatformKey } from "../../models/Media.js";
import { signedMediaUrl } from "./mediaUrl.js";

/** A failure with a message that is safe to store and show. */
export class PublishError extends Error {
  constructor(
    message: string,
    /** True only when nothing can have been posted yet (rate limit, network before a write). */
    public readonly retryable = false,
  ) {
    super(message);
  }
}

export interface PublishMedia {
  id: string;
  filename: string;
  mimeType: string;
  kind: string;
}

export interface PublishContext {
  platform: PlatformKey;
  accessToken: string;
  account: { platformAccountId: string; username: string; metadata?: Map<string, string> | undefined };
  title: string;
  text: string;
  media: PublishMedia[];
}

export interface PublishResult {
  id: string;
  url: string;
}

const env = (n: string) => process.env[n] ?? "";
const graphVersion = () => env("META_GRAPH_VERSION") || "v21.0";

/** Pulls a short human message out of a provider error body, without keeping anything long or token-like. */
function safeMessage(body: unknown): string {
  const b = body as Record<string, unknown> | null;
  const nested = (b?.["error"] ?? {}) as Record<string, unknown>;
  const raw = [nested["message"], b?.["error_description"], b?.["detail"], b?.["title"], b?.["message"], typeof b?.["error"] === "string" ? b["error"] : ""]
    .find((v): v is string => typeof v === "string" && v.length > 0);
  return (raw ?? "").replace(/[A-Za-z0-9_\-]{40,}/g, "…").slice(0, 200);
}

interface Reply {
  status: number;
  headers: Headers;
  json: Record<string, unknown>;
}

/**
 * fetch with a timeout. Never logs bodies. `commit` marks the request that actually creates
 * the post: if it fails we cannot know whether it went through, so it is never retried.
 */
async function call(label: string, url: string, init: RequestInit = {}, commit = false, timeoutMs = 60000): Promise<Reply> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new PublishError(`Could not reach ${label}.`, !commit);
  }
  let json: Record<string, unknown> = {};
  try {
    const text = await res.text();
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = {};
  }
  if (!res.ok) {
    console.error(`[publish] ${label} responded HTTP ${res.status}`);
    const detail = safeMessage(json);
    if (res.status === 429) throw new PublishError(`${label} is rate limiting requests.`, !commit);
    if (res.status >= 500) throw new PublishError(`${label} had a server error (HTTP ${res.status}).`, !commit);
    if (res.status === 401) throw new PublishError(`${label} rejected the stored credentials. Reconnect the account.`);
    if (res.status === 402 || res.status === 403) {
      throw new PublishError(`${label} refused the request (HTTP ${res.status}). The account may lack permission or the API plan does not allow posting.${detail ? ` ${detail}` : ""}`);
    }
    throw new PublishError(`${label} rejected the post${detail ? `: ${detail}` : ` (HTTP ${res.status}).`}`);
  }
  return { status: res.status, headers: res.headers, json };
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readFile(m: PublishMedia): Promise<Blob> {
  try {
    const buf = await fs.readFile(path.join(uploadDir, path.basename(m.filename)));
    return new Blob([new Uint8Array(buf)], { type: m.mimeType });
  } catch {
    throw new PublishError("A media file is missing from storage.");
  }
}

const needMedia = (ctx: PublishContext): PublishMedia => {
  const m = ctx.media[0];
  if (!m) throw new PublishError("This post needs a media file.");
  return m;
};

// ───────────────────────── Instagram ─────────────────────────

async function instagram(ctx: PublishContext): Promise<PublishResult> {
  const g = `https://graph.facebook.com/${graphVersion()}`;
  const igId = ctx.account.platformAccountId;
  const m = needMedia(ctx);
  const video = m.mimeType.startsWith("video/");

  const create = new URLSearchParams({ caption: ctx.text, access_token: ctx.accessToken });
  if (video) {
    create.set("media_type", "REELS");
    create.set("video_url", signedMediaUrl(m.id));
  } else {
    create.set("image_url", signedMediaUrl(m.id));
  }
  const container = await call("Instagram", `${g}/${encodeURIComponent(igId)}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: create.toString(),
  });
  const containerId = str(container.json["id"]);
  if (!containerId) throw new PublishError("Instagram did not accept the media.");

  // Videos are processed asynchronously; wait until Instagram says they are ready.
  if (video) {
    const deadline = Date.now() + 5 * 60 * 1000;
    for (;;) {
      const s = await call("Instagram", `${g}/${containerId}?fields=status_code&access_token=${encodeURIComponent(ctx.accessToken)}`);
      const code = str(s.json["status_code"]);
      if (code === "FINISHED") break;
      if (code === "ERROR" || code === "EXPIRED") throw new PublishError("Instagram could not process the video. Check the format (MP4/MOV, H.264, up to 15 minutes).");
      if (Date.now() > deadline) throw new PublishError("Instagram took too long to process the video.", true);
      await sleep(5000);
    }
  }

  const published = await call(
    "Instagram",
    `${g}/${encodeURIComponent(igId)}/media_publish`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ creation_id: containerId, access_token: ctx.accessToken }).toString() },
    true,
  );
  const id = str(published.json["id"]);
  if (!id) throw new PublishError("Instagram did not confirm the post.");
  let url = "";
  try {
    const link = await call("Instagram", `${g}/${id}?fields=permalink&access_token=${encodeURIComponent(ctx.accessToken)}`);
    url = str(link.json["permalink"]);
  } catch {
    // The post is live; the link is a convenience only.
  }
  return { id, url };
}

// ───────────────────────── Facebook ─────────────────────────

async function facebook(ctx: PublishContext): Promise<PublishResult> {
  const pageId = ctx.account.platformAccountId;
  const m = ctx.media[0];
  let reply: Reply;
  if (!m) {
    reply = await call(
      "Facebook",
      `https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(pageId)}/feed`,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ message: ctx.text, access_token: ctx.accessToken }).toString() },
      true,
    );
  } else {
    const video = m.mimeType.startsWith("video/");
    const form = new FormData();
    form.set("access_token", ctx.accessToken);
    form.set(video ? "description" : "caption", ctx.text);
    if (video) form.set("title", ctx.title.slice(0, 100));
    form.set("source", await readFile(m), m.filename);
    const host = video ? "graph-video.facebook.com" : "graph.facebook.com";
    reply = await call("Facebook", `https://${host}/${graphVersion()}/${encodeURIComponent(pageId)}/${video ? "videos" : "photos"}`, { method: "POST", body: form }, true, 5 * 60 * 1000);
  }
  const id = str(reply.json["post_id"]) || str(reply.json["id"]);
  if (!id) throw new PublishError("Facebook did not confirm the post.");
  return { id, url: `https://www.facebook.com/${id}` };
}

// ───────────────────────── YouTube ─────────────────────────

async function youtube(ctx: PublishContext): Promise<PublishResult> {
  const m = needMedia(ctx);
  const blob = await readFile(m);
  const privacy = ["public", "unlisted", "private"].includes(env("YOUTUBE_DEFAULT_PRIVACY")) ? env("YOUTUBE_DEFAULT_PRIVACY") : "private";

  const init = await call("YouTube", "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      ...bearer(ctx.accessToken),
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(blob.size),
      "X-Upload-Content-Type": m.mimeType,
    },
    body: JSON.stringify({
      snippet: { title: ctx.title.slice(0, 100), description: ctx.text.slice(0, 5000), categoryId: "22" },
      status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
    }),
  });
  const location = init.headers.get("location");
  if (!location) throw new PublishError("YouTube did not start the upload.");

  const done = await call("YouTube", location, { method: "PUT", headers: { "Content-Type": m.mimeType }, body: blob }, true, 10 * 60 * 1000);
  const id = str(done.json["id"]);
  if (!id) throw new PublishError("YouTube did not confirm the upload.");
  return { id, url: `https://www.youtube.com/watch?v=${id}` };
}

// ───────────────────────── LinkedIn ─────────────────────────

/** LinkedIn's "little text" format treats these characters specially; escape them (# is kept for hashtags). */
const escapeLinkedIn = (s: string) => s.replace(/[\\|{}@[\]()<>*_~]/g, (c) => `\\${c}`);

async function linkedin(ctx: PublishContext): Promise<PublishResult> {
  const author = `urn:li:person:${ctx.account.platformAccountId}`;
  const headers = {
    ...bearer(ctx.accessToken),
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": env("LINKEDIN_API_VERSION") || "202504",
    "Content-Type": "application/json",
  };
  const body: Record<string, unknown> = {
    author,
    commentary: escapeLinkedIn(ctx.text),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const m = ctx.media[0];
  if (m) {
    const init = await call("LinkedIn", "https://api.linkedin.com/rest/images?action=initializeUpload", {
      method: "POST",
      headers,
      body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
    });
    const value = (init.json["value"] ?? {}) as Record<string, unknown>;
    const uploadUrl = str(value["uploadUrl"]);
    const imageUrn = str(value["image"]);
    if (!uploadUrl || !imageUrn) throw new PublishError("LinkedIn did not start the image upload.");
    await call("LinkedIn", uploadUrl, { method: "PUT", headers: { ...bearer(ctx.accessToken), "Content-Type": m.mimeType }, body: await readFile(m) }, false, 2 * 60 * 1000);
    body["content"] = { media: { id: imageUrn, altText: ctx.title.slice(0, 120) } };
  }

  const res = await call("LinkedIn", "https://api.linkedin.com/rest/posts", { method: "POST", headers, body: JSON.stringify(body) }, true);
  const id = res.headers.get("x-restli-id") ?? "";
  if (!id) throw new PublishError("LinkedIn did not confirm the post.");
  return { id, url: `https://www.linkedin.com/feed/update/${id}` };
}

// ───────────────────────── X ─────────────────────────

async function x(ctx: PublishContext): Promise<PublishResult> {
  const res = await call(
    "X",
    "https://api.twitter.com/2/tweets",
    { method: "POST", headers: { ...bearer(ctx.accessToken), "Content-Type": "application/json" }, body: JSON.stringify({ text: ctx.text }) },
    true,
  );
  const id = str((res.json["data"] as Record<string, unknown> | undefined)?.["id"]);
  if (!id) throw new PublishError("X did not confirm the post.");
  const handle = ctx.account.username.replace(/^@/, "");
  return { id, url: handle ? `https://x.com/${handle}/status/${id}` : `https://x.com/i/web/status/${id}` };
}

export const PUBLISHERS: Record<PlatformKey, (ctx: PublishContext) => Promise<PublishResult>> = {
  instagram,
  facebook,
  youtube,
  linkedin,
  x,
};
