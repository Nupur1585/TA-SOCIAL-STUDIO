import { CalendarDays } from "lucide-react";
import { useBrands } from "../../context/BrandsContext";
import { formatDate } from "../../lib/format";
import type { MediaItem } from "../../types";
import { KebabMenu, type MenuAction } from "../ui/KebabMenu";
import { PlatformIcon } from "../ui/PlatformIcon";
import { KindBadge, MediaThumb } from "./MediaThumb";

interface Props {
  item: MediaItem;
  actions: MenuAction[];
  onOpen: () => void;
  /** Highlighted state when the card is used inside the media picker. */
  selected?: boolean;
}

function useBrandName(brandId: string) {
  const { brands } = useBrands();
  return brands.find((b) => b.id === brandId)?.name ?? "Unknown brand";
}

export function MediaCard({ item, actions, onOpen, selected }: Props) {
  const brand = useBrandName(item.brandId);
  return (
    <article
      className={`rounded-xl border bg-white p-2.5 shadow-sm transition-shadow hover:shadow-md ${
        selected ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-200/70"
      }`}
    >
      <div className="relative">
        <button type="button" onClick={onOpen} className="block w-full" aria-label={`Open ${item.title}`}>
          <MediaThumb item={item} className="aspect-[16/11] w-full rounded-lg" />
        </button>
        <span className="pointer-events-none absolute left-2 top-2">
          <KindBadge kind={item.kind} />
        </span>
        {actions.length > 0 && <KebabMenu actions={actions} className="absolute right-2 top-2" />}
      </div>
      <div className="px-1 pb-1 pt-3">
        <h3 className="truncate text-sm font-semibold text-slate-900" title={item.title}>
          {item.title}
        </h3>
        <p className="mt-1 truncate text-xs text-slate-500">{brand}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarDays size={13} />
            {formatDate(item.createdAt)}
          </span>
          <span className="flex gap-1">
            {item.platforms.map((p) => (
              <PlatformIcon key={p} platform={p} size="xs" />
            ))}
          </span>
        </div>
      </div>
    </article>
  );
}

export function MediaRow({ item, actions, onOpen, selected }: Props) {
  const brand = useBrandName(item.brandId);
  return (
    <article
      className={`flex items-center gap-3 rounded-xl border bg-white p-2.5 shadow-sm ${
        selected ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-200/70"
      }`}
    >
      <button type="button" onClick={onOpen} className="w-20 shrink-0 sm:w-28" aria-label={`Open ${item.title}`}>
        <MediaThumb item={item} className="aspect-[16/11] w-full rounded-lg" />
      </button>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-slate-900">{item.title}</h3>
        <p className="truncate text-xs text-slate-500">{brand}</p>
        <p className="mt-1 text-xs text-slate-500 sm:hidden">{formatDate(item.createdAt)}</p>
      </div>
      <KindBadge kind={item.kind} />
      <span className="hidden w-28 text-xs text-slate-500 sm:block">{formatDate(item.createdAt)}</span>
      <span className="hidden gap-1 md:flex">
        {item.platforms.map((p) => (
          <PlatformIcon key={p} platform={p} size="xs" />
        ))}
      </span>
      {actions.length > 0 && <KebabMenu actions={actions} />}
    </article>
  );
}
