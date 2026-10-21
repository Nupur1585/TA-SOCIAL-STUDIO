import { CalendarDays, FileText, Film, GalleryHorizontal, Image as ImageIcon, Play, Smartphone, Zap } from "lucide-react";
import { useBrands } from "../../context/BrandsContext";
import { formatDateTime, formatDuration } from "../../lib/format";
import { mediaFileUrl } from "../../services/mediaService";
import type { ContentItem, ContentType } from "../../types";
import { BrandLogo } from "../ui/BrandLogo";
import { KebabMenu, type MenuAction } from "../ui/KebabMenu";
import { PlatformIcon } from "../ui/PlatformIcon";
import { StatusBadge } from "../ui/StatusBadge";

const typeStyle: Record<ContentType, { cls: string; icon: typeof Film }> = {
  Image: { cls: "bg-blue-600", icon: ImageIcon },
  Reel: { cls: "bg-fuchsia-600", icon: Smartphone },
  Carousel: { cls: "bg-indigo-600", icon: GalleryHorizontal },
  Video: { cls: "bg-emerald-600", icon: Play },
  Short: { cls: "bg-red-600", icon: Zap },
  Text: { cls: "bg-slate-600", icon: FileText },
};

const VIDEO_TYPES: ContentType[] = ["Video", "Reel", "Short"];

export function TypeBadge({ type }: { type: ContentType }) {
  const { cls, icon: Icon } = typeStyle[type];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-white ${cls}`}>
      <Icon size={12} />
      {type}
    </span>
  );
}

/** Shows the first attached media file, or a gradient placeholder when there is none. */
export function ContentThumb({ item, className = "" }: { item: ContentItem; className?: string }) {
  const mediaId = item.mediaIds[0];
  const isVideo = VIDEO_TYPES.includes(item.type);
  const Icon = typeStyle[item.type].icon;
  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
      {mediaId && !item.demo ? (
        isVideo ? (
          <video
            src={`${mediaFileUrl(mediaId)}#t=0.5`}
            preload="metadata"
            muted
            playsInline
            crossOrigin="use-credentials"
            className="h-full w-full object-cover"
          />
        ) : (
          <img
            src={mediaFileUrl(mediaId)}
            alt={item.title}
            loading="lazy"
            crossOrigin="use-credentials"
            className="h-full w-full object-cover"
          />
        )
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${
            item.thumbClass ?? "from-slate-200 to-slate-400"
          }`}
        >
          {item.type === "Text" ? (
            <Icon size={28} className="text-slate-500" />
          ) : isVideo ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white">
              <Play size={18} fill="currentColor" />
            </span>
          ) : null}
        </div>
      )}
      {item.duration != null && (
        <span className="absolute bottom-2 right-2 rounded bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-white">
          {formatDuration(item.duration)}
        </span>
      )}
    </div>
  );
}

interface Props {
  item: ContentItem;
  actions: MenuAction[];
  onOpen: () => void;
}

function useBrand(brandId: string) {
  const { brands } = useBrands();
  return brands.find((b) => b.id === brandId);
}

const dateOf = (item: ContentItem) => formatDateTime(item.scheduledAt ?? item.createdAt);

export function ContentCard({ item, actions, onOpen }: Props) {
  const brand = useBrand(item.brandId);
  return (
    <article className="flex flex-col rounded-xl border border-slate-200/70 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="relative">
        <button type="button" onClick={onOpen} className="block w-full" aria-label={`Open ${item.title}`}>
          <ContentThumb item={item} className="aspect-[16/9] w-full rounded-lg" />
        </button>
        <span className="pointer-events-none absolute left-2 top-2">
          <TypeBadge type={item.type} />
        </span>
        <KebabMenu actions={actions} className="absolute right-2 top-2" />
      </div>

      <div className="flex flex-1 flex-col px-1 pt-3">
        <h3 className="truncate text-sm font-semibold text-slate-900" title={item.title}>
          {item.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs text-slate-500">{item.caption || "No caption"}</p>
        <p className="mt-1.5 line-clamp-1 text-xs text-slate-500">{item.hashtags.join(" ")}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <BrandLogo
              initials={brand?.initials ?? "?"}
              gradient={brand?.logoClass ?? "from-slate-400 to-slate-500"}
              className="h-6 w-6 rounded-md text-[10px]"
            />
            <span className="truncate text-xs text-slate-600">{brand?.name ?? "Unknown brand"}</span>
          </span>
          <span className="flex shrink-0 gap-1">
            {item.platforms.slice(0, 3).map((p) => (
              <PlatformIcon key={p} platform={p} size="xs" />
            ))}
            {item.platforms.length > 3 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1 text-[10px] text-slate-500">
                +{item.platforms.length - 3}
              </span>
            )}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
            <CalendarDays size={13} className="shrink-0" />
            <span className="truncate">{dateOf(item)}</span>
          </span>
          <StatusBadge status={item.status} />
        </div>
      </div>
    </article>
  );
}

export function ContentRow({ item, actions, onOpen }: Props) {
  const brand = useBrand(item.brandId);
  return (
    <article className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white p-2.5 shadow-sm">
      <button type="button" onClick={onOpen} className="w-20 shrink-0 sm:w-28" aria-label={`Open ${item.title}`}>
        <ContentThumb item={item} className="aspect-[16/9] w-full rounded-lg" />
      </button>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-slate-900">{item.title}</h3>
        <p className="truncate text-xs text-slate-500">{item.caption || "No caption"}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {brand?.name ?? "Unknown brand"} · {dateOf(item)}
        </p>
      </div>
      <span className="hidden sm:block">
        <TypeBadge type={item.type} />
      </span>
      <span className="hidden gap-1 md:flex">
        {item.platforms.map((p) => (
          <PlatformIcon key={p} platform={p} size="xs" />
        ))}
      </span>
      <StatusBadge status={item.status} />
      <KebabMenu actions={actions} />
    </article>
  );
}
