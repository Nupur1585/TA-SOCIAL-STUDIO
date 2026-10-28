import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, History, ImagePlus, Loader2, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { AIHistoryModal } from "../components/ai/AIHistoryModal";
import { MediaPicker } from "../components/media/MediaPicker";
import { Notice } from "../components/ui/ListControls";
import { PageHeader } from "../components/ui/PageHeader";
import { PlatformIcon } from "../components/ui/PlatformIcon";
import { useBrands } from "../context/BrandsContext";
import {
  generate,
  getAiStatus,
  LENGTHS,
  PURPOSES,
  TONES,
  type AiGeneration,
  type AiSettings,
} from "../services/aiService";
import { apiFullMessage, changeContentStatus, createContent, updateContent, type ContentInput } from "../services/contentService";
import { getMedia, mediaFileUrl } from "../services/mediaService";
import { listAccounts, type SocialAccount } from "../services/socialService";
import { DraftFields } from "../components/ai/DraftFields";
import { ALL_PLATFORMS as ALL, LANGUAGES, NAMES, bodyOf, fullText, issuesFor, loadSettings, parseTags, saveSettings, type Draft } from "../lib/aiDrafts";
import type { ContentType, MediaItem, PlatformKey } from "../types";

const field = "w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400";
const card = "rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm";

interface Group {
  variations: Draft[];
  selected: number;
  include: boolean;
  savedId?: string;
}
type Groups = Partial<Record<PlatformKey, Group>>;
interface SaveResult {
  platform: PlatformKey;
  id?: string;
  status: "Draft" | "Scheduled";
  error?: string;
}

