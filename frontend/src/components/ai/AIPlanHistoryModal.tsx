import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { formatDateTime } from "../../lib/format";
import { deleteGeneration, listPlans, type AiPlan } from "../../services/aiService";
import { apiErrorMessage } from "../../services/mediaService";
import { Notice } from "../ui/ListControls";
import { Modal } from "../ui/Overlay";
import { PlatformIcon } from "../ui/PlatformIcon";

/** Previous content plans for a brand. Opening one loads it (with edits and captions) into the planner. */
export function AIPlanHistoryModal({
  brandId,
  onOpen,
  onClose,
  onDeleted,
}: {
  brandId: string;
  onOpen: (p: AiPlan) => void;
  onClose: () => void;
  /** So the planner can clear itself if the open plan is deleted. */
  onDeleted: (id: string) => void;
}) {
  const [items, setItems] = useState<AiPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPlans(brandId)
      .then((p) => !cancelled && setItems(p))
      .catch((e: unknown) => !cancelled && setError(apiErrorMessage(e, "Could not load plans.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [brandId]);

  const remove = async (p: AiPlan) => {
    if (!window.confirm("Delete this plan from history? Posts already saved from it are not affected.")) return;
    try {
      await deleteGeneration(p.id);
      setItems((prev) => prev.filter((x) => x.id !== p.id));
      onDeleted(p.id);
    } catch (e) {
      setError(apiErrorMessage(e, "Could not delete the plan."));
    }
  };

  return (
    <Modal title="Content plan history" onClose={onClose} wide>
      {error && <Notice tone="error">{error}</Notice>}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
          <Loader2 size={18} className="animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">No plans yet for this brand.</p>
      ) : (
        <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
          {items.map((p) => {
            const saved = p.plan.ideas.filter((i) => i.contentId).length;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900" title={p.topic}>
                    {p.plan.goal}: {p.topic}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.plan.ideas.length} ideas · {p.plan.periodDays} days from {p.plan.startDate} · {saved} saved · {formatDateTime(p.createdAt)}
                  </p>
                </div>
                <span className="flex gap-1">
                  {p.platforms.map((pl) => (
                    <PlatformIcon key={pl} platform={pl} size="xs" />
                  ))}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onOpen(p);
                    onClose();
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Open
                </button>
                <button type="button" onClick={() => void remove(p)} aria-label="Delete plan" className="rounded p-1.5 text-red-600 hover:bg-red-50">
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
