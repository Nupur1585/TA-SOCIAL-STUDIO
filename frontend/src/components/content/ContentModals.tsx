import { useState, type ReactNode } from "react";
import { useBrands } from "../../context/BrandsContext";
import { formatDateTime, toLocalInput } from "../../lib/format";
import type { ContentItem } from "../../types";
import { Notice } from "../ui/ListControls";
import { Modal } from "../ui/Overlay";
import { PlatformIcon } from "../ui/PlatformIcon";
import { StatusBadge } from "../ui/StatusBadge";
import { ContentThumb, TypeBadge } from "./ContentCard";

export function ContentDetailsModal({
  item,
  onClose,
  footer,
}: {
  item: ContentItem;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const { brands } = useBrands();
  const brand = brands.find((b) => b.id === item.brandId)?.name ?? "Unknown brand";
  return (
    <Modal title={item.title} onClose={onClose} wide>
      <div className="grid gap-5 md:grid-cols-[1fr_16rem]">
        <div className="space-y-3">
          <ContentThumb item={item} className="aspect-video w-full rounded-lg" />
          <p className="whitespace-pre-wrap text-sm text-slate-700">{item.caption || "No caption"}</p>
          <p className="text-sm text-blue-600">{item.hashtags.join(" ")}</p>
          {item.targets.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Publishing</h3>
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {item.targets.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                    <PlatformIcon platform={t.platform} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-800">{t.accountName}</span>
                      {t.status === "Published" && t.publishedAt && <span className="block text-xs text-slate-500">Published {formatDateTime(t.publishedAt)}</span>}
                      {t.status !== "Published" && t.lastAttemptAt && <span className="block text-xs text-slate-500">Last attempt {formatDateTime(t.lastAttemptAt)} · {t.attempts} attempt{t.attempts === 1 ? "" : "s"}</span>}
                      {t.error && <span className="block text-xs text-red-600">{t.error}</span>}
                    </span>
                    {t.publishedUrl && (
                      <a href={t.publishedUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:underline">
                        View post
                      </a>
                    )}
                    <StatusBadge status={t.status} tone={t.status === "Published" ? "green" : t.status === "Failed" ? "red" : t.status === "Publishing" ? "blue" : "gray"} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {item.demo && (
            <Notice tone="info">Demonstration item. Create content to manage real posts.</Notice>
          )}
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Status</dt>
            <dd className="mt-1">
              <StatusBadge status={item.status} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Type</dt>
            <dd className="mt-1">
              <TypeBadge type={item.type} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Brand</dt>
            <dd className="font-medium text-slate-800">{brand}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{item.scheduledAt ? "Scheduled for" : "Created"}</dt>
            <dd className="text-slate-800">{formatDateTime(item.scheduledAt ?? item.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Platforms</dt>
            <dd className="mt-1 flex gap-1">
              {item.platforms.map((p) => (
                <PlatformIcon key={p} platform={p} size="sm" />
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Attached media</dt>
            <dd className="text-slate-800">{item.mediaIds.length}</dd>
          </div>
        </dl>
      </div>
      {footer && <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">{footer}</div>}
    </Modal>
  );
}

export function ScheduleModal({
  item,
  busy,
  onSubmit,
  onClose,
}: {
  item: ContentItem;
  busy: boolean;
  onSubmit: (isoDate: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(toLocalInput(item.scheduledAt));
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const when = new Date(value);
    if (!value || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      return setError("Choose a date and time in the future.");
    }
    onSubmit(when.toISOString());
  };

  return (
    <Modal title="Schedule content" onClose={onClose}>
      <label className="block text-sm font-medium text-slate-700">
        Publish date and time
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
        />
      </label>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? "Scheduling…" : "Schedule"}
        </button>
      </div>
    </Modal>
  );
}
