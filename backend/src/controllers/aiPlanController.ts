import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import AiGeneration, { PLAN_CONTENT_TYPES } from "../models/AiGeneration.js";
import Content from "../models/Content.js";
import Media, { PLATFORMS } from "../models/Media.js";
import SocialAccount from "../models/SocialAccount.js";
import { AiError, aiConfigured } from "../services/ai/anthropic.js";
import { LENGTHS, TONES } from "../services/ai/generate.js";
import {
  GOALS,
  TYPES_BY_PLATFORM,
  busySlots,
  captionsForIdeas,
  cleanTags,
  generatePlan,
  localToInstant,
  regenerateIdeas,
  type PlanIdea,
  type PlanRequest,
} from "../services/ai/plan.js";
import { findConflicts } from "../services/publishing/conflicts.js";
import { audit } from "../utils/audit.js";
import { resolveBrand } from "../utils/brands.js";
import { brandIdSchema } from "./mediaController.js";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time");
const NOT_CONFIGURED = "AI is not configured on the server. Add ANTHROPIC_API_KEY to backend/.env and restart.";

const planSchema = z.object({
  brandId: brandIdSchema,
  platforms: z.array(z.enum(PLATFORMS)).min(1, "Select at least one platform").max(PLATFORMS.length),
  accountIds: z.array(objectId).max(20).default([]),
  goal: z.enum(GOALS),
  periodDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  postCount: z.number().int().min(1, "Plan at least one post").max(30),
  topics: z.string().trim().min(3, "Enter the topics, products or announcements to plan around").max(2000),
  preferences: z.string().trim().max(300).default(""),
  tone: z.enum(TONES).default("Professional"),
  language: z.string().trim().min(2).max(40).regex(/^[\p{L}\p{N} ()\-,.]+$/u, "Invalid language").default("English"),
  startDate: dateStr,
  utcOffsetMinutes: z.number().int().min(-840).max(840),
});

const ideaSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,20}$/),
  idea: z.string().trim().max(400),
  topic: z.string().trim().max(200).default(""),
  platform: z.enum(PLATFORMS),
  contentType: z.enum(PLAN_CONTENT_TYPES),
  captionConcept: z.string().trim().max(600).default(""),
  callToAction: z.string().trim().max(200).default(""),
  hashtags: z.array(z.string().max(60)).max(30).default([]),
  date: dateStr,
  time: timeStr,
  reason: z.string().trim().max(400).default(""),
  draft: z
    .object({
      title: z.string().max(200),
      caption: z.string().max(6000),
      callToAction: z.string().max(500),
      hashtags: z.array(z.string().max(60)).max(30),
    })
    .nullable()
    .optional(),
  mediaIds: z.array(objectId).max(10).default([]),
  contentId: objectId.nullable().optional(),
});
const saveSchema = z.object({ ideas: z.array(ideaSchema).max(40) });

type PlanDoc = mongoose.HydratedDocument<mongoose.InferSchemaType<typeof AiGeneration.schema>>;

const serialize = (g: PlanDoc) => ({
  id: String(g._id),
  kind: "plan" as const,
  brandId: g.brandId,
  topic: g.topic,
  purpose: g.purpose,
  settings: g.settings,
  platforms: g.platforms,
  plan: g.plan
    ? {
        goal: g.plan.goal,
        periodDays: g.plan.periodDays,
        postCount: g.plan.postCount,
        startDate: g.plan.startDate,
        utcOffsetMinutes: g.plan.utcOffsetMinutes,
        preferences: g.plan.preferences ?? "",
        accountIds: g.plan.accountIds,
        ideas: g.plan.ideas.map((i) => ({
          id: i.id,
          idea: i.idea ?? "",
          topic: i.topic ?? "",
          platform: i.platform,
          contentType: i.contentType,
          captionConcept: i.captionConcept ?? "",
          callToAction: i.callToAction ?? "",
          hashtags: i.hashtags,
          date: i.date,
          time: i.time,
          reason: i.reason ?? "",
          issues: i.issues,
          draft: i.draft ? { title: i.draft.title ?? "", caption: i.draft.caption ?? "", callToAction: i.draft.callToAction ?? "", hashtags: i.draft.hashtags } : null,
          mediaIds: i.mediaIds,
          contentId: i.contentId ?? null,
        })),
      }
    : null,
  model: g.model ?? "",
  createdAt: g.createdAt,
  updatedAt: g.updatedAt,
});

