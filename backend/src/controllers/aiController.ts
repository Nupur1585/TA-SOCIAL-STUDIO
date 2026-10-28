import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { PLATFORMS } from "../models/Media.js";
import AiGeneration from "../models/AiGeneration.js";
import { AiError, aiConfigured, aiModel } from "../services/ai/anthropic.js";
import { LENGTHS, PURPOSES, TONES, generateContent } from "../services/ai/generate.js";
import { audit } from "../utils/audit.js";
import { resolveBrand } from "../utils/brands.js";
import { brandIdSchema } from "./mediaController.js";

const generateSchema = z.object({
  brandId: brandIdSchema,
  platforms: z.array(z.enum(PLATFORMS)).min(1, "Select at least one platform").max(PLATFORMS.length),
  topic: z.string().trim().min(3, "Describe what the content should be about").max(1500),
  purpose: z.enum(PURPOSES).default("Promotional post"),
  tone: z.enum(TONES).default("Professional"),
  language: z.string().trim().min(2).max(40).regex(/^[\p{L}\p{N} ()\-,.]+$/u, "Invalid language").default("English"),
  length: z.enum(LENGTHS).default("Medium"),
  hashtagCount: z.number().int().min(0).max(15).default(5),
  includeCta: z.boolean().default(true),
  variations: z.number().int().min(1).max(3).default(1),
});

type GenDoc = mongoose.HydratedDocument<mongoose.InferSchemaType<typeof AiGeneration.schema>>;

const serialize = (g: GenDoc) => ({
  id: String(g._id),
  kind: "content" as const,
  brandId: g.brandId,
  topic: g.topic,
  purpose: g.purpose,
  settings: g.settings,
  platforms: g.platforms,
  results: g.results.map((r) => ({
    platform: r.platform,
    variations: r.variations.map((v) => ({
      title: v.title ?? "",
      caption: v.caption ?? "",
      callToAction: v.callToAction ?? "",
      shortDescription: v.shortDescription ?? "",
      hashtags: v.hashtags,
      issues: v.issues,
    })),
  })),
  model: g.model ?? "",
  createdAt: g.createdAt,
});

const fail = (res: Response, e: unknown) => {
  if (e instanceof AiError) return res.status(e.status).json({ success: false, message: e.message });
  throw e;
};

/** Lets the UI show "AI not configured" up front. Never includes the key. */
export function aiStatus(_req: Request, res: Response) {
  res.json({ success: true, data: { configured: aiConfigured(), model: aiConfigured() ? aiModel() : null } });
}

export async function generate(req: Request, res: Response) {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? "Invalid request" });
  const input = parsed.data;
  if (!aiConfigured()) {
    return res.status(503).json({ success: false, message: "AI is not configured on the server. Add ANTHROPIC_API_KEY to backend/.env and restart." });
  }
  const brand = await resolveBrand(input.brandId);
  if (!brand.ok) return res.status(400).json({ success: false, message: brand.message });

  const platforms = [...new Set(input.platforms)];
  try {
    const { results, model } = await generateContent({
      brand: { name: brand.brand.name, tagline: brand.brand.tagline, description: brand.brand.description, hashtags: brand.brand.hashtags },
      platforms,
      topic: input.topic,
      purpose: input.purpose,
      tone: input.tone,
      language: input.language,
      length: input.length,
      hashtagCount: input.hashtagCount,
      includeCta: input.includeCta,
      variations: input.variations,
    });
    const doc = await AiGeneration.create({
      brandId: input.brandId,
      createdBy: new mongoose.Types.ObjectId(req.user!.id),
      topic: input.topic,
      purpose: input.purpose,
      settings: { tone: input.tone, language: input.language, length: input.length, hashtagCount: input.hashtagCount, includeCta: input.includeCta, variations: input.variations },
      platforms,
      results,
      model,
    });
    await audit(req, { action: "Generated AI content", category: "Content", resource: brand.brand.name, resourceId: String(doc._id), metadata: { platforms: platforms.join(","), variations: input.variations } });
    res.status(201).json({ success: true, data: serialize(doc) });
  } catch (e) {
    await audit(req, { action: "Generated AI content", category: "Content", result: "Failed", resource: brand.brand.name, metadata: { reason: e instanceof AiError ? e.message : "unexpected error" } });
    return fail(res, e);
  }
}

export async function listGenerations(req: Request, res: Response) {
  const brandId = typeof req.query["brandId"] === "string" ? req.query["brandId"] : "";
  const limit = Math.min(50, Math.max(1, Number(req.query["limit"]) || 20));
  // Content plans live in the same collection but have their own endpoints.
  const filter: Record<string, unknown> = { kind: { $ne: "plan" }, ...(/^[A-Za-z0-9_-]{1,64}$/.test(brandId) ? { brandId } : {}) };
  const items = await AiGeneration.find(filter).sort({ createdAt: -1 }).limit(limit);
  res.json({ success: true, data: items.map(serialize) });
}

async function load(req: Request, res: Response) {
  const id = String(req.params["id"]);
  const doc = mongoose.isValidObjectId(id) ? await AiGeneration.findById(id) : null;
  if (!doc) res.status(404).json({ success: false, message: "Generation not found" });
  return doc;
}

export async function getGeneration(req: Request, res: Response) {
  const doc = await load(req, res);
  if (doc) res.json({ success: true, data: serialize(doc) });
}

export async function deleteGeneration(req: Request, res: Response) {
  const doc = await load(req, res);
  if (!doc) return;
  await doc.deleteOne();
  res.json({ success: true });
}
