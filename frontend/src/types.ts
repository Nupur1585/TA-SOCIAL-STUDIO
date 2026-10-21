export type PlatformKey =
  | "instagram"
  | "facebook"
  | "youtube"
  | "linkedin"
  | "x";

export type BrandStatus = "Active" | "Inactive";

export interface Brand {
  id: string;
  brandId: string;
  name: string;
  initials: string;
  tagline: string;
  description: string;
  timezone: string;
  assignedUsers: number;
  hashtags: string[];
  platforms: PlatformKey[];
  status: BrandStatus;
  assetCount: number;
  guidelinesUpdated: string;
  /** Tailwind gradient classes used for banner and logo (no image assets exist yet). */
  bannerClass: string;
  logoClass: string;
}

export type ContentStatus = "Ready" | "Scheduled" | "Pending";

export interface UpcomingContentItem {
  id: string;
  title: string;
  brand: string;
  platforms: PlatformKey[];
  date: string;
  time: string;
  status: ContentStatus;
  thumbClass: string;
}

export interface ActivityItem {
  id: string;
  kind: "approved" | "uploaded" | "scheduled" | "brand";
  title: string;
  description: string;
  time: string;
}

export type MediaKind = "Image" | "Video" | "Reel" | "Short" | "Carousel";

export interface MediaItem {
  id: string;
  title: string;
  kind: MediaKind;
  brandId: string;
  platforms: PlatformKey[];
  /** ISO date string. */
  createdAt: string;
  /** Seconds, videos only. */
  duration: number | null;
  mimeType: string;
  size: number;
  /** True for items from data/demoMedia.ts: they have no file behind them. */
  demo?: boolean;
  thumbClass?: string;
}

export type ContentType = "Image" | "Reel" | "Carousel" | "Video" | "Short" | "Text";

export type ContentWorkflowStatus =
  | "Draft"
  | "Pending Approval"
  | "Approved"
  | "Scheduled"
  | "Published"
  | "Rejected";

export interface ContentItem {
  id: string;
  title: string;
  caption: string;
  hashtags: string[];
  brandId: string;
  platforms: PlatformKey[];
  type: ContentType;
  status: ContentWorkflowStatus;
  scheduledAt: string | null;
  createdAt: string;
  mediaIds: string[];
  /** True for items from data/demoContent.ts: they exist only in the browser. */
  demo?: boolean;
  thumbClass?: string;
  /** Video length in seconds, shown on demo video cards. */
  duration?: number | null;
}