const fail = (res: Response, e: unknown) => {
  if (e instanceof AiError) return res.status(e.status).json({ success: false, message: e.message });
  throw e;
};
const bad = (res: Response, message: string) => res.status(400).json({ success: false, message });

async function loadPlan(req: Request, res: Response) {
  const id = String(req.params["id"]);
  const doc = mongoose.isValidObjectId(id) ? await AiGeneration.findById(id) : null;
  if (!doc || doc.kind !== "plan" || !doc.plan) {
    res.status(404).json({ success: false, message: "Plan not found" });
    return null;
  }
  return doc;
}

/** Ownership checks: chosen accounts must belong to the brand. */
async function accountsBelong(brandId: string, accountIds: string[]) {
  if (accountIds.length === 0) return true;
  const n = await SocialAccount.countDocuments({ _id: { $in: accountIds }, brandId: new mongoose.Types.ObjectId(brandId) });
  return n === new Set(accountIds).size;
}

function requestFrom(doc: PlanDoc, brand: PlanRequest["brand"], busy: PlanRequest["busy"]): PlanRequest {
  const p = doc.plan!;
  return {
    brand,
    platforms: doc.platforms,
    goal: p.goal as PlanRequest["goal"],
    periodDays: p.periodDays ?? 7,
    postCount: p.postCount ?? 5,
    topics: doc.topic,
    preferences: p.preferences ?? "",
    tone: doc.settings?.tone ?? "Professional",
    language: doc.settings?.language ?? "English",
    startDate: p.startDate ?? "",
    utcOffsetMinutes: p.utcOffsetMinutes ?? 0,
    busy,
  };
}

type IdeaDoc = NonNullable<PlanDoc["plan"]>["ideas"][number];

const toIdea = (i: IdeaDoc): PlanIdea => ({
  id: i.id,
  idea: i.idea ?? "",
  topic: i.topic ?? "",
  platform: i.platform,
  contentType: i.contentType as PlanIdea["contentType"],
  captionConcept: i.captionConcept ?? "",
  callToAction: i.callToAction ?? "",
  hashtags: [...i.hashtags],
  date: i.date,
  time: i.time,
  reason: i.reason ?? "",
  issues: [...i.issues],
});

export async function createPlan(req: Request, res: Response) {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, parsed.error.issues[0]?.message ?? "Invalid request");
  const input = parsed.data;
  if (!aiConfigured()) return res.status(503).json({ success: false, message: NOT_CONFIGURED });
  const brand = await resolveBrand(input.brandId);
  if (!brand.ok) return bad(res, brand.message);
  if (!(await accountsBelong(input.brandId, input.accountIds))) return bad(res, "A selected account does not belong to this brand");

  const start = localToInstant(input.startDate, "00:00", input.utcOffsetMinutes);
  if (start === null) return bad(res, "Invalid start date");
  if (start < Date.now() - 2 * 86_400_000 || start > Date.now() + 120 * 86_400_000) return bad(res, "Choose a start date within the next few months");
  if (input.postCount > input.periodDays * 3) return bad(res, `That is too many posts for ${input.periodDays} days (maximum ${input.periodDays * 3}).`);

  const platforms = [...new Set(input.platforms)];
  const busy = await busySlots(input.brandId, start, start + input.periodDays * 86_400_000, input.accountIds);
  const request: PlanRequest = {
    brand: { name: brand.brand.name, tagline: brand.brand.tagline, description: brand.brand.description, hashtags: brand.brand.hashtags },
    platforms,
    goal: input.goal,
    periodDays: input.periodDays,
    postCount: input.postCount,
    topics: input.topics,
    preferences: input.preferences,
    tone: input.tone,
    language: input.language,
    startDate: input.startDate,
    utcOffsetMinutes: input.utcOffsetMinutes,
    busy,
  };
  try {
    const { ideas, model } = await generatePlan(request);
    const doc = await AiGeneration.create({
      kind: "plan",
      brandId: input.brandId,
      createdBy: new mongoose.Types.ObjectId(req.user!.id),
      topic: input.topics,
      purpose: input.goal,
      settings: { tone: input.tone, language: input.language },
      platforms,
      plan: {
        goal: input.goal,
        periodDays: input.periodDays,
        postCount: input.postCount,
        startDate: input.startDate,
        utcOffsetMinutes: input.utcOffsetMinutes,
        preferences: input.preferences,
        accountIds: input.accountIds,
        ideas,
      },
      model,
    });
    await audit(req, { action: "Generated AI content plan", category: "Content", resource: brand.brand.name, resourceId: String(doc._id), metadata: { ideas: ideas.length, platforms: platforms.join(",") } });
    res.status(201).json({ success: true, data: serialize(doc) });
  } catch (e) {
    await audit(req, { action: "Generated AI content plan", category: "Content", result: "Failed", resource: brand.brand.name, metadata: { reason: e instanceof AiError ? e.message : "unexpected error" } });
    return fail(res, e);
  }
}

