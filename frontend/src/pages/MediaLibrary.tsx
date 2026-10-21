import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MediaCard, MediaRow } from "../components/media/MediaCard";
import { MediaFilterPanel, type KindFilter } from "../components/media/MediaFilterPanel";
import { MediaPreviewModal } from "../components/media/MediaPreviewModal";
import { UploadMediaModal } from "../components/media/UploadMediaModal";
import type { MenuAction } from "../components/ui/KebabMenu";
import { Notice, SearchInput, SelectField, ViewToggle, type Layout } from "../components/ui/ListControls";
import { ConfirmDialog } from "../components/ui/Overlay";
import { useBrands } from "../context/BrandsContext";
import { demoMedia } from "../data/demoMedia";
import { useDebounced } from "../lib/useDebounced";
import {
  apiErrorMessage,
  deleteMedia,
  downloadMedia,
  listMedia,
  type MediaQuery,
} from "../services/mediaService";
import type { MediaItem, MediaKind, PlatformKey } from "../types";

const PAGE_SIZE = 30;
type Sort = "newest" | "oldest" | "name";

interface Filters {
  q: string;
  brandIds: string[];
  kind: KindFilter;
  platform: PlatformKey | "all";
  sort: Sort;
}

/** Client-side equivalent of the server filters, used only for demonstration data. */
function filterDemo(items: MediaItem[], f: Filters, ignoreKind = false): MediaItem[] {
  const q = f.q.trim().toLowerCase();
  const out = items.filter(
    (m) =>
      (!q || m.title.toLowerCase().includes(q)) &&
      (!f.brandIds.length || f.brandIds.includes(m.brandId)) &&
      (f.platform === "all" || m.platforms.includes(f.platform)) &&
      (ignoreKind || f.kind === "all" || m.kind === f.kind),
  );
  return out.sort((a, b) =>
    f.sort === "name"
      ? a.title.localeCompare(b.title)
      : f.sort === "oldest"
        ? a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt),
  );
}

const countBy = (items: MediaItem[], key: (m: MediaItem) => string) =>
  items.reduce<Record<string, number>>((acc, m) => ({ ...acc, [key(m)]: (acc[key(m)] ?? 0) + 1 }), {});

