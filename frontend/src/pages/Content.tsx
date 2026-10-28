import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Plus, Sparkles } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ContentCard, ContentRow } from "../components/content/ContentCard";
import { ContentDetailsModal, ScheduleModal } from "../components/content/ContentModals";
import type { MenuAction } from "../components/ui/KebabMenu";
import {
  Notice,
  Pagination,
  SearchInput,
  SelectField,
  ViewToggle,
  type Layout,
} from "../components/ui/ListControls";
import { ConfirmDialog } from "../components/ui/Overlay";
import { useBrands } from "../context/BrandsContext";
import { buildDemoContent } from "../data/demoContent";
import { useDebounced } from "../lib/useDebounced";
import { apiErrorMessage } from "../services/mediaService";
import {
  apiFullMessage,
  publishContentNow,
  rescheduleContent,
  changeContentStatus,
  deleteContent,
  duplicateContent,
  listContent,
  type ContentQuery,
} from "../services/contentService";
import type { ContentItem, ContentType, ContentWorkflowStatus, PlatformKey } from "../types";

const PAGE_SIZE = 8;

const STATUSES: { key: ContentWorkflowStatus | "all"; label: string }[] = [
  { key: "all", label: "All Content" },
  { key: "Draft", label: "Draft" },
  { key: "Pending Approval", label: "Pending Approval" },
  { key: "Approved", label: "Approved" },
  { key: "Scheduled", label: "Scheduled" },
  { key: "Publishing", label: "Publishing" },
  { key: "Published", label: "Published" },
  { key: "Failed", label: "Failed" },
  { key: "Cancelled", label: "Cancelled" },
  { key: "Rejected", label: "Rejected" },
];
const TYPES: ContentType[] = ["Image", "Reel", "Carousel", "Video", "Short", "Text"];

interface Filters {
  q: string;
  brandId: string;
  platform: PlatformKey | "all";
  type: ContentType | "all";
}

/** Client-side equivalent of the server filters, used only for demonstration data. */
function filterDemo(items: ContentItem[], f: Filters, status: string): ContentItem[] {
  const q = f.q.trim().toLowerCase();
  return items.filter(
    (c) =>
      (!q || [c.title, c.caption, ...c.hashtags].join(" ").toLowerCase().includes(q)) &&
      (f.brandId === "all" || c.brandId === f.brandId) &&
      (f.platform === "all" || c.platforms.includes(f.platform)) &&
      (f.type === "all" || c.type === f.type) &&
      (status === "all" || c.status === status),
  );
}

const isStatus = (v: string | null): v is ContentWorkflowStatus => STATUSES.some((s) => s.key === v && v !== "all");

