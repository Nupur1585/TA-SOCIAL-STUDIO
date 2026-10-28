import { useEffect, useMemo, useState } from "react";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { CheckCircle2, Clock, Download, FileBarChart, FileText, Loader2, Plus, Send } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { KebabMenu } from "../components/ui/KebabMenu";
import { Notice, Pagination, SearchInput, SelectField } from "../components/ui/ListControls";
import { MetricCard } from "../components/ui/MetricCard";
import { ConfirmDialog, Modal } from "../components/ui/Overlay";
import { PageHeader, primaryButton } from "../components/ui/PageHeader";
import { PlatformIcon } from "../components/ui/PlatformIcon";
import { StatusBadge, type BadgeTone } from "../components/ui/StatusBadge";
import { useBrands } from "../context/BrandsContext";
import { RANGE_OPTIONS, rangeBounds } from "../lib/dateRange";
import { formatDate } from "../lib/format";
import { useDebounced } from "../lib/useDebounced";
import { apiErrorMessage } from "../services/mediaService";
import {
  createReport,
  deleteReport,
  downloadReport,
  listReports,
  type ReportFormat,
  type ReportItem,
  type ReportList,
  type ReportQuery,
  type ReportStatus,
  type ReportType,
} from "../services/reportService";
import type { PlatformKey } from "../types";

const PAGE_SIZE = 6;
const TYPES: ReportType[] = ["Content Summary", "Schedule Overview", "Media Inventory", "Publishing History"];
const STATUSES: ReportStatus[] = ["Ready", "Processing", "Scheduled", "Failed"];
const PLATFORMS: PlatformKey[] = ["instagram", "facebook", "youtube", "linkedin", "x"];
const tone: Record<ReportStatus, BadgeTone> = { Ready: "green", Processing: "blue", Scheduled: "purple", Failed: "red" };

const range = (r: ReportItem) => `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`;
const inputCls = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400";