export async function listPlans(req: Request, res: Response) {
  const brandId = typeof req.query["brandId"] === "string" ? req.query["brandId"] : "";
  const filter: Record<string, unknown> = { kind: "plan", ...(/^[A-Za-z0-9_-]{1,64}$/.test(brandId) ? { brandId } : {}) };
  const items = await AiGeneration.find(filter).sort({ createdAt: -1 }).limit(30);
  res.json({ success: true, data: items.map(serialize) });
}

export async function getPlan(req: Request, res: Response) {
  const doc = await loadPlan(req, res);
  if (doc) res.json({ success: true, data: serialize(doc) });
}

/** Stores the admin's edits (idea text, date/time, platform, type, drafts, media). */
export async function savePlan(req: Request, res: Response) {
  const parsed = saveSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, parsed.error.issues[0]?.message ?? "Invalid plan");
  const doc = await loadPlan(req, res);
  if (!doc) return;

  const ideas = parsed.data.ideas;
  for (const i of ideas) {
    if (!doc.platforms.includes(i.platform)) return bad(res, "An idea uses a platform that is not part of this plan");
    if (!TYPES_BY_PLATFORM[i.platform].includes(i.contentType)) return bad(res, `${i.contentType} is not available for ${i.platform}`);
  }
  // Media and linked posts must belong to this plan's brand; anything else is dropped, never trusted.
  const mediaIds = [...new Set(ideas.flatMap((i) => i.mediaIds))];
  const okMedia = new Set((await Media.find({ _id: { $in: mediaIds }, brandId: doc.brandId }).select("_id").lean()).map((m) => String(m._id)));
  const contentIds = [...new Set(ideas.flatMap((i) => (i.contentId ? [i.contentId] : [])))];
  const okContent = new Set((await Content.find({ _id: { $in: contentIds }, brandId: doc.brandId }).select("_id").lean()).map((c) => String(c._id)));

  doc.set(
    "plan.ideas",
    ideas.map((i) => ({
      id: i.id,
      idea: i.idea,
      topic: i.topic,
      platform: i.platform,
      contentType: i.contentType,
      captionConcept: i.captionConcept,
      callToAction: i.callToAction,
      hashtags: cleanTags(i.hashtags, 30),
      date: i.date,
      time: i.time,
      reason: i.reason,
      issues: [],
      ...(i.draft ? { draft: { ...i.draft, hashtags: cleanTags(i.draft.hashtags, 30) } } : {}),
      mediaIds: i.mediaIds.filter((m) => okMedia.has(m)),
      ...(i.contentId && okContent.has(i.contentId) ? { contentId: i.contentId } : {}),
    })),
  );
  await doc.save();
  res.json({ success: true, data: serialize(doc) });
}

const idsSchema = z.object({ ideaIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,20}$/)).min(1, "Select at least one idea").max(10, "Select up to 10 ideas at a time") });

async function planContext(doc: PlanDoc) {
  const brand = await resolveBrand(doc.brandId);
  if (!brand.ok) return null;
  return { brand: { name: brand.brand.name, tagline: brand.brand.tagline, description: brand.brand.description, hashtags: brand.brand.hashtags } };
}

