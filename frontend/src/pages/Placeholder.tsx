import { Construction } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useBrands } from "../context/BrandsContext";

const titles: Record<string, string> = {
  content: "Content",
  "content/new": "Create Content",
  media: "Media Library",
  calendar: "Calendar",
  analytics: "Analytics",
  reports: "Reports",
  "activity-logs": "Activity Logs",
  settings: "Settings",
};

/** Shown for routes whose real pages have not been built yet. */
export default function Placeholder() {
  const { pathname } = useLocation();
  const { brandId } = useParams();
  const { brands } = useBrands();
  const brand = brands.find((b) => b.id === brandId);

  const key = pathname.replace(/^\//, "");
  let title = titles[key] ?? "Page";
  if (brandId) {
    const section = key.split("/")[2];
    title = brand
      ? `${brand.name}${section ? ` — ${section[0].toUpperCase()}${section.slice(1)}` : ""}`
      : "Brand not found";
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-24 text-center">
      <Construction size={32} className="text-slate-400" />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">
        This page hasn&apos;t been built yet.
      </p>
      <Link
        to="/dashboard"
        className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
