/**
 * DEMONSTRATION DATA ONLY.
 * Shown by the Content page while the backend has no content records, so the
 * layout can be reviewed. Items exist only in the browser and are read-only.
 * Never mixed with API results.
 */
import type { ContentItem, ContentType, ContentWorkflowStatus, PlatformKey } from "../types";
import { remapBrands } from "./demoBrands";

const TA = "brd-001";
const NY = "brd-002";

const c = (
  n: number,
  title: string,
  caption: string,
  hashtags: string[],
  brandId: string,
  platforms: PlatformKey[],
  type: ContentType,
  status: ContentWorkflowStatus,
  scheduledAt: string,
  thumbClass: string,
  duration: number | null = null,
): ContentItem => ({
  id: `demo-content-${n}`,
  title,
  caption,
  hashtags,
  brandId,
  platforms,
  type,
  status,
  scheduledAt,
  createdAt: scheduledAt,
  mediaIds: [],
  targets: [],
  demo: true,
  thumbClass,
  duration,
});

const rawDemoContent: ContentItem[] = [
  c(1, "Discover the beauty of Amdavad", "Heritage, culture and modern vibes — all in one city.", ["#Amdavad", "#Heritage", "#Travel"], TA, ["instagram", "facebook", "linkedin", "youtube"], "Image", "Approved", "2026-10-10T10:00:00+05:30", "from-orange-500 via-amber-400 to-slate-700"),
  c(2, "Daily Yoga Tips #12", "Small steps, big changes.", ["#Yoga", "#Wellness", "#Nirvikalp"], NY, ["instagram", "youtube", "linkedin"], "Reel", "Scheduled", "2026-10-10T16:00:00+05:30", "from-orange-600 via-amber-500 to-slate-900"),
  c(3, "5 Ways to Boost Your Productivity", "Better habits. Bigger dreams.", ["#Productivity", "#Tips", "#Tech"], TA, ["instagram", "facebook", "linkedin", "youtube"], "Carousel", "Pending Approval", "2026-10-11T11:00:00+05:30", "from-stone-200 via-stone-400 to-slate-700"),
  c(4, "Exploring Gujarat | Travel Vlog", "From ancient temples to modern cities…", ["#Gujarat", "#Travel", "#Explore"], TA, ["instagram", "facebook", "youtube"], "Video", "Draft", "2026-10-12T18:00:00+05:30", "from-amber-500 via-orange-400 to-sky-700", 45),
  c(5, "Your Growth, Our Strategy", "Digital solutions for a better tomorrow.", ["#DigitalMarketing", "#Strategy", "#Business"], TA, ["linkedin", "facebook", "instagram"], "Image", "Approved", "2026-10-13T09:00:00+05:30", "from-indigo-900 via-violet-700 to-slate-600"),
  c(6, "Mindful Living", "A calmer mind, a happier you.", ["#Mindfulness", "#Yoga", "#Nirvikalp"], NY, ["instagram", "youtube", "linkedin"], "Short", "Scheduled", "2026-10-14T15:00:00+05:30", "from-orange-600 via-amber-500 to-slate-900", 30),
  c(7, "The Future is Digital", "Stay ahead. Stay creative. Stay connected.", ["#Digital", "#Innovation", "#TA"], TA, ["linkedin", "facebook", "instagram"], "Text", "Rejected", "2026-10-15T10:00:00+05:30", "from-stone-200 via-stone-300 to-stone-500"),
  c(8, "Nirvikalp Yoga Academy", "Yoga for a balanced life.", ["#Yoga", "#Wellness", "#Nirvikalp"], NY, ["instagram", "facebook", "youtube"], "Image", "Approved", "2026-10-16T17:00:00+05:30", "from-sky-700 via-blue-500 to-amber-300"),
];

export const buildDemoContent = (brandIds: string[]) => remapBrands(rawDemoContent, brandIds);
