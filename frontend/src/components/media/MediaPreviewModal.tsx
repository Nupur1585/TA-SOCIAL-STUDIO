import { Download, FilePlus2, Trash2 } from "lucide-react";
import { useBrands } from "../../context/BrandsContext";
import { formatBytes, formatDate } from "../../lib/format";
import { mediaFileUrl } from "../../services/mediaService";
import type { MediaItem } from "../../types";
import { Modal } from "../ui/Overlay";
import { PlatformIcon } from "../ui/PlatformIcon";
import { KindBadge, MediaThumb } from "./MediaThumb";

export function MediaPreviewModal({
  item,
  onClose,
  onDownload,
  onUse,
  onDelete,
}: {
  item: MediaItem;
  onClose: () => void;
  onDownload: () => void;
  onUse: () => void;
  onDelete: () => void;
}) {
  const { brands } = useBrands();
  const brand = brands.find((b) => b.id === item.brandId)?.name ?? "Unknown brand";
  const isVideo = item.mimeType.startsWith("video/");

  return (
    <Modal title={item.title} onClose={onClose} wide>
      <div className="grid gap-5 md:grid-cols-[1fr_16rem]">
        <div className="overflow-hidden rounded-lg bg-slate-900">
          {item.demo ? (
            <MediaThumb item={item} className="aspect-video w-full" />
          ) : isVideo ? (
            <video
              src={mediaFileUrl(item.id)}
              controls
              crossOrigin="use-credentials"
              className="max-h-[60vh] w-full"
            />
          ) : (
            <img
              src={mediaFileUrl(item.id)}
              alt={item.title}
              crossOrigin="use-credentials"
              className="max-h-[60vh] w-full object-contain"
            />
          )}
        </div>

        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Type</dt>
            <dd className="mt-1">
              <KindBadge kind={item.kind} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Brand</dt>
            <dd className="font-medium text-slate-800">{brand}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Uploaded</dt>
            <dd className="text-slate-800">{formatDate(item.createdAt)}</dd>
          </div>
          {!item.demo && (
            <div>
              <dt className="text-xs text-slate-500">Size</dt>
              <dd className="text-slate-800">{formatBytes(item.size)}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-slate-500">Platforms</dt>
            <dd className="mt-1 flex gap-1">
              {item.platforms.length ? (
                item.platforms.map((p) => <PlatformIcon key={p} platform={p} size="sm" />)
              ) : (
                <span className="text-slate-500">None selected</span>
              )}
            </dd>
          </div>
          {item.demo && (
            <p className="rounded-md bg-sky-50 p-2 text-xs text-sky-800">
              Demonstration item. Upload your own media to download, reuse or delete it.
            </p>
          )}
        </dl>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          disabled={item.demo}
          onClick={onDownload}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <Download size={16} /> Download
        </button>
        <button
          type="button"
          disabled={item.demo}
          onClick={onUse}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <FilePlus2 size={16} /> Use in content
        </button>
        <button
          type="button"
          disabled={item.demo}
          onClick={onDelete}
          className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
        >
          <Trash2 size={16} /> Delete
        </button>
      </div>
    </Modal>
  );
}
