import { Film, GalleryHorizontal, Image as ImageIcon, Play, Smartphone, Zap } from "lucide-react";
import type { MediaItem, MediaKind } from "../../types";
import { formatDuration } from "../../lib/format";
import { mediaFileUrl } from "../../services/mediaService";

const kindStyle: Record<MediaKind, { cls: string; icon: typeof Film }> = {
  Image: { cls: "bg-blue-600", icon: ImageIcon },
  Video: { cls: "bg-blue-600", icon: Play },
  Reel: { cls: "bg-fuchsia-600", icon: Smartphone },
  Short: { cls: "bg-red-600", icon: Zap },
  Carousel: { cls: "bg-indigo-600", icon: GalleryHorizontal },
};

export function KindBadge({ kind }: { kind: MediaKind }) {
  const { cls, icon: Icon } = kindStyle[kind];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-white ${cls}`}>
      <Icon size={12} />
      {kind}
    </span>
  );
}

/**
 * Real items show the stored file; demo items show a gradient placeholder
 * because they have no file behind them.
 */
export function MediaThumb({ item, className = "" }: { item: MediaItem; className?: string }) {
  const isVideo = item.mimeType.startsWith("video/");
  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
      {item.demo ? (
        <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${item.thumbClass ?? "from-slate-300 to-slate-500"}`}>
          {isVideo && (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white">
              <Play size={18} fill="currentColor" />
            </span>
          )}
        </div>
      ) : isVideo ? (
        <video
          src={`${mediaFileUrl(item.id)}#t=0.5`}
          preload="metadata"
          muted
          playsInline
          crossOrigin="use-credentials"
          className="h-full w-full object-cover"
        />
      ) : (
        <img
          src={mediaFileUrl(item.id)}
          alt={item.title}
          loading="lazy"
          crossOrigin="use-credentials"
          className="h-full w-full object-cover"
        />
      )}
      {item.duration != null && (
        <span className="absolute bottom-2 right-2 rounded bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-white">
          {formatDuration(item.duration)}
        </span>
      )}
    </div>
  );
}
