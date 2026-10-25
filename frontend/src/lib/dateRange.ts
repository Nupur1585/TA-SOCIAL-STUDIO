import { endOfDay, startOfDay, subDays } from "date-fns";

export const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
] as const;

/** ISO bounds for a preset, or empty for "all". */
export function rangeBounds(value: string): { from?: string; to?: string } {
  if (value === "all") return {};
  const now = new Date();
  return {
    from: startOfDay(subDays(now, Number(value) - 1)).toISOString(),
    to: endOfDay(now).toISOString(),
  };
}
