import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-slate-900">
          <Icon size={28} className="text-blue-600" />
          {title}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}

export const primaryButton =
  "flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60";
