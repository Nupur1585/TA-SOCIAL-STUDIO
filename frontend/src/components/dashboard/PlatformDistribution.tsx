import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { PlatformKey } from "../../types";
import { Card, CardHeader } from "../ui/Card";
import { PlatformIcon } from "../ui/PlatformIcon";

export interface PlatformSlice {
  platform: PlatformKey;
  label: string;
  value: number;
  color: string;
}

export function PlatformDistribution({
  data,
  total,
}: {
  data: PlatformSlice[];
  total: number;
}) {
  return (
    <Card className="p-5">
      <CardHeader title="Platform Distribution" />
      <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
        <div className="relative h-44 w-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius="64%"
                outerRadius="100%"
                paddingAngle={1}
                startAngle={90}
                endAngle={-270}
                stroke="none"
              >
                {data.map((d) => (
                  <Cell key={d.platform} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-slate-900">{total}</span>
            <span className="text-xs text-slate-500">Total Posts</span>
          </div>
        </div>

        <ul className="w-full space-y-3">
          {data.map((d) => (
            <li key={d.platform} className="flex items-center gap-3 text-sm">
              <PlatformIcon platform={d.platform} size="sm" />
              <span className="flex-1 text-slate-800">{d.label}</span>
              <span className="font-medium text-slate-700">{d.value}%</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
