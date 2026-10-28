import type { ReactNode } from "react";
import { fullText, issuesFor, LIMITS, mediaHints, type Draft } from "../../lib/aiDrafts";
import type { MediaItem, PlatformKey } from "../../types";

const field = "w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400";

/**
 * The editable caption editor for one platform's generated post. Shared by the AI Content page
 * and the AI Planner so both edit generated text the same way.
 */
export function DraftFields({
  platform,
  draft,
  onChange,
  media = [],
  actions,
}: {
  platform: PlatformKey;
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  media?: MediaItem[];
  /** Page-specific buttons shown beside the character counter (copy, regenerate, ...). */
  actions?: ReactNode;
}) {
  const issues = issuesFor(platform, draft);
  const hints = mediaHints(platform, media);
  const len = fullText(draft).length;
  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-slate-600">
        {platform === "youtube" ? "Video title" : "Headline (used as the post title)"}
        <input value={draft.title} onChange={(e) => onChange({ title: e.target.value })} maxLength={platform === "youtube" ? 100 : 150} className={`mt-1 h-9 ${field}`} />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        {platform === "youtube" ? "Description" : "Caption"}
        <textarea value={draft.caption} onChange={(e) => onChange({ caption: e.target.value })} rows={platform === "x" ? 3 : 6} className={`mt-1 py-2 ${field}`} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-600">
          Call to action
          <input value={draft.callToAction} onChange={(e) => onChange({ callToAction: e.target.value })} className={`mt-1 h-9 ${field}`} />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Hashtags
          <input value={draft.hashtags} onChange={(e) => onChange({ hashtags: e.target.value })} className={`mt-1 h-9 ${field}`} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={len > LIMITS[platform] ? "font-semibold text-red-600" : "text-slate-500"}>
          {len.toLocaleString()} / {LIMITS[platform].toLocaleString()} characters
        </span>
        {actions && <span className="ml-auto flex flex-wrap gap-1.5">{actions}</span>}
      </div>
      {issues.length > 0 && (
        <ul className="list-disc rounded-lg bg-red-50 py-2 pl-7 pr-3 text-xs text-red-700">
          {issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
      {hints.length > 0 && (
        <ul className="list-disc rounded-lg bg-amber-50 py-2 pl-7 pr-3 text-xs text-amber-800">
          {hints.map((h) => (
            <li key={h}>{h} You can save a draft, but scheduling will be blocked.</li>
          ))}
        </ul>
      )}
    </div>
  );
}
