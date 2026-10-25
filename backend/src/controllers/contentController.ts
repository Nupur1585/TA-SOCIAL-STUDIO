import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import Content, { CONTENT_STATUSES, CONTENT_TYPES } from "../models/Content.js";
import Media, { PLATFORMS } from "../models/Media.js";
import { audit } from "../utils/audit.js";
import { brandIdSchema, escapeRegex } from "./mediaController.js";

const hashtag = z
  .string()
  .trim()
  .regex(/^#?[\p{L}\p{N}_]{1,50}$/u)
  .transform((t) => (t.startsWith("#") ? t : `#${t}`));

const contentSchema = z.object({
  title: z.string().trim().min(1).max(150),
  caption: z.string().max(2200).default(""),
  hashtags: z.array(hashtag).max(30).default([]),
  brandId: brandIdSchema,
  platforms: z.array(z.enum(PLATFORMS)).min(1, "Select at least one platform").max(PLATFORMS.length),
  type: z.enum(CONTENT_TYPES),
  scheduledAt: z.iso.datetime({ offset: true }).nullable().optional(),
  mediaIds: z.array(z.string()).max(10).default([]),
});
const updateSchema = contentSchema.partial();

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  brandId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  platform: z.enum(PLATFORMS).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  type: z.enum(CONTENT_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  // Range on scheduledAt, used by the calendar.
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(8),
});

/** Allowed manual status changes. "Published" is intentionally unreachable: nothing publishes yet. */
const TRANSITIONS: Record<string, string[]> = {
  Draft: ["Pending Approval"],
  "Pending Approval": ["Approved", "Rejected", "Draft"],
  Approved: ["Scheduled", "Draft"],
  Scheduled: ["Approved", "Draft"],
  Rejected: ["Draft", "Pending Approval"],
  Published: [],
};

const EDITABLE = ["Draft", "Rejected"];

const notFound = (res: Response) => res.status(404).json({ success: false, message: "Content not found" });
const bad = (res: Response, message: string) => res.status(400).json({ success: false, message });

type Doc = mongoose.HydratedDocument<mongoose.InferSchemaType<typeof Content.schema>>;

const serialize = (c: Doc) => ({
  id: String(c._id),
  title: c.title,
  caption: c.caption,
  hashtags: c.hashtags,
  brandId: c.brandId,
  platforms: c.platforms,
  type: c.type,
  status: c.status,
  scheduledAt: c.scheduledAt ?? null,
  mediaIds: c.mediaIds.map(String),
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

async function validMediaIds(ids: string[]): Promise<boolean> {
  if (!ids.every((i) => mongoose.isValidObjectId(i))) return false;
  return (await Media.countDocuments({ _id: { $in: ids } })) === new Set(ids).size;
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
    data: items.map(serialize),
    meta: { page, limit, total, statusCounts: Object.fromEntries(counts.map((c) => [c._id, c.n])) },
  });
}

export async function getContent(req: Request, res: Response) {
  const doc = await load(req, res);
  if (doc) res.json({ success: true, data: serialize(doc) });
}

export async function createContent(req: Request, res: Response) {
  const parsed = contentSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, parsed.error.issues[0]?.message ?? "Invalid content");
  const { scheduledAt, ...rest } = parsed.data;
  if (!(await validMediaIds(rest.mediaIds))) return bad(res, "One or more media files do not exist");

  const doc = await Content.create({
    ...rest,
    ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
    status: "Draft",
    createdBy: new mongoose.Types.ObjectId(req.user!.id),
  });
  await audit(req, { action: "Created content", category: "Content", resource: doc.title, resourceId: String(doc._id) });
  res.status(201).json({ success: true, data: serialize(doc) });
}

export async function updateContent(req: Request, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, parsed.error.issues[0]?.message ?? "Invalid content");
  const doc = await load(req, res);
  if (!doc) return;
  if (!EDITABLE.includes(doc.status)) {
    return res
      .status(409)
      .json({ success: false, message: `${doc.status} content cannot be edited. Move it back to Draft first.` });
  }
  const { scheduledAt, mediaIds, ...rest } = parsed.data;
  if (mediaIds && !(await validMediaIds(mediaIds))) return bad(res, "One or more media files do not exist");

  doc.set(rest);
  if (mediaIds) doc.set("mediaIds", mediaIds);
  if (scheduledAt !== undefined) doc.set("scheduledAt", scheduledAt ? new Date(scheduledAt) : undefined);
  await doc.save();
  await audit(req, { action: "Updated content", category: "Content", resource: doc.title, resourceId: String(doc._id) });
  res.json({ success: true, data: serialize(doc) });
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
    if (!when || when.getTime() <= Date.now()) return bad(res, "Choose a future date and time to schedule");
    doc.set("scheduledAt", when);
  }
  const previous = doc.status;
  doc.set("status", status);
  await doc.save();
  await audit(req, {
    action: status === "Scheduled" ? "Scheduled content" : `Status change to ${status}`,
    category: status === "Scheduled" ? "Scheduling" : "Content",
    resource: doc.title,
    resourceId: String(doc._id),
    metadata: { from: previous, to: status },
  });
  res.json({ success: true, data: serialize(doc) });
}

export async function duplicateContent(req: Request, res: Response) {
  const doc = await load(req, res);
  if (!doc) return;
  const copy = await Content.create({
    title: `${doc.title} (Copy)`.slice(0, 150),
    caption: doc.caption,
    hashtags: doc.hashtags,
    brandId: doc.brandId,
    platforms: doc.platforms,
    type: doc.type,
    mediaIds: doc.mediaIds,
    status: "Draft",
    createdBy: new mongoose.Types.ObjectId(req.user!.id),
  });
  await audit(req, { action: "Duplicated content", category: "Content", resource: doc.title, resourceId: String(copy._id) });
  res.status(201).json({ success: true, data: serialize(copy) });
}

export async function deleteContent(req: Request, res: Response) {
  const doc = await load(req, res);
  if (!doc) return;
  await doc.deleteOne();
  await audit(req, { action: "Deleted content", category: "Content", resource: doc.title, resourceId: String(doc._id) });
  res.json({ success: true });
}
