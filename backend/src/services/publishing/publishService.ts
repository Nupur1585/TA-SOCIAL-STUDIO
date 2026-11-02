import mongoose from "mongoose";
import Brand from "../../models/Brand.js";
import Content from "../../models/Content.js";
import Media from "../../models/Media.js";
import SocialAccount from "../../models/SocialAccount.js";
import { auditSystem } from "../../utils/audit.js";
import { ProviderError } from "../social/providers.js";
import { getUsableAccessToken } from "../social/socialService.js";
import { PublishError, PUBLISHERS } from "./publishers.js";
import { composeText, validateForPlatform, type MediaInfo } from "./rules.js";

export type ContentDoc = mongoose.HydratedDocument<mongoose.InferSchemaType<typeof Content.schema>>;

export const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5 * 60 * 1000;
const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", linkedin: "LinkedIn", x: "X" };

/**
 * Everything that must be true for a post to be published: the brand is active, the accounts belong to
 * the brand and are connected, the media belongs to the brand, and each platform's rules are met.
 */
export async function assessContent(c: ContentDoc): Promise<string[]> {
  const problems: string[] = [];
  if (c.targets.length === 0) return ["Choose at least one connected account to publish to."];

  const brand = mongoose.isValidObjectId(c.brandId) ? await Brand.findById(c.brandId) : null;
  if (!brand) return ["The brand no longer exists."];
  if (brand.status !== "Active") problems.push(`${brand.name} is inactive.`);

  const mediaDocs = await Media.find({ _id: { $in: c.mediaIds } }).lean();
  if (mediaDocs.length !== new Set(c.mediaIds.map(String)).size) problems.push("An attached media file no longer exists.");
  if (mediaDocs.some((m) => m.brandId !== c.brandId)) problems.push("Attached media belongs to a different brand.");
  const media: MediaInfo[] = mediaDocs.map((m) => ({ id: String(m._id), kind: m.kind, mimeType: m.mimeType, size: m.size, duration: m.duration ?? null }));
  const text = composeText(c.caption, c.hashtags);

  const accounts = await SocialAccount.find({ _id: { $in: c.targets.map((t) => t.socialAccountId) } }).select("+refreshTokenEnc");
  for (const t of c.targets) {
    if (t.status === "Published") continue;
    const label = PLATFORM_LABEL[t.platform] ?? t.platform;
    const account = accounts.find((a) => a._id.equals(t.socialAccountId));
    if (!account) {
      problems.push(`${label}: the connected account no longer exists.`);
      continue;
    }
    if (String(account.brandId) !== c.brandId) {
      problems.push(`${label}: ${account.displayName || account.username} belongs to a different brand.`);
      continue;
    }
    const name = account.displayName || account.username || label;
    const expired = account.tokenExpiresAt != null && account.tokenExpiresAt.getTime() <= Date.now() && !account.refreshTokenEnc;
    if (account.status === "Disconnected") problems.push(`${label}: ${name} is disconnected. Reconnect it first.`);
    else if (account.status === "Error") problems.push(`${label}: ${name} has a connection error. Reconnect it first.`);
    else if (account.status === "Expired" || expired) problems.push(`${label}: the connection for ${name} has expired. Reconnect it first.`);
    else if (account.platform !== t.platform) problems.push(`${label}: account/platform mismatch.`);
    problems.push(...validateForPlatform(t.platform, { title: c.title, text, media }).map((p) => `${label}: ${p}`));
  }
  return [...new Set(problems)];
}

const safeText = (e: unknown) => (e instanceof PublishError || e instanceof ProviderError ? e.message : "Publishing failed unexpectedly.");

/** A ProviderError from token refresh is only retryable for rate limits and network trouble. */
const isRetryable = (e: unknown) => (e instanceof PublishError ? e.retryable : e instanceof ProviderError ? e.status === 429 || e.status === 502 : false);

/**
 * Publishes every unfinished target of a post that has already been claimed (status "Publishing").
 * Targets that are already Published are never touched, so a retry cannot post twice.
 */
