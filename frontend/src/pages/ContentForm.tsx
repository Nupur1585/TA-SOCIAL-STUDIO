import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ImagePlus, Loader2, X } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MediaPicker } from "../components/media/MediaPicker";
import { Notice } from "../components/ui/ListControls";
import { PlatformIcon } from "../components/ui/PlatformIcon";
import { StatusBadge, type BadgeTone } from "../components/ui/StatusBadge";
import { useBrands } from "../context/BrandsContext";
import { toLocalInput } from "../lib/format";
import {
  apiProblems,
  changeContentStatus,
  createContent,
  getContent,
  updateContent,
  type ContentInput,
} from "../services/contentService";
import { apiErrorMessage, getMedia, mediaFileUrl } from "../services/mediaService";
import { listAccounts, type SocialAccount, type SocialStatus } from "../services/socialService";
import type { ContentType, ContentWorkflowStatus, PlatformKey } from "../types";

const TYPES: ContentType[] = ["Image", "Reel", "Carousel", "Video", "Short", "Text"];
const VIDEO_TYPES: ContentType[] = ["Video", "Reel", "Short"];
const ALL_PLATFORMS: PlatformKey[] = ["instagram", "facebook", "youtube", "linkedin", "x"];
const LIMITS: Record<PlatformKey, number> = { instagram: 2200, facebook: 63000, youtube: 5000, linkedin: 3000, x: 280 };
const NAMES: Record<PlatformKey, string> = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", linkedin: "LinkedIn", x: "X" };
const statusTone: Record<SocialStatus, BadgeTone> = { Connected: "green", Expired: "orange", Disconnected: "gray", Error: "red" };

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
  const [intent, setIntent] = useState<PlatformKey[]>([]);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [type, setType] = useState<ContentType>("Image");
  const [scheduledAt, setScheduledAt] = useState("");
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [status, setStatus] = useState<ContentWorkflowStatus | null>(null);
  const [picking, setPicking] = useState(false);

  const [loading, setLoading] = useState(editing || params.has("mediaId"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const brand = brands.find((b) => b.id === brandId);
  // Brands load asynchronously; adopt the selected brand once it is known.
  useEffect(() => {
    if (!brandId && selectedBrandId) setBrandId(selectedBrandId);
  }, [brandId, selectedBrandId]);

  // Connected accounts of the chosen brand (names and status only; tokens never reach the browser).
  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    setAccountsLoading(true);
    listAccounts(brandId)
      .then((a) => !cancelled && setAccounts(a.filter((x) => x.status !== "Disconnected")))
      .catch(() => !cancelled && setAccounts([]))
      .finally(() => !cancelled && setAccountsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [brandId]);

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
          setIntent(c.platforms);
          setAccountIds(c.targets.map((t) => t.socialAccountId));
          setType(c.type);
          setStatus(c.status);
          setScheduledAt(toLocalInput(c.scheduledAt));
          setMediaIds(c.mediaIds);
        } else if (mediaId) {
          const m = await getMedia(mediaId);
          if (cancelled) return;
          setMediaIds([m.id]);
          setBrandId(m.brandId);
          setType(m.kind);
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

  const selectedAccounts = accounts.filter((a) => accountIds.includes(a.id));
  const platforms = useMemo(
    () => (selectedAccounts.length ? [...new Set(selectedAccounts.map((a) => a.platform))] : intent),
    [selectedAccounts, intent],
  );
  const fullText = [caption.trim(), parseHashtags(hashtags).filter((t) => !caption.includes(t)).join(" ")].filter(Boolean).join("\n\n");

  const toggleAccount = (a: SocialAccount) =>
    setAccountIds((prev) => (prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]));
  const toggleIntent = (p: PlatformKey) => setIntent((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const fail = (e: unknown, fallback: string) => {
    setError(apiErrorMessage(e, fallback));
    setProblems(apiProblems(e));
    setSaving(false);
  };

  /** mode: draft = keep status, schedule = then schedule, approval = then submit for approval. */
  const save = async (mode: "draft" | "schedule" | "approval") => {
    setError(null);
    setProblems([]);
    if (!brandId) return setError("Create a brand on the Brands page first.");
    if (!title.trim()) return setError("Enter a title.");
    if (platforms.length === 0) return setError("Choose at least one connected account (or a platform for the draft).");
    if (mode === "approval" && type !== "Text" && mediaIds.length === 0) return setError("Attach media before submitting for approval.");
    const when = scheduledAt ? new Date(scheduledAt) : null;
    if (when && Number.isNaN(when.getTime())) return setError("Enter a valid schedule date.");
    if (mode === "schedule") {
      if (selectedAccounts.length === 0) return setError("Choose at least one connected account to schedule.");
      if (!when || when.getTime() <= Date.now() + 60_000) return setError("Choose a date and time in the future to schedule.");
    }

    const input: ContentInput = {
      title: title.trim(),
      caption,
      hashtags: parseHashtags(hashtags),
      brandId,
      platforms,
      accountIds: selectedAccounts.map((a) => a.id),
      type,
      scheduledAt: when ? when.toISOString() : null,
      mediaIds,
    };
    setSaving(true);
    let savedId: string;
    try {
      const saved = id ? await updateContent(id, input) : await createContent(input);
      savedId = saved.id;
    } catch (e) {
      return fail(e, "Could not save this post. Check that the backend is running.");
    }
    try {
      if (mode === "schedule") await changeContentStatus(savedId, "Scheduled", when!.toISOString());
      if (mode === "approval") await changeContentStatus(savedId, "Pending Approval");
    } catch (e) {
      // The post itself is saved; only the extra step failed.
      setSaving(false);
      setError(`Saved, but it could not be ${mode === "schedule" ? "scheduled" : "submitted"}: ${apiErrorMessage(e, "unknown error")}`);
      setProblems(apiProblems(e));
      if (!id) navigate(`/content/${savedId}/edit`, { replace: true });
      return;
    }
    navigate(mode === "approval" ? "/content?status=Pending%20Approval" : mode === "schedule" ? "/content?status=Scheduled" : "/content");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" /> Loading…
      </div>
    );
  }

  const canSchedule = !status || ["Draft", "Failed", "Cancelled"].includes(status);
  const canApproval = !status || ["Draft", "Rejected"].includes(status);
  const isScheduled = status === "Scheduled";
  const previewMedia = mediaIds[0];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <Link to="/content" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={15} /> Back to Content
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{editing ? "Edit Content" : "Create Content"}</h1>
        <p className="mt-2 text-sm text-slate-500">
          Save a draft, or pick connected accounts and a time to schedule it. Posts are published by the server at the scheduled time.
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5 rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <label className="block text-sm font-medium text-slate-700">
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} className={`mt-1 h-10 ${fieldCls}`} />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Caption
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={5000} rows={5} className={`mt-1 py-2 ${fieldCls}`} />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Hashtags
            <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#Yoga #Wellness" className={`mt-1 h-10 ${fieldCls}`} />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium text-slate-700">
              Brand
              <select
                value={brandId}
                disabled={editing && status !== "Draft"}
                onChange={(e) => {
                  setBrandId(e.target.value);
                  // Media and accounts belong to the previous brand.
                  setMediaIds([]);
                  setAccountIds([]);
                  setIntent([]);
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
              Publish at
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={`mt-1 h-10 ${fieldCls}`} />
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Publish to</legend>
            {accountsLoading ? (
              <p className="mt-2 text-sm text-slate-500">Loading connected accounts…</p>
            ) : accounts.length === 0 ? (
              <div className="mt-2 space-y-3">
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  No social accounts are connected to {brand?.name ?? "this brand"} yet. You can save a draft for a platform now, but publishing needs a connected account.{" "}
                  <Link to="/brands" className="font-medium underline">
                    Connect accounts
                  </Link>
                </p>
                <div className="flex flex-wrap gap-2">
                  {ALL_PLATFORMS.map((p) => (
                    <label
                      key={p}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium ${
                        intent.includes(p) ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"
                      }`}
                    >
                      <input type="checkbox" className="sr-only" checked={intent.includes(p)} onChange={() => toggleIntent(p)} />
                      {NAMES[p]}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {accounts.map((a) => (
                  <li key={a.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
                      <input type="checkbox" checked={accountIds.includes(a.id)} onChange={() => toggleAccount(a)} />
                      <PlatformIcon platform={a.platform} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">{a.displayName || a.username}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {NAMES[a.platform]}
                          {a.username && ` · @${a.username.replace(/^@/, "")}`}
                        </span>
                      </span>
                      <StatusBadge status={a.status} tone={statusTone[a.status]} />
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {selectedAccounts.some((a) => a.status !== "Connected") && (
              <p className="mt-2 text-xs text-amber-700">A selected account needs reconnecting (Brands → Social accounts) before this post can be published.</p>
            )}
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
                        <video src={`${mediaFileUrl(mid)}#t=0.5`} preload="metadata" muted crossOrigin="use-credentials" className="aspect-square w-full rounded-lg bg-slate-100 object-cover" />
                      ) : (
                        <img src={mediaFileUrl(mid)} alt="Attached media" crossOrigin="use-credentials" className="aspect-square w-full rounded-lg bg-slate-100 object-cover" />
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

          {error && (
            <Notice tone="error">
              <p>{error}</p>
              {problems.length > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
            </Notice>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <Link to="/content" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </Link>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save("draft")}
              className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-60"
            >
              {saving ? "Saving…" : isScheduled || status === "Failed" ? "Save changes" : "Save as draft"}
            </button>
            {canApproval && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void save("approval")}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Submit for approval
              </button>
            )}
            {canSchedule && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void save("schedule")}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Schedule
              </button>
            )}
          </div>
        </div>

        <aside className="space-y-3 rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm lg:sticky lg:top-24">
          <h2 className="text-sm font-semibold text-slate-900">Preview</h2>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            {previewMedia && type !== "Text" ? (
              VIDEO_TYPES.includes(type) ? (
                <video src={`${mediaFileUrl(previewMedia)}#t=0.5`} preload="metadata" muted crossOrigin="use-credentials" className="aspect-video w-full bg-slate-100 object-cover" />
              ) : (
                <img src={mediaFileUrl(previewMedia)} alt="" crossOrigin="use-credentials" className="aspect-video w-full bg-slate-100 object-cover" />
              )
            ) : (
              <div className="flex aspect-video items-center justify-center bg-slate-50 text-xs text-slate-400">{type === "Text" ? "Text post" : "No media"}</div>
            )}
            <div className="space-y-1 p-3">
              <p className="text-xs font-semibold text-slate-700">{brand?.name ?? "Brand"}</p>
              <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{fullText || "Your caption will appear here."}</p>
            </div>
          </div>
          {platforms.length > 0 && (
            <ul className="space-y-1 text-xs">
              {platforms.map((p) => {
                const over = fullText.length > LIMITS[p];
                return (
                  <li key={p} className="flex items-center gap-2">
                    <PlatformIcon platform={p} size="xs" />
                    <span className="flex-1 text-slate-600">{NAMES[p]}</span>
                    <span className={over ? "font-semibold text-red-600" : "text-slate-500"}>
                      {fullText.length.toLocaleString()} / {LIMITS[p].toLocaleString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-slate-500">
            Platform limits: Instagram needs one JPEG image or a video; YouTube needs one video; LinkedIn takes text and one image; X takes text only; Facebook takes text and one image or video.
          </p>
        </aside>
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