export async function regenerate(req: Request, res: Response) {
  const parsed = idsSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, parsed.error.issues[0]?.message ?? "Invalid request");
  if (!aiConfigured()) return res.status(503).json({ success: false, message: NOT_CONFIGURED });
  const doc = await loadPlan(req, res);
  if (!doc) return;
  const ctx = await planContext(doc);
  if (!ctx) return bad(res, "The brand no longer exists");

  const all = doc.plan!.ideas.map(toIdea);
  const replace = all.filter((i) => parsed.data.ideaIds.includes(i.id));
  if (replace.length === 0) return bad(res, "None of the selected ideas exist in this plan");
  const keep = all.filter((i) => !parsed.data.ideaIds.includes(i.id));
  try {
    const fresh = await regenerateIdeas(requestFrom(doc, ctx.brand, []), replace, keep);
    const byId = new Map(fresh.map((f) => [f.id, f]));
    for (const stored of doc.plan!.ideas) {
      const n = byId.get(stored.id);
      if (!n) continue;
      // New creative content invalidates captions and any link to an already saved post.
      stored.set({ idea: n.idea, topic: n.topic, contentType: n.contentType, captionConcept: n.captionConcept, callToAction: n.callToAction, hashtags: n.hashtags, reason: n.reason, draft: undefined });
      if (!stored.contentId) stored.set("issues", []);
    }
    await doc.save();
    res.json({ success: true, data: serialize(doc) });
  } catch (e) {
    return fail(res, e);
  }
}

const contentSchema = idsSchema.extend({
  length: z.enum(LENGTHS).default("Medium"),
  hashtagCount: z.number().int().min(0).max(15).default(5),
  includeCta: z.boolean().default(true),
});

/** Uses the normal AI caption generator for each selected idea (one rate-limited request, up to 10 ideas). */
export async function generatePlanContent(req: Request, res: Response) {
  const parsed = contentSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, parsed.error.issues[0]?.message ?? "Invalid request");
  if (!aiConfigured()) return res.status(503).json({ success: false, message: NOT_CONFIGURED });
  const doc = await loadPlan(req, res);
  if (!doc) return;
  const ctx = await planContext(doc);
  if (!ctx) return bad(res, "The brand no longer exists");

  const picked = doc.plan!.ideas.filter((i) => parsed.data.ideaIds.includes(i.id)).map(toIdea);
  if (picked.length === 0) return bad(res, "None of the selected ideas exist in this plan");

  const results = await captionsForIdeas(
    picked,
    { brand: ctx.brand, goal: doc.plan!.goal as PlanRequest["goal"], tone: doc.settings?.tone ?? "Professional", language: doc.settings?.language ?? "English", topics: doc.topic },
    { length: parsed.data.length, hashtagCount: parsed.data.hashtagCount, includeCta: parsed.data.includeCta },
  );
  const failures: Record<string, string> = {};
  for (const stored of doc.plan!.ideas) {
    const r = results.get(stored.id);
    if (r === undefined) continue;
    if (typeof r === "string") failures[stored.id] = r;
    else stored.set("draft", { title: r.title, caption: r.caption, callToAction: r.callToAction, hashtags: r.hashtags });
  }
  await doc.save();
  await audit(req, { action: "Generated captions for AI plan", category: "Content", resource: ctx.brand.name, resourceId: String(doc._id), metadata: { ideas: picked.length, failed: Object.keys(failures).length } });
  res.json({ success: true, data: serialize(doc), failures });
}

const slotsSchema = z.object({
  brandId: brandIdSchema,
  slots: z
    .array(z.object({ platform: z.enum(PLATFORMS), accountIds: z.array(objectId).max(20).default([]), scheduledAt: z.iso.datetime({ offset: true }) }))
    .max(40),
  ignoreContentIds: z.array(objectId).max(40).default([]),
});

/** Which proposed slots collide with posts that are already scheduled for the same account. */
export async function checkSlots(req: Request, res: Response) {
  const parsed = slotsSchema.safeParse(req.body);
  if (!parsed.success) return bad(res, "Invalid slots");
  const brand = await resolveBrand(parsed.data.brandId);
  if (!brand.ok) return bad(res, brand.message);
  const conflicts = await findConflicts(
    parsed.data.brandId,
    parsed.data.slots.map((s) => ({ platform: s.platform, accountIds: s.accountIds, at: new Date(s.scheduledAt).getTime() })),
    parsed.data.ignoreContentIds,
  );
  res.json({ success: true, data: conflicts });
}
