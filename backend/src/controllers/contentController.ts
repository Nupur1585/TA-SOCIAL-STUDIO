import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import Content, { CONTENT_STATUSES, CONTENT_TYPES } from "../models/Content.js";
import Media, { PLATFORMS } from "../models/Media.js";
import SocialAccount from "../models/SocialAccount.js";
import { SAME_TIME_GAP_MS, findConflicts } from "../services/publishing/conflicts.js";
import { assessContent, claimForNow, publishClaimed, type ContentDoc } from "../services/publishing/publishService.js";
import { audit } from "../utils/audit.js";
import { resolveBrand } from "../utils/brands.js";
import { omitUndefined } from "../utils/object.js";
import { brandIdSchema, escapeRegex } from "./mediaController.js";

const hashtag = z
  .string()
  .trim()
  .regex(/^#?[\p{L}\p{N}_]{1,50}$/u)
  .transform((t) => (t.startsWith("#") ? t : `#${t}`));

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

const contentSchema = z.object({
  title: z.string().trim().min(1).max(150),
  // No .default() on optional fields: defaults would survive .partial() and wipe data on PATCH.
  caption: z.string().max(5000).optional(),
  hashtags: z.array(hashtag).max(30).optional(),
  brandId: brandIdSchema,
  // Intent only. Once accounts are chosen, platforms are derived from them.
  platforms: z.array(z.enum(PLATFORMS)).max(PLATFORMS.length).optional(),
  accountIds: z.array(objectId).max(20).optional(),
  type: z.enum(CONTENT_TYPES),
  scheduledAt: z.iso.datetime({ offset: true }).nullable().optional(),
  mediaIds: z.array(z.string()).max(10).optional(),
});
const updateSchema = contentSchema.partial();

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  brandId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  platform: z.enum(PLATFORMS).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  type: z.enum(CONTENT_TYPES).optional(),
  // Range on scheduledAt, used by the calendar.
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(8),
});

/**
 * Allowed manual status changes. "Publishing" and "Published" are never set by a client:
 * only the publisher, after the platform confirms, can move a post there.
 */
const TRANSITIONS: Record<string, string[]> = {
  Draft: ["Pending Approval", "Scheduled"],
  "Pending Approval": ["Approved", "Rejected", "Draft"],
  Approved: ["Scheduled", "Draft"],
  Scheduled: ["Draft", "Cancelled"],
  Publishing: [],
  Failed: ["Scheduled", "Draft", "Cancelled"],
  Cancelled: ["Draft", "Scheduled"],
  Rejected: ["Draft", "Pending Approval"],
  Published: [],
};

const EDITABLE = ["Draft", "Rejected", "Failed", "Cancelled", "Scheduled"];

const notFound = (res: Response) => res.status(404).json({ success: false, message: "Content not found" });
const bad = (res: Response, message: string, problems?: string[]) =>
  res.status(400).json({ success: false, message, ...(problems ? { problems } : {}) });

type AccountLite = { _id: unknown; displayName: string; username: string; status: string; tokenExpiresAt?: Date | null };

