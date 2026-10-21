import { useEffect, useState } from "react";
import { ArrowLeft, ImagePlus, Loader2, X } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MediaPicker } from "../components/media/MediaPicker";
import { Notice } from "../components/ui/ListControls";
import { useBrands } from "../context/BrandsContext";
import { toLocalInput } from "../lib/format";
import {
  changeContentStatus,
  createContent,
  getContent,
  updateContent,
  type ContentInput,
} from "../services/contentService";
import { apiErrorMessage, getMedia, mediaFileUrl } from "../services/mediaService";
import type { ContentType, PlatformKey } from "../types";

const TYPES: ContentType[] = ["Image", "Reel", "Carousel", "Video", "Short", "Text"];
const VIDEO_TYPES: ContentType[] = ["Video", "Reel", "Short"];
const ALL_PLATFORMS: PlatformKey[] = ["instagram", "facebook", "youtube", "linkedin", "x"];

const fieldCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400";

const parseHashtags = (raw: string) =>
  Array.from(new Set(raw.split(/[\s,]+/).filter(Boolean).map((t) => (t.startsWith("#") ? t : `#${t}`))));

export default function ContentForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { brands, selectedBrandId } = useBrands();

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [brandId, setBrandId] = useState(selectedBrandId);
  const [platforms, setPlatforms] = useState<PlatformKey[]>([]);
  const [type, setType] = useState<ContentType>("Image");
  const [scheduledAt, setScheduledAt] = useState("");
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);

  const [loading, setLoading] = useState(editing || params.has("mediaId"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brand = brands.find((b) => b.id === brandId);

  // Load the record being edited, or the media chosen with "Use in content".
  useEffect(() => {
    const mediaId = params.get("mediaId");
    let cancelled = false;
    const load = async () => {
      try {
        if (id) {
          const c = await getContent(id);
          if (cancelled) return;
          setTitle(c.title);
          setCaption(c.caption);
          setHashtags(c.hashtags.join(" "));
          setBrandId(c.brandId);
          setPlatforms(c.platforms);
          setType(c.type);
          setScheduledAt(toLocalInput(c.scheduledAt));
          setMediaIds(c.mediaIds);
        } else if (mediaId) {
          const m = await getMedia(mediaId);
          if (cancelled) return;
          setMediaIds([m.id]);
          setBrandId(m.brandId);
          setType(m.kind);
          setPlatforms(m.platforms);
          setTitle(m.title);
        }
      } catch (e) {
        if (!cancelled) setError(apiErrorMessage(e, "Could not load the requested item."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (id || mediaId) void load();
    return () => {
      cancelled = true;
    };
  }, [id, params]);

  const togglePlatform = (p: PlatformKey) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const save = async (submitForApproval: boolean) => {
    if (!title.trim()) return setError("Enter a title.");
    if (platforms.length === 0) return setError("Select at least one platform.");
    if (submitForApproval && type !== "Text" && mediaIds.length === 0) {
      return setError("Attach media before submitting for approval.");
    }
    const when = scheduledAt ? new Date(scheduledAt) : null;
    if (when && Number.isNaN(when.getTime())) return setError("Enter a valid schedule date.");

    const input: ContentInput = {
      title: title.trim(),
      caption,
      hashtags: parseHashtags(hashtags),
      brandId,
      platforms,
      type,
      scheduledAt: when ? when.toISOString() : null,
      mediaIds,
    };
    setError(null);
    setSaving(true);
    try {
      const saved = id ? await updateContent(id, input) : await createContent(input);
      if (submitForApproval) await changeContentStatus(saved.id, "Pending Approval");
      navigate(submitForApproval ? "/content?status=Pending%20Approval" : "/content");
    } catch (e) {
      setError(apiErrorMessage(e, "Could not save this content. Check that the backend is running."));
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link to="/content" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} /> Back to Content
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {editing ? "Edit Content" : "Create Content"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Content is saved as a draft. Submit it for approval when it is ready.
        </p>
      </div>

      <div className="space-y-5 rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} className={`mt-1 h-10 ${fieldCls}`} />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Caption
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={2200}
            rows={4}
            className={`mt-1 py-2 ${fieldCls}`}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Hashtags
          <input
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#Yoga #Wellness"
            className={`mt-1 h-10 ${fieldCls}`}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium text-slate-700">
            Brand
            <select
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                // Media and platforms belong to the previous brand.
                setMediaIds([]);
                setPlatforms([]);
              }}
              className={`mt-1 h-10 ${fieldCls}`}
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Content type
            <select value={type} onChange={(e) => setType(e.target.value as ContentType)} className={`mt-1 h-10 ${fieldCls}`}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Schedule (optional)
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={`mt-1 h-10 ${fieldCls}`}
            />
          </label>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Platforms</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALL_PLATFORMS.filter((p) => brand?.platforms.includes(p)).map((p) => {
              const on = platforms.includes(p);
              return (
                <label
                  key={p}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${
                    on ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"
                  }`}
                >
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => togglePlatform(p)} />
                  {p === "x" ? "X" : p}
                </label>
              );
            })}
          </div>
        </fieldset>

        {type !== "Text" && (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Media</span>
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <ImagePlus size={16} /> Choose from Media Library
              </button>
            </div>
            {mediaIds.length > 0 ? (
              <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {mediaIds.map((mid) => (
                  <li key={mid} className="relative">
                    {VIDEO_TYPES.includes(type) ? (
                      <video
                        src={`${mediaFileUrl(mid)}#t=0.5`}
                        preload="metadata"
                        muted
                        crossOrigin="use-credentials"
                        className="aspect-square w-full rounded-lg bg-slate-100 object-cover"
                      />
                    ) : (
                      <img
                        src={mediaFileUrl(mid)}
                        alt="Attached media"
                        crossOrigin="use-credentials"
                        className="aspect-square w-full rounded-lg bg-slate-100 object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setMediaIds((prev) => prev.filter((x) => x !== mid))}
                      aria-label="Remove media"
                      className="absolute right-1 top-1 rounded-full bg-white p-1 text-slate-700 shadow hover:bg-slate-100"
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No media attached.</p>
            )}
          </div>
        )}

        {error && <Notice tone="error">{error}</Notice>}

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <Link
            to="/content"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(false)}
            className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save as draft"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Save &amp; submit for approval
          </button>
        </div>
      </div>

      {picking && (
        <MediaPicker
          brandId={brandId}
          selectedIds={mediaIds}
          onClose={() => setPicking(false)}
          onConfirm={(ids) => {
            setMediaIds(ids);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}
