const tones = {
  green: "bg-emerald-50 text-emerald-600",
  blue: "bg-sky-50 text-sky-600",
  orange: "bg-orange-50 text-orange-500",
  red: "bg-red-50 text-red-500",
  gray: "bg-slate-100 text-slate-500",
  purple: "bg-violet-50 text-violet-600",
} as const;

export type BadgeTone = keyof typeof tones;

const statusTone: Record<string, BadgeTone> = {
  Active: "green",
  Ready: "green",
  Scheduled: "blue",
  Pending: "orange",
  Inactive: "gray",
  // Content workflow statuses
  Draft: "gray",
  "Pending Approval": "orange",
  Approved: "green",
  Published: "purple",
  Rejected: "red",
};

export function StatusBadge({
  status,
  tone,
}: {
  status: string;
  tone?: BadgeTone;
}) {
  const t = tone ?? statusTone[status] ?? "gray";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${tones[t]}`}
    >
      {status}
    </span>
  );
}
