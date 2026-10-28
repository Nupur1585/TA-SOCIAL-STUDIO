import { LENGTHS, TONES, type AiSettings } from "../services/aiService";
import type { MediaItem, PlatformKey } from "../types";

export const ALL_PLATFORMS: PlatformKey[] = ["instagram", "facebook", "youtube", "linkedin", "x"];
export const NAMES: Record<PlatformKey, string> = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", linkedin: "LinkedIn", x: "X" };
export const LIMITS: Record<PlatformKey, number> = { instagram: 2200, facebook: 63000, youtube: 5000, linkedin: 3000, x: 280 };

/** The editable text of one generated post. Hashtags are plain space-separated text while editing. */
export interface Draft {
  key: string;
  title: string;
  caption: string;
  callToAction: string;
  hashtags: string;
}

export const parseTags = (raw: string) => [...new Set(raw.split(/[\s,]+/).filter(Boolean).map((t) => (t.startsWith("#") ? t : `#${t}`)))];
export const bodyOf = (d: Draft) => (d.callToAction.trim() ? `${d.caption.trim()}\n\n${d.callToAction.trim()}` : d.caption.trim());
export const fullText = (d: Draft) => {
  const body = bodyOf(d);
  return [body, parseTags(d.hashtags).filter((t) => !body.includes(t)).join(" ")].filter(Boolean).join("\n\n");
};

/** Same limits the server enforces, so problems show while editing. */
export function issuesFor(p: PlatformKey, d: Draft): string[] {
  const out: string[] = [];
  const text = fullText(d);
  if (!d.caption.trim()) out.push("The caption is empty.");
  if (text.length > LIMITS[p]) out.push(`Over the ${LIMITS[p].toLocaleString()}-character limit (${text.length.toLocaleString()}).`);
  if (p === "youtube") {
    if (!d.title.trim()) out.push("A YouTube title is required.");
    if (d.title.length > 100) out.push(`Title is over 100 characters (${d.title.length}).`);
  }
  if (p === "instagram" && parseTags(d.hashtags).length > 30) out.push("Instagram allows at most 30 hashtags.");
  return out;
}

/** Non-blocking: things that would stop scheduling later, given the chosen media. */
export function mediaHints(p: PlatformKey, media: MediaItem[]): string[] {
  const video = media.some((m) => m.mimeType.startsWith("video/"));
  const image = media.some((m) => m.mimeType.startsWith("image/"));
  if (p === "instagram" && media.length !== 1) return ["Instagram needs exactly one image or video."];
  if (p === "instagram" && image && media.some((m) => m.mimeType !== "image/jpeg" && m.mimeType.startsWith("image/"))) return ["Instagram only accepts JPEG images."];
  if (p === "youtube" && !(video && media.length === 1)) return ["YouTube needs exactly one video."];
  if (p === "linkedin" && video) return ["Video posting to LinkedIn is not supported yet."];
  if (p === "x" && media.length > 0) return ["Media on X posts is not supported yet."];
  if ((p === "facebook" || p === "linkedin") && media.length > 1) return [`${NAMES[p]} supports one media file here.`];
  return [];
}

export const SETTINGS_KEY = "ta-ai-settings";
export const DEFAULT_SETTINGS: AiSettings = { purpose: "Promotional post", tone: "Professional", language: "English", length: "Medium", hashtagCount: 5, includeCta: true, variations: 1 };
export const LANGUAGES = ["English", "Hindi", "Gujarati", "Spanish", "French", "German", "Arabic"];

/** Shared by the AI Content and AI Planner pages so tone/language carry over. */
export function loadSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AiSettings>) };
      return {
        ...s,
        tone: TONES.includes(s.tone) ? s.tone : DEFAULT_SETTINGS.tone,
        length: LENGTHS.includes(s.length) ? s.length : DEFAULT_SETTINGS.length,
      };
    }
  } catch {
    // Storage can be unavailable; defaults are fine.
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: AiSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Not critical.
  }
}