async function runClaimed(c: ContentDoc): Promise<void> {
  const problems = await assessContent(c);
  if (problems.length > 0) {
    for (const t of c.targets) {
      if (t.status !== "Published") t.set({ status: "Failed", error: problems[0]!.slice(0, 300), lastAttemptAt: new Date() });
    }
    c.set({ status: "Failed", nextAttemptAt: undefined });
    await c.save();
    await auditSystem({ action: "Publishing failed validation", category: "Scheduling", result: "Failed", resource: c.title, resourceId: String(c._id), metadata: { reason: problems[0] } });
    return;
  }

  const mediaDocs = await Media.find({ _id: { $in: c.mediaIds } }).lean();
  const media = c.mediaIds.map((id) => mediaDocs.find((m) => m._id.equals(id))).filter((m) => !!m);
  const text = composeText(c.caption, c.hashtags);
  let retryScheduled = false;

  for (const t of c.targets) {
    if (t.status === "Published") continue;
    t.set({ status: "Publishing", error: "", lastAttemptAt: new Date(), attempts: (t.attempts ?? 0) + 1 });
    await c.save();

    const account = await SocialAccount.findById(t.socialAccountId);
    try {
      if (!account) throw new PublishError("The connected account no longer exists.");
      const accessToken = await getUsableAccessToken(String(account._id));
      const result = await PUBLISHERS[t.platform]({
        platform: t.platform,
        accessToken,
        account: { platformAccountId: account.platformAccountId, username: account.username, metadata: account.metadata as Map<string, string> | undefined },
        title: c.title,
        text,
        media: media.map((m) => ({ id: String(m._id), filename: m.filename, mimeType: m.mimeType, kind: m.kind })),
      });
      t.set({ status: "Published", publishedId: result.id, publishedUrl: result.url, publishedAt: new Date(), error: "" });
      await auditSystem({ action: "Published post", category: "Scheduling", resource: `${t.platform}: ${c.title}`, resourceId: String(c._id), metadata: { platform: t.platform } });
    } catch (e) {
      const message = safeText(e);
      const retry = isRetryable(e) && (t.attempts ?? 0) < MAX_ATTEMPTS;
      if (retry) {
        retryScheduled = true;
        t.set({ status: "Pending", error: `${message} Retrying automatically.` });
      } else {
        t.set({ status: "Failed", error: message.slice(0, 300) });
      }
      await auditSystem({ action: "Publishing attempt failed", category: "Scheduling", result: "Failed", resource: `${t.platform}: ${c.title}`, resourceId: String(c._id), metadata: { reason: message, attempt: t.attempts ?? 0, willRetry: retry } });
    }
    await c.save();
  }

  const all = c.targets;
  if (all.every((t) => t.status === "Published")) {
    c.set({ status: "Published", publishedAt: new Date(), nextAttemptAt: undefined });
  } else if (retryScheduled && !all.some((t) => t.status === "Failed")) {
    c.set({ status: "Scheduled", nextAttemptAt: new Date(Date.now() + RETRY_DELAY_MS) });
  } else {
    // Any permanent failure ends the run. Published targets stay published; failed ones can be retried manually.
    for (const t of all) if (t.status === "Pending") t.set({ status: "Failed", error: t.error || "Not attempted because another account failed." });
    c.set({ status: "Failed", nextAttemptAt: undefined });
  }
  await c.save();
}

let activePublishes = 0;

/** Number of posts being published right now, so a shutdown can wait for them instead of cutting them off. */
export const publishesInFlight = () => activePublishes;

export async function publishClaimed(c: ContentDoc): Promise<void> {
  activePublishes += 1;
  try {
    await runClaimed(c);
  } finally {
    activePublishes -= 1;
  }
}

/** Atomically takes the next due post. Only one worker can win a given post, so it cannot publish twice. */
export async function claimNextDue(): Promise<ContentDoc | null> {
  const now = new Date();
  return Content.findOneAndUpdate(
    {
      status: "Scheduled",
      scheduledAt: { $lte: now },
      $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }],
    },
    { $set: { status: "Publishing", publishStartedAt: now } },
    { sort: { scheduledAt: 1 }, returnDocument: "after" },
  );
}

/** Claims one specific post for an immediate publish. Returns null if it is not in a publishable state. */
export async function claimForNow(id: string): Promise<ContentDoc | null> {
  return Content.findOneAndUpdate(
    { _id: id, status: { $in: ["Draft", "Approved", "Scheduled", "Failed", "Cancelled"] } },
    { $set: { status: "Publishing", publishStartedAt: new Date() }, $unset: { nextAttemptAt: 1 } },
    { returnDocument: "after" },
  );
}

/** After a restart, posts left "Publishing" may or may not have gone out. Never retry them automatically. */
export async function recoverInterrupted(): Promise<number> {
  const stuck = await Content.find({ status: "Publishing" });
  for (const c of stuck) {
    for (const t of c.targets) {
      if (t.status === "Publishing" || t.status === "Pending") {
        t.set({ status: "Failed", error: "Interrupted by a server restart. Check the platform before retrying." });
      }
    }
    c.set({ status: "Failed" });
    await c.save();
    await auditSystem({ action: "Publishing interrupted", category: "Scheduling", result: "Warning", resource: c.title, resourceId: String(c._id) });
  }
  return stuck.length;
}
