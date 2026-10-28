import mongoose from "mongoose";
import Content from "../../models/Content.js";
import type { PlatformKey } from "../../models/Media.js";

/** Planner warnings use this window; the Content API itself only blocks true double-bookings (see SAME_TIME_GAP_MS). */
export const CONFLICT_GAP_MS = 30 * 60_000;
export const SAME_TIME_GAP_MS = 5 * 60_000;

/** Existing posts that clash with proposed slots (same account, or same brand+platform when no account is chosen). */
export async function findConflicts(
  brandId: string,
  slots: { platform: PlatformKey; accountIds: string[]; at: number }[],
  ignoreContentIds: string[],
  gapMs: number = CONFLICT_GAP_MS,
): Promise<{ index: number; title: string; at: string }[]> {
  if (slots.length === 0) return [];
  const lo = Math.min(...slots.map((s) => s.at)) - gapMs;
  const hi = Math.max(...slots.map((s) => s.at)) + gapMs;
  const ignore = ignoreContentIds.filter((i) => mongoose.isValidObjectId(i));
  const posts = await Content.find({
    brandId,
    status: { $in: ["Scheduled", "Publishing"] },
    scheduledAt: { $gte: new Date(lo), $lte: new Date(hi) },
    ...(ignore.length ? { _id: { $nin: ignore } } : {}),
  }).select("title scheduledAt targets platforms");
  const out: { index: number; title: string; at: string }[] = [];
  slots.forEach((s, index) => {
    const hit = posts.find((p) => {
      if (!p.scheduledAt || Math.abs(p.scheduledAt.getTime() - s.at) >= gapMs) return false;
      return s.accountIds.length
        ? p.targets.some((t) => s.accountIds.includes(String(t.socialAccountId)) && t.platform === s.platform)
        : p.targets.some((t) => t.platform === s.platform) || p.platforms.includes(s.platform);
    });
    if (hit?.scheduledAt) out.push({ index, title: hit.title, at: hit.scheduledAt.toISOString() });
  });
  return out;
}