function serializeWith(c: ContentDoc, accounts: Map<string, AccountLite>) {
  return {
    id: String(c._id),
    title: c.title,
    caption: c.caption,
    hashtags: c.hashtags,
    brandId: c.brandId,
    platforms: c.platforms,
    type: c.type,
    status: c.status,
    scheduledAt: c.scheduledAt ?? null,
    publishedAt: c.publishedAt ?? null,
    nextAttemptAt: c.nextAttemptAt ?? null,
    mediaIds: c.mediaIds.map(String),
    targets: c.targets.map((t) => {
      const a = accounts.get(String(t.socialAccountId));
      const expired = a?.tokenExpiresAt != null && a.tokenExpiresAt.getTime() <= Date.now();
      return {
        id: String(t._id),
        socialAccountId: String(t.socialAccountId),
        platform: t.platform,
        accountName: a?.displayName || a?.username || "Removed account",
        username: a?.username ?? "",
        accountStatus: a ? (a.status === "Connected" && expired ? "Expired" : a.status) : "Disconnected",
        status: t.status,
        attempts: t.attempts ?? 0,
        lastAttemptAt: t.lastAttemptAt ?? null,
        publishedAt: t.publishedAt ?? null,
        publishedId: t.publishedId ?? "",
        publishedUrl: t.publishedUrl ?? "",
        error: t.error ?? "",
      };
    }),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/** Loads the accounts referenced by the posts so targets can show names and live connection state. */
async function serializeMany(docs: ContentDoc[]) {
  const ids = [...new Set(docs.flatMap((d) => d.targets.map((t) => String(t.socialAccountId))))];
  const accounts = ids.length ? await SocialAccount.find({ _id: { $in: ids } }).select("displayName username status tokenExpiresAt").lean() : [];
  const map = new Map(accounts.map((a) => [String(a._id), a as AccountLite]));
  return docs.map((d) => serializeWith(d, map));
}

async function validMediaIds(ids: string[], brandId: string): Promise<string | null> {
  if (!ids.every((i) => mongoose.isValidObjectId(i))) return "Invalid media selection";
  const found = await Media.find({ _id: { $in: ids } }).select("brandId").lean();
  if (found.length !== new Set(ids).size) return "One or more media files do not exist";
  if (found.some((m) => m.brandId !== brandId)) return "Media must belong to the same brand as the post";
  return null;
}

type TargetInput = { socialAccountId: mongoose.Types.ObjectId; platform: (typeof PLATFORMS)[number] };

/** Accounts must exist, belong to this brand and still be connected. Ownership is never taken from the client. */
async function resolveTargets(brandId: string, accountIds: string[]): Promise<{ targets: TargetInput[] } | { error: string }> {
  const unique = [...new Set(accountIds)];
  const accounts = await SocialAccount.find({ _id: { $in: unique } }).select("brandId platform status displayName username");
  if (accounts.length !== unique.length) return { error: "One or more selected accounts do not exist" };
  for (const a of accounts) {
    if (String(a.brandId) !== brandId) return { error: "A selected account belongs to a different brand" };
    if (a.status === "Disconnected") return { error: `${a.displayName || a.username} is disconnected. Reconnect it or choose another account.` };
  }
  return { targets: accounts.map((a) => ({ socialAccountId: a._id, platform: a.platform })) };
}

/** Replaces the targets while keeping anything already published (it can never be removed or re-posted). */
function applyTargets(doc: ContentDoc, targets: TargetInput[]) {
  const keep = doc.targets.filter((t) => t.status === "Published");
  const existing = new Map(doc.targets.map((t) => [String(t.socialAccountId), t]));
  const next: Array<Record<string, unknown> & { platform: TargetInput["platform"] }> = keep.map((t) => ({ ...t.toObject() }));
  for (const t of targets) {
    if (keep.some((k) => k.socialAccountId.equals(t.socialAccountId))) continue;
    const prev = existing.get(String(t.socialAccountId));
    next.push(prev ? prev.toObject() : { ...t, status: "Pending", attempts: 0 });
  }
  doc.set("targets", next);
  doc.set("platforms", [...new Set(next.map((t) => t.platform))]);
}

async function load(req: Request, res: Response) {
  const id = String(req.params["id"]);
  if (!mongoose.isValidObjectId(id)) {
    notFound(res);
    return null;
  }
  const doc = await Content.findById(id);
  if (!doc) notFound(res);
  return doc;
}

/** Blocks scheduling two posts for the same account within minutes of each other. Never touches other posts. */
async function clashMessage(doc: ContentDoc, when: Date): Promise<string | null> {
  for (const t of doc.targets) {
    if (t.status === "Published") continue;
    const hit = await findConflicts(doc.brandId, [{ platform: t.platform, accountIds: [String(t.socialAccountId)], at: when.getTime() }], [String(doc._id)], SAME_TIME_GAP_MS);
    if (hit.length > 0) return `Another post ("${hit[0]!.title}") is already scheduled for the same ${t.platform} account at about that time. Choose a different time.`;
  }
  return null;
}

const resetTargets = (doc: ContentDoc) => {
  for (const t of doc.targets) {
    if (t.status !== "Published") t.set({ status: "Pending", attempts: 0, error: "" });
  }
};

export async function listContent(req: Request, res: Response) {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) return bad(res, "Invalid filters");
  const { q, brandId, platform, status, type, page, limit, from, to } = parsed.data;

  const base: Record<string, unknown> = {};
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: "i" };
    base["$or"] = [{ title: rx }, { caption: rx }, { hashtags: rx }];
  }
  if (brandId) base["brandId"] = brandId;
  if (platform) base["platforms"] = platform;
  if (type) base["type"] = type;
  if (from || to) {
    base["scheduledAt"] = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
  }
  const filter = status ? { ...base, status } : base;

  const [items, total, counts] = await Promise.all([
    Content.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Content.countDocuments(filter),
    Content.aggregate<{ _id: string; n: number }>([{ $match: base }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);

  res.json({
    success: true,
    data: await serializeMany(items),
    meta: { page, limit, total, statusCounts: Object.fromEntries(counts.map((c) => [c._id, c.n])) },
  });
}

export async function getContent(req: Request, res: Response) {
  const doc = await load(req, res);
  if (doc) res.json({ success: true, data: (await serializeMany([doc]))[0] });
}

export async function createContent(req: Request, res: Response) {
  const parsed = contentSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, parsed.error.issues[0]?.message ?? "Invalid content");
  const { scheduledAt, accountIds, ...rest } = parsed.data;
  const brand = await resolveBrand(rest.brandId, true);
  if (!brand.ok) return bad(res, brand.message);
  if (!(accountIds?.length || rest.platforms?.length)) return bad(res, "Select at least one platform or connected account");

  const mediaIds = rest.mediaIds ?? [];
  const mediaError = await validMediaIds(mediaIds, rest.brandId);
  if (mediaError) return bad(res, mediaError);

  let targets: TargetInput[] = [];
  if (accountIds?.length) {
    const r = await resolveTargets(rest.brandId, accountIds);
    if ("error" in r) return bad(res, r.error);
    targets = r.targets;
  }

  const doc = new Content({
    caption: "",
    hashtags: [],
    ...omitUndefined(rest),
    mediaIds,
    targets: targets.map((t) => ({ ...t, status: "Pending" })),
    platforms: targets.length ? [...new Set(targets.map((t) => t.platform))] : (rest.platforms ?? []),
    ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
    status: "Draft",
    createdBy: new mongoose.Types.ObjectId(req.user!.id),
  });
  await doc.save();
  await audit(req, { action: "Created content", category: "Content", resource: doc.title, resourceId: String(doc._id) });
  res.status(201).json({ success: true, data: (await serializeMany([doc]))[0] });
}

export async function updateContent(req: Request, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, parsed.error.issues[0]?.message ?? "Invalid content");
  const doc = await load(req, res);
  if (!doc) return;
  if (!EDITABLE.includes(doc.status)) {
    return res.status(409).json({ success: false, message: `${doc.status} content cannot be edited. Move it back to Draft first.` });
  }
  const { scheduledAt, mediaIds, accountIds, platforms, ...rest } = parsed.data;

  const brandChanged = rest.brandId !== undefined && rest.brandId !== doc.brandId;
  const brandId = rest.brandId ?? doc.brandId;
  if (brandChanged) {
    const brand = await resolveBrand(brandId, true);
    if (!brand.ok) return bad(res, brand.message);
  }
  const finalMedia = mediaIds ?? (brandChanged ? [] : doc.mediaIds.map(String));
  const mediaError = await validMediaIds(finalMedia, brandId);
  if (mediaError) return bad(res, mediaError);

  doc.set(omitUndefined(rest));
  doc.set("mediaIds", finalMedia);
  if (scheduledAt !== undefined) doc.set("scheduledAt", scheduledAt ? new Date(scheduledAt) : undefined);

  // Accounts belong to a brand: switching brand clears them unless a new selection is sent.
  const ids = accountIds ?? (brandChanged ? [] : undefined);
  if (ids !== undefined) {
    const r = ids.length ? await resolveTargets(brandId, ids) : { targets: [] as TargetInput[] };
    if ("error" in r) return bad(res, r.error);
    applyTargets(doc, r.targets);
    if (r.targets.length === 0 && platforms) doc.set("platforms", platforms);
  } else if (platforms && doc.targets.length === 0) {
    doc.set("platforms", platforms);
  }

  // A post that is already scheduled must stay publishable, otherwise the scheduler would fail it later.
  if (doc.status === "Scheduled") {
    const problems = await assessContent(doc);
    if (problems.length) return bad(res, "This change would make the scheduled post unpublishable.", problems);
    if (!doc.scheduledAt || doc.scheduledAt.getTime() <= Date.now()) return bad(res, "Choose a future date and time for a scheduled post.");
    const clash = await clashMessage(doc, doc.scheduledAt);
    if (clash) return bad(res, clash);
  }
  await doc.save();
  await audit(req, { action: "Updated content", category: "Content", resource: doc.title, resourceId: String(doc._id) });
  res.json({ success: true, data: (await serializeMany([doc]))[0] });
}

