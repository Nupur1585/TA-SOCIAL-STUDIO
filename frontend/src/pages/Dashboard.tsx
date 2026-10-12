import { useMemo, useState } from "react";
import {
  ArrowUp,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock,
  FileText,
  Hand,
} from "lucide-react";
import { ContentOverviewChart } from "../components/dashboard/ContentOverviewChart";
import { PlatformDistribution } from "../components/dashboard/PlatformDistribution";
import { QuickActions } from "../components/dashboard/QuickActions";
import { RecentActivity } from "../components/dashboard/RecentActivity";
import { UpcomingContentTable } from "../components/dashboard/UpcomingContentTable";
import { MetricCard } from "../components/ui/MetricCard";
import { useBrands } from "../context/BrandsContext";
import {
  contentOverviewData,
  dashboardStats,
  platformDistribution,
  recentActivity,
  totalPosts,
  upcomingContent,
} from "../data/sampleData";

const ranges = [
  { value: "7", label: "Last 7 Days", points: 3 },
  { value: "30", label: "Last 30 Days", points: contentOverviewData.length },
  { value: "90", label: "Last 90 Days", points: contentOverviewData.length },
];

function Select({
  value,
  onChange,
  icon,
  children,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="relative flex items-center">
      <span className="pointer-events-none absolute left-3 text-blue-600">
        {icon}
      </span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 min-w-44 appearance-none rounded-lg border border-slate-200 bg-white pl-10 pr-9 text-sm text-slate-700 outline-none focus:border-blue-400"
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 text-slate-500"
      />
    </label>
  );
}

export default function Dashboard() {
  const { brands } = useBrands();
  const [brandFilter, setBrandFilter] = useState("all");
  const [range, setRange] = useState("30");

  const activeBrands = brands.filter((b) => b.status === "Active").length;
  const brandName = brands.find((b) => b.id === brandFilter)?.name;

  const rows = useMemo(
    () =>
      brandName
        ? upcomingContent.filter((c) => c.brand === brandName)
        : upcomingContent,
    [brandName],
  );

  const chartData = useMemo(() => {
    const points = ranges.find((r) => r.value === range)?.points ?? 10;
    return contentOverviewData.slice(-points);
  }, [range]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-slate-800">
            Good morning, Admin <Hand size={16} className="text-amber-500" />
          </p>
          <p className="text-sm text-slate-500">
            Here&apos;s what&apos;s happening across your brands.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select
            label="Brand filter"
            value={brandFilter}
            onChange={setBrandFilter}
            icon={<Building2 size={16} />}
          >
            <option value="all">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select
            label="Date range"
            value={range}
            onChange={setRange}
            icon={<CalendarDays size={16} />}
          >
            {ranges.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Active Brands"
          value={activeBrands}
          icon={Building2}
          tone="blue"
          footer={`${brands.length} total`}
          footerTone="green"
          footerIcon={ArrowUp}
        />
        <MetricCard
          title="Total Content"
          value={dashboardStats.totalContent}
          icon={FileText}
          tone="purple"
          footer={dashboardStats.contentGrowth}
          footerTone="green"
          footerIcon={ArrowUp}
        />
        <MetricCard
          title="Upcoming Content"
          value={dashboardStats.upcomingContent}
          icon={CalendarDays}
          tone="green"
          footer={`${dashboardStats.upcomingThisWeek} this week`}
          footerTone="green"
          footerIcon={ArrowUp}
        />
        <MetricCard
          title="Pending Approval"
          value={dashboardStats.pendingApproval}
          icon={Clock}
          tone="orange"
          footer="Needs attention"
          footerTone="red"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ContentOverviewChart data={chartData} />
        <PlatformDistribution data={platformDistribution} total={totalPosts} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
        <UpcomingContentTable items={rows} />
        <RecentActivity items={recentActivity} />
        <QuickActions />
      </div>
    </div>
  );
}
