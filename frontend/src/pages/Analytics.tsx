import { useMemo, useState } from "react";
import { BarChart3, Download, Eye, FileText, Heart, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { ContentThumb } from "../components/content/ContentCard";
import { ContentDetailsModal } from "../components/content/ContentModals";
import { Card, CardHeader } from "../components/ui/Card";
import { Notice, SelectField } from "../components/ui/ListControls";
import { MetricCard } from "../components/ui/MetricCard";
import { PageHeader, primaryButton } from "../components/ui/PageHeader";
import { PlatformIcon } from "../components/ui/PlatformIcon";
import { useBrands } from "../context/BrandsContext";
import { buildAnalytics } from "../data/demoAnalytics";
import { formatDate } from "../lib/format";
import type { ContentItem } from "../types";

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

const compact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const tooltipStyle = { borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 };
const tick = { fontSize: 11, fill: "#64748b" };

function Legend2({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export default function Analytics() {
  const { brands } = useBrands();
  const navigate = useNavigate();
  const [brandId, setBrandId] = useState("all");
  const [range, setRange] = useState("30");
  const [details, setDetails] = useState<ContentItem | null>(null);

  const days = Number(range);
  const data = useMemo(() => buildAnalytics(days, brandId), [days, brandId]);
  const periodLabel = `previous ${days} days`;
  const trend = (n: number) => `${n >= 0 ? "+" : ""}${n}% from ${periodLabel}`;
  const tone = (n: number) => (n >= 0 ? ("green" as const) : ("red" as const));
  const platformTotal = data.platforms.reduce((a, p) => a + p.value, 0);

  const lines = [
    { key: "likes", label: "Likes", color: "#2563eb" },
    { key: "comments", label: "Comments", color: "#7c3aed" },
    { key: "shares", label: "Shares", color: "#ef4444" },
    { key: "saves", label: "Saves", color: "#10b981" },
  ];
  const typeColors = ["#2563eb", "#7c3aed", "#10b981", "#f97316", "#ec4899"];

  return (
    <div className="space-y-5">
      <PageHeader icon={BarChart3} title="Analytics" subtitle="Track performance and understand how your content is growing.">
        <SelectField className="w-44" value={brandId} onChange={setBrandId}>
          <option value="all">All Brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </SelectField>
        <SelectField className="w-44" value={range} onChange={setRange}>
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </SelectField>
        <button type="button" onClick={() => navigate("/reports?create=1")} className={primaryButton}>
          <Download size={16} /> Export Report
        </button>
      </PageHeader>

      <Notice tone="info">
        <strong>Demonstration data.</strong> No social platform analytics are connected yet, so the figures below are samples that respond to the filters. Export Report opens the Reports page, which builds files from your real content records.
      </Notice>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Reach" value={compact(data.totals.reach)} icon={Eye} tone="blue" footer={trend(data.trends.reach)} footerTone={tone(data.trends.reach)} />
        <MetricCard title="Total Engagement" value={compact(data.totals.engagement)} icon={Heart} tone="purple" footer={trend(data.trends.engagement)} footerTone={tone(data.trends.engagement)} />
        <MetricCard title="Total Followers" value={compact(data.totals.followers)} icon={Users} tone="green" footer={trend(data.trends.followers)} footerTone={tone(data.trends.followers)} />
        <MetricCard title="Published Content" value={data.totals.published} icon={FileText} tone="orange" footer={trend(data.trends.published)} footerTone={tone(data.trends.published)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardHeader title="Engagement Overview" />
            <Legend2 items={lines} />
          </div>
          <div className="mt-4 h-64" role="img" aria-label="Line chart of likes, comments, shares and saves over time">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.series} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#e8edf5" vertical={false} />
                <XAxis dataKey="date" tick={tick} tickLine={false} axisLine={false} />
                <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={compact} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => Number(v).toLocaleString()} />
                {lines.map((l) => (
                  <Line key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={l.color} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardHeader title="Reach & Impressions" />
            <Legend2 items={[{ label: "Reach", color: "#2563eb" }, { label: "Impressions", color: "#7c3aed" }]} />
          </div>
          <div className="mt-4 h-64" role="img" aria-label="Bar chart of reach and impressions over time">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.series} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#e8edf5" vertical={false} />
                <XAxis dataKey="date" tick={tick} tickLine={false} axisLine={false} />
                <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={compact} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => Number(v).toLocaleString()} />
                <Bar dataKey="reach" name="Reach" fill="#2563eb" radius={[3, 3, 0, 0]} />
                <Bar dataKey="impressions" name="Impressions" fill="#7c3aed" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <CardHeader title="Platform Performance" />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:flex-nowrap">
            <div className="relative h-44 w-44 shrink-0" role="img" aria-label="Donut chart of reach by platform">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.platforms} dataKey="value" nameKey="label" innerRadius={54} outerRadius={80} paddingAngle={2} stroke="none">
                    {data.platforms.map((p) => (
                      <Cell key={p.platform} fill={p.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => Number(v).toLocaleString()} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-slate-900">{compact(platformTotal)}</span>
                <span className="text-[11px] text-slate-500">Total Reach</span>
              </div>
            </div>
            <ul className="w-full space-y-2.5 text-sm">
              {data.platforms.map((p) => (
                <li key={p.platform} className="flex items-center gap-2">
                  <PlatformIcon platform={p.platform} size="xs" />
                  <span className="flex-1 text-slate-700">{p.label}</span>
                  <span className="font-medium text-slate-900">{Math.round((p.value / platformTotal) * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader title="Content Performance" />
          <div className="mt-4 h-52" role="img" aria-label="Bar chart of engagement by content type">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byType} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#e8edf5" vertical={false} />
                <XAxis dataKey="type" tick={tick} tickLine={false} axisLine={false} />
                <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={compact} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => Number(v).toLocaleString()} />
                <Legend wrapperStyle={{ display: "none" }} />
                <Bar dataKey="value" name="Engagement" radius={[4, 4, 0, 0]}>
                  {data.byType.map((t, i) => (
                    <Cell key={t.type} fill={typeColors[i % typeColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader title="Top Performing Content" action={<button type="button" onClick={() => navigate("/content")} className="text-xs font-medium text-blue-600 hover:underline">View All →</button>} />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead>
                <tr className="text-slate-500">
                  <th className="pb-2 font-medium">Content</th>
                  <th className="pb-2 font-medium">Platform</th>
                  <th className="pb-2 text-right font-medium">Reach</th>
                  <th className="pb-2 text-right font-medium">Engagement</th>
                  <th className="pb-2 text-right font-medium">Published</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.top.map((t) => (
                  <tr key={t.item.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setDetails(t.item)}>
                    <td className="py-2">
                      <span className="flex items-center gap-2">
                        <ContentThumb item={t.item} className="h-9 w-12 shrink-0 rounded" />
                        <span className="min-w-0">
                          <span className="block max-w-36 truncate font-medium text-slate-800">{t.item.title}</span>
                          <span className="block text-slate-500">{brands.find((b) => b.id === t.item.brandId)?.name}</span>
                        </span>
                      </span>
                    </td>
                    <td className="py-2">{t.item.platforms[0] && <PlatformIcon platform={t.item.platforms[0]} size="xs" />}</td>
                    <td className="py-2 text-right text-slate-700">{t.reach.toLocaleString()}</td>
                    <td className="py-2 text-right text-slate-700">{t.engagement.toLocaleString()}</td>
                    <td className="py-2 text-right whitespace-nowrap text-slate-700">{formatDate(t.item.scheduledAt ?? t.item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.top.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No content for this brand.</p>}
          </div>
        </Card>
      </div>

      {details && <ContentDetailsModal item={details} onClose={() => setDetails(null)} />}
    </div>
  );
}