export default function AIContent() {
  const { brands, selectedBrandId } = useBrands();
  const [brandId, setBrandId] = useState(selectedBrandId);
  const [platforms, setPlatforms] = useState<PlatformKey[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [accountSel, setAccountSel] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [settings, setSettings] = useState<AiSettings>(loadSettings);
  const [groups, setGroups] = useState<Groups>({});
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [history, setHistory] = useState(false);
  const [ai, setAi] = useState<{ configured: boolean; model: string | null } | null>(null);
  const [generating, setGenerating] = useState<PlatformKey | "all" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [results, setResults] = useState<SaveResult[]>([]);
  const counter = useRef(0);

  const brand = brands.find((b) => b.id === brandId);
  useEffect(() => {
    if (!brandId && selectedBrandId) setBrandId(selectedBrandId);
  }, [brandId, selectedBrandId]);

  useEffect(() => {
    getAiStatus().then(setAi).catch(() => setAi({ configured: false, model: null }));
  }, []);

  useEffect(() => saveSettings(settings), [settings]);

  // Connected accounts of the chosen brand (real data only; tokens never reach the browser).
  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    listAccounts(brandId)
      .then((a) => !cancelled && setAccounts(a.filter((x) => x.status !== "Disconnected")))
      .catch(() => !cancelled && setAccounts([]));
    return () => {
      cancelled = true;
    };
  }, [brandId]);

  // Platforms relevant to this brand: planned ones plus any with a connected account.
  const relevant = useMemo(() => {
    const set = new Set<PlatformKey>([...(brand?.platforms ?? []), ...accounts.map((a) => a.platform)]);
    return set.size > 0 ? ALL.filter((p) => set.has(p)) : ALL;
  }, [brand, accounts]);

  const hasWork = Object.keys(groups).length > 0 || topic.trim() !== "";
  const changeBrand = (id: string) => {
    if (id === brandId) return;
    if (hasWork && !window.confirm("Changing the brand clears the current topic and generated drafts. Continue?")) return;
    setBrandId(id);
    setPlatforms([]);
    setAccountSel([]);
    setGroups({});
    setMedia([]);
    setResults([]);
  };

  const togglePlatform = (p: PlatformKey) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  const toggleAccount = (id: string) => setAccountSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const set = <K extends keyof AiSettings>(k: K, v: AiSettings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  /** Adds generated variations to the editor. Existing drafts and the user's selection are never replaced. */
  const merge = (g: AiGeneration) => {
    setGroups((prev) => {
      const next = { ...prev };
      for (const r of g.results) {
        const added: Draft[] = r.variations.map((v) => ({
          key: `v${++counter.current}`,
          title: v.title,
          caption: v.caption,
          callToAction: v.callToAction,
          hashtags: v.hashtags.join(" "),
        }));
        const cur = next[r.platform];
        next[r.platform] = cur
          ? { ...cur, variations: [...cur.variations, ...added] }
          : { variations: added, selected: 0, include: true };
      }
      return next;
    });
  };

  const run = async (targets: PlatformKey[], which: PlatformKey | "all") => {
    setError(null);
    setNotice(null);
    if (!brandId) return setError("Create a brand on the Brands page first.");
    if (targets.length === 0) return setError("Select at least one platform.");
    if (topic.trim().length < 3) return setError("Describe what the content should be about.");
    setGenerating(which);
    try {
      const g = await generate({ ...settings, brandId, platforms: targets, topic: topic.trim() });
      merge(g);
      setNotice(`Generated ${g.results.reduce((n, r) => n + r.variations.length, 0)} variation(s). Nothing has been saved or published.`);
    } catch (e) {
      setError(apiFullMessage(e, "AI generation failed. Please try again."));
    } finally {
      setGenerating(null);
    }
  };

  const openFromHistory = (g: AiGeneration) => {
    setTopic(g.topic);
    setPlatforms((prev) => [...new Set([...prev, ...g.platforms])]);
    merge(g);
    setNotice("Opened from history. Its variations were added to the editor.");
  };

  const patchGroup = (p: PlatformKey, fn: (g: Group) => Group) =>
    setGroups((prev) => (prev[p] ? { ...prev, [p]: fn(prev[p]!) } : prev));
  const editDraft = (p: PlatformKey, patch: Partial<Draft>) =>
    patchGroup(p, (g) => ({ ...g, variations: g.variations.map((v, i) => (i === g.selected ? { ...v, ...patch } : v)) }));
  const removeVariation = (p: PlatformKey) =>
    setGroups((prev) => {
      const g = prev[p];
      if (!g) return prev;
      const variations = g.variations.filter((_, i) => i !== g.selected);
      const next = { ...prev };
      if (variations.length === 0) delete next[p];
      else next[p] = { ...g, variations, selected: Math.max(0, g.selected - 1) };
      return next;
    });

  const copy = async (d: Draft) => {
    try {
      await navigator.clipboard.writeText(fullText(d));
      setNotice("Copied to the clipboard.");
    } catch {
      setError("Could not copy automatically. Select the text and copy it manually.");
    }
  };

  const pickMedia = async (ids: string[]) => {
    setPicking(false);
    try {
      setMedia(await Promise.all(ids.map((id) => getMedia(id))));
    } catch (e) {
      setError(apiFullMessage(e, "Could not load the selected media."));
    }
  };

  const activePlatforms = (Object.keys(groups) as PlatformKey[]).filter((p) => groups[p]?.include);
  const blocking = activePlatforms.flatMap((p) => {
    const g = groups[p]!;
    return issuesFor(p, g.variations[g.selected]!).map((i) => `${NAMES[p]}: ${i}`);
  });

  const formatFor = (p: PlatformKey): ContentType => {
    const video = media.some((m) => m.mimeType.startsWith("video/"));
    if (media.length === 0) return "Text";
    if (video) return p === "instagram" ? "Reel" : p === "youtube" ? "Video" : "Video";
    return media.length > 1 ? "Carousel" : "Image";
  };

  /** Saves each platform's selected variation as a normal Content draft (updating it if already saved). */
  const save = async (mode: "draft" | "schedule") => {
    setError(null);
    setNotice(null);
    if (activePlatforms.length === 0) return setError("Generate content and keep at least one platform ticked.");
    if (blocking.length > 0) return setError("Fix the highlighted problems before saving.");
    const when = scheduledAt ? new Date(scheduledAt) : null;
    if (mode === "schedule") {
      if (!when || Number.isNaN(when.getTime()) || when.getTime() <= Date.now() + 60_000) return setError("Choose a date and time in the future to schedule.");
      const missing = activePlatforms.filter((p) => !accounts.some((a) => a.platform === p && accountSel.includes(a.id)));
      if (missing.length) return setError(`Choose a connected account for ${missing.map((p) => NAMES[p]).join(", ")} to schedule.`);
    }
    setSaving(true);
    const out: SaveResult[] = [];
    for (const p of activePlatforms) {
      const g = groups[p]!;
      const d = g.variations[g.selected]!;
      const input: ContentInput = {
        title: (p === "youtube" ? d.title : d.title || topic).trim().slice(0, p === "youtube" ? 100 : 150),
        caption: bodyOf(d),
        hashtags: parseTags(d.hashtags),
        brandId,
        platforms: [p],
        accountIds: accounts.filter((a) => a.platform === p && accountSel.includes(a.id)).map((a) => a.id),
        type: formatFor(p),
        scheduledAt: mode === "schedule" && when ? when.toISOString() : null,
        mediaIds: media.map((m) => m.id),
      };
      try {
        const saved = g.savedId ? await updateContent(g.savedId, input) : await createContent(input);
        patchGroup(p, (x) => ({ ...x, savedId: saved.id }));
        if (mode === "schedule" && when) await changeContentStatus(saved.id, "Scheduled", when.toISOString());
        out.push({ platform: p, id: saved.id, status: mode === "schedule" ? "Scheduled" : "Draft" });
      } catch (e) {
        out.push({ platform: p, status: "Draft", error: apiFullMessage(e, "Could not save.") });
      }
    }
    setResults(out);
    setSaving(false);
  };

  const showGroups = (Object.keys(groups) as PlatformKey[]).sort((a, b) => ALL.indexOf(a) - ALL.indexOf(b));

  return (
    <div className="space-y-5">
      <PageHeader icon={Sparkles} title="AI Content" subtitle="Generate platform-specific posts for a brand, edit them, then save them as drafts or schedule them.">
        <Link to="/content/planner" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Plan a period
        </Link>
        <button
          type="button"
          onClick={() => setHistory(true)}
          disabled={!brandId}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <History size={16} /> History
        </button>
      </PageHeader>

      {ai && !ai.configured && (
        <Notice tone="error">
          AI is not configured on the server. Add <code>ANTHROPIC_API_KEY</code> to <code>backend/.env</code> and restart the backend. You can still use everything else on this page.
        </Notice>
      )}
      <Notice tone="info">Generated text is a draft for you to review. Nothing is posted until you schedule or publish it yourself, and AI can make mistakes, so check facts before you post.</Notice>

      <div className="grid items-start gap-5 xl:grid-cols-[24rem_minmax(0,1fr)]">
        {/* ── Inputs ── */}
        <section className={`${card} space-y-4`}>
          <label className="block text-sm font-medium text-slate-700">
            Brand
            <select value={brandId} onChange={(e) => changeBrand(e.target.value)} className={`mt-1 h-10 ${field}`}>
              {brands.length === 0 && <option value="">No brands yet</option>}
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Platforms</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {relevant.map((p) => (
                <label
                  key={p}
                  className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                    platforms.includes(p) ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"
                  }`}
                >
                  <input type="checkbox" className="sr-only" checked={platforms.includes(p)} onChange={() => togglePlatform(p)} />
                  <PlatformIcon platform={p} size="xs" />
                  {NAMES[p]}
                </label>
              ))}
            </div>
            {platforms.map((p) => {
              const list = accounts.filter((a) => a.platform === p);
              return (
                <div key={p} className="mt-3 rounded-lg bg-slate-50 p-2.5">
                  <p className="text-xs font-semibold text-slate-600">{NAMES[p]} accounts</p>
                  {list.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">
                      None connected. You can still generate and save drafts.{" "}
                      <Link to="/brands" className="font-medium text-blue-600 underline">
                        Connect
                      </Link>
                    </p>
                  ) : (
                    list.map((a) => (
                      <label key={a.id} className="mt-1 flex items-center gap-2 text-xs text-slate-700">
                        <input type="checkbox" checked={accountSel.includes(a.id)} onChange={() => toggleAccount(a.id)} />
                        <span className="truncate">
                          {a.displayName || a.username}
                          {a.username && ` (@${a.username.replace(/^@/, "")})`}
                        </span>
                        <span className={`ml-auto ${a.status === "Connected" ? "text-emerald-600" : "text-orange-600"}`}>{a.status}</span>
                      </label>
                    ))
                  )}
                </div>
              );
            })}
          </fieldset>

          <label className="block text-sm font-medium text-slate-700">
            Topic or idea
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={1500}
              rows={4}
              placeholder="e.g. Announce our new yoga retreat in Rishikesh, open for bookings from March"
              className={`mt-1 py-2 ${field}`}
            />
            <span className="text-xs font-normal text-slate-500">{topic.length}/1500 · Only include facts you want in the post.</span>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Content type
            <select value={settings.purpose} onChange={(e) => set("purpose", e.target.value as AiSettings["purpose"])} className={`mt-1 h-10 ${field}`}>
              {PURPOSES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-slate-700">
              Tone
              <select value={settings.tone} onChange={(e) => set("tone", e.target.value as AiSettings["tone"])} className={`mt-1 h-10 ${field}`}>
                {TONES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Language
              <input list="ai-languages" value={settings.language} onChange={(e) => set("language", e.target.value)} maxLength={40} className={`mt-1 h-10 ${field}`} />
              <datalist id="ai-languages">
                {LANGUAGES.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Length
              <select value={settings.length} onChange={(e) => set("length", e.target.value as AiSettings["length"])} className={`mt-1 h-10 ${field}`}>
                {LENGTHS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Variations
              <select value={settings.variations} onChange={(e) => set("variations", Number(e.target.value))} className={`mt-1 h-10 ${field}`}>
                {[1, 2, 3].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Hashtags
              <select value={settings.hashtagCount} onChange={(e) => set("hashtagCount", Number(e.target.value))} className={`mt-1 h-10 ${field}`}>
                {[0, 3, 5, 8, 10, 15].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "None" : `Up to ${n}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={settings.includeCta} onChange={(e) => set("includeCta", e.target.checked)} />
              Call to action
            </label>
          </div>

          {error && <Notice tone="error" onClose={() => setError(null)}>{error}</Notice>}

          <button
            type="button"
            disabled={generating !== null || !ai?.configured || platforms.length === 0}
            onClick={() => void run(platforms, "all")}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating === "all" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating === "all" ? "Generating…" : showGroups.length ? "Generate more variations" : "Generate content"}
          </button>
          {!ai?.configured && ai && <p className="text-xs text-slate-500">Generate is disabled until the AI key is configured.</p>}
        </section>

        {/* ── Editor ── */}
        <div className="min-w-0 space-y-5">
          {notice && <Notice tone="success" onClose={() => setNotice(null)}>{notice}</Notice>}

          {showGroups.length === 0 ? (
            <section className={`${card} py-16 text-center text-sm text-slate-500`}>
              Choose a brand, platforms and a topic, then generate. Each platform gets its own version that you can edit here.
            </section>
          ) : (
            showGroups.map((p) => {
              const g = groups[p]!;
              const d = g.variations[g.selected]!;
              return (
                <section key={p} className={`${card} space-y-3`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <PlatformIcon platform={p} size="md" />
                    <h2 className="text-base font-semibold text-slate-900">{NAMES[p]}</h2>
                    {g.savedId && <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Saved</span>}
                    <label className="ml-auto flex items-center gap-2 text-xs text-slate-600">
                      <input type="checkbox" checked={g.include} onChange={(e) => patchGroup(p, (x) => ({ ...x, include: e.target.checked }))} />
                      Include when saving
                    </label>
                  </div>

                  {g.variations.length > 1 && (
                    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={`${NAMES[p]} variations`}>
                      {g.variations.map((v, i) => (
                        <button
                          key={v.key}
                          type="button"
                          role="tab"
                          aria-selected={i === g.selected}
                          onClick={() => patchGroup(p, (x) => ({ ...x, selected: i }))}
                          className={`rounded-md border px-3 py-1 text-xs font-medium ${i === g.selected ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                        >
                          Variation {i + 1}
                        </button>
                      ))}
                    </div>
                  )}

                  <DraftFields
                    platform={p}
                    draft={d}
                    media={media}
                    onChange={(patch) => editDraft(p, patch)}
                    actions={
                      <>
                        <button type="button" onClick={() => void copy(d)} className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50">
                          <Copy size={13} /> Copy
                        </button>
                        <button
                          type="button"
                          disabled={generating !== null || !ai?.configured || !topic.trim()}
                          onClick={() => void run([p], p)}
                          className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {generating === p ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Generate another
                        </button>
                        <button type="button" onClick={() => removeVariation(p)} className="flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 font-medium text-red-600 hover:bg-red-50">
                          <Trash2 size={13} /> Remove
                        </button>
                      </>
                    }
                  />
                </section>
              );
            })
          )}

          {/* ── Media + save ── */}
          {showGroups.length > 0 && (
            <>
              <section className={`${card} space-y-3`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">Media (shared by all platforms)</h2>
                  <button type="button" onClick={() => setPicking(true)} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <ImagePlus size={16} /> {media.length ? "Change media" : "Choose from Media Library"}
                  </button>
                </div>
                {media.length === 0 ? (
                  <p className="text-sm text-slate-500">No media attached. Text posts are fine for Facebook, LinkedIn and X; Instagram and YouTube need media.</p>
                ) : (
                  <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    {media.map((m) => (
                      <li key={m.id} className="relative">
                        {m.mimeType.startsWith("video/") ? (
                          <video src={`${mediaFileUrl(m.id)}#t=0.5`} preload="metadata" muted crossOrigin="use-credentials" className="aspect-square w-full rounded-lg bg-slate-100 object-cover" />
                        ) : (
                          <img src={mediaFileUrl(m.id)} alt={m.title} crossOrigin="use-credentials" className="aspect-square w-full rounded-lg bg-slate-100 object-cover" />
                        )}
                        <button type="button" onClick={() => setMedia((prev) => prev.filter((x) => x.id !== m.id))} aria-label="Remove media" className="absolute right-1 top-1 rounded-full bg-white p-1 shadow hover:bg-slate-100">
                          <X size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={`${card} space-y-3`}>
                <h2 className="text-sm font-semibold text-slate-900">Save</h2>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block text-xs font-medium text-slate-600">
                    Publish at (only needed to schedule)
                    <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={`mt-1 h-10 ${field}`} />
                  </label>
                  <button
                    type="button"
                    disabled={saving || blocking.length > 0}
                    onClick={() => void save("draft")}
                    className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save as drafts"}
                  </button>
                  <button
                    type="button"
                    disabled={saving || blocking.length > 0}
                    onClick={() => void save("schedule")}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Save &amp; schedule
                  </button>
                </div>
                {blocking.length > 0 && <p className="text-xs text-red-600">Fix the problems above (or untick the platform) to save.</p>}
                <p className="text-xs text-slate-500">Each platform becomes its own post in Content, targeting the accounts you ticked. Scheduling runs the normal publishing checks.</p>

                {results.length > 0 && (
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
                    {results.map((r) => (
                      <li key={r.platform} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                        <PlatformIcon platform={r.platform} size="xs" />
                        <span className="font-medium text-slate-800">{NAMES[r.platform]}</span>
                        {r.error ? (
                          <span className="min-w-0 flex-1 text-xs text-red-600">{r.error}</span>
                        ) : (
                          <>
                            <span className="flex-1 text-xs text-emerald-700">Saved as {r.status === "Scheduled" ? "scheduled post" : "draft"}</span>
                            <Link to={`/content/${r.id}/edit`} className="text-xs font-medium text-blue-600 hover:underline">
                              Open
                            </Link>
                          </>
                        )}
                      </li>
                    ))}
                    <li className="px-3 py-2.5 text-xs">
                      <Link to="/calendar" className="font-medium text-blue-600 hover:underline">
                        Open Calendar
                      </Link>{" "}
                      ·{" "}
                      <Link to="/content" className="font-medium text-blue-600 hover:underline">
                        Open Content
                      </Link>
                    </li>
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {picking && <MediaPicker brandId={brandId} selectedIds={media.map((m) => m.id)} onClose={() => setPicking(false)} onConfirm={(ids) => void pickMedia(ids)} />}
      {history && brandId && <AIHistoryModal brandId={brandId} onOpen={openFromHistory} onClose={() => setHistory(false)} />}
    </div>
  );
}
