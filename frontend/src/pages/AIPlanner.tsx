import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarClock, History, ImagePlus, Loader2, RefreshCw, Save, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";
import { AIPlanHistoryModal } from "../components/ai/AIPlanHistoryModal";
import { DraftFields } from "../components/ai/DraftFields";
import { MediaPicker } from "../components/media/MediaPicker";
import { Notice } from "../components/ui/ListControls";
import { PageHeader } from "../components/ui/PageHeader";
import { PlatformIcon } from "../components/ui/PlatformIcon";
import { useBrands } from "../context/BrandsContext";
import {
  ALL_PLATFORMS,
  LANGUAGES,
  NAMES,
  bodyOf,
  issuesFor,
  loadSettings,
  parseTags,
  saveSettings,
  type Draft,
} from "../lib/aiDrafts";
import {
  GOALS,
  TONES,
  TYPES_BY_PLATFORM,
  checkSlots,
  createPlan,
  generateIdeaContent,
  getAiStatus,
  regenerateIdeas,
  savePlan,
  type AiPlan,
  type AiSettings,
  type PlanIdea,
} from "../services/aiService";
import { apiFullMessage, changeContentStatus, createContent, updateContent, type ContentInput } from "../services/contentService";
import { getMedia, mediaFileUrl } from "../services/mediaService";
import { listAccounts, type SocialAccount } from "../services/socialService";
import type { MediaItem, PlatformKey } from "../types";

const field = "w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400";
const card = "rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm";
const MAX_BATCH = 10;
const DEFAULT_COUNT: Record<7 | 14 | 30, number> = { 7: 4, 14: 8, 30: 12 };

/** An idea as edited in the browser: hashtags stay plain text so spaces can be typed. */
interface IdeaEdit extends Omit<PlanIdea, "hashtags" | "draft" | "issues"> {
  hashtagsText: string;
  draft: Draft | null;
  issues: string[];
}
interface SaveResult {
  id: string;
  idea: string;
  postId?: string;
  status?: "Draft" | "Scheduled";
  error?: string;
}

const toEdit = (i: PlanIdea): IdeaEdit => ({
  ...i,
  hashtagsText: i.hashtags.join(" "),
  draft: i.draft ? { key: i.id, title: i.draft.title, caption: i.draft.caption, callToAction: i.draft.callToAction, hashtags: i.draft.hashtags.join(" ") } : null,
});
const fromEdit = (e: IdeaEdit): PlanIdea => {
  const { hashtagsText, draft, ...rest } = e;
  return {
    ...rest,
    hashtags: parseTags(hashtagsText),
    draft: draft ? { title: draft.title, caption: draft.caption, callToAction: draft.callToAction, hashtags: parseTags(draft.hashtags) } : null,
  };
};