export default function Content() {
  const { brands } = useBrands();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const rawStatus = params.get("status");
  const status: ContentWorkflowStatus | "all" = isStatus(rawStatus) ? rawStatus : "all";

  const [filters, setFilters] = useState<Filters>({ q: "", brandId: "all", platform: "all", type: "all" });
  const [layout, setLayout] = useState<Layout>("grid");
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounced(filters.q);

  const [items, setItems] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [libraryEmpty, setLibraryEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [details, setDetails] = useState<ContentItem | null>(null);
  const [scheduling, setScheduling] = useState<ContentItem | null>(null);
  const [toDelete, setToDelete] = useState<ContentItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const patch = (p: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...p }));
    setPage(1);
  };
  const setStatus = (s: string) => {
    setParams(s === "all" ? {} : { status: s }, { replace: true });
    setPage(1);
  };

  const query = useMemo((): ContentQuery => {
    const q: ContentQuery = { page, limit: PAGE_SIZE };
    if (debouncedQ.trim()) q.q = debouncedQ.trim();
    if (filters.brandId !== "all") q.brandId = filters.brandId;
    if (filters.platform !== "all") q.platform = filters.platform;
    if (filters.type !== "all") q.type = filters.type;
    if (status !== "all") q.status = status;
    return q;
  }, [page, debouncedQ, filters.brandId, filters.platform, filters.type, status]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listContent(query)
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setTotal(r.total);
        setStatusCounts(r.statusCounts);
        // statusCounts ignore the status filter, so with no other filter they show whether
        // any real content exists. Filtered responses can't tell, so keep the last answer.
        if (!query.q && !query.brandId && !query.platform && !query.type) {
          setLibraryEmpty(Object.keys(r.statusCounts).length === 0);
        }
      })
      .catch((e: unknown) => !cancelled && setError(apiErrorMessage(e, "Could not load content. Is the backend running?")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query, reload]);

  // While something is being published, refresh until it settles.
  const anyPublishing = items.some((i) => i.status === "Publishing");
  useEffect(() => {
    if (!anyPublishing) return;
    const t = setInterval(() => setReload((n) => n + 1), 4000);
    return () => clearInterval(t);
  }, [anyPublishing]);

  // Demonstration data is shown only while the database holds no content at all.
  const demoMode = !loading && !error && libraryEmpty;
  const demoContent = useMemo(() => buildDemoContent(brands.map((b) => b.id)), [brands]);
  const demoMatches = useMemo(() => (demoMode ? filterDemo(demoContent, filters, status) : []), [demoMode, demoContent, filters, status]);
  const shownTotal = demoMode ? demoMatches.length : total;
  const shown = demoMode ? demoMatches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : items;
  const pageCount = Math.max(1, Math.ceil(shownTotal / PAGE_SIZE));

  const counts: Record<string, number> = useMemo(() => {
    const base = demoMode
      ? filterDemo(demoContent, filters, "all").reduce<Record<string, number>>(
          (acc, c) => ({ ...acc, [c.status]: (acc[c.status] ?? 0) + 1 }),
          {},
        )
      : statusCounts;
    return { ...base, all: Object.values(base).reduce((a, b) => a + b, 0) };
  }, [demoMode, demoContent, filters, statusCounts]);

  const run = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await work();
      setNotice({ tone: "success", text: success });
      setReload((n) => n + 1);
      return true;
    } catch (e) {
      setNotice({ tone: "error", text: apiFullMessage(e, "That action failed. Please try again.") });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const move = (c: ContentItem, to: ContentWorkflowStatus, success: string) =>
    void run(() => changeContentStatus(c.id, to), success);

  const actionsFor = (c: ContentItem): MenuAction[] => {
    const demo = { disabled: !!c.demo, hint: "Demonstration item" };
    const acts: MenuAction[] = [{ label: "View details", onSelect: () => setDetails(c) }];
    if (["Draft", "Rejected", "Failed", "Cancelled", "Scheduled"].includes(c.status)) {
      acts.push({ label: "Edit", onSelect: () => navigate(`/content/${c.id}/edit`), ...demo });
    }
    if (c.status === "Draft" || c.status === "Rejected") {
      acts.push({ label: "Submit for approval", onSelect: () => move(c, "Pending Approval", "Submitted for approval."), ...demo });
    }
    if (["Draft", "Approved", "Scheduled", "Failed", "Cancelled"].includes(c.status)) {
      acts.push({
        label: c.status === "Failed" ? "Retry now" : "Publish now",
        onSelect: () => {
          if (window.confirm(`Publish "${c.title}" now to ${c.targets.length || "the selected"} account(s)?`)) {
            void run(() => publishContentNow(c.id), "Publishing started. Status updates automatically.");
          }
        },
        ...demo,
      });
    }
    if (c.status === "Pending Approval") {
      acts.push({ label: "Approve", onSelect: () => move(c, "Approved", "Content approved."), ...demo });
      acts.push({ label: "Reject", onSelect: () => move(c, "Rejected", "Content rejected."), ...demo });
    }
    if (["Draft", "Approved", "Failed", "Cancelled"].includes(c.status)) {
      acts.push({ label: "Schedule", onSelect: () => setScheduling(c), ...demo });
    }
    if (c.status === "Scheduled") {
      acts.push({ label: "Reschedule", onSelect: () => setScheduling(c), ...demo });
      acts.push({ label: "Cancel scheduling", onSelect: () => move(c, "Cancelled", "Scheduling cancelled."), ...demo });
    }
    if (["Pending Approval", "Approved", "Scheduled", "Failed", "Cancelled"].includes(c.status)) {
      acts.push({ label: "Move to Draft", onSelect: () => move(c, "Draft", "Moved back to draft."), ...demo });
    }
    acts.push({
      label: "Duplicate",
      onSelect: () => void run(() => duplicateContent(c.id), `Duplicated "${c.title}" as a draft.`),
      ...demo,
    });
    acts.push({ label: "Delete", onSelect: () => setToDelete(c), danger: true, ...demo });
    return acts;
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const target = toDelete;
    await run(() => deleteContent(target.id), `"${target.title}" was deleted.`);
    setToDelete(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-slate-900">
            <FileText size={28} className="text-blue-600" />
            Content
          </h1>
          <p className="mt-2 text-sm text-slate-500">Manage all your social media content in one place.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/content/ai"
            className="flex items-center gap-2 rounded-lg border border-blue-600 bg-white px-5 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50"
          >
            <Sparkles size={18} />
            Generate with AI
          </Link>
        <Link
          to="/content/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus size={18} />
          Create Content
        </Link>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200/70 bg-white p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]">
        <div className="flex items-center sm:col-span-2 xl:col-span-1">
          <SearchInput
            value={filters.q}
            onChange={(q) => patch({ q })}
            placeholder="Search by caption, hashtag, or title..."
          />
        </div>
        <SelectField label="Brand" value={filters.brandId} onChange={(brandId) => patch({ brandId })}>
          <option value="all">All Brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Platform" value={filters.platform} onChange={(v) => patch({ platform: v as Filters["platform"] })}>
          <option value="all">All Platforms</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="youtube">YouTube</option>
          <option value="linkedin">LinkedIn</option>
          <option value="x">X</option>
        </SelectField>
        <SelectField label="Status" value={status} onChange={setStatus}>
          <option value="all">All Statuses</option>
          {STATUSES.slice(1).map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Content Type" value={filters.type} onChange={(v) => patch({ type: v as Filters["type"] })}>
          <option value="all">All Types</option>
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </SelectField>
        <div className="flex items-center justify-end">
          <ViewToggle layout={layout} onChange={setLayout} />
        </div>
      </div>

      <div role="tablist" aria-label="Content status" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200/70 bg-white px-3 shadow-sm">
        {STATUSES.map((s) => {
          const active = status === s.key;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatus(s.key)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-4 text-sm font-medium ${
                active ? "border-blue-600 text-blue-600" : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {s.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  active ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {counts[s.key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {notice && (
        <Notice tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      {demoMode && (
        <Notice tone="info">
          <strong>Demonstration data.</strong> No content exists yet, so sample items are shown to preview the layout.
          They are read-only. Use Create Content to add real posts.
        </Notice>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
          <Loader2 size={18} className="animate-spin" /> Loading content…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => setReload((n) => n + 1)}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          No content matches your filters.
        </div>
      ) : (
        <>
          <div
            className={
              layout === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "space-y-2"
            }
          >
            {shown.map((c) =>
              layout === "grid" ? (
                <ContentCard key={c.id} item={c} actions={actionsFor(c)} onOpen={() => setDetails(c)} />
              ) : (
                <ContentRow key={c.id} item={c} actions={actionsFor(c)} onOpen={() => setDetails(c)} />
              ),
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + shown.length} of {shownTotal} content items
            </p>
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          </div>
        </>
      )}

      {details && <ContentDetailsModal item={details} onClose={() => setDetails(null)} />}
      {scheduling && (
        <ScheduleModal
          item={scheduling}
          busy={busy}
          onClose={() => setScheduling(null)}
          onSubmit={(iso) => {
            const target = scheduling;
            void run(
              () => (target.status === "Scheduled" ? rescheduleContent(target.id, iso) : changeContentStatus(target.id, "Scheduled", iso)),
              target.status === "Scheduled" ? "Post rescheduled." : "Content scheduled.",
            ).then((ok) => {
              if (ok) setScheduling(null);
            });
          }}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          title="Delete content?"
          message={`"${toDelete.title}" will be permanently deleted.`}
          busy={busy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