export default function Reports() {
  const { brands } = useBrands();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [brandId, setBrandId] = useState("all");
  const [type, setType] = useState<ReportType | "all">("all");
  const [status, setStatus] = useState<ReportStatus | "all">("all");
  const [rangeKey, setRangeKey] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounced(q);

  const [data, setData] = useState<ReportList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const [creating, setCreating] = useState(params.get("create") === "1");
  const [detail, setDetail] = useState<ReportItem | null>(null);
  const [toDelete, setToDelete] = useState<ReportItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // Deep link from Analytics: /reports?create=1 opens the form, then cleans the URL.
  useEffect(() => {
    if (params.get("create") === "1") setParams({}, { replace: true });
  }, [params, setParams]);

  const query = useMemo((): ReportQuery => {
    const out: ReportQuery = { sort, page, limit: PAGE_SIZE, ...rangeBounds(rangeKey) };
    if (debouncedQ.trim()) out.q = debouncedQ.trim();
    if (brandId !== "all") out.brandId = brandId;
    if (type !== "all") out.type = type;
    if (status !== "all") out.status = status;
    return out;
  }, [debouncedQ, brandId, type, status, rangeKey, sort, page]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listReports(query)
      .then((r) => !cancelled && setData(r))
      .catch((e: unknown) => !cancelled && setError(apiErrorMessage(e, "Could not load reports. Is the backend running?")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query, reload]);

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const download = async (r: ReportItem) => {
    try {
      await downloadReport(r);
    } catch (e) {
      setNotice({ tone: "error", text: apiErrorMessage(e, "Download failed.") });
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await deleteReport(toDelete.id);
      setNotice({ tone: "success", text: `"${toDelete.name}" was deleted.` });
      setReload((n) => n + 1);
    } catch (e) {
      setNotice({ tone: "error", text: apiErrorMessage(e, "Could not delete this report.") });
    } finally {
      setBusy(false);
      setToDelete(null);
    }
  };

  const s = data?.summary;
  const finished = (s?.ready ?? 0) + (s?.failed ?? 0);
  const rate = finished ? `${Math.round(((s?.ready ?? 0) / finished) * 100)}% success rate` : "No reports yet";
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <PageHeader icon={FileBarChart} title="Reports" subtitle="Create, download, and manage social media performance reports.">
        <button type="button" onClick={() => setCreating(true)} className={primaryButton}>
          <Plus size={18} /> Create Report
        </button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Reports" value={s?.total ?? "–"} icon={FileText} tone="purple" footer="All time reports" />
        <MetricCard title="Reports Generated" value={s?.ready ?? "–"} icon={CheckCircle2} tone="green" footer={rate} />
        <MetricCard title="Scheduled Reports" value={s?.scheduled ?? "–"} icon={Clock} tone="orange" footer="Upcoming scheduled" />
        <MetricCard title="Available for Download" value={s?.ready ?? "–"} icon={Send} tone="blue" footer="Ready to download" />
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200/70 bg-white p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))]">
        <div className="flex items-center sm:col-span-2 xl:col-span-1">
          <SearchInput value={q} onChange={reset(setQ)} placeholder="Search reports..." />
        </div>
        <SelectField value={brandId} onChange={reset(setBrandId)}>
          <option value="all">All Brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </SelectField>
        <SelectField value={type} onChange={reset((v) => setType(v as typeof type))}>
          <option value="all">All Report Types</option>
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </SelectField>
        <SelectField value={status} onChange={reset((v) => setStatus(v as typeof status))}>
          <option value="all">All Statuses</option>
          {STATUSES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </SelectField>
        <SelectField value={rangeKey} onChange={reset(setRangeKey)}>
          {RANGE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </SelectField>
        <SelectField value={sort} onChange={reset((v) => setSort(v as typeof sort))}>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="name">Name (A–Z)</option>
        </SelectField>
      </div>

      {notice && (
        <Notice tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold text-slate-700">
                {["Report Name", "Brand", "Type", "Date Range", "Created By", "Created Date", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    <Loader2 size={18} className="mr-2 inline animate-spin" /> Loading reports…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <p className="text-sm font-medium text-red-700">{error}</p>
                    <button type="button" onClick={() => setReload((n) => n + 1)} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                      Try again
                    </button>
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    {s?.total ? "No reports match your filters." : "No reports yet. Click Create Report to generate your first one."}
                  </td>
                </tr>
              ) : (
                data.items.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs font-medium text-slate-900">
                      <button type="button" onClick={() => setDetail(r)} className="text-left hover:text-blue-600">
                        {r.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">{r.brandName}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{r.type}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{range(r)}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{r.createdByEmail}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} tone={tone[r.status]} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={r.status !== "Ready"}
                          onClick={() => void download(r)}
                          aria-label={`Download ${r.name}`}
                          title={r.status === "Ready" ? "Download" : "Not available until the report is Ready"}
                          className="rounded p-1.5 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Download size={16} />
                        </button>
                        <KebabMenu
                          actions={[
                            { label: "View details", onSelect: () => setDetail(r) },
                            { label: "Delete", onSelect: () => setToDelete(r), danger: true },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && !error && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Showing {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + (data?.items.length ?? 0)} of {total} reports
          </p>
          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </div>
      )}

      {creating && (
        <CreateReportModal
          onClose={() => setCreating(false)}
          onCreated={(r) => {
            setNotice({ tone: "success", text: `"${r.name}" is ready to download.` });
            setReload((n) => n + 1);
          }}
        />
      )}
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {[
              ["Brand", detail.brandName],
              ["Type", detail.type],
              ["Format", detail.format],
              ["Date range", range(detail)],
              ["Created by", detail.createdByEmail],
              ["Created", new Date(detail.createdAt).toLocaleString()],
              ["Records", detail.rowCount ?? "—"],
              ["File size", detail.size ? `${Math.max(1, Math.round(detail.size / 1024))} KB` : "—"],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="text-xs text-slate-500">{k}</dt>
                <dd className="mt-1 text-slate-800">{v}</dd>
              </div>
            ))}
            <div>
              <dt className="text-xs text-slate-500">Status</dt>
              <dd className="mt-1">
                <StatusBadge status={detail.status} tone={tone[detail.status]} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Platforms</dt>
              <dd className="mt-1 flex gap-1">
                {detail.platforms.length ? detail.platforms.map((p) => <PlatformIcon key={p} platform={p} size="sm" />) : <span className="text-slate-500">All</span>}
              </dd>
            </div>
          </dl>
          {detail.error && <div className="mt-4"><Notice tone="error">{detail.error}</Notice></div>}
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              disabled={detail.status !== "Ready"}
              onClick={() => void download(detail)}
              className={primaryButton}
            >
              <Download size={16} /> Download
            </button>
          </div>
        </Modal>
      )}
      {toDelete && (
        <ConfirmDialog
          title="Delete report?"
          message={`"${toDelete.name}" and its generated file will be permanently deleted.`}
          busy={busy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

function CreateReportModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: ReportItem) => void }) {
  const { brands, selectedBrandId } = useBrands();
  const today = format(new Date(), "yyyy-MM-dd");
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState(selectedBrandId || "all");
  const [type, setType] = useState<ReportType>("Content Summary");
  const [start, setStart] = useState(format(subDays(new Date(), 29), "yyyy-MM-dd"));
  const [end, setEnd] = useState(today);
  const [platforms, setPlatforms] = useState<PlatformKey[]>([]);
  const [fmt, setFmt] = useState<ReportFormat>("PDF");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const submit = async () => {
    if (!name.trim()) return setError("Enter a report name.");
    if (!start || !end) return setError("Choose a start and end date.");
    if (start > end) return setError("The end date must be on or after the start date.");
    const brandName = brandId === "all" ? "All Brands" : (brands.find((b) => b.id === brandId)?.name ?? "Unknown brand");
    setError(null);
    setWorking(true);
    try {
      const r = await createReport({
        name: name.trim(),
        brandId,
        brandName,
        type,
        format: fmt,
        startDate: startOfDay(new Date(`${start}T00:00:00`)).toISOString(),
        endDate: endOfDay(new Date(`${end}T00:00:00`)).toISOString(),
        platforms,
      });
      onCreated(r);
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e, "Report generation failed. Please try again."));
      setWorking(false);
    }
  };

  const toggle = (p: PlatformKey) => setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  return (
    <Modal title="Create Report" onClose={working ? () => {} : onClose}>
      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Report name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={`mt-1 ${inputCls}`} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Brand
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={`mt-1 ${inputCls}`}>
              <option value="all">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Report type
            <select value={type} onChange={(e) => setType(e.target.value as ReportType)} className={`mt-1 ${inputCls}`}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Start date
            <input type="date" value={start} max={end || undefined} onChange={(e) => setStart(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            End date
            <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Platforms (none selected = all)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <label
                key={p}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                  platforms.includes(p) ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"
                }`}
              >
                <input type="checkbox" className="sr-only" checked={platforms.includes(p)} onChange={() => toggle(p)} />
                {p === "x" ? "X" : p}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Output format</legend>
          <div className="mt-2 flex gap-4 text-sm text-slate-700">
            {(["PDF", "CSV"] as const).map((f) => (
              <label key={f} className="flex items-center gap-2">
                <input type="radio" name="fmt" checked={fmt === f} onChange={() => setFmt(f)} /> {f}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-xs text-slate-500">
          Reports are built from your content and media records. Social platform analytics are not connected yet, so no engagement figures are included.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={working} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={() => void submit()} disabled={working} className={primaryButton}>
            {working && <Loader2 size={16} className="animate-spin" />}
            {working ? "Generating…" : "Generate Report"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
