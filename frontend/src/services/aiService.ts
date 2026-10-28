import api from "./api";
import type { PlatformKey } from "../types";

export const PURPOSES = [
  "Promotional post",
  "Educational post",
  "Product announcement",
  "Brand awareness",
  "Engagement post",
  "Informational post",
  "Video caption",
  "Custom content",
] as const;
export const TONES = ["Professional", "Friendly", "Promotional", "Educational", "Casual"] as const;
export const LENGTHS = ["Short", "Medium", "Long"] as const;

export interface AiSettings {
  purpose: (typeof PURPOSES)[number];
  tone: (typeof TONES)[number];
  language: string;
  length: (typeof LENGTHS)[number];
  hashtagCount: number;
  includeCta: boolean;
  variations: number;
}

export interface GenerateInput extends AiSettings {
  brandId: string;
  platforms: PlatformKey[];
  topic: string;
}

export interface AiVariation {
  title: string;
  caption: string;
  callToAction: string;
  shortDescription: string;
  hashtags: string[];
  issues: string[];
}

export interface AiGeneration {
  id: string;
  brandId: string;
  topic: string;
  purpose: string;
  settings: { tone?: string; language?: string; length?: string; hashtagCount?: number; includeCta?: boolean; variations?: number };
  platforms: PlatformKey[];
  results: { platform: PlatformKey; variations: AiVariation[] }[];
  model: string;
  createdAt: string;
}

export async function getAiStatus(): Promise<{ configured: boolean; model: string | null }> {
  return (await api.get("/admin/ai/status")).data.data;
}

// Generation can take a while; allow longer than the default client timeout.
export async function generate(input: GenerateInput): Promise<AiGeneration> {
  return (await api.post("/admin/ai/generate", input, { timeout: 120_000 })).data.data;
}

export async function listGenerations(brandId?: string): Promise<AiGeneration[]> {
  return (await api.get("/admin/ai/generations", { params: brandId ? { brandId } : {} })).data.data;
}

export async function deleteGeneration(id: string): Promise<void> {
  await api.delete(`/admin/ai/generations/${id}`);
}

// ───────────── Content planner ─────────────

export const GOALS = ["Brand awareness", "Engagement", "Product promotion", "Education", "Traffic", "Lead generation"] as const;
export type PlanType = "Image" | "Reel" | "Carousel" | "Video" | "Short" | "Text";

/** Formats each platform can actually take (mirrors the server). */
export const TYPES_BY_PLATFORM: Record<PlatformKey, PlanType[]> = {
  instagram: ["Image", "Reel", "Carousel"],
  facebook: ["Text", "Image", "Video"],
  youtube: ["Video", "Short"],
  linkedin: ["Text", "Image"],
  x: ["Text"],
};

export interface PlanDraft {
  title: string;
  caption: string;
  callToAction: string;
  hashtags: string[];
}

export interface PlanIdea {
  id: string;
  idea: string;
  topic: string;
  platform: PlatformKey;
  contentType: PlanType;
  captionConcept: string;
  callToAction: string;
  hashtags: string[];
  /** Local date/time (YYYY-MM-DD, HH:mm) in the admin's timezone when the plan was made. */
  date: string;
  time: string;
  reason: string;
  issues: string[];
  draft: PlanDraft | null;
  mediaIds: string[];
  /** Set once the idea was saved as a real post. */
  contentId: string | null;
}

export interface AiPlan {
  id: string;
  kind: "plan";
  brandId: string;
  topic: string;
  purpose: string;
  settings: { tone?: string; language?: string };
  platforms: PlatformKey[];
  plan: {
    goal: (typeof GOALS)[number];
    periodDays: number;
    postCount: number;
    startDate: string;
    utcOffsetMinutes: number;
    preferences: string;
    accountIds: string[];
    ideas: PlanIdea[];
  };
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanInput {
  brandId: string;
  platforms: PlatformKey[];
  accountIds: string[];
  goal: (typeof GOALS)[number];
  periodDays: 7 | 14 | 30;
  postCount: number;
  topics: string;
  preferences: string;
  tone: AiSettings["tone"];
  language: string;
  startDate: string;
  utcOffsetMinutes: number;
}

export async function createPlan(input: PlanInput): Promise<AiPlan> {
  return (await api.post("/admin/ai/plans", input, { timeout: 120_000 })).data.data;
}
export async function listPlans(brandId?: string): Promise<AiPlan[]> {
  return (await api.get("/admin/ai/plans", { params: brandId ? { brandId } : {} })).data.data;
}
export async function savePlan(id: string, ideas: PlanIdea[]): Promise<AiPlan> {
  const body = ideas.map(({ issues: _issues, ...i }) => i);
  return (await api.put(`/admin/ai/plans/${id}`, { ideas: body })).data.data;
}
export async function regenerateIdeas(id: string, ideaIds: string[]): Promise<AiPlan> {
  return (await api.post(`/admin/ai/plans/${id}/regenerate`, { ideaIds }, { timeout: 120_000 })).data.data;
}
export async function generateIdeaContent(
  id: string,
  ideaIds: string[],
  settings: { length: AiSettings["length"]; hashtagCount: number; includeCta: boolean },
): Promise<{ plan: AiPlan; failures: Record<string, string> }> {
  const r = await api.post(`/admin/ai/plans/${id}/generate-content`, { ideaIds, ...settings }, { timeout: 180_000 });
  return { plan: r.data.data, failures: r.data.failures };
}
export async function checkSlots(
  brandId: string,
  slots: { platform: PlatformKey; accountIds: string[]; scheduledAt: string }[],
  ignoreContentIds: string[],
): Promise<{ index: number; title: string; at: string }[]> {
  return (await api.post("/admin/ai/slots/check", { brandId, slots, ignoreContentIds })).data.data;
}

