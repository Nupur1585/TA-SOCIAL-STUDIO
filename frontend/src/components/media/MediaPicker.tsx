import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiErrorMessage, listMedia } from "../../services/mediaService";
import type { MediaItem } from "../../types";
import { Notice, SearchInput } from "../ui/ListControls";
import { Modal } from "../ui/Overlay";
import { useDebounced } from "../../lib/useDebounced";
import { MediaCard } from "./MediaCard";

/** Lets the content form choose files from the Media Library. */
export function MediaPicker({
  brandId,
  selectedIds,
  max = 10,
  onClose,
  onConfirm,
}: {
  brandId: string;
  selectedIds: string[];
  max?: number;
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const debounced = useDebounced(q);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [chosen, setChosen] = useState<Record<string, MediaItem>>({});
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listMedia({ brandId, limit: 60, ...(debounced.trim() ? { q: debounced.trim() } : {}) })
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setSeen((prev) => new Set([...prev, ...r.items.map((i) => i.id)]));
        setSeen((prev) => new Set([...prev, ...r.items.map((i) => i.id)]));
        // Keep already-attached files checked even when they are not in the visible page.
        setChosen((prev) => {
          const next = { ...prev };
          r.items.filter((i) => selectedIds.includes(i.id)).forEach((i) => (next[i.id] = i));
          return next;
        });
      })
      .catch((e: unknown) => !cancelled && setError(apiErrorMessage(e, "Could not load media.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // selectedIds only seeds the initial selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, debounced]);

  // Attached files that were never loaded here (older than the first page) stay attached.
  const initial = selectedIds.filter((id) => !seen.has(id));

  const toggle = (item: MediaItem) =>
    setChosen((prev) => {
      const next = { ...prev };
      if (next[item.id]) delete next[item.id];
      else if (Object.keys(next).length < max) next[item.id] = item;
      return next;
    });

  return (
    <Modal title="Choose from Media Library" onClose={onClose} wide>
      <SearchInput value={q} onChange={setQ} placeholder="Search media..." />
      <div className="mt-4 max-h-[55vh] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin" /> Loading…
          </div>
        ) : error ? (
          <Notice tone="error">{error}</Notice>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            No media found for this brand. Upload files in the Media Library first.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((m) => (
              <MediaCard key={m.id} item={m} actions={[]} selected={!!chosen[m.id]} onOpen={() => toggle(m)} />
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-sm text-slate-500">
          {Object.keys(chosen).length + initial.length} selected (max {max})
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm([...Object.keys(chosen), ...initial])}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Use selected
          </button>
        </div>
      </div>
    </Modal>
  );
}
