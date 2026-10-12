import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";

export type MetricTone = "blue" | "purple" | "green" | "orange" | "red";

const iconTone: Record<MetricTone, string> = {
  blue: "bg-blue-50 text-blue-600",
  purple: "bg-violet-50 text-violet-600",
  green: "bg-emerald-50 text-emerald-600",
  orange: "bg-orange-50 text-orange-500",
  red: "bg-rose-50 text-rose-500",
};

const footTone = {
  green: "text-emerald-600",
  red: "text-red-500",
  muted: "text-slate-500",
} as const;

export function MetricCard({
  title,
  value,
  icon: Icon,
  tone,
  footer,
  footerTone = "muted",
  footerIcon: FooterIcon,
}: {
  title: string;
  value: number | string;
  icon: LucideIcon;
  tone: MetricTone;
  footer: string;
  footerTone?: keyof typeof footTone;
  footerIcon?: LucideIcon;
}) {
  return (
    <Card className="flex items-start gap-4 p-5">
      <span
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${iconTone[tone]}`}
      >
        <Icon size={24} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <p className="mt-1 text-3xl font-bold leading-tight text-slate-900">
          {value}
        </p>
        <p
          className={`mt-1 flex items-center gap-1 text-xs ${footTone[footerTone]}`}
        >
          {FooterIcon && <FooterIcon size={13} />}
          {footer}
        </p>
      </div>
    </Card>
  );
}
