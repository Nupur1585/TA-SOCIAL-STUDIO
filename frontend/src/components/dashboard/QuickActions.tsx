import { BarChart3, CirclePlus, Settings, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardHeader } from "../ui/Card";

const actions = [
  {
    label: "Create Content",
    to: "/content/new",
    icon: CirclePlus,
    cls: "bg-blue-600 text-white hover:bg-blue-700",
  },
  {
    label: "Add Brand",
    to: "/brands?add=1",
    icon: UserPlus,
    cls: "bg-indigo-50 text-slate-800 hover:bg-indigo-100",
  },
  {
    label: "View Reports",
    to: "/reports",
    icon: BarChart3,
    cls: "bg-emerald-50 text-slate-800 hover:bg-emerald-100",
  },
  {
    label: "Go to Settings",
    to: "/settings",
    icon: Settings,
    cls: "bg-slate-50 text-slate-800 hover:bg-slate-100",
  },
];

export function QuickActions() {
  return (
    <Card className="p-5">
      <CardHeader title="Quick Actions" />
      <div className="mt-4 space-y-3">
        {actions.map(({ label, to, icon: Icon, cls }) => (
          <Link
            key={label}
            to={to}
            className={`flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition-colors ${cls}`}
          >
            <Icon size={19} />
            {label}
          </Link>
        ))}
      </div>
    </Card>
  );
}
