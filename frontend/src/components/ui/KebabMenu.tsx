import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";

export interface MenuAction {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
}

/** Three-dot actions menu used on media and content cards. */
export function KebabMenu({
  actions,
  className = "",
}: {
  actions: MenuAction[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Actions"
        aria-expanded={open}
        className="flex h-7 w-7 items-center justify-center rounded-md bg-white/95 text-slate-700 shadow-sm hover:bg-white"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <ul className="absolute right-0 z-30 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-lg">
          {actions.map((a) => (
            <li key={a.label}>
              <button
                type="button"
                disabled={a.disabled}
                title={a.disabled ? a.hint : undefined}
                onClick={() => {
                  setOpen(false);
                  a.onSelect();
                }}
                className={`w-full rounded-md px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-40 ${
                  a.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