export default function MediaLibrary() {
  const { brands } = useBrands();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({ q: "", brandIds: [], kind: "all", platform: "all", sort: "newest" });
  const [layout, setLayout] = useState<Layout>("grid");
  const debouncedQ = useDebounced(filters.q);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [kindCounts, setKindCounts] = useState<Record<string, number>>({});
  const [brandCounts, setBrandCounts] = useState<Record<string, number>>({});
  const [libraryEmpty, setLibraryEmpty] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [toDelete, setToDelete] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p }));

  const query = useMemo((): MediaQuery => {
    const q: MediaQuery = { sort: filters.sort, limit: PAGE_SIZE };
    if (debouncedQ.trim()) q.q = debouncedQ.trim();
    if (filters.brandIds.length) q.brandId = filters.brandIds.join(",");
    if (filters.kind !== "all") q.kind = filters.kind;
    if (filters.platform !== "all") q.platform = filters.platform;
    return q;
  }, [debouncedQ, filters.brandIds, filters.kind, filters.platform, filters.sort]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listMedia({ ...query, page: 1 })
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setTotal(r.total);
        setKindCounts(r.kindCounts);
        setBrandCounts(r.brandCounts);
        setLibraryEmpty(Object.keys(r.brandCounts).length === 0);
        setPage(1);
      })
      .catch((e: unknown) => !cancelled && setError(apiErrorMessage(e, "Could not load media. Is the backend running?")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query, reload]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const r = await listMedia({ ...query, page: page + 1 });
      setItems((prev) => [...prev, ...r.items]);
      setPage(page + 1);
    } catch (e) {
      setNotice({ tone: "error", text: apiErrorMessage(e, "Could not load more media.") });
    } finally {
      setLoadingMore(false);
    }
  }, [query, page]);

  // Demonstration data only appears when the library holds no real uploads at all.
  const demoMode = !loading && !error && libraryEmpty;
  const demoVisible = useMemo(() => (demoMode ? filterDemo(demoMedia, filters) : []), [demoMode, filters]);
  const shown = demoMode ? demoVisible : items;
  const shownTotal = demoMode ? demoVisible.length : total;

  const panelKindCounts = demoMode ? countBy(filterDemo(demoMedia, filters, true), (m) => m.kind) : kindCounts;
  const panelBrandCounts = demoMode ? countBy(demoMedia, (m) => m.brandId) : brandCounts;

  const toggleBrand = (id: string) =>
    patch({ brandIds: filters.brandIds.includes(id) ? filters.brandIds.filter((b) => b !== id) : [...filters.brandIds, id] });

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteMedia(toDelete.id);
      setNotice({ tone: "success", text: `"${toDelete.title}" was deleted.` });
      setToDelete(null);
      setPreview(null);
      setReload((n) => n + 1);
    } catch (e) {
      setNotice({ tone: "error", text: apiErrorMessage(e, "Could not delete this media.") });
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const download = async (m: MediaItem) => {
    try {
      await downloadMedia(m);
    } catch (e) {
      setNotice({ tone: "error", text: apiErrorMessage(e, "Download failed.") });
    }
  };

  const openInContent = (m: MediaItem) => navigate(`/content/new?mediaId=${m.id}`);

  const actionsFor = (m: MediaItem): MenuAction[] => [
    { label: "Preview", onSelect: () => setPreview(m) },
    { label: "Download", onSelect: () => void download(m), disabled: !!m.demo, hint: "Demonstration item" },
    { label: "Use in content", onSelect: () => openInContent(m), disabled: !!m.demo, hint: "Demonstration item" },
    { label: "Delete", onSelect: () => setToDelete(m), danger: true, disabled: !!m.demo, hint: "Demonstration item" },
  ];

  const kinds: MediaKind[] = ["Image", "Video", "Reel", "Short", "Carousel"];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Media Library</h1>
          <p className="mt-2 text-sm text-slate-500">Manage your media files and reuse them across your content.</p>
        </div>
        <button
          type="button"
          onClick={() => setUploading(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus size={18} />
          Upload Media
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[14rem] flex-[2] basis-64">
          <SearchInput value={filters.q} onChange={(q) => patch({ q })} placeholder="Search media..." />
        </div>
        <SelectField
          className="w-44"
          value={filters.brandIds.length === 1 ? (filters.brandIds[0] ?? "all") : filters.brandIds.length ? "multi" : "all"}
          onChange={(v) => patch({ brandIds: v === "all" ? [] : [v] })}
        >
          <option value="all">All Brands</option>
          {filters.brandIds.length > 1 && (
            <option value="multi" disabled>
              {filters.brandIds.length} brands
            </option>
          )}
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </SelectField>
        <SelectField className="w-40" value={filters.kind} onChange={(v) => patch({ kind: v as KindFilter })}>
          <option value="all">All Types</option>
          {kinds.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </SelectField>
        <SelectField className="w-44" value={filters.platform} onChange={(v) => patch({ platform: v as Filters["platform"] })}>
          <option value="all">All Platforms</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="youtube">YouTube</option>
          <option value="linkedin">LinkedIn</option>
          <option value="x">X</option>
        </SelectField>
        <SelectField className="w-40 sm:ml-auto" value={filters.sort} onChange={(v) => patch({ sort: v as Sort })}>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="name">Name (A–Z)</option>
        </SelectField>
        <ViewToggle layout={layout} onChange={setLayout} />
      </div>

      {notice && (
        <Notice tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}
      {demoMode && (
        <Notice tone="info">
          <strong>Demonstration data.</strong> Your library is empty, so sample items are shown to preview the layout.
          Upload media to replace them.
        </Notice>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <MediaFilterPanel
          kind={filters.kind}
          onKind={(kind) => patch({ kind })}
          kindCounts={panelKindCounts}
          brandIds={filters.brandIds}
          onToggleBrand={toggleBrand}
          brandCounts={panelBrandCounts}
        />

        <div className="min-w-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin" /> Loading media…
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
              No media matches your filters.
            </div>
          ) : (
            <>
              <div
                className={
                  layout === "grid"
                    ? "grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                    : "space-y-2"
                }
              >
                {shown.map((m) =>
                  layout === "grid" ? (
                    <MediaCard key={m.id} item={m} actions={actionsFor(m)} onOpen={() => setPreview(m)} />
                  ) : (
                    <MediaRow key={m.id} item={m} actions={actionsFor(m)} onOpen={() => setPreview(m)} />
                  ),
                )}
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>
                  Showing {shown.length} of {shownTotal} items
                </span>
                {!demoMode && shown.length < shownTotal && (
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {uploading && (
        <UploadMediaModal
          defaultBrandId={filters.brandIds[0]}
          onClose={() => setUploading(false)}
          onUploaded={(item) => {
            setNotice({ tone: "success", text: `"${item.title}" was uploaded.` });
            setReload((n) => n + 1);
          }}
        />
      )}
      {preview && (
        <MediaPreviewModal
          item={preview}
          onClose={() => setPreview(null)}
          onDownload={() => void download(preview)}
          onUse={() => openInContent(preview)}
          onDelete={() => setToDelete(preview)}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          title="Delete media?"
          message={`"${toDelete.title}" will be permanently deleted and removed from any content that uses it.`}
          busy={deleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
