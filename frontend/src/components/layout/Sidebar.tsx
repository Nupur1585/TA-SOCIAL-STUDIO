import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ChevronDown,
  FileCheck2,
  Home,
  Images,
  ScrollText,
  Settings,
  X,
} from "lucide-react";
import { BrandLogo } from "../ui/BrandLogo";

const linkBase =
  "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors";
const linkIdle = "text-slate-300 hover:bg-white/5 hover:text-white";
const linkActive = "bg-blue-600 text-white shadow-lg shadow-blue-900/30";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `${linkBase} ${isActive ? linkActive : linkIdle}`;

const mainItems = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/brands", label: "Brands", icon: Building2 },
];

const lowerItems = [
  { to: "/media", label: "Media Library", icon: Images },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: FileCheck2 },
  { to: "/activity-logs", label: "Activity Logs", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { pathname } = useLocation();
  const contentActive = pathname.startsWith("/content");
  const [contentOpen, setContentOpen] = useState(contentActive);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#0a1a4a] px-4 py-5 transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center gap-3 px-1">
          <BrandLogo
            className="h-10 w-10 text-base"
            gradient="from-blue-500 to-indigo-600"
          />
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-wide text-white">
              SOCIAL STUDIO
            </p>
            <p className="text-xs text-slate-400">Tech Amdavad</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded p-1 text-slate-400 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto" onClick={onClose}>
          {mainItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navClass}>
              <Icon size={19} />
              {label}
            </NavLink>
          ))}

          <div onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setContentOpen((v) => !v)}
              aria-expanded={contentOpen}
              className={`${linkBase} w-full ${contentActive ? linkActive : linkIdle}`}
            >
              <FileCheck2 size={19} />
              Content
              <ChevronDown
                size={16}
                className={`ml-auto transition-transform ${contentOpen ? "rotate-180" : ""}`}
              />
            </button>
            {contentOpen && (
              <div className="ml-5 mt-1 space-y-1 border-l border-white/10 pl-3">
                {[
                  { to: "/content", label: "All Content", end: true },
                  { to: "/content/new", label: "Create Content", end: true },
                ].map((s) => (
                  <NavLink
                    key={s.to}
                    to={s.to}
                    end={s.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `block rounded-md px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? "text-white"
                          : "text-slate-400 hover:text-white"
                      }`
                    }
                  >
                    {s.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {lowerItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navClass}>
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 flex items-center gap-3 border-t border-white/10 px-1 pt-4">
          <BrandLogo
            className="h-9 w-9 rounded-full text-xs"
            gradient="from-indigo-500 to-violet-600"
          />
          <div className="leading-tight">
            <p className="text-xs font-semibold text-white">Tech Amdavad LLP</p>
            <p className="text-[11px] text-slate-400">
              Social Media Management &amp; AI
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
