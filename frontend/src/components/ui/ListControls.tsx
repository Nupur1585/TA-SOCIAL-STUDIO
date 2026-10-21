import type { ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, List, Search } from "lucide-react";

export type Layout = "grid" | "list";

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block min-w-0 flex-1">
      <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400"
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  children,
  className = "",
}: {
  /** Small caption shown above the value (Content page). Omit for a plain select. */
  label?: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`relative flex flex-col justify-center rounded-lg border border-slate-200 bg-white px-3 ${
        label ? "h-14" : "h-11"
      } ${className}`}
    >
      {label && <span className="text-[11px] leading-none text-slate-500">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label ?? "Filter"}
        className="w-full appearance-none bg-transparent pr-6 text-sm text-slate-700 outline-none"
      >
        {children}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
    </label>
  );
}

export function ViewToggle({
  layout,
  onChange,
}: {
  layout: Layout;
  onChange: (l: Layout) => void;
}) {
  const btn = (l: Layout, Icon: typeof List, label: string) => (
    <button
      type="button"
      onClick={() => onChange(l)}
      aria-label={label}
      aria-pressed={layout === l}
      className={`flex h-9 w-10 items-center justify-center rounded-md ${
        layout === l ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-50"
      }`}
    >
      <Icon size={18} />
    </button>
  );
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-1">
      {btn("grid", LayoutGrid, "Grid view")}
      {btn("list", List, "List view")}
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  // 1 2 3 4 5 … last, windowed around the current page.
  const shown = [...new Set([1, 2, page - 1, page, page + 1, pageCount])]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);
  const pages: (number | "gap")[] = [];
  shown.forEach((p, i) => {
    const prev = shown[i - 1];
    if (prev !== undefined && p - prev > 1) pages.push("gap");
    pages.push(p);
  });
  const cell = "flex h-9 min-w-9 items-center justify-center rounded-md border text-sm";
  return (
    <nav className="flex items-center gap-1.5" aria-label="Pagination">
      <button
        type="button"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
        className={`${cell} border-slate-200 bg-white text-slate-600 disabled:opacity-40`}
      >
        <ChevronLeft size={16} />
      </button>
      {pages.map((p, i) =>
        p === "gap" ? (
          <span key={`g${i}`} className="px-1 text-slate-400">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={`${cell} ${
              p === page
                ? "border-blue-600 bg-blue-600 font-semibold text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={page === pageCount}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
        className={`${cell} border-slate-200 bg-white text-slate-600 disabled:opacity-40`}
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

export function Notice({
  tone,
  children,
  onClose,
}: {
  tone: "success" | "error" | "info";
  children: ReactNode;
  onClose?: () => void;
}) {
  const cls = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    error: "border-red-200 bg-red-50 text-red-700",
    info: "border-sky-200 bg-sky-50 text-sky-800",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-3 rounded-lg border px-4 py-2.5 text-sm ${cls}`}>
      <div className="flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="font-semibold opacity-70 hover:opacity-100">
          ×
        </button>
      )}
    </div>
  );
}
