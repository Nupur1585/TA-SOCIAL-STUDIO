/**
 * DEMONSTRATION DATA ONLY.
 * Shown by the Media Library while the backend has no uploaded media, so the
 * layout can be reviewed. These items have no file behind them: they cannot be
 * downloaded, deleted or attached to content. Never mixed with API results.
 */
import type { MediaItem, MediaKind, PlatformKey } from "../types";
import { remapBrands } from "./demoBrands";

const TA = "brd-001";
const NY = "brd-002";

const m = (
  n: number,
  title: string,
  kind: MediaKind,
  brandId: string,
  platforms: PlatformKey[],
  day: string,
  thumbClass: string,
  duration: number | null = null,
): MediaItem => ({
  id: `demo-media-${n}`,
  title,
  kind,
  brandId,
  platforms,
  createdAt: `2026-${day}T10:00:00.000Z`,
  duration,
  mimeType: duration ? "video/mp4" : "image/jpeg",
  size: 0,
  demo: true,
  thumbClass,
});

const rawDemoMedia: MediaItem[] = [
  m(1, "Ahmedabad Cityscape", "Image", TA, ["instagram", "facebook", "linkedin"], "10-10", "from-sky-500 via-teal-400 to-emerald-700"),
  m(2, "Work From Anywhere", "Image", TA, ["instagram", "facebook", "linkedin"], "10-09", "from-stone-200 via-stone-300 to-emerald-300"),
  m(3, "Yoga Session", "Video", NY, ["youtube", "instagram"], "10-08", "from-orange-500 via-amber-400 to-slate-800", 94),
  m(4, "Nature's Vibes", "Image", TA, ["instagram", "facebook", "linkedin"], "10-07", "from-green-800 via-emerald-500 to-lime-300"),
  m(5, "Behind the Scenes", "Reel", NY, ["youtube", "instagram", "linkedin"], "10-05", "from-rose-600 via-orange-400 to-slate-800", 45),
  m(6, "Motivational Quote", "Image", NY, ["youtube", "instagram", "linkedin"], "10-04", "from-pink-100 via-rose-100 to-sky-200"),
  m(7, "Productivity Tips", "Carousel", TA, ["instagram", "facebook", "linkedin"], "10-03", "from-stone-300 via-stone-400 to-slate-600"),
  m(8, "Brand Story", "Video", TA, ["youtube", "instagram", "linkedin"], "10-02", "from-slate-900 via-slate-700 to-amber-700", 55),
  m(9, "Peace & Balance", "Image", NY, ["youtube", "instagram", "linkedin"], "10-01", "from-orange-600 via-amber-500 to-slate-900"),
  m(10, "Yoga Community", "Image", NY, ["instagram", "facebook", "linkedin"], "09-30", "from-amber-200 via-orange-200 to-teal-600"),
  m(11, "Team Workspace", "Image", TA, ["instagram", "facebook", "linkedin"], "09-29", "from-amber-100 via-stone-200 to-emerald-400"),
  m(12, "Ocean Waves", "Video", TA, ["youtube", "instagram"], "09-28", "from-teal-700 via-cyan-500 to-sky-200", 32),
  m(13, "City Lights", "Image", TA, ["instagram", "facebook", "linkedin"], "09-27", "from-indigo-900 via-blue-700 to-orange-400"),
  m(14, "Coffee Moments", "Short", NY, ["instagram", "facebook", "linkedin"], "09-26", "from-stone-100 via-stone-300 to-amber-900", 18),
];

export const buildDemoMedia = (brandIds: string[]) => remapBrands(rawDemoMedia, brandIds);
