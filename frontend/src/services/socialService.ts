import api from "./api";
import type { PlatformKey } from "../types";

export type SocialStatus = "Connected" | "Expired" | "Disconnected" | "Error";

/** Mirrors the backend response. Tokens are never part of it. */
export interface SocialAccount {
  id: string;
  brandId: string;
  platform: PlatformKey;
  platformAccountId: string;
  username: string;
  displayName: string;
  profileImageUrl: string;
  status: SocialStatus;
  scopes: string[];
  tokenExpiresAt: string | null;
  connectedAt: string | null;
  lastCheckedAt: string | null;
  lastError: string;
  metadata: { pageName?: string };
}

export interface ProviderInfo {
  platform: PlatformKey;
  provider: string;
  label: string;
  /** False when the server lacks credentials or the encryption key. */
  configured: boolean;
  /** Names of missing environment variables (never values). */
  missing: string[];
  notes: string;
}

export async function listProviders(): Promise<ProviderInfo[]> {
  return (await api.get("/admin/social-providers")).data.data;
}

export async function listAccounts(brandId: string): Promise<SocialAccount[]> {
  return (await api.get(`/admin/brands/${brandId}/social-accounts`)).data.data;
}

/** Returns the provider's login URL; the caller sends the browser there. */
export async function startConnect(brandId: string, platform: PlatformKey): Promise<string> {
  return (await api.post(`/admin/brands/${brandId}/social-accounts/connect`, { platform })).data.data.authUrl;
}

export async function checkAccount(brandId: string, id: string): Promise<SocialAccount> {
  return (await api.post(`/admin/brands/${brandId}/social-accounts/${id}/check`)).data.data;
}

export async function refreshAccount(brandId: string, id: string): Promise<SocialAccount> {
  return (await api.post(`/admin/brands/${brandId}/social-accounts/${id}/refresh`)).data.data;
}

export async function disconnectAccount(brandId: string, id: string): Promise<SocialAccount> {
  return (await api.delete(`/admin/brands/${brandId}/social-accounts/${id}`)).data.data;
}
