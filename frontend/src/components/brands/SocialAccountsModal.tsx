import { useCallback, useEffect, useState } from "react";
import { Loader2, Plug, RefreshCw, Unplug } from "lucide-react";
import { formatDate } from "../../lib/format";
import { apiErrorMessage } from "../../services/mediaService";
import {
  checkAccount,
  disconnectAccount,
  listAccounts,
  listProviders,
  refreshAccount,
  startConnect,
  type ProviderInfo,
  type SocialAccount,
  type SocialStatus,
} from "../../services/socialService";
import type { Brand, PlatformKey } from "../../types";
import { Notice } from "../ui/ListControls";
import { Modal } from "../ui/Overlay";
import { PlatformIcon } from "../ui/PlatformIcon";
import { StatusBadge, type BadgeTone } from "../ui/StatusBadge";

const ORDER: PlatformKey[] = ["instagram", "facebook", "youtube", "linkedin", "x"];
const NAMES: Record<PlatformKey, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
};
const tone: Record<SocialStatus, BadgeTone> = { Connected: "green", Expired: "orange", Disconnected: "gray", Error: "red" };

/** Connect, check, reconnect and disconnect the social accounts of one brand. */
export function SocialAccountsModal({
  brand,
  onClose,
  onChanged,
}: {
  brand: Brand;
  onClose: () => void;
  /** Called after a change so the brand list can refresh its connected count. */
  onChanged: () => void;
}) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Keys of actions in flight ("connect:instagram", "check:<id>"), to block duplicate requests.
  const [busy, setBusy] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, p] = await Promise.all([listAccounts(brand.id), listProviders()]);
      setAccounts(a);
      setProviders(p);
    } catch (e) {
      setError(apiErrorMessage(e, "Could not load social accounts. Is the backend running?"));
    } finally {
      setLoading(false);
    }
  }, [brand.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (key: string, work: () => Promise<void>) => {
    if (busy.includes(key)) return;
    setBusy((b) => [...b, key]);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(apiErrorMessage(e, "That action failed. Please try again."));
    } finally {
      setBusy((b) => b.filter((k) => k !== key));
    }
  };

  const connect = (platform: PlatformKey) =>
    act(`connect:${platform}`, async () => {
      const url = await startConnect(brand.id, platform);
      // Leaves the app for the provider's login page; the callback returns to /brands.
      window.location.assign(url);
      // Keep the button locked while the browser navigates away.
      await new Promise(() => {});
    });

  const replace = (a: SocialAccount) => {
    setAccounts((prev) => prev.map((x) => (x.id === a.id ? a : x)));
    onChanged();
  };

  const check = (a: SocialAccount) =>
    act(`check:${a.id}`, async () => {
      replace(await checkAccount(brand.id, a.id));
    });
  const refresh = (a: SocialAccount) =>
    act(`refresh:${a.id}`, async () => {
      replace(await refreshAccount(brand.id, a.id));
    });
  const disconnect = (a: SocialAccount) => {
    if (!window.confirm(`Disconnect ${a.displayName || a.username || NAMES[a.platform]}? Scheduled posts will no longer be able to use it.`)) return;
    return act(`disconnect:${a.id}`, async () => {
      replace(await disconnectAccount(brand.id, a.id));
    });
  };

  return (
    <Modal title={`Social accounts · ${brand.name}`} onClose={onClose} wide>
      <div className="space-y-4">
        {error && <Notice tone="error" onClose={() => setError(null)}>{error}</Notice>}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin" /> Loading accounts…
          </div>
        ) : (
          ORDER.map((platform) => {
            const provider = providers.find((p) => p.platform === platform);
            const list = accounts.filter((a) => a.platform === platform);
            const live = list.filter((a) => a.status !== "Disconnected");
            const connecting = busy.includes(`connect:${platform}`);
            const unavailable = !provider?.configured;
            return (
              <section key={platform} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <PlatformIcon platform={platform} size="lg" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-900">{NAMES[platform]}</h3>
                    <p className="text-xs text-slate-500">
                      {live.length === 0 ? "Not connected" : `${live.length} account${live.length === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={unavailable || connecting}
                    onClick={() => void connect(platform)}
                    title={unavailable ? `Server setup needed: ${provider?.missing.join(", ")}` : undefined}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {connecting ? <Loader2 size={15} className="animate-spin" /> : <Plug size={15} />}
                    {live.length ? "Connect another" : "Connect"}
                  </button>
                </div>

                {unavailable && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Not available yet: the server is missing {provider?.missing.join(", ") ?? "its configuration"}. Add it to <code>backend/.env</code> and restart the backend.
                  </p>
                )}

                {list.length > 0 && (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {list.map((a) => {
                      const needsReconnect = a.status === "Expired" || a.status === "Error" || a.status === "Disconnected";
                      return (
                        <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                          {a.profileImageUrl ? (
                            <img src={a.profileImageUrl} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full bg-slate-100 object-cover" />
                          ) : (
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                              {(a.displayName || a.username || "?").slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">{a.displayName || a.username}</p>
                            <p className="truncate text-xs text-slate-500">
                              {a.username && `@${a.username.replace(/^@/, "")} · `}
                              {a.metadata.pageName && `Page: ${a.metadata.pageName} · `}
                              {a.connectedAt ? `Connected ${formatDate(a.connectedAt)}` : ""}
                              {a.tokenExpiresAt ? ` · Expires ${formatDate(a.tokenExpiresAt)}` : ""}
                            </p>
                            {a.lastError && a.status !== "Connected" && <p className="text-xs text-red-600">{a.lastError}</p>}
                          </div>
                          <StatusBadge status={a.status} tone={tone[a.status]} />
                          <div className="flex items-center gap-1">
                            {a.status !== "Disconnected" && (
                              <button
                                type="button"
                                onClick={() => void check(a)}
                                disabled={busy.includes(`check:${a.id}`)}
                                className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                <RefreshCw size={13} className={busy.includes(`check:${a.id}`) ? "animate-spin" : ""} /> Check
                              </button>
                            )}
                            {a.status === "Expired" && (
                              <button
                                type="button"
                                onClick={() => void refresh(a)}
                                disabled={busy.includes(`refresh:${a.id}`)}
                                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                Refresh
                              </button>
                            )}
                            {needsReconnect && (
                              <button
                                type="button"
                                disabled={unavailable || connecting}
                                onClick={() => void connect(platform)}
                                className="rounded-md bg-orange-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                              >
                                Reconnect
                              </button>
                            )}
                            {a.status !== "Disconnected" && (
                              <button
                                type="button"
                                onClick={() => void disconnect(a)}
                                disabled={busy.includes(`disconnect:${a.id}`)}
                                className="flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                <Unplug size={13} /> Disconnect
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {provider?.notes && <p className="mt-3 text-xs text-slate-500">{provider.notes}</p>}
              </section>
            );
          })
        )}
        <p className="text-xs text-slate-500">
          Connecting an account lets TA Social Studio read its profile. Publishing to connected accounts is not available yet.
        </p>
      </div>
    </Modal>
  );
}
