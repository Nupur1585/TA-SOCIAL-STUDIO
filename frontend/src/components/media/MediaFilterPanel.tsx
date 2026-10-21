import { Check, Film, GalleryHorizontal, Image as ImageIcon, Images, Smartphone, Zap } from "lucide-react";
import { useBrands } from "../../context/BrandsContext";
import type { MediaKind } from "../../types";
import { Card } from "../ui/Card";

export type KindFilter = "all" | MediaKind;

const categories: { key: KindFilter; label: string; icon: typeof Film }[] = [
  { key: "all", label: "All Media", icon: Images },
  { key: "Image", label: "Images", icon: ImageIcon },
  { key: "Video", label: "Videos", icon: Film },
  { key: "Reel", label: "Reels", icon: Smartphone },
  { key: "Short", label: "Shorts", icon: Zap },
  { key: "Carousel", label: "Carousel", icon: GalleryHorizontal },
];

export function MediaFilterPanel({
  kind,
  onKind,
  kindCounts,
  brandIds,
  onToggleBrand,
  brandCounts,
}: {
  kind: KindFilter;
  onKind: (k: KindFilter) => void;
  kindCounts: Record<string, number>;
  brandIds: string[];
  onToggleBrand: (id: string) => void;
  brandCounts: Record<string, number>;
}) {
  const { brands } = useBrands();
  const total = Object.values(kindCounts).reduce((a, b) => a + b, 0);
  return (
    <Card className="p-3 lg:sticky lg:top-24">
      <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:block lg:space-y-1">
        {categories.map(({ key, label, icon: Icon }) => {
          const active = kind === key;
          const count = key === "all" ? total : (kindCounts[key] ?? 0);
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onKind(key)}
                aria-pressed={active}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                  active ? "bg-blue-50 font-medium text-blue-600" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon size={18} />
                <span className="flex-1 text-left">{label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-blue-100" : "bg-slate-100 text-slate-500"}`}>
                  {count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 border-t border-slate-100 px-3 pt-4">
        <h3 className="text-sm font-semibold text-slate-900">Brands</h3>
        <ul className="mt-3 space-y-1">
          {brands.map((b) => {
            const checked = brandIds.includes(b.id);
            return (
              <li key={b.id}>
                <label className="flex cursor-pointer items-center gap-3 py-1.5 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleBrand(b.id)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-blue-300 ${
                      checked ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"
                    }`}
                  >
                    {checked && <Check size={13} strokeWidth={3} />}
                  </span>
                  <span className="flex-1 truncate">{b.name}</span>
                  <span className="text-xs text-slate-500">{brandCounts[b.id] ?? 0}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
