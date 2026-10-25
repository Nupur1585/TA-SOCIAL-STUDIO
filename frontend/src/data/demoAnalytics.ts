/**
 * DEMONSTRATION DATA ONLY.
 * No social platform analytics API is connected, so these numbers are generated
 * deterministically for layout review. Replace `buildAnalytics` with a call in
 * services/ once a real analytics endpoint exists. Never present as live data.
 */
import { addDays, format, subDays } from "date-fns";
import { demoContent } from "./demoContent";
import type { ContentItem, PlatformKey } from "../types";

export interface AnalyticsPoint {
  date: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
}

export interface TopContent {
  item: ContentItem;
  reach: number;
  engagement: number;
}

export interface AnalyticsData {
  series: AnalyticsPoint[];
  totals: { reach: number; engagement: number; followers: number; published: number };
  trends: { reach: number; engagement: number; followers: number; published: number };
  platforms: { platform: PlatformKey; label: string; value: number; color: string }[];
  byType: { type: string; value: number }[];
  top: TopContent[];
}

const brandFactor = (brandId: string) => (brandId === "all" ? 1 : brandId === "brd-001" ? 0.62 : 0.38);
const wave = (i: number, seed: number) => 1 + 0.35 * Math.sin(i * 0.9 + seed) + 0.15 * Math.cos(i * 0.31 + seed * 2);

function day(i: number, f: number) {
  const reach = Math.round(5200 * f * wave(i, 1));
  return {
    reach,
    impressions: Math.round(reach * 1.45 * wave(i, 3)),
    likes: Math.round(1900 * f * wave(i, 2)),
    comments: Math.round(520 * f * wave(i, 4)),
    shares: Math.round(310 * f * wave(i, 5)),
    saves: Math.round(240 * f * wave(i, 6)),
  };
}

const sum = (from: number, to: number, f: number, key: "reach" | "likes" | "comments" | "shares" | "saves") => {
  let t = 0;
  for (let i = from; i < to; i++) t += day(i, f)[key];
  return t;
};
const engagementOf = (from: number, to: number, f: number) =>
  (["likes", "comments", "shares", "saves"] as const).reduce((a, k) => a + sum(from, to, f, k), 0);
const pct = (cur: number, prev: number) => (prev ? Math.round(((cur - prev) / prev) * 100) : 0);

export function buildAnalytics(days: number, brandId: string, today = new Date()): AnalyticsData {
  const f = brandFactor(brandId);
  // Index 0 is the first day of the current period; the previous period sits before it.
  const base = 1000;
  const start = base;
  const end = base + days;

  const buckets = Math.min(10, days);
  const size = days / buckets;
  const series: AnalyticsPoint[] = [];
  for (let b = 0; b < buckets; b++) {
    const lo = Math.floor(start + b * size);
    const hi = Math.max(lo + 1, Math.floor(start + (b + 1) * size));
    const agg = { likes: 0, comments: 0, shares: 0, saves: 0, reach: 0, impressions: 0 };
    for (let i = lo; i < hi; i++) {
      const d = day(i, f);
      (Object.keys(agg) as (keyof typeof agg)[]).forEach((k) => (agg[k] += d[k]));
    }
    const date = addDays(subDays(today, days - 1), Math.floor(b * size));
    series.push({ date: format(date, "MMM d"), ...agg });
  }

  const reach = sum(start, end, f, "reach");
  const engagement = engagementOf(start, end, f);
  const published = Math.round((days / 30) * 48 * f);
  const prevPublished = Math.round((days / 30) * 43 * f);

  const shares = [
    { platform: "instagram" as const, label: "Instagram", share: 0.45, color: "#e1306c" },
    { platform: "facebook" as const, label: "Facebook", share: 0.3, color: "#2563eb" },
    { platform: "linkedin" as const, label: "LinkedIn", share: 0.15, color: "#7c3aed" },
    { platform: "youtube" as const, label: "YouTube", share: 0.1, color: "#ef4444" },
  ];

  const typeWeights: [string, number][] = [["Posts", 3400], ["Reels", 4600], ["Stories", 2200], ["Videos", 3100], ["Carousels", 2700]];

  const top = demoContent
    .filter((c) => brandId === "all" || c.brandId === brandId)
    .map((item, i) => ({
      item,
      reach: Math.round((1300 - i * 140) * (days / 30 + 0.4)),
      engagement: Math.round((330 - i * 32) * (days / 30 + 0.4)),
    }))
    .sort((a, b) => b.reach - a.reach)
    .slice(0, 5);

  return {
    series,
    totals: { reach, engagement, followers: Math.round(28600 * f), published },
    trends: {
      reach: pct(reach, sum(start - days, start, f, "reach")),
      engagement: pct(engagement, engagementOf(start - days, start, f)),
      followers: 12,
      published: pct(published, prevPublished),
    },
    platforms: shares.map((s) => ({ platform: s.platform, label: s.label, color: s.color, value: Math.round(reach * s.share) })),
    byType: typeWeights.map(([type, w]) => ({ type, value: Math.round(w * f * (days / 30)) })),
    top,
  };
}
