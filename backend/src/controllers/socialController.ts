import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { frontendOrigin } from "../config/env.js";
import Brand from "../models/Brand.js";
import { PLATFORMS } from "../models/Media.js";
import SocialAccount from "../models/SocialAccount.js";
import { PROVIDERS, ProviderError, type ProviderId } from "../services/social/providers.js";
import {
  checkAccount,
  completeConnect,
  disconnectAccount,
  manualRefresh,
  providerStatus,
  serializeAccount,
  startConnect,
} from "../services/social/socialService.js";
import { audit } from "../utils/audit.js";

const fail = (res: Response, e: unknown) => {
  if (e instanceof ProviderError) return res.status(e.status).json({ success: false, message: e.message });
  throw e;
};

/** The brand in the URL must exist; every account route then verifies the account belongs to it. */
async function brandFrom(req: Request, res: Response) {
  const id = String(req.params["brandId"]);
  const brand = mongoose.isValidObjectId(id) ? await Brand.findById(id) : null;
  if (!brand) res.status(404).json({ success: false, message: "Brand not found" });
  return brand;
}

async function accountFrom(req: Request, res: Response) {
  const brand = await brandFrom(req, res);
  if (!brand) return null;
  const id = String(req.params["accountId"]);
  const account = mongoose.isValidObjectId(id) ? await SocialAccount.findById(id) : null;
  // A mismatched brand is reported as "not found" so account ids can't be probed across brands.
  if (!account || !account.brandId.equals(brand._id)) {
    res.status(404).json({ success: false, message: "Social account not found" });
    return null;
  }
  return { brand, account };
}

const label = (a: { platform: string; displayName: string }) => `${a.platform}: ${a.displayName}`;

/**
 * Short, safe text from the provider's error_reason / error_description query parameters, so the admin can see
 * why the login failed. Only plain characters survive and the length is capped: the value comes from the URL.
 */
export function denialMessage(query: Record<string, unknown>): string {
  const clean = (v: unknown) => (typeof v === "string" ? v.replace(/[^A-Za-z0-9 .,:'()/_-]/g, "").trim().slice(0, 160) : "");
  const detail = clean(query["error_description"]) || clean(query["error_reason"]);
  const base = query["error"] === "access_denied" || !query["error"] ? "Authorization was cancelled or denied." : "The provider returned an error.";
  return detail ? `${base} (${detail})` : base;
}

export function listProviders(_req: Request, res: Response) {
  res.json({ success: true, data: providerStatus() });
}

export async function listAccounts(req: Request, res: Response) {
  const brand = await brandFrom(req, res);
  if (!brand) return;
  const accounts = await SocialAccount.find({ brandId: brand._id }).sort({ platform: 1, createdAt: 1 });
  res.json({ success: true, data: accounts.map(serializeAccount) });
}

const connectSchema = z.object({ platform: z.enum(PLATFORMS) });

export async function connect(req: Request, res: Response) {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "Unsupported platform" });
  const brand = await brandFrom(req, res);
  if (!brand) return;
  try {
    const authUrl = await startConnect(req.user!.id, String(brand._id), parsed.data.platform);
    res.json({ success: true, data: { authUrl } });
  } catch (e) {
    return fail(res, e);
  }
}

export async function getAccount(req: Request, res: Response) {
  const found = await accountFrom(req, res);
  if (found) res.json({ success: true, data: serializeAccount(found.account) });
}

export async function check(req: Request, res: Response) {
  const found = await accountFrom(req, res);
  if (!found) return;
  try {
    const doc = await checkAccount(String(found.account._id));
    res.json({ success: true, data: serializeAccount(doc ?? found.account) });
  } catch (e) {
    return fail(res, e);
  }
}

export async function refresh(req: Request, res: Response) {
  const found = await accountFrom(req, res);
  if (!found) return;
  const base = { action: "Refreshed social account", category: "Brands" as const, resource: label(found.account), resourceId: String(found.account._id) };
  try {
    const doc = await manualRefresh(String(found.account._id));
    await audit(req, base);
    res.json({ success: true, data: serializeAccount(doc ?? found.account) });
  } catch (e) {
    await audit(req, { ...base, result: "Failed" });
    return fail(res, e);
  }
}

export async function disconnect(req: Request, res: Response) {
  const found = await accountFrom(req, res);
  if (!found) return;
  const doc = await disconnectAccount(String(found.account._id));
  await audit(req, { action: "Disconnected social account", category: "Brands", resource: label(found.account), resourceId: String(found.account._id) });
  res.json({ success: true, data: serializeAccount(doc ?? found.account) });
}

/**
 * Provider redirect target (GET /api/social/callback/:provider). Always answers with a
 * redirect back to the Brands page; the outcome travels in the query string.
 */
export async function oauthCallback(req: Request, res: Response) {
  const back = (params: Record<string, string>) =>
    res.redirect(`${frontendOrigin()}/brands?${new URLSearchParams(params).toString()}`);

  const providerId = String(req.params["provider"]) as ProviderId;
  const state = typeof req.query["state"] === "string" ? req.query["state"] : "";
  const code = typeof req.query["code"] === "string" ? req.query["code"] : "";

  if (!PROVIDERS[providerId]) return back({ social_error: "Unknown provider." });
  if (typeof req.query["error"] === "string" || !code || !state) {
    const message = denialMessage(req.query);
    await audit(req, { action: "Connected social account", category: "Brands", result: "Failed", resource: providerId, metadata: { reason: message } });
    return back({ social_error: message });
  }
  try {
    const r = await completeConnect(req.user!.id, providerId, state, code);
    await audit(req, { action: "Connected social account", category: "Brands", resource: r.platform, resourceId: r.brandId, metadata: { accounts: r.connected } });
    return back({ social: "connected", platform: r.platform, count: String(r.connected), brand: r.brandId });
  } catch (e) {
    const message = e instanceof ProviderError ? e.message : "Could not complete the connection. Please try again.";
    if (!(e instanceof ProviderError)) console.error("[social] callback failed:", (e as Error).name);
    await audit(req, { action: "Connected social account", category: "Brands", result: "Failed", resource: providerId, metadata: { reason: message } });
    return back({ social_error: message });
  }
}
