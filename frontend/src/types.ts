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
