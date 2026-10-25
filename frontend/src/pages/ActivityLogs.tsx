import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Eye, Loader2, ScrollText, ShieldCheck, TriangleAlert, XCircle } from "lucide-react";
import { Notice, Pagination, SearchInput, SelectField } from "../components/ui/ListControls";
import { MetricCard } from "../components/ui/MetricCard";
import { Modal } from "../components/ui/Overlay";
import { PageHeader, primaryButton } from "../components/ui/PageHeader";
import { StatusBadge, type BadgeTone } from "../components/ui/StatusBadge";
import { formatDateTime } from "../lib/format";
import { RANGE_OPTIONS, rangeBounds } from "../lib/dateRange";
import { useDebounced } from "../lib/useDebounced";
import {
  AUDIT_CATEGORIES,
  exportAudit,
  listAudit,
  type AuditCategory,
  type AuditEntry,
  type AuditList,
  type AuditQuery,
  type AuditResult,
} from "../services/auditService";
import { apiErrorMessage } from "../services/mediaService";

const PAGE_SIZE = 8;
const resultTone: Record<AuditResult, BadgeTone> = { Success: "green", Failed: "red", Warning: "orange" };

export default function ActivityLogs() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<AuditCategory | "all">("all");
  const [user, setUser] = useState("all");
  const [result, setResult] = useState<AuditResult | "all">("all");
  const [range, setRange] = useState("30");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounced(q);

  const [data, setData] = useState<AuditList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const query = useMemo((): AuditQuery => {
    const out: AuditQuery = { sort, page, limit: PAGE_SIZE, ...rangeBounds(range) };
    if (debouncedQ.trim()) out.q = debouncedQ.trim();
    if (category !== "all") out.category = category;
    if (user !== "all") out.user = user;
    if (result !== "all") out.result = result;
    return out;
  }, [debouncedQ, category, user, result, range, sort, page]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listAudit(query)
      .then((r) => !cancelled && setData(r))
      .catch((e: unknown) => !cancelled && setError(apiErrorMessage(e, "Could not load activity logs. Is the backend running?")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query, reload]);

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const doExport = async () => {
    setExporting(true);
    setNotice(null);
    try {
      await exportAudit(query);
    } catch (e) {
      setNotice(apiErrorMessage(e, "Export failed."));
    } finally {
      setExporting(false);
    }
  };

  const s = data?.summary;
  const pct = (n: number) => (s && s.total ? `${((n / s.total) * 100).toFixed(1)}%` : "0%");
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <PageHeader icon={ScrollText} title="Activity Logs" subtitle="Monitor important actions and changes across your workspace.">
        <button type="button" onClick={() => void doExport()} disabled={exporting} className={primaryButton}>
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Export Logs
        </button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Activities" value={s?.total ?? "–"} icon={ScrollText} tone="blue" footer="For the selected filters" />
        <MetricCard title="Successful Actions" value={s?.success ?? "–"} icon={CheckCircle2} tone="green" footer={`${pct(s?.success ?? 0)} success rate`} footerTone="green" />
        <MetricCard title="Failed Actions" value={s?.failed ?? "–"} icon={XCircle} tone="red" footer={`${pct(s?.failed ?? 0)} failure rate`} footerTone="red" />
        <MetricCard title="Active Administrators" value={s?.activeAdmins ?? "–"} icon={ShieldCheck} tone="purple" footer="Admins in last 30 days" />
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200/70 bg-white p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        <div className="flex items-center sm:col-span-2 xl:col-span-1">
          <SearchInput value={q} onChange={reset(setQ)} placeholder="Search by action, user or resource..." />
        </div>
        <SelectField value={category} onChange={reset((v) => setCategory(v as typeof category))}>
          <option value="all">All Categories</option>
          {AUDIT_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </SelectField>
        <SelectField value={user} onChange={reset(setUser)}>
          <option value="all">All Users</option>
          {(data?.users ?? []).map((u) => (
            <option key={u}>{u}</option>
          ))}
        </SelectField>
        <SelectField value={result} onChange={reset((v) => setResult(v as typeof result))}>
          <option value="all">All Results</option>
          <option>Success</option>
          <option>Failed</option>
          <option>Warning</option>
        </SelectField>
        <SelectField value={range} onChange={reset(setRange)}>
          {RANGE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </SelectField>
        <SelectField value={sort} onChange={reset((v) => setSort(v as typeof sort))}>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </SelectField>
      </div>

      {notice && <Notice tone="error" onClose={() => setNotice(null)}>{notice}</Notice>}

      <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold text-slate-700">
                {["Date & Time", "Administrator", "Action", "Category", "Resource", "Result", "Details"].map((h) => (
                  <th key={h} className="px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <Loader2 size={18} className="mr-2 inline animate-spin" /> Loading activity…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <p className="text-sm font-medium text-red-700">{error}</p>
                    <button type="button" onClick={() => setReload((n) => n + 1)} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                      Try again
                    </button>
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    No activity matches your filters.
                  </td>
                </tr>
              ) : (
                data.items.map((l) => (
                  <tr key={l.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(l)}>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{formatDateTime(l.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{l.actorEmail}</td>
                    <td className={`px-4 py-3 text-xs ${l.result === "Failed" ? "text-red-600" : "text-slate-800"}`}>{l.action}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{l.category}</td>
                    <td className="max-w-[16rem] truncate px-4 py-3 text-xs text-slate-700">{l.resource || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={l.result} tone={resultTone[l.result]} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        aria-label="View details"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(l);
                        }}
                        className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      >
                        <Eye size={16} />
                      </button>
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
            Showing {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + (data?.items.length ?? 0)} of {total} activities
          </p>
          <Pagination page={page} pageCount={pageCount} onChange={setPage} />
        </div>
      )}

      {selected && (
        <Modal title="Activity details" onClose={() => setSelected(null)}>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Field label="Date & time">{new Date(selected.createdAt).toLocaleString()}</Field>
            <Field label="Administrator">{selected.actorEmail}</Field>
            <Field label="Action">{selected.action}</Field>
            <Field label="Category">{selected.category}</Field>
            <Field label="Target resource">{selected.resource || "—"}</Field>
            <Field label="Result">
              <span className="inline-flex items-center gap-1">
                {selected.result === "Warning" && <TriangleAlert size={14} className="text-orange-500" />}
                <StatusBadge status={selected.result} tone={resultTone[selected.result]} />
              </span>
            </Field>
            {selected.resourceId && <Field label="Resource ID">{selected.resourceId}</Field>}
            {Object.entries(selected.metadata).map(([k, v]) => (
              <Field key={k} label={k}>
                {v}
              </Field>
            ))}
          </dl>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs capitalize text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-slate-800">{children}</dd>
    </div>
  );
}
