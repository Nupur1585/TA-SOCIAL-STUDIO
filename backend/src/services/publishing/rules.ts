import type { PlatformKey } from "../../models/Media.js";
import { publicBaseIsReachable } from "./mediaUrl.js";

export interface MediaInfo {
  id: string;
  kind: string;
  mimeType: string;
  size: number;
  duration: number | null;
}

export interface PostInfo {
  title: string;
  /** Caption plus hashtags, exactly as it will be posted. */
  text: string;
  media: MediaInfo[];
}

const isImage = (m: MediaInfo) => m.mimeType.startsWith("image/");
const isVideo = (m: MediaInfo) => m.mimeType.startsWith("video/");

/**
 * What each platform's official API lets this app post today.
 * Returns human-readable problems; an empty list means the post can be attempted.
 * These are checked when scheduling, on "publish now", and again by the scheduler.
 */
export function validateForPlatform(platform: PlatformKey, post: PostInfo): string[] {
  const issues: string[] = [];
  const { media, text } = post;
  const images = media.filter(isImage);
  const videos = media.filter(isVideo);
  const need = (cond: boolean, msg: string) => {
    if (!cond) issues.push(msg);
  };

  switch (platform) {
    case "instagram":
      need(media.length === 1, "Instagram posts need exactly one image or video (carousels are not supported yet).");
      need(images.every((m) => m.mimeType === "image/jpeg"), "Instagram only accepts JPEG images through its API. Convert PNG/WEBP/GIF files.");
      need(media.every((m) => m.kind !== "Carousel"), "Carousel posts are not supported yet.");
      need(text.length <= 2200, "Instagram captions are limited to 2,200 characters.");
      need(publicBaseIsReachable(), "Instagram must download the media from a public HTTPS address. Set PUBLIC_BASE_URL on the server to a reachable URL (not localhost).");
      break;
    case "facebook":
      need(media.length <= 1, "Facebook posts support one image or video here.");
      need(media.length > 0 || text.trim().length > 0, "Add a caption or one image/video.");
      need(text.length <= 63000, "The caption is too long for Facebook.");
      break;
    case "youtube":
      need(videos.length === 1 && media.length === 1, "YouTube posts need exactly one video file.");
      need(post.title.trim().length > 0 && post.title.length <= 100, "YouTube titles must be 1–100 characters.");
      need(text.length <= 5000, "YouTube descriptions are limited to 5,000 characters.");
      break;
    case "linkedin":
      need(text.trim().length > 0, "LinkedIn posts need text.");
      need(videos.length === 0, "Video posting to LinkedIn is not supported yet.");
      need(images.length <= 1, "LinkedIn posts support one image here.");
      need(text.length <= 3000, "LinkedIn posts are limited to 3,000 characters.");
      break;
    case "x":
      need(text.trim().length > 0, "X posts need text.");
      need(media.length === 0, "Attaching media to X posts is not supported yet (it needs the media.write permission).");
      need(text.length <= 280, `X posts are limited to 280 characters (this one is ${text.length}).`);
      break;
  }
  return issues;
}

/** Caption and hashtags merged the way every platform sees them. */
export function composeText(caption: string, hashtags: string[]): string {
  const tags = hashtags.filter((t) => !caption.includes(t)).join(" ");
  return [caption.trim(), tags].filter(Boolean).join("\n\n");
}