const tomorrow = () => {
  const d = new Date(Date.now() + 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const slotMs = (i: { date: string; time: string }) => {
  const t = new Date(`${i.date}T${i.time}`).getTime();
  return Number.isNaN(t) ? null : t;
};

export default function AIPlanner() {
  const { brands, selectedBrandId } = useBrands();
  const [brandId, setBrandId] = useState(selectedBrandId);
  const [platforms, setPlatforms] = useState<PlatformKey[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [accountSel, setAccountSel] = useState<string[]>([]);
  const [goal, setGoal] = useState<(typeof GOALS)[number]>("Brand awareness");
  const [periodDays, setPeriodDays] = useState<7 | 14 | 30>(7);
  const [postCount, setPostCount] = useState(DEFAULT_COUNT[7]);
  const [startDate, setStartDate] = useState(tomorrow());
  const [topics, setTopics] = useState("");
  const [preferences, setPreferences] = useState("");
  const [settings, setSettings] = useState<AiSettings>(loadSettings);

  const [plan, setPlan] = useState<AiPlan | null>(null);
  const [ideas, setIdeas] = useState<IdeaEdit[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [media, setMedia] = useState<Record<string, MediaItem[]>>({});
  const [conflicts, setConflicts] = useState<Record<string, string>>({});
  const [pickingFor, setPickingFor] = useState<string | null>(null);

  const [ai, setAi] = useState<{ configured: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [results, setResults] = useState<SaveResult[]>([]);
  const [history, setHistory] = useState(false);
  const countEdited = useRef(false);

  const brand = brands.find((b) => b.id === brandId);
  useEffect(() => {
    if (!brandId && selectedBrandId) setBrandId(selectedBrandId);
  }, [brandId, selectedBrandId]);
  useEffect(() => {
    getAiStatus().then(setAi).catch(() => setAi({ configured: false }));
  }, []);
  useEffect(() => saveSettings(settings), [settings]);

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

  const relevant = useMemo(() => {
    const set = new Set<PlatformKey>([...(brand?.platforms ?? []), ...accounts.map((a) => a.platform)]);
    return set.size > 0 ? ALL_PLATFORMS.filter((p) => set.has(p)) : ALL_PLATFORMS;
  }, [brand, accounts]);

  const accountsFor = (p: PlatformKey) => accounts.filter((a) => a.platform === p && accountSel.includes(a.id)).map((a) => a.id);

  /** Loads a plan (new, regenerated or from history) into the editor, keeping the current selection. */
  const applyPlan = (p: AiPlan, keepSelection = true) => {
    setPlan(p);
    setIdeas(p.plan.ideas.map(toEdit));
    setSelected((prev) => (keepSelection ? prev.filter((id) => p.plan.ideas.some((i) => i.id === id)) : []));
    const missing = [...new Set(p.plan.ideas.flatMap((i) => i.mediaIds))];
    if (missing.length) {
      void Promise.all(missing.map((id) => getMedia(id).catch(() => null))).then((items) => {
        const byId = new Map(items.filter((m): m is MediaItem => !!m).map((m) => [m.id, m]));
        setMedia(Object.fromEntries(p.plan.ideas.map((i) => [i.id, i.mediaIds.flatMap((m) => (byId.get(m) ? [byId.get(m)!] : []))])));
      });
    } else {
      setMedia({});
    }
  };

  const openFromHistory = (p: AiPlan) => {
    setBrandId(p.brandId);
    setPlatforms(p.platforms);
    setAccountSel(p.plan.accountIds);
    setGoal(p.plan.goal);
    setPeriodDays(p.plan.periodDays as 7 | 14 | 30);
    setPostCount(p.plan.postCount);
    setStartDate(p.plan.startDate);
    setTopics(p.topic);
    setPreferences(p.plan.preferences);
    setResults([]);
    applyPlan(p, false);
    setNotice("Plan reopened. Your earlier edits and captions are included.");
  };

  const changeBrand = (id: string) => {
    if (id === brandId) return;
    if (plan && !window.confirm("Changing the brand closes the current plan (it stays in history). Continue?")) return;
    setBrandId(id);
    setPlatforms([]);
    setAccountSel([]);
    setPlan(null);
    setIdeas([]);
    setSelected([]);
    setResults([]);
  };

  const togglePlatform = (p: PlatformKey) => setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  const toggleAccount = (id: string) => setAccountSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const patchIdea = (id: string, patch: Partial<IdeaEdit>) => setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const changePlatform = (idea: IdeaEdit, p: PlatformKey) => {
    if (p === idea.platform) return;
    if (idea.draft && !window.confirm("Changing the platform discards this idea's generated caption (it was written for another platform). Continue?")) return;
    const allowed = TYPES_BY_PLATFORM[p];
    patchIdea(idea.id, { platform: p, contentType: allowed.includes(idea.contentType) ? idea.contentType : allowed[0]!, draft: null });
  };

  // ── conflicts with existing scheduled posts (server) and with other ideas (here) ──
  const slotKey = JSON.stringify(ideas.map((i) => [i.id, i.platform, i.date, i.time, i.contentId]));
  const accountKey = accountSel.join();
  useEffect(() => {
    if (!brandId || ideas.length === 0) return;
    const t = setTimeout(() => {
      const valid = ideas.flatMap((i) => {
        const ms = slotMs(i);
        return ms === null ? [] : [{ idea: i, at: new Date(ms).toISOString() }];
      });
      checkSlots(
        brandId,
        valid.map((v) => ({ platform: v.idea.platform, accountIds: accountsFor(v.idea.platform), scheduledAt: v.at })),
        ideas.flatMap((i) => (i.contentId ? [i.contentId] : [])),
      )
        .then((hits) =>
          setConflicts(Object.fromEntries(hits.map((h) => [valid[h.index]!.idea.id, `"${h.title}" is already scheduled for this account within 30 minutes.`]))),
        )
        .catch(() => setConflicts({}));
    }, 600);
    return () => clearTimeout(t);
    // accountsFor reads accounts/accountSel, covered by the keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotKey, accountKey, brandId]);

  const overlaps = useMemo(() => {
    const out: Record<string, string> = {};
    for (const a of ideas) {
      const ta = slotMs(a);
      if (ta === null) continue;
      const other = ideas.find((b) => b.id !== a.id && b.platform === a.platform && slotMs(b) !== null && Math.abs(slotMs(b)! - ta) < 30 * 60_000);
      if (other) out[a.id] = "Too close to another idea on this platform.";
    }
    return out;
  }, [ideas]);

  // ── actions ──
  const guard = async (name: string, work: () => Promise<void>) => {
    if (busy) return;
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      await work();
    } catch (e) {
      setError(apiFullMessage(e, "That failed. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const persist = async () => {
    if (plan) await savePlan(plan.id, ideas.map(fromEdit));
  };

  const generate = () =>
    guard("generate", async () => {
      if (!brandId) throw new Error("Create a brand on the Brands page first.");
      if (platforms.length === 0) return setError("Select at least one platform.");
      if (topics.trim().length < 3) return setError("Enter the topics, products or announcements to plan around.");
      if (plan && ideas.some((i) => i.draft || i.contentId) && !window.confirm("Generate a new plan? The current plan stays in history, but unsaved edits to it are kept only there.")) return;
      await persist();
      const p = await createPlan({
        brandId,
        platforms,
        accountIds: accountSel,
        goal,
        periodDays,
        postCount,
        topics: topics.trim(),
        preferences: preferences.trim(),
        tone: settings.tone,
        language: settings.language,
        startDate,
        utcOffsetMinutes: -new Date(`${startDate}T12:00`).getTimezoneOffset(),
      });
      setResults([]);
      applyPlan(p, false);
      setNotice(`Plan created with ${p.plan.ideas.length} ideas. Nothing has been saved as a post, scheduled or published.`);
    });

  const savePlanOnly = () =>
    guard("save-plan", async () => {
      await persist();
      setNotice("Plan saved.");
    });

  const regenerate = () =>
    guard("regenerate", async () => {
      if (!plan) return;
      await persist();
      const p = await regenerateIdeas(plan.id, selected);
      applyPlan(p);
      setNotice(`Regenerated ${selected.length} idea(s). Their dates and platforms were kept; captions for them were cleared.`);
    });

  const writeCaptions = () =>
    guard("captions", async () => {
      if (!plan) return;
      await persist();
      const { plan: p, failures } = await generateIdeaContent(plan.id, selected, { length: settings.length, hashtagCount: settings.hashtagCount, includeCta: settings.includeCta });
      applyPlan(p);
      const failed = Object.keys(failures).length;
      if (failed) setError(`${failed} caption(s) could not be generated: ${[...new Set(Object.values(failures))].join(" ")}`);
      setNotice(`Wrote captions for ${selected.length - failed} idea(s). Review and edit them below.`);
    });

  const removeIdea = (id: string) => {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    setSelected((prev) => prev.filter((x) => x !== id));
  };

  const pickedIdeas = ideas.filter((i) => selected.includes(i.id));

  /** Problems that stop an idea being saved (drafts) or scheduled. Empty means OK. */
  const problemsFor = (i: IdeaEdit, schedule: boolean): string[] => {
    const out: string[] = [];
    if (!i.draft) return ["No caption yet. Write captions first."];
    out.push(...issuesFor(i.platform, i.draft));
    const ms = slotMs(i);
    if (ms === null) out.push("Choose a valid date and time.");
    if (schedule) {
      if (ms !== null && ms <= Date.now() + 60_000) out.push("The time is in the past.");
      if (accountsFor(i.platform).length === 0) out.push(`Choose a connected ${NAMES[i.platform]} account.`);
      if (conflicts[i.id]) out.push(conflicts[i.id]!);
      if (overlaps[i.id]) out.push(overlaps[i.id]!);
    }
    return out;
  };

  /** Saves selected ideas as normal Content posts (drafts, or scheduled when asked). Nothing is published. */
  const saveSelected = (mode: "draft" | "schedule") =>
    guard(mode, async () => {
      if (!plan) return;
      if (pickedIdeas.length === 0) return setError("Select at least one idea.");
      const blocked = pickedIdeas.flatMap((i) => problemsFor(i, mode === "schedule").map((p) => `Idea "${i.idea.slice(0, 40)}": ${p}`));
      if (blocked.length) return setError(blocked.join(" "));

      const out: SaveResult[] = [];
      const linked = new Map<string, string>();
      for (const i of pickedIdeas) {
        const d = i.draft!;
        const ms = slotMs(i)!;
        const input: ContentInput = {
          title: (i.platform === "youtube" ? d.title : d.title || i.idea).trim().slice(0, i.platform === "youtube" ? 100 : 150),
          caption: bodyOf(d),
          hashtags: parseTags(d.hashtags),
          brandId,
          platforms: [i.platform],
          accountIds: accountsFor(i.platform),
          type: i.contentType,
          scheduledAt: new Date(ms).toISOString(),
          mediaIds: (media[i.id] ?? []).map((m) => m.id),
        };
        try {
          const saved = i.contentId ? await updateContent(i.contentId, input) : await createContent(input);
          linked.set(i.id, saved.id);
          if (mode === "schedule") await changeContentStatus(saved.id, "Scheduled", new Date(ms).toISOString());
          out.push({ id: i.id, idea: i.idea, postId: saved.id, status: mode === "schedule" ? "Scheduled" : "Draft" });
        } catch (e) {
          out.push({ id: i.id, idea: i.idea, ...(linked.has(i.id) ? { postId: linked.get(i.id)! } : {}), error: apiFullMessage(e, "Could not save.") });
        }
      }
      // Remember which ideas became posts so they are never saved twice.
      const next = ideas.map((i) => (linked.has(i.id) ? { ...i, contentId: linked.get(i.id)! } : i));
      setIdeas(next);
      await savePlan(plan.id, next.map(fromEdit));
      setResults(out);
      const okCount = out.filter((r) => !r.error).length;
      setNotice(`${okCount} of ${out.length} saved as ${mode === "schedule" ? "scheduled posts" : "drafts"}. Nothing has been published.`);
    });

  const pickMedia = async (ids: string[]) => {
    const target = pickingFor;
    setPickingFor(null);
    if (!target) return;
    try {
      const items = await Promise.all(ids.map((id) => getMedia(id)));
      setMedia((prev) => ({ ...prev, [target]: items }));
      patchIdea(target, { mediaIds: ids });
    } catch (e) {
      setError(apiFullMessage(e, "Could not load the selected media."));
    }
  };

  const allSelected = ideas.length > 0 && selected.length === ideas.length;
  const tooMany = selected.length > MAX_BATCH;

  return (
    <div className="space-y-5">
      <PageHeader icon={CalendarClock} title="AI Content Planner" subtitle="Plan a period of posts for a brand, review and edit the ideas, then turn the ones you approve into drafts or scheduled posts.">
        <Link to="/content/ai" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <Sparkles size={16} /> Single post
        </Link>
        <button type="button" onClick={() => setHistory(true)} disabled={!brandId} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <History size={16} /> Plan history
        </button>
      </PageHeader>

      {ai && !ai.configured && (
        <Notice tone="error">
          AI is not configured on the server. Add <code>ANTHROPIC_API_KEY</code> to <code>backend/.env</code> and restart the backend.
        </Notice>
      )}
      <Notice tone="info">
        Suggested dates and times are AI suggestions based on your settings and the posts already scheduled. No audience analytics are connected, so nothing here is based on when your audience is active. Review everything: nothing is posted until you schedule it yourself.
      </Notice>

      <div className="grid items-start gap-5 xl:grid-cols-[24rem_minmax(0,1fr)]">
        {/* ── Plan settings ── */}
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
                <label key={p} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${platforms.includes(p) ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}>
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
                      None connected. You can plan and save drafts, but scheduling needs an account.{" "}
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

          <div>
            <span className="text-sm font-medium text-slate-700">Planning period</span>
            <div className="mt-1 flex gap-2">
              {([7, 14, 30] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={periodDays === d}
                  onClick={() => {
                    setPeriodDays(d);
                    if (!countEdited.current) setPostCount(DEFAULT_COUNT[d]);
                    else setPostCount((n) => Math.min(n, d * 3));
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${periodDays === d ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-slate-700">
              Starting
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`mt-1 h-10 ${field}`} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Number of posts
              <input
                type="number"
                min={1}
                max={periodDays * 3}
                value={postCount}
                onChange={(e) => {
                  countEdited.current = true;
                  setPostCount(Math.max(1, Math.min(periodDays * 3, Number(e.target.value) || 1)));
                }}
                className={`mt-1 h-10 ${field}`}
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Business goal
            <select value={goal} onChange={(e) => setGoal(e.target.value as (typeof GOALS)[number])} className={`mt-1 h-10 ${field}`}>
              {GOALS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Topics, products, services or announcements
            <textarea value={topics} onChange={(e) => setTopics(e.target.value)} maxLength={2000} rows={5} placeholder="e.g. Yoga retreat in Rishikesh in March; beginner morning classes; teacher training enquiries" className={`mt-1 py-2 ${field}`} />
            <span className="text-xs font-normal text-slate-500">{topics.length}/2000 · Only include facts you want used. The AI will not add prices, dates or offers.</span>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Preferences (optional)
            <input value={preferences} onChange={(e) => setPreferences(e.target.value)} maxLength={300} placeholder="e.g. avoid weekends, more video than text" className={`mt-1 h-10 ${field}`} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-slate-700">
              Tone
              <select value={settings.tone} onChange={(e) => setSettings((s) => ({ ...s, tone: e.target.value as AiSettings["tone"] }))} className={`mt-1 h-10 ${field}`}>
                {TONES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Language
              <input list="planner-languages" value={settings.language} onChange={(e) => setSettings((s) => ({ ...s, language: e.target.value }))} maxLength={40} className={`mt-1 h-10 ${field}`} />
              <datalist id="planner-languages">
                {LANGUAGES.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </label>
          </div>

          <button
            type="button"
            disabled={busy !== null || !ai?.configured || platforms.length === 0}
            onClick={() => void generate()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "generate" ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {busy === "generate" ? "Planning…" : plan ? "Generate a new plan" : "Generate plan"}
          </button>
        </section>

        {/* ── Plan review ── */}
        <div className="min-w-0 space-y-4">
          {error && <Notice tone="error" onClose={() => setError(null)}>{error}</Notice>}
          {notice && <Notice tone="success" onClose={() => setNotice(null)}>{notice}</Notice>}

          {!plan ? (
            <section className={`${card} py-16 text-center text-sm text-slate-500`}>Choose a brand, platforms, a period and your topics, then generate a plan. You will review every idea before anything is saved.</section>
          ) : (
            <>
              <section className={`${card} flex flex-wrap items-center gap-2`}>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? ideas.map((i) => i.id) : [])} />
                  {selected.length} of {ideas.length} selected
                </label>
                {tooMany && <span className="text-xs text-red-600">Select up to {MAX_BATCH} at a time for AI actions.</span>}
                <span className="ml-auto flex flex-wrap gap-2">
                  <button type="button" onClick={() => void savePlanOnly()} disabled={busy !== null} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    {busy === "save-plan" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save plan
                  </button>
                  <button type="button" onClick={() => void regenerate()} disabled={busy !== null || selected.length === 0 || tooMany || !ai?.configured} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    {busy === "regenerate" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Regenerate selected
                  </button>
                  <button type="button" onClick={() => void writeCaptions()} disabled={busy !== null || selected.length === 0 || tooMany || !ai?.configured} className="flex items-center gap-1.5 rounded-lg border border-blue-600 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50">
                    {busy === "captions" ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Write captions
                  </button>
                  <button type="button" onClick={() => void saveSelected("draft")} disabled={busy !== null || selected.length === 0} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    {busy === "draft" ? "Saving…" : "Save as drafts"}
                  </button>
                  <button type="button" onClick={() => void saveSelected("schedule")} disabled={busy !== null || selected.length === 0} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                    {busy === "schedule" ? "Scheduling…" : "Save & schedule"}
                  </button>
                </span>
              </section>

              {results.length > 0 && (
                <section className={card}>
                  <ul className="divide-y divide-slate-100 text-sm">
                    {results.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
                        <span className="min-w-0 flex-1 truncate text-slate-800">{r.idea}</span>
                        {r.error ? <span className="text-xs text-red-600">{r.error}</span> : <span className="text-xs text-emerald-700">Saved as {r.status === "Scheduled" ? "scheduled post" : "draft"}</span>}
                        {r.postId && (
                          <Link to={`/content/${r.postId}/edit`} className="text-xs font-medium text-blue-600 hover:underline">
                            Open
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs">
                    <Link to="/calendar" className="font-medium text-blue-600 hover:underline">
                      Open Calendar
                    </Link>{" "}
                    to reschedule or cancel · <Link to="/content" className="font-medium text-blue-600 hover:underline">Open Content</Link>
                  </p>
                </section>
              )}

              {ideas.length === 0 && <section className={`${card} py-10 text-center text-sm text-slate-500`}>All ideas were removed. Generate a new plan to start again.</section>}

              {ideas.map((i, n) => {
                const warn = conflicts[i.id] ?? overlaps[i.id];
                return (
                  <section key={i.id} className={`${card} space-y-3 ${selected.includes(i.id) ? "ring-2 ring-blue-200" : ""}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <input type="checkbox" aria-label={`Select idea ${n + 1}`} checked={selected.includes(i.id)} onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, i.id] : prev.filter((x) => x !== i.id)))} />
                      <PlatformIcon platform={i.platform} size="sm" />
                      <span className="text-sm font-semibold text-slate-900">Idea {n + 1}</span>
                      {i.contentId && (
                        <Link to={`/content/${i.contentId}/edit`} className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 hover:underline">
                          Saved as a post
                        </Link>
                      )}
                      {warn && (
                        <span className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700" title={warn}>
                          <AlertTriangle size={12} /> Time conflict
                        </span>
                      )}
                      <button type="button" onClick={() => removeIdea(i.id)} className="ml-auto flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-4">
                      <label className="block text-xs font-medium text-slate-600">
                        Platform
                        <select value={i.platform} onChange={(e) => changePlatform(i, e.target.value as PlatformKey)} className={`mt-1 h-9 ${field}`}>
                          {(plan.platforms.length ? plan.platforms : ALL_PLATFORMS).map((p) => (
                            <option key={p} value={p}>
                              {NAMES[p]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-medium text-slate-600">
                        Format
                        <select value={i.contentType} onChange={(e) => patchIdea(i.id, { contentType: e.target.value as IdeaEdit["contentType"] })} className={`mt-1 h-9 ${field}`}>
                          {TYPES_BY_PLATFORM[i.platform].map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-medium text-slate-600">
                        Date
                        <input type="date" value={i.date} onChange={(e) => patchIdea(i.id, { date: e.target.value })} className={`mt-1 h-9 ${field}`} />
                      </label>
                      <label className="block text-xs font-medium text-slate-600">
                        Time
                        <input type="time" value={i.time} onChange={(e) => patchIdea(i.id, { time: e.target.value })} className={`mt-1 h-9 ${field}`} />
                      </label>
                    </div>

                    <label className="block text-xs font-medium text-slate-600">
                      Content idea
                      <textarea value={i.idea} onChange={(e) => patchIdea(i.id, { idea: e.target.value })} rows={2} maxLength={400} className={`mt-1 py-2 ${field}`} />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs font-medium text-slate-600">
                        Caption concept
                        <textarea value={i.captionConcept} onChange={(e) => patchIdea(i.id, { captionConcept: e.target.value })} rows={2} maxLength={600} className={`mt-1 py-2 ${field}`} />
                      </label>
                      <div className="grid gap-3">
                        <label className="block text-xs font-medium text-slate-600">
                          Topic
                          <input value={i.topic} onChange={(e) => patchIdea(i.id, { topic: e.target.value })} maxLength={200} className={`mt-1 h-9 ${field}`} />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block text-xs font-medium text-slate-600">
                            Call to action
                            <input value={i.callToAction} onChange={(e) => patchIdea(i.id, { callToAction: e.target.value })} maxLength={200} className={`mt-1 h-9 ${field}`} />
                          </label>
                          <label className="block text-xs font-medium text-slate-600">
                            Hashtags
                            <input value={i.hashtagsText} onChange={(e) => patchIdea(i.id, { hashtagsText: e.target.value })} className={`mt-1 h-9 ${field}`} />
                          </label>
                        </div>
                      </div>
                    </div>

                    {i.reason && (
                      <p className="text-xs italic text-slate-500">
                        AI suggestion: {i.reason} <span className="not-italic">(not based on audience analytics)</span>
                      </p>
                    )}
                    {i.issues.length > 0 && <ul className="list-disc rounded-lg bg-amber-50 py-2 pl-7 pr-3 text-xs text-amber-800">{i.issues.map((x) => <li key={x}>{x}</li>)}</ul>}
                    {warn && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{warn} Pick another time before scheduling.</p>}

                    <div className="rounded-lg border border-dashed border-slate-300 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">Media</span>
                        {(media[i.id] ?? []).map((m) => (
                          <span key={m.id} className="h-9 w-9 overflow-hidden rounded bg-slate-100">
                            {m.mimeType.startsWith("video/") ? (
                              <video src={`${mediaFileUrl(m.id)}#t=0.5`} preload="metadata" muted crossOrigin="use-credentials" className="h-full w-full object-cover" />
                            ) : (
                              <img src={mediaFileUrl(m.id)} alt={m.title} crossOrigin="use-credentials" className="h-full w-full object-cover" />
                            )}
                          </span>
                        ))}
                        <button type="button" onClick={() => setPickingFor(i.id)} className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          <ImagePlus size={13} /> {(media[i.id] ?? []).length ? "Change" : "Choose"}
                        </button>
                        {(media[i.id] ?? []).length > 0 && (
                          <button type="button" onClick={() => { setMedia((p) => ({ ...p, [i.id]: [] })); patchIdea(i.id, { mediaIds: [] }); }} className="text-xs text-red-600 hover:underline">
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    {i.draft ? (
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="mb-2 text-xs font-semibold text-slate-700">Generated caption for {NAMES[i.platform]} (edit freely)</p>
                        <DraftFields
                          platform={i.platform}
                          draft={i.draft}
                          media={media[i.id] ?? []}
                          onChange={(patch) => patchIdea(i.id, { draft: { ...i.draft!, ...patch } })}
                          actions={
                            <button type="button" onClick={() => patchIdea(i.id, { draft: null })} className="flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 font-medium text-red-600 hover:bg-red-50">
                              <Trash2 size={13} /> Discard caption
                            </button>
                          }
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No caption yet. Select this idea and click “Write captions”.</p>
                    )}
                  </section>
                );
              })}
            </>
          )}
        </div>
      </div>

      {pickingFor && <MediaPicker brandId={brandId} selectedIds={ideas.find((i) => i.id === pickingFor)?.mediaIds ?? []} onClose={() => setPickingFor(null)} onConfirm={(ids) => void pickMedia(ids)} />}
      {history && brandId && (
        <AIPlanHistoryModal
          brandId={brandId}
          onOpen={openFromHistory}
          onClose={() => setHistory(false)}
          onDeleted={(id) => {
            if (plan?.id === id) {
              setPlan(null);
              setIdeas([]);
              setSelected([]);
            }
          }}
        />
      )}
    </div>
  );
}
