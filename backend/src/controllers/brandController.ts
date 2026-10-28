import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import Brand, { BRAND_STATUSES } from "../models/Brand.js";
import Content from "../models/Content.js";
import Media, { PLATFORMS } from "../models/Media.js";
import Report from "../models/Report.js";
import SocialAccount from "../models/SocialAccount.js";
import { audit } from "../utils/audit.js";
import { omitUndefined } from "../utils/object.js";

const hashtag = z
  .string()
  .trim()
  .regex(/^#?[\p{L}\p{N}_]{1,50}$/u, "Invalid hashtag")
  .transform((t) => (t.startsWith("#") ? t : `#${t}`));

const createSchema = z.object({
  name: z.string().trim().min(2, "Brand name is required").max(80),
  tagline: z.string().trim().max(120).optional(),
  description: z.string().trim().min(5, "Add a short description").max(500),
  timezone: z.string().trim().min(1).max(60),
  // No .default() here: defaults would survive .partial() and wipe fields on PATCH.
  assignedUsers: z.number().int().min(0).max(1000).optional(),
  hashtags: z.array(hashtag).max(30).optional(),
  platforms: z.array(z.enum(PLATFORMS)).max(PLATFORMS.length).optional(),
});
const updateSchema = createSchema.partial();
const statusSchema = z.object({ status: z.enum(BRAND_STATUSES) });

type BrandDoc = mongoose.HydratedDocument<mongoose.InferSchemaType<typeof Brand.schema>>;

const serialize = (b: BrandDoc, assetCount: number, connectedAccounts = 0) => ({
  id: String(b._id),
  name: b.name,
  tagline: b.tagline,
  description: b.description,
  status: b.status,
  hashtags: b.hashtags,
  timezone: b.timezone,
  platforms: b.platforms,
  assignedUsers: b.assignedUsers,
  paletteIndex: b.paletteIndex,
  assetCount,
  // Real, currently usable social connections (not the planned `platforms`).
  connectedAccounts,
  createdAt: b.createdAt,
  updatedAt: b.updatedAt,
});

const bad = (res: Response, message: string) => res.status(400).json({ success: false, message });
const isDuplicate = (e: unknown) => (e as { code?: number })?.code === 11000;
const DUPLICATE = "A brand with this name already exists";

async function load(req: Request, res: Response) {
  const id = String(req.params["id"]);
  const brand = mongoose.isValidObjectId(id) ? await Brand.findById(id) : null;
  if (!brand) res.status(404).json({ success: false, message: "Brand not found" });
  return brand;
}

export async function listBrands(_req: Request, res: Response) {
  const [brands, counts, social] = await Promise.all([
    Brand.find().sort({ createdAt: 1 }),
    Media.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$brandId", n: { $sum: 1 } } }]),
    SocialAccount.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
      { $match: { status: "Connected", $or: [{ tokenExpiresAt: null }, { tokenExpiresAt: { $gt: new Date() } }] } },
      { $group: { _id: "$brandId", n: { $sum: 1 } } },
    ]),
  ]);
  const byBrand = new Map(counts.map((c) => [c._id, c.n]));
  const connected = new Map(social.map((c) => [String(c._id), c.n]));
  res.json({
    success: true,
    data: brands.map((b) => serialize(b, byBrand.get(String(b._id)) ?? 0, connected.get(String(b._id)) ?? 0)),
  });
}

export async function getBrand(req: Request, res: Response) {
  const brand = await load(req, res);
  if (!brand) return;
  const n = await Media.countDocuments({ brandId: String(brand._id) });
  res.json({ success: true, data: serialize(brand, n) });
}

export async function createBrand(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, parsed.error.issues[0]?.message ?? "Invalid brand");
  const user = new mongoose.Types.ObjectId(req.user!.id);
  try {
    const count = await Brand.countDocuments();
    // status, createdBy and updatedBy are never taken from the request body.
    const brand = await Brand.create({ tagline: "", assignedUsers: 1, hashtags: [], platforms: [], ...omitUndefined(parsed.data), status: "Active", paletteIndex: count % 3, createdBy: user, updatedBy: user });
    await audit(req, { action: "Created brand", category: "Brands", resource: brand.name, resourceId: String(brand._id) });
    res.status(201).json({ success: true, data: serialize(brand, 0) });
  } catch (e) {
    if (isDuplicate(e)) return res.status(409).json({ success: false, message: DUPLICATE });
    throw e;
  }
}

export async function updateBrand(req: Request, res: Response) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, parsed.error.issues[0]?.message ?? "Invalid brand");
  const brand = await load(req, res);
  if (!brand) return;
  brand.set(omitUndefined(parsed.data));
  brand.set("updatedBy", new mongoose.Types.ObjectId(req.user!.id));
  try {
    await brand.save();
  } catch (e) {
    if (isDuplicate(e)) return res.status(409).json({ success: false, message: DUPLICATE });
    throw e;
  }
  await audit(req, { action: "Updated brand", category: "Brands", resource: brand.name, resourceId: String(brand._id) });
  const n = await Media.countDocuments({ brandId: String(brand._id) });
  res.json({ success: true, data: serialize(brand, n) });
}

export async function setBrandStatus(req: Request, res: Response) {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, "Invalid status");
  const brand = await load(req, res);
  if (!brand) return;
  brand.set({ status: parsed.data.status, updatedBy: new mongoose.Types.ObjectId(req.user!.id) });
  await brand.save();
  await audit(req, {
    action: `Set brand ${parsed.data.status.toLowerCase()}`,
    category: "Brands",
    resource: brand.name,
    resourceId: String(brand._id),
  });
  const n = await Media.countDocuments({ brandId: String(brand._id) });
  res.json({ success: true, data: serialize(brand, n) });
}

/** Brands that still own media, content or reports cannot be deleted: nothing is cascaded. */
export async function deleteBrand(req: Request, res: Response) {
  const brand = await load(req, res);
  if (!brand) return;
  const id = String(brand._id);
  const live = await SocialAccount.countDocuments({ brandId: brand._id, status: { $ne: "Disconnected" } });
  if (live > 0) {
    return res.status(409).json({ success: false, message: `${brand.name} still has ${live} connected social account(s). Disconnect them first.` });
  }
  const [media, content, reports] = await Promise.all([
    Media.countDocuments({ brandId: id }),
    Content.countDocuments({ brandId: id }),
    Report.countDocuments({ brandId: id }),
  ]);
  if (media + content + reports > 0) {
    await audit(req, { action: "Deleted brand", category: "Brands", result: "Failed", resource: brand.name, resourceId: id, metadata: { reason: "in use" } });
    return res.status(409).json({
      success: false,
      message: `${brand.name} still has ${media} media file(s), ${content} content item(s) and ${reports} report(s). Delete or reassign them first, or set the brand to Inactive.`,
    });
  }
  await SocialAccount.deleteMany({ brandId: brand._id });
  await brand.deleteOne();
  await audit(req, { action: "Deleted brand", category: "Brands", resource: brand.name, resourceId: id });
  res.json({ success: true });
}
