import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ContentThumb } from "../components/content/ContentCard";
import { ContentDetailsModal } from "../components/content/ContentModals";
import { Notice, SearchInput, SelectField } from "../components/ui/ListControls";
import { PageHeader, primaryButton } from "../components/ui/PageHeader";
import { PlatformIcon } from "../components/ui/PlatformIcon";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useBrands } from "../context/BrandsContext";
import { demoContent } from "../data/demoContent";
import { useDebounced } from "../lib/useDebounced";
import { listContent, type ContentQuery } from "../services/contentService";
import { apiErrorMessage } from "../services/mediaService";
import type { ContentItem, ContentWorkflowStatus, PlatformKey } from "../types";

type View = "month" | "week" | "day";

const chipTone: Record<ContentWorkflowStatus, string> = {
  Approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  Scheduled: "bg-sky-50 text-sky-800 border-sky-200",
  "Pending Approval": "bg-orange-50 text-orange-800 border-orange-200",
  Draft: "bg-slate-100 text-slate-700 border-slate-200",
  Rejected: "bg-red-50 text-red-800 border-red-200",
  Published: "bg-violet-50 text-violet-800 border-violet-200",
};

const STATUSES: ContentWorkflowStatus[] = ["Draft", "Pending Approval", "Approved", "Scheduled", "Published", "Rejected"];
const dayKey = (d: Date) => format(d, "yyyy-MM-dd");
const when = (c: ContentItem) => new Date(c.scheduledAt as string);

function visibleRange(view: View, cursor: Date) {
  if (view === "month") {
    return { start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) };
  }
  if (view === "week") return { start: startOfWeek(cursor), end: endOfWeek(cursor) };
  return { start: startOfDay(cursor), end: endOfDay(cursor) };
}

function label(view: View, cursor: Date) {
  if (view === "month") return format(cursor, "MMMM yyyy");
  if (view === "day") return format(cursor, "MMM d, yyyy");
  const { start, end } = visibleRange("week", cursor);
  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}

function Chip({ item, onOpen, compact }: { item: ContentItem; onOpen: () => void; compact?: boolean }) {
  const first = item.platforms[0];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      title={`${item.title} · ${format(when(item), "hh:mm a")} · ${item.status}`}
      className={`flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight ${chipTone[item.status]}`}
    >
      {first && <PlatformIcon platform={first} size="xs" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.title}</span>
        {!compact && <span className="block opacity-70">{format(when(item), "hh:mm a")}</span>}
      </span>
    </button>
  );
}

