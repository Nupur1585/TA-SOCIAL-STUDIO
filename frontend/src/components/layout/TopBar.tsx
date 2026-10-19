import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  UserCircle2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useBrands } from "../../context/BrandsContext";
import api from "../../services/api";
import { BrandLogo } from "../ui/BrandLogo";

type BackendState = "connecting" | "online" | "offline";

function useOutsideClose(close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [close]);
  return ref;
}

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { brands, selectedBrandId, setSelectedBrandId } = useBrands();
  const [brandOpen, setBrandOpen] = useState(false);
  const [backend, setBackend] = useState<BackendState>("connecting");
  const [query, setQuery] = useState("");
  const brandRef = useOutsideClose(() => setBrandOpen(false));
  const { user, logout } = useAuth();
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useOutsideClose(() => setUserOpen(false));

  const selected = brands.find((b) => b.id === selectedBrandId) ?? brands[0];

  // Preserves the original backend health check from the previous App.tsx.
  useEffect(() => {
    api
      .get("/health")
      .then((r) => setBackend(r.data?.success ? "online" : "offline"))
      .catch(() => setBackend("offline"));
  }, []);

  const dot = {
    connecting: "bg-amber-400",
    online: "bg-emerald-500",
    offline: "bg-red-500",
  }[backend];
  const dotLabel = {
    connecting: "Connecting to backend",
    online: "Backend connected",
    offline: "Backend offline",
  }[backend];

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <label className="relative hidden w-full max-w-sm flex-1 sm:block">
        <Search
          size={17}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search anything..."
          className="h-10 w-full rounded-lg border border-transparent bg-slate-100/80 pl-10 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:bg-white"
        />
      </label>

      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        <span
          title={dotLabel}
          aria-label={dotLabel}
          className={`h-2.5 w-2.5 rounded-full ${dot}`}
        />

        <div className="relative" ref={brandRef}>
          <button
            type="button"
            onClick={() => setBrandOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 hover:bg-slate-50"
          >
            {selected && (
              <BrandLogo
                initials={selected.initials}
                gradient={selected.logoClass}
                className="h-8 w-8 text-xs"
              />
            )}
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-sm font-semibold text-slate-800">
                {selected?.name ?? "No brand"}
              </span>
              <span className="block text-[11px] text-slate-500">
                {selected?.platforms.length ?? 0} connected platforms
              </span>
            </span>
            <ChevronDown size={16} className="text-slate-500" />
          </button>
          {brandOpen && (
            <ul className="absolute right-0 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              {brands.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBrandId(b.id);
                      setBrandOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-slate-50"
                  >
                    <BrandLogo
                      initials={b.initials}
                      gradient={b.logoClass}
                      className="h-8 w-8 text-xs"
                    />
                    <span className="flex-1 text-sm text-slate-800">{b.name}</span>
                    {b.id === selectedBrandId && (
                      <Check size={16} className="text-blue-600" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Notifications"
        >
          <Bell size={20} />
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
            3
          </span>
        </button>

        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => setUserOpen((v) => !v)}
            aria-expanded={userOpen}
            className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-50"
          >
            <UserCircle2 size={34} className="text-slate-400" strokeWidth={1.4} />
            <span className="hidden text-sm font-medium text-slate-800 sm:inline">
              Admin
            </span>
            <ChevronDown size={16} className="hidden text-slate-500 sm:block" />
          </button>
          {userOpen && (
            <div className="absolute right-0 mt-2 w-60 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="text-xs text-slate-500">Signed in as</p>
                <p className="truncate text-sm font-medium text-slate-800">
                  {user?.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