const statusSchema = z.object({
  status: z.enum(CONTENT_STATUSES),
  scheduledAt: z.iso.datetime({ offset: true }).optional(),
});

export async function changeStatus(req: Request, res: Response) {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, "Invalid status");
  const doc = await load(req, res);
  if (!doc) return;
  const { status, scheduledAt } = parsed.data;

  if (!TRANSITIONS[doc.status]?.includes(status)) {
    await audit(req, { action: `Status change to ${status}`, category: "Content", result: "Failed", resource: doc.title, resourceId: String(doc._id), metadata: { from: doc.status } });
    return res.status(409).json({ success: false, message: `Cannot move ${doc.status} content to ${status}` });
  }
  if (status === "Pending Approval" && doc.mediaIds.length === 0 && doc.type !== "Text") {
    return bad(res, "Attach media before submitting for approval");
  }
  if (status === "Scheduled") {
    const when = scheduledAt ? new Date(scheduledAt) : doc.scheduledAt;
    if (!when || when.getTime() <= Date.now() + 30_000) return bad(res, "Choose a date and time at least a minute in the future to schedule");
    doc.set("scheduledAt", when);
    const problems = await assessContent(doc);
    if (problems.length) return bad(res, "This post can't be scheduled yet.", problems);
    const clash = await clashMessage(doc, when);
    if (clash) return bad(res, clash);
    resetTargets(doc);
    doc.set("nextAttemptAt", undefined);
  }
  if (status === "Draft" || status === "Cancelled") {
    doc.set("nextAttemptAt", undefined);
    if (doc.status === "Failed") resetTargets(doc);
  }
  const previous = doc.status;
  doc.set("status", status);
  await doc.save();
  const scheduling = status === "Scheduled" || status === "Cancelled" || previous === "Scheduled";
  await audit(req, {
    action: status === "Scheduled" ? "Scheduled content" : status === "Cancelled" ? "Cancelled scheduled content" : `Status change to ${status}`,
    category: scheduling ? "Scheduling" : "Content",
    resource: doc.title,
    resourceId: String(doc._id),
    metadata: { from: previous, to: status },
  });
  res.json({ success: true, data: (await serializeMany([doc]))[0] });
}

