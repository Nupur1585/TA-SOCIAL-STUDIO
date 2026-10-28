import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  Share2,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { AddBrandModal } from "../components/brands/AddBrandModal";
import { BrandCard } from "../components/brands/BrandCard";
import { SocialAccountsModal } from "../components/brands/SocialAccountsModal";
import { Notice } from "../components/ui/ListControls";
import { MetricCard } from "../components/ui/MetricCard";
import { useBrands } from "../context/BrandsContext";

const selectCls =
  "h-10 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-700 outline-none focus:border-blue-400";

export default function Brands() {
  const { brands, loading, error, reload, addBrand, setBrandStatus, removeBrand } = useBrands();
  const [managing, setManaging] = useState<string | null>(null);
  const [socialNotice, setSocialNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  // Ids with a request in flight, so a double click can't submit twice.
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const runFor = async (id: string, work: () => Promise<void>) => {
    if (busyIds.includes(id)) return;
    setBusyIds((ids) => [...ids, id]);
    setActionError(null);
    try {
      await work();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "That action failed.");
    } finally {
      setBusyIds((ids) => ids.filter((x) => x !== id));
    }
  };
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [timezone, setTimezone] = useState("all");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [adding, setAdding] = useState(params.get("add") === "1");

  // Quick-action deep link: /brands?add=1 opens the form, then cleans the URL.
  useEffect(() => {
    if (params.get("add") === "1") {
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  // The OAuth callback returns here with ?social=connected or ?social_error=...
  useEffect(() => {
    const ok = params.get("social") === "connected";
    const err = params.get("social_error");
    if (!ok && !err) return;
    if (ok) {
      const n = Number(params.get("count") ?? "1");
      setSocialNotice({ tone: "success", text: `Connected ${n} ${params.get("platform") ?? "social"} account${n === 1 ? "" : "s"}.` });
      setManaging(params.get("brand"));
      reload();
    } else {
      setSocialNotice({ tone: "error", text: err ?? "Could not connect the account." });
    }
    setParams({}, { replace: true });
  }, [params, setParams, reload]);

  const total = brands.length;
  const active = brands.filter((b) => b.status === "Active").length;
  const platforms = brands.reduce((n, b) => n + b.connectedAccounts, 0);
  const zones = useMemo(
    () => Array.from(new Set(brands.map((b) => b.timezone))),
    [brands],
  );

  const filtered = brands.filter((b) => {
    const q = search.trim().toLowerCase();
    const matches =
      !q ||
      [b.name, b.brandId, b.tagline, b.description, ...b.hashtags]
        .join(" ")
        .toLowerCase()
        .includes(q);
    return (
      matches &&
      (status === "all" || b.status === status) &&
      (timezone === "all" || b.timezone === timezone)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-slate-900">
            <Building2 size={28} className="text-blue-600" />
            Brands
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage your brands, their social media accounts and settings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus size={18} />
          Add Brand
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Brands"
          value={total}
          icon={Building2}
          tone="blue"
          footer="Active brands in your system"
        />
        <MetricCard
          title="Active Brands"
          value={active}
          icon={CircleCheck}
          tone="green"
          footer={`${total ? Math.round((active / total) * 100) : 0}% of total brands`}
        />
        <MetricCard
          title="Total Platforms Connected"
          value={platforms}
          icon={Share2}
          tone="purple"
          footer="Across all brands"
        />
        <MetricCard
          title="Inactive Brands"
          value={total - active}
          icon={CircleAlert}
          tone="red"
          footer={total - active === 0 ? "No inactive brands" : "Needs review"}
        />
      </div>

      <section className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-4">
          <label className="relative min-w-52 flex-1">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search brands..."
              className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-blue-400"
            />
          </label>

          <label className="relative">
            <select
              aria-label="Status filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={selectCls}
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-3 text-slate-500"
            />
          </label>

          <label className="relative">
            <select
              aria-label="Timezone filter"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={selectCls}
            >
              <option value="all">All Timezones</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-3 text-slate-500"
            />
          </label>

          <div className="flex overflow-hidden rounded-lg border border-slate-200">
            {(
              [
                ["grid", LayoutGrid, "Grid view"],
                ["list", List, "List view"],
              ] as const
            ).map(([key, Icon, label]) => (
              <button
                key={key}
                type="button"
                aria-label={label}
                aria-pressed={layout === key}
                onClick={() => setLayout(key)}
                className={`flex h-10 w-11 items-center justify-center ${
                  layout === key
                    ? "bg-blue-50 text-blue-600"
                    : "bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>
        </div>

        {socialNotice && (
          <div className="mt-4">
            <Notice tone={socialNotice.tone} onClose={() => setSocialNotice(null)}>
              {socialNotice.text}
            </Notice>
          </div>
        )}
        {actionError && (
          <div className="mt-4">
            <Notice tone="error" onClose={() => setActionError(null)}>
              {actionError}
            </Notice>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin" /> Loading brands…
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">
            {brands.length === 0
              ? "No brands yet. Click Add Brand to create one."
              : "No brands match your search or filters."}
          </p>
        ) : (
          <div
            className={`mt-5 grid gap-5 ${layout === "grid" ? "lg:grid-cols-2" : "grid-cols-1"}`}
          >
            {filtered.map((b) => (
              <BrandCard
                key={b.id}
                brand={b}
                layout={layout}
                onManageAccounts={(brand) => setManaging(brand.id)}
                onToggleStatus={(brand) =>
                  void runFor(brand.id, () => setBrandStatus(brand.id, brand.status === "Active" ? "Inactive" : "Active"))
                }
                onDelete={(brand) => {
                  if (window.confirm(`Delete ${brand.name}?`)) void runFor(brand.id, () => removeBrand(brand.id));
                }}
              />
            ))}
          </div>
        )}
      </section>

      {managing && brands.find((b) => b.id === managing) && (
        <SocialAccountsModal
          brand={brands.find((b) => b.id === managing)!}
          onClose={() => setManaging(null)}
          onChanged={reload}
        />
      )}

      {adding && (
        <AddBrandModal
          onClose={() => setAdding(false)}
          onSubmit={async (input) => {
            await addBrand(input);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}
