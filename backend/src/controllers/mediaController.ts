import path from "node:path";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import {
  MAX_IMAGE_BYTES,
  matchesSignature,
  removeFile,
  uploadDir,
} from "../middleware/upload.js";
import Content from "../models/Content.js";
import Media, { MEDIA_KINDS, PLATFORMS } from "../models/Media.js";
import { audit } from "../utils/audit.js";
import { resolveBrand } from "../utils/brands.js";

const BRAND_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const brandIdSchema = z.string().regex(BRAND_RE, "Invalid brand");

const uploadSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  brandId: brandIdSchema,
  kind: z.enum(MEDIA_KINDS).optional(),
  platforms: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []))
    .pipe(z.array(z.enum(PLATFORMS)).max(PLATFORMS.length)),
  duration: z.coerce.number().min(0).max(86400).optional(),
});

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  brandId: z.string().optional(),
  kind: z.enum(MEDIA_KINDS).optional(),
  platform: z.enum(PLATFORMS).optional(),
  sort: z.enum(["newest", "oldest", "name"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const serialize = (m: {
  _id: unknown;
  title: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: string;
  brandId: string;
  platforms: string[];
  duration?: number | null | undefined;
  createdAt?: Date;
}) => ({
  id: String(m._id),
  title: m.title,
  originalName: m.originalName,
  mimeType: m.mimeType,
  size: m.size,
  kind: m.kind,
  brandId: m.brandId,
  platforms: m.platforms,
  duration: m.duration ?? null,
  createdAt: m.createdAt,
});

export async function listMedia(req: Request, res: Response) {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Invalid filters" });
  }
  const { q, brandId, kind, platform, sort, page, limit } = parsed.data;

  // brandId may be a comma-separated multi-select.
  const brandIds = brandId ? brandId.split(",").filter((b) => BRAND_RE.test(b)) : [];
  const base: Record<string, unknown> = {};
  if (q) base["title"] = { $regex: escapeRegex(q), $options: "i" };
  if (brandIds.length) base["brandId"] = { $in: brandIds };
  if (platform) base["platforms"] = platform;
  const filter = kind ? { ...base, kind } : base;

  const sortBy = (
    { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, name: { title: 1 } } as const
  )[sort] as Record<string, 1 | -1>;

  const [items, total, kindCounts, brandCounts] = await Promise.all([
    Media.find(filter)
      .sort(sortBy)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Media.countDocuments(filter),
    Media.aggregate<{ _id: string; n: number }>([{ $match: base }, { $group: { _id: "$kind", n: { $sum: 1 } } }]),
    Media.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$brandId", n: { $sum: 1 } } }]),
  ]);

  res.json({
    success: true,
    data: items.map(serialize),
    meta: {
      page,
      limit,
      total,
      kindCounts: Object.fromEntries(kindCounts.map((c) => [c._id, c.n])),
      brandCounts: Object.fromEntries(brandCounts.map((c) => [c._id, c.n])),
    },
  });
}

export async function uploadMedia(req: Request, res: Response) {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }
  const reject = (message: string) => {
    removeFile(file.filename);
    void audit(req, { action: "Uploaded media", category: "Media", result: "Failed", resource: file.originalname.slice(0, 120), metadata: { reason: message } });
    return res.status(400).json({ success: false, message });
  };

  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) return reject("Invalid brand, type or platform selection");
  const body = parsed.data;
  const brand = await resolveBrand(body.brandId, true);
  if (!brand.ok) return reject(brand.message);

  const isVideo = file.mimetype.startsWith("video/");
  if (!isVideo && file.size > MAX_IMAGE_BYTES) return reject("Images must be 15 MB or smaller");
  if (!matchesSignature(path.join(uploadDir, file.filename), file.mimetype)) {
    return reject("File contents do not match its type");
  }

  // Images can only be Image/Carousel; videos can only be Video/Reel/Short.
  const allowedKinds: readonly string[] = isVideo ? ["Video", "Reel", "Short"] : ["Image", "Carousel"];
  const kind = body.kind ?? allowedKinds[0]!;
  if (!allowedKinds.includes(kind)) return reject(`A ${isVideo ? "video" : "image"} file cannot be a ${kind}`);

  let media;
  try {
    media = await Media.create({
      title: body.title ?? path.parse(file.originalname).name.slice(0, 150),
      originalName: file.originalname.slice(0, 255),
      filename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      kind: kind as (typeof MEDIA_KINDS)[number],
      brandId: body.brandId,
      platforms: body.platforms,
      ...(isVideo && body.duration !== undefined ? { duration: Math.round(body.duration) } : {}),
      uploadedBy: new mongoose.Types.ObjectId(req.user!.id),
    });
  } catch (error) {
    removeFile(file.filename);
    throw error;
  }

  await audit(req, { action: "Uploaded media", category: "Media", resource: media.title, resourceId: String(media._id), metadata: { kind: media.kind } });
  res.status(201).json({ success: true, data: serialize(media) });
}

async function findMedia(req: Request, res: Response) {
  const id = String(req.params["id"]);
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ success: false, message: "Media not found" });
    return null;
  }
  const media = await Media.findById(id);
  if (!media) res.status(404).json({ success: false, message: "Media not found" });
  return media;
}

export async function getMedia(req: Request, res: Response) {
  const media = await findMedia(req, res);
  if (media) res.json({ success: true, data: serialize(media) });
}

/** Streams the stored file. Auth-protected like every /api/admin route. */
export async function getMediaFile(req: Request, res: Response) {
  const media = await findMedia(req, res);
  if (!media) return;
  // Helmet defaults to same-origin; the React app is served from another port.
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.query["download"] === "1") {
    const ext = path.extname(media.filename);
    const safe = media.title.replace(/[^\w\- ]+/g, "").trim() || "media";
    res.setHeader("Content-Disposition", `attachment; filename="${safe}${ext}"`);
  }
  // sendFile infers Content-Type from the server-generated extension.
  res.sendFile(path.join(uploadDir, path.basename(media.filename)), (error) => {
    if (error && !res.headersSent) res.status(404).json({ success: false, message: "File missing" });
  });
}

const updateSchema = z.object({
  title: z.string().trim().min(1).max(150).optional(),
  platforms: z.array(z.enum(PLATFORMS)).optional(),
});

export async function updateMedia(req: Request, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid data" });
  const media = await findMedia(req, res);
  if (!media) return;
  if (parsed.data.title !== undefined) media.title = parsed.data.title;
  if (parsed.data.platforms !== undefined) media.set("platforms", parsed.data.platforms);
  await media.save();
  res.json({ success: true, data: serialize(media) });
}

export async function deleteMedia(req: Request, res: Response) {
  const media = await findMedia(req, res);
  if (!media) return;
  const used = await Content.countDocuments({ mediaIds: media._id });
  if (used > 0) {
    return res.status(409).json({ success: false, message: `This file is used by ${used} post${used === 1 ? "" : "s"}. Remove it from them (or delete them) first.` });
  }
  await media.deleteOne();
  removeFile(media.filename);
  await audit(req, { action: "Deleted media", category: "Media", resource: media.title, resourceId: String(media._id) });
  res.json({ success: true });
}
