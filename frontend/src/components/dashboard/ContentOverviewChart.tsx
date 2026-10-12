import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader } from "../ui/Card";

export interface OverviewPoint {
  date: string;
  posts: number;
  reels: number;
  stories: number;
  others: number;
}

const series = [
  { key: "posts", label: "Posts", color: "#2563eb" },
  { key: "reels", label: "Reels", color: "#7c3aed" },
  { key: "stories", label: "Stories", color: "#db2777" },
  { key: "others", label: "Others", color: "#0891b2" },
] as const;

export function ContentOverviewChart({ data }: { data: OverviewPoint[] }) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardHeader title="Content Overview" />
        <ul className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#e8edf5" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              domain={[0, 40]}
              ticks={[0, 10, 20, 30, 40]}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
