import { ArrowRight, Building2, CalendarDays, Check, CloudUpload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import type { ActivityItem } from "../../types";
import { Card, CardHeader } from "../ui/Card";

const kinds: Record<ActivityItem["kind"], { icon: LucideIcon; cls: string }> = {
  approved: { icon: Check, cls: "bg-emerald-100 text-emerald-600" },
  uploaded: { icon: CloudUpload, cls: "bg-sky-100 text-sky-600" },
  scheduled: { icon: CalendarDays, cls: "bg-violet-100 text-violet-600" },
  brand: { icon: Building2, cls: "bg-cyan-100 text-cyan-600" },
};

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <Card className="p-5">
      <CardHeader
        title="Recent Activity"
        action={
          <Link
            to="/activity-logs"
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
          >
            View All <ArrowRight size={13} />
          </Link>
        }
      />
      <ol className="relative mt-5 space-y-5">
        <span
          className="absolute bottom-4 left-4 top-4 w-px bg-slate-200"
          aria-hidden
        />
        {items.map((a) => {
          const { icon: Icon, cls } = kinds[a.kind];
          return (
            <li key={a.id} className="relative flex gap-3">
              <span
                className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cls}`}
              >
                <Icon size={15} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-500">{a.description}</p>
                <p className="text-xs text-slate-400">{a.time}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
