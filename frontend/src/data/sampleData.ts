/**
 * TEMPORARY SAMPLE DATA.
 * The backend currently exposes no Brand, Content, Analytics or Activity
 * endpoints. Everything here is demonstration data and should be replaced
 * by API calls (via services/api.ts) once those endpoints exist.
 */
import type {
  ActivityItem,
  Brand,
  PlatformKey,
  UpcomingContentItem,
} from "../types";

export const sampleBrands: Brand[] = [
  {
    id: "brd-001",
    brandId: "BRD-001",
    name: "Tech Amdavad",
    initials: "TA",
    tagline: "Technology · Innovation · Growth",
    description:
      "Tech Amdavad is a technology and digital solutions brand focused on innovation and growth.",
    timezone: "Asia/Kolkata (IST)",
    assignedUsers: 2,
    hashtags: ["#TechAmdavad", "#Innovation", "#Digital"],
    platforms: ["instagram", "facebook", "youtube", "linkedin", "x"],
    status: "Active",
    assetCount: 5,
    guidelinesUpdated: "2 days ago",
    bannerClass: "from-slate-700 via-slate-500 to-sky-300",
    logoClass: "from-indigo-700 to-violet-600",
  },
  {
    id: "brd-002",
    brandId: "BRD-002",
    name: "Nirvikalp Yoga Academy",
    initials: "NY",
    tagline: "Mind · Body · Balance",
    description:
      "Nirvikalp Yoga Academy offers transformative yoga and wellness programs for a healthier life.",
    timezone: "Asia/Kolkata (IST)",
    assignedUsers: 1,
    hashtags: ["#Yoga", "#Wellness", "#Nirvikalp"],
    platforms: ["instagram", "facebook", "youtube", "linkedin"],
    status: "Active",
    assetCount: 3,
    guidelinesUpdated: "5 days ago",
    bannerClass: "from-orange-300 via-rose-200 to-amber-100",
    logoClass: "from-teal-500 to-emerald-400",
  },
];

export const contentOverviewData = [
  { date: "Sep 25", posts: 14, reels: 8, stories: 4, others: 3 },
  { date: "Sep 28", posts: 17, reels: 9, stories: 5, others: 4 },
  { date: "Oct 1", posts: 15, reels: 10, stories: 7, others: 3 },
  { date: "Oct 4", posts: 20, reels: 11, stories: 6, others: 5 },
  { date: "Oct 7", posts: 25, reels: 12, stories: 8, others: 4 },
  { date: "Oct 10", posts: 23, reels: 13, stories: 7, others: 6 },
  { date: "Oct 13", posts: 28, reels: 14, stories: 9, others: 5 },
  { date: "Oct 16", posts: 27, reels: 15, stories: 8, others: 7 },
  { date: "Oct 19", posts: 31, reels: 17, stories: 10, others: 6 },
  { date: "Oct 22", posts: 35, reels: 22, stories: 12, others: 8 },
];

export const platformDistribution: {
  platform: PlatformKey;
  label: string;
  value: number;
  color: string;
}[] = [
  { platform: "instagram", label: "Instagram", value: 45, color: "#e1306c" },
  { platform: "facebook", label: "Facebook", value: 30, color: "#2563eb" },
  { platform: "linkedin", label: "LinkedIn", value: 15, color: "#7c3aed" },
  { platform: "youtube", label: "YouTube", value: 10, color: "#ef4444" },
];

export const totalPosts = 128;

export const upcomingContent: UpcomingContentItem[] = [
  {
    id: "c1",
    title: "Summer Campaign",
    brand: "Tech Amdavad",
    platforms: ["instagram", "facebook"],
    date: "Tomorrow",
    time: "10:00 AM",
    status: "Ready",
    thumbClass: "from-orange-400 to-sky-700",
  },
  {
    id: "c2",
    title: "Yoga Tips #12",
    brand: "Nirvikalp Yoga Academy",
    platforms: ["youtube"],
    date: "Oct 10",
    time: "04:00 PM",
    status: "Scheduled",
    thumbClass: "from-amber-300 to-slate-800",
  },
  {
    id: "c3",
    title: "New Service Launch",
    brand: "Tech Amdavad",
    platforms: ["facebook", "linkedin"],
    date: "Oct 11",
    time: "11:00 AM",
    status: "Pending",
    thumbClass: "from-stone-300 to-stone-600",
  },
];

export const recentActivity: ActivityItem[] = [
  {
    id: "a1",
    kind: "approved",
    title: "Content approved",
    description: "Yoga Tips #11 by Nirvikalp Yoga Academy",
    time: "2 hours ago",
  },
  {
    id: "a2",
    kind: "uploaded",
    title: "Media uploaded",
    description: "3 new images added to Media Library",
    time: "4 hours ago",
  },
  {
    id: "a3",
    kind: "scheduled",
    title: "Content scheduled",
    description: "Summer Campaign by Tech Amdavad",
    time: "6 hours ago",
  },
  {
    id: "a4",
    kind: "brand",
    title: "New brand added",
    description: "Nirvikalp Yoga Academy",
    time: "1 day ago",
  },
];

export const dashboardStats = {
  totalContent: 128,
  contentGrowth: "12%",
  upcomingContent: 24,
  upcomingThisWeek: 8,
  pendingApproval: 7,
};

export const timezones = [
  "Asia/Kolkata (IST)",
  "UTC",
  "America/New_York (EST)",
  "Europe/London (GMT)",
  "Asia/Dubai (GST)",
  "Asia/Singapore (SGT)",
];

/** Temporary admin presentation data until real user data is wired in. */
export const sampleAdmin = { name: "Admin" };