export default function Calendar() {
  const { brands } = useBrands();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [brandId, setBrandId] = useState("all");
  const [platform, setPlatform] = useState<PlatformKey | "all">("all");
  const [status, setStatus] = useState<ContentWorkflowStatus | "all">("all");
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q);

  const [libraryEmpty, setLibraryEmpty] = useState<boolean | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [upcoming, setUpcoming] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [details, setDetails] = useState<ContentItem | null>(null);

  const range = useMemo(() => visibleRange(view, cursor), [view, cursor]);

  const filters = useMemo((): ContentQuery => {
    const f: ContentQuery = {};
    if (debouncedQ.trim()) f.q = debouncedQ.trim();
    if (brandId !== "all") f.brandId = brandId;
    if (platform !== "all") f.platform = platform;
    if (status !== "all") f.status = status;
    return f;
  }, [debouncedQ, brandId, platform, status]);

  // One-off probe: if no real content exists at all, show demonstration data instead.
  useEffect(() => {
    listContent({ limit: 1 })
      .then((r) => setLibraryEmpty(Object.keys(r.statusCounts).length === 0))
      .catch((e: unknown) => {
        setLibraryEmpty(false);
        setError(apiErrorMessage(e, "Could not load the calendar. Is the backend running?"));
        setLoading(false);
      });
  }, [reload]);

  const demoMode = libraryEmpty === true;

  const demoFiltered = useMemo(() => {
    const ql = (filters.q ?? "").toLowerCase();
    return demoContent.filter(
      (c) =>
        (!ql || [c.title, c.caption, ...c.hashtags].join(" ").toLowerCase().includes(ql)) &&
        (!filters.brandId || c.brandId === filters.brandId) &&
        (!filters.platform || c.platforms.includes(filters.platform)) &&
        (!filters.status || c.status === filters.status),
    );
  }, [filters]);

  useEffect(() => {
    if (libraryEmpty === null || demoMode) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const now = new Date();
    Promise.all([
      listContent({ ...filters, from: range.start.toISOString(), to: range.end.toISOString(), limit: 200 }),
      listContent({ ...filters, from: now.toISOString(), to: addDays(now, 90).toISOString(), limit: 50 }),
    ])
      .then(([inRange, soon]) => {
        if (cancelled) return;
        setItems(inRange.items);
        setUpcoming([...soon.items].sort((a, b) => when(a).getTime() - when(b).getTime()).slice(0, 5));
      })
      .catch((e: unknown) => !cancelled && setError(apiErrorMessage(e, "Could not load scheduled content.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [libraryEmpty, demoMode, filters, range, reload]);

  const shown = useMemo(
    () => (demoMode ? demoFiltered.filter((c) => when(c) >= range.start && when(c) <= range.end) : items),
    [demoMode, demoFiltered, items, range],
  );
  const upcomingShown = demoMode ? [...demoFiltered].sort((a, b) => when(a).getTime() - when(b).getTime()).slice(0, 5) : upcoming;
  const busyLoading = demoMode ? false : loading;

  const byDay = useMemo(() => {
    const m = new Map<string, ContentItem[]>();
    shown.forEach((c) => {
      const k = dayKey(when(c));
      m.set(k, [...(m.get(k) ?? []), c].sort((a, b) => when(a).getTime() - when(b).getTime()));
    });
    return m;
  }, [shown]);

  const step = (dir: 1 | -1) =>
    setCursor((c) => (view === "month" ? addMonths(c, dir) : view === "week" ? addWeeks(c, dir) : addDays(c, dir)));
  const goToday = () => {
    setCursor(new Date());
    setSelected(new Date());
  };
  const openDay = (d: Date) => {
    setSelected(d);
    setCursor(d);
  };

  const days = eachDayOfInterval(range);
  const today = new Date();
  const editable = (c: ContentItem) => !c.demo && (c.status === "Draft" || c.status === "Rejected");

  const btn = "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50";

  return (
    <div className="space-y-5">
      <PageHeader icon={CalendarDays} title="Calendar" subtitle="Plan, schedule, and manage your social media content.">
        <Link to="/content/new" className={primaryButton}>
          <Plus size={18} /> Schedule Content
        </Link>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={goToday} className={btn}>
          Today
        </button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => step(-1)} aria-label="Previous" className={`${btn} px-2`}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Next" className={`${btn} px-2`}>
            <ChevronRight size={18} />
          </button>
        </div>
        <h2 className="min-w-40 text-base font-semibold text-slate-900" aria-live="polite">
          {label(view, cursor)}
        </h2>
        <div role="group" aria-label="Calendar view" className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
          {(["month", "week", "day"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`h-10 px-4 text-sm font-medium capitalize ${view === v ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-50"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
          <SelectField className="w-40" value={brandId} onChange={setBrandId}>
            <option value="all">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </SelectField>
          <SelectField className="w-40" value={platform} onChange={(v) => setPlatform(v as typeof platform)}>
            <option value="all">All Platforms</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="youtube">YouTube</option>
            <option value="linkedin">LinkedIn</option>
            <option value="x">X</option>
          </SelectField>
          <SelectField className="w-40" value={status} onChange={(v) => setStatus(v as typeof status)}>
            <option value="all">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SelectField>
        </div>
      </div>
      <div className="max-w-md">
        <SearchInput value={q} onChange={setQ} placeholder="Search scheduled content..." />
      </div>

      {demoMode && (
        <Notice tone="info">
          <strong>Demonstration data.</strong> No content has been scheduled yet, so sample items are shown. Use Schedule Content to add real posts.
        </Notice>
      )}
      {error && (
        <Notice tone="error">
          {error}{" "}
          <button type="button" onClick={() => setReload((n) => n + 1)} className="font-semibold underline">
            Try again
          </button>
        </Notice>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm">
          {busyLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
              <Loader2 className="animate-spin text-blue-600" />
            </div>
          )}
          <div className="overflow-x-auto">
            {view === "day" ? (
              <div className="min-h-64 divide-y divide-slate-100 p-4">
                {(byDay.get(dayKey(cursor)) ?? []).length === 0 ? (
                  <p className="py-16 text-center text-sm text-slate-500">Nothing scheduled for this day.</p>
                ) : (
                  (byDay.get(dayKey(cursor)) ?? []).map((c) => (
                    <button key={c.id} type="button" onClick={() => setDetails(c)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50">
                      <span className="w-20 shrink-0 text-xs font-medium text-slate-600">{format(when(c), "hh:mm a")}</span>
                      <ContentThumb item={c} className="h-12 w-16 shrink-0 rounded-md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{c.title}</span>
                        <span className="block truncate text-xs text-slate-500">{brands.find((b) => b.id === c.brandId)?.name}</span>
                      </span>
                      <StatusBadge status={c.status} />
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="min-w-[640px]">
                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-xs font-semibold text-slate-700">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="py-2.5">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {days.map((d) => {
                    const list = byDay.get(dayKey(d)) ?? [];
                    const isToday = isSameDay(d, today);
                    const isSel = isSameDay(d, selected);
                    const outside = view === "month" && !isSameMonth(d, cursor);
                    const max = view === "month" ? 2 : 12;
                    return (
                      <div
                        key={dayKey(d)}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelected(d)}
                        onDoubleClick={() => {
                          openDay(d);
                          setView("day");
                        }}
                        onKeyDown={(e) => e.key === "Enter" && setSelected(d)}
                        className={`border-b border-r border-slate-100 p-1.5 ${view === "month" ? "min-h-28" : "min-h-72"} ${
                          outside ? "bg-slate-50/60" : ""
                        } ${isSel ? "bg-blue-50/50 ring-1 ring-inset ring-blue-300" : ""}`}
                      >
                        <span
                          className={`mb-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${
                            isToday ? "bg-blue-600 font-semibold text-white" : outside ? "text-slate-300" : "text-slate-700"
                          }`}
                        >
                          {format(d, "d")}
                        </span>
                        <div className="space-y-1">
                          {list.slice(0, max).map((c) => (
                            <Chip key={c.id} item={c} onOpen={() => setDetails(c)} />
                          ))}
                          {list.length > max && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDay(d);
                                setView("day");
                              }}
                              className="w-full rounded-md bg-slate-100 px-1.5 py-0.5 text-left text-[11px] font-medium text-slate-600 hover:bg-slate-200"
                            >
                              +{list.length - max} more
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Upcoming Content</h2>
            <button type="button" onClick={() => navigate("/content?status=Scheduled")} className="text-xs font-medium text-blue-600 hover:underline">
              View All →
            </button>
          </div>
          {upcomingShown.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No upcoming content.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {upcomingShown.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setDetails(c)} className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50">
                    <ContentThumb item={c} className="h-14 w-14 shrink-0 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">{c.title}</span>
                      <span className="block truncate text-xs text-slate-500">{brands.find((b) => b.id === c.brandId)?.name}</span>
                      <span className="block text-xs text-slate-500">{format(when(c), "MMM d, yyyy · hh:mm a")}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1.5">
                      <span className="flex gap-1">
                        {c.platforms.slice(0, 2).map((p) => (
                          <PlatformIcon key={p} platform={p} size="xs" />
                        ))}
                      </span>
                      <StatusBadge status={c.status} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {details && (
        <ContentDetailsModal
          item={details}
          onClose={() => setDetails(null)}
          footer={
            editable(details) ? (
              <Link to={`/content/${details.id}/edit`} className={primaryButton}>
                Edit content
              </Link>
            ) : (
              <Link to="/content" className="text-sm font-medium text-blue-600 hover:underline">
                Manage in Content
              </Link>
            )
          }
        />
      )}
    </div>
  );
}
