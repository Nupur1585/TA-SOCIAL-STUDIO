import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { formatDateTime } from "../../lib/format";
import { deleteGeneration, listGenerations, type AiGeneration } from "../../services/aiService";
import { apiErrorMessage } from "../../services/mediaService";
import { Notice } from "../ui/ListControls";
import { Modal } from "../ui/Overlay";
import { PlatformIcon } from "../ui/PlatformIcon";

/** Previous AI generations for a brand. Opening one adds its variations to the editor. */
export function AIHistoryModal({
  brandId,
  onOpen,
  onClose,
}: {
  brandId: string;
  onOpen: (g: AiGeneration) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<AiGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listGenerations(brandId)
      .then((g) => !cancelled && setItems(g))
      .catch((e: unknown) => !cancelled && setError(apiErrorMessage(e, "Could not load history.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [brandId]);

  const remove = async (g: AiGeneration) => {
    if (!window.confirm("Delete this generation from history? Drafts already saved are not affected.")) return;
    try {
      await deleteGeneration(g.id);
      setItems((prev) => prev.filter((x) => x.id !== g.id));
    } catch (e) {
      setError(apiErrorMessage(e, "Could not delete it."));
    }
  };

  return (
    <Modal title="AI generation history" onClose={onClose} wide>
      {error && <Notice tone="error">{error}</Notice>}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
          <Loader2 size={18} className="animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">No generations yet for this brand.</p>
      ) : (
        <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
          {items.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900" title={g.topic}>
                  {g.topic}
                </p>
                <p className="text-xs text-slate-500">
                  {g.purpose} · {g.settings.tone} · {formatDateTime(g.createdAt)}
                </p>
              </div>
              <span className="flex gap-1">
                {g.platforms.map((p) => (
                  <PlatformIcon key={p} platform={p} size="xs" />
                ))}
              </span>
              <button
                type="button"
                onClick={() => {
                  onOpen(g);
                  onClose();
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Open
              </button>
              <button type="button" onClick={() => void remove(g)} aria-label="Delete generation" className="rounded p-1.5 text-red-600 hover:bg-red-50">
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
