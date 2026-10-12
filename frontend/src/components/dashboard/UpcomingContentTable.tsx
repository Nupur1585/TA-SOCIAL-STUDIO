import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { UpcomingContentItem } from "../../types";
import { Card, CardHeader } from "../ui/Card";
import { PlatformIcon } from "../ui/PlatformIcon";
import { StatusBadge } from "../ui/StatusBadge";

export function UpcomingContentTable({
  items,
}: {
  items: UpcomingContentItem[];
}) {
  return (
    <Card className="p-5">
      <CardHeader
        title="Upcoming Content"
        action={
          <Link
            to="/calendar"
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
          >
            View Calendar <ArrowRight size={13} />
          </Link>
        }
      />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs font-semibold text-slate-700">
              <th className="rounded-l-md px-3 py-2">Media</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Brand</th>
              <th className="px-3 py-2">Platform(s)</th>
              <th className="px-3 py-2">Date</th>
              <th className="rounded-r-md px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-3">
                  <div
                    className={`h-10 w-14 rounded-md bg-gradient-to-br ${c.thumbClass}`}
                    aria-hidden
                  />
                </td>
                <td className="px-3 py-3 text-xs font-medium text-slate-800">
                  {c.title}
                </td>
                <td className="px-3 py-3 text-xs text-slate-700">{c.brand}</td>
                <td className="px-3 py-3">
                  <div className="flex gap-1.5">
                    {c.platforms.map((p) => (
                      <PlatformIcon key={p} platform={p} size="sm" />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-slate-700">
                  <span className="block">{c.date}</span>
                  <span className="block text-slate-500">{c.time}</span>
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            No upcoming content for this brand.
          </p>
        )}
      </div>
    </Card>
  );
}
