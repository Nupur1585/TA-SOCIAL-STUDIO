import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200/70 bg-white shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {action}
    </div>
  );
}
