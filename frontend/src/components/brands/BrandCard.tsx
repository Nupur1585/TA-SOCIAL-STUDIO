import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Clock,
  FileText,
  Hash,
  Image as ImageIcon,
  MoreHorizontal,
  Fingerprint,
  Users,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { Brand } from "../../types";
import { BrandLogo } from "../ui/BrandLogo";
import { PlatformIcon } from "../ui/PlatformIcon";
import { StatusBadge } from "../ui/StatusBadge";

interface Props {
  brand: Brand;
  layout: "grid" | "list";
  onToggleStatus: (brand: Brand) => void;
  onDelete: (brand: Brand) => void;
  onManageAccounts: (brand: Brand) => void;
}

function Info({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon size={17} className="mt-0.5 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <div className="text-sm font-medium text-slate-800">{children}</div>
      </div>
    </div>
  );
}

export function BrandCard({ brand, layout, onToggleStatus, onDelete, onManageAccounts }: Props) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const detailPath = `/brands/${brand.id}`;

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const visible = brand.platforms.slice(0, 4);
  const extra = brand.platforms.length - visible.length;
  const wide = layout === "list";

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className={wide ? "lg:flex" : ""}>
        {/* Banner + identity */}
        <div className={wide ? "lg:w-[38%] lg:shrink-0" : ""}>
          <div
            className={`h-24 bg-gradient-to-r ${brand.bannerClass} ${wide ? "lg:h-28" : ""}`}
          />
          <div className="relative px-5 pb-4">
            <div className="-mt-9 flex items-end gap-4">
              <div className="rounded-xl bg-white p-1.5 shadow-md">
                <BrandLogo
                  initials={brand.initials}
                  gradient={brand.logoClass}
                  className="h-16 w-16 text-2xl"
                />
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <Link
                  to={detailPath}
                  className="block truncate text-lg font-bold text-slate-900 hover:text-blue-600"
                >
                  {brand.name}
                </Link>
                <p className="truncate text-xs text-slate-500">{brand.tagline}</p>
              </div>
              <div className="relative flex items-center gap-2 pb-2" ref={menuRef}>
                <StatusBadge status={brand.status} />
                <button
                  type="button"
                  aria-label={`Actions for ${brand.name}`}
                  aria-expanded={menu}
                  onClick={() => setMenu((v) => !v)}
                  className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
                >
                  <MoreHorizontal size={16} />
                </button>
                {menu && (
                  <ul className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-lg">
                    <li>
                      <button
                        className="w-full rounded-md px-3 py-2 text-left hover:bg-slate-50"
                        onClick={() => navigate(detailPath)}
                      >
                        View details
                      </button>
                    </li>
                    <li>
                      <button
                        className="w-full rounded-md px-3 py-2 text-left hover:bg-slate-50"
                        onClick={() => {
                          setMenu(false);
                          onManageAccounts(brand);
                        }}
                      >
                        Social accounts
                      </button>
                    </li>
                    <li>
                      <button
                        className="w-full rounded-md px-3 py-2 text-left hover:bg-slate-50"
                        onClick={() => {
                          setMenu(false);
                          onToggleStatus(brand);
                        }}
                      >
                        {brand.status === "Active" ? "Deactivate" : "Activate"}
                      </button>
                    </li>
                    <li>
                      <button
                        className="w-full rounded-md px-3 py-2 text-left text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setMenu(false);
                          onDelete(brand);
                        }}
                      >
                        Delete brand
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              {visible.map((p) => (
                <PlatformIcon key={p} platform={p} size="lg" />
              ))}
              {extra > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  +{extra} more
                </span>
              )}
              <button
                type="button"
                onClick={() => onManageAccounts(brand)}
                className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {brand.connectedAccounts > 0 ? `${brand.connectedAccounts} connected · Manage` : "Connect accounts"}
              </button>
            </div>
          </div>
        </div>

        {/* Details + shortcuts */}
        <div className={wide ? "flex-1 lg:border-l lg:border-slate-100" : ""}>
          <div className="grid gap-5 border-t border-slate-100 px-5 py-4 sm:grid-cols-2 lg:border-t-0">
            <div className="space-y-4">
              <Info icon={Fingerprint} label="Brand ID">
                {brand.brandId}
              </Info>
              <Info icon={Clock} label="Timezone">
                {brand.timezone}
              </Info>
              <Info icon={Users} label="Assigned Users">
                {brand.assignedUsers} {brand.assignedUsers === 1 ? "user" : "users"}
              </Info>
            </div>
            <div className="space-y-4 sm:border-l sm:border-slate-100 sm:pl-5">
              <Info icon={FileText} label="Description">
                <span className="font-normal text-slate-700">
                  {brand.description}
                </span>
              </Info>
              <Info icon={Hash} label="Default Hashtags">
                <span className="font-normal text-slate-500">
                  {brand.hashtags.join(" ")}
                </span>
              </Info>
            </div>
          </div>

          <div className="mx-5 mb-5 grid grid-cols-2 divide-x divide-slate-100 rounded-lg border border-slate-100">
            <Link
              to={`${detailPath}/assets`}
              className="flex items-center gap-3 p-3 hover:bg-slate-50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                <ImageIcon size={18} />
              </span>
              <span className="leading-tight">
                <span className="block text-xs font-medium text-slate-800">
                  Brand Assets
                </span>
                <span className="block text-xs text-slate-500">
                  {brand.assetCount} files
                </span>
              </span>
            </Link>
            <Link
              to={`${detailPath}/guidelines`}
              className="flex items-center gap-3 p-3 hover:bg-slate-50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                <FileText size={18} />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block text-xs font-medium text-slate-800">
                  Guidelines
                </span>
                <span className="block truncate text-xs text-slate-500">
                  Updated {brand.guidelinesUpdated}
                </span>
              </span>
              <ChevronRight size={16} className="text-slate-400" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