const rescheduleSchema = z.object({ scheduledAt: z.iso.datetime({ offset: true }) });

export async function reschedule(req: Request, res: Response) {
  const parsed = rescheduleSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, "Choose a valid date and time");
  const doc = await load(req, res);
  if (!doc) return;
  if (doc.status !== "Scheduled") return res.status(409).json({ success: false, message: "Only scheduled posts can be rescheduled" });
  const when = new Date(parsed.data.scheduledAt);
  if (when.getTime() <= Date.now() + 30_000) return bad(res, "Choose a date and time at least a minute in the future");
  const clash = await clashMessage(doc, when);
  if (clash) return bad(res, clash);
  const previous = doc.scheduledAt;
  doc.set({ scheduledAt: when, nextAttemptAt: undefined });
  await doc.save();
  await audit(req, { action: "Rescheduled content", category: "Scheduling", resource: doc.title, resourceId: String(doc._id), metadata: { from: previous?.toISOString(), to: when.toISOString() } });
  res.json({ success: true, data: (await serializeMany([doc]))[0] });
}

/** Publishes immediately. Validates first, then atomically claims the post so it can't run twice. */
export async function publishNow(req: Request, res: Response) {
  const doc = await load(req, res);
  if (!doc) return;
  if (!["Draft", "Approved", "Scheduled", "Failed", "Cancelled"].includes(doc.status)) {
    return res.status(409).json({ success: false, message: `${doc.status} content can't be published right now` });
  }
  const problems = await assessContent(doc);
  if (problems.length) return bad(res, "This post can't be published yet.", problems);

  const claimed = await claimForNow(String(doc._id));
  if (!claimed) return res.status(409).json({ success: false, message: "This post is already being published" });
  resetTargets(claimed);
  claimed.set("scheduledAt", claimed.scheduledAt ?? new Date());
  await claimed.save();
  await audit(req, { action: "Publish now requested", category: "Scheduling", resource: claimed.title, resourceId: String(claimed._id) });

  // Runs in the background; the client polls the post for the outcome.
  void publishClaimed(claimed).catch((e: unknown) => console.error("[publish] crashed:", (e as Error).name));
  res.status(202).json({ success: true, data: (await serializeMany([claimed]))[0] });
}

export async function duplicateContent(req: Request, res: Response) {
  const doc = await load(req, res);
  if (!doc) return;
  const brand = await resolveBrand(doc.brandId, true);
  if (!brand.ok) return bad(res, brand.message);
  const copy = await Content.create({
    title: `${doc.title} (Copy)`.slice(0, 150),
    caption: doc.caption,
    hashtags: doc.hashtags,
    brandId: doc.brandId,
    platforms: doc.platforms,
    // The copy targets the same accounts but starts with a clean slate: no results, never published.
    targets: doc.targets.map((t) => ({ socialAccountId: t.socialAccountId, platform: t.platform, status: "Pending" })),
    type: doc.type,
    mediaIds: doc.mediaIds,
    status: "Draft",
    createdBy: new mongoose.Types.ObjectId(req.user!.id),
  });
  await audit(req, { action: "Duplicated content", category: "Content", resource: doc.title, resourceId: String(copy._id) });
  res.status(201).json({ success: true, data: (await serializeMany([copy]))[0] });
}

export async function deleteContent(req: Request, res: Response) {
  const doc = await load(req, res);
  if (!doc) return;
  if (doc.status === "Publishing") return res.status(409).json({ success: false, message: "This post is being published right now" });
  await doc.deleteOne();
  await audit(req, { action: "Deleted content", category: "Content", resource: doc.title, resourceId: String(doc._id) });
  res.json({ success: true });
}
