import type { Request } from "express";
import mongoose from "mongoose";
import AuditLog, { AUDIT_CATEGORIES, AUDIT_RESULTS } from "../models/AuditLog.js";

interface AuditEntry {
  action: string;
  category: (typeof AUDIT_CATEGORIES)[number];
  result?: (typeof AUDIT_RESULTS)[number];
  resource?: string;
  resourceId?: string;
  /** Short, non-secret values only. */
  metadata?: Record<string, string | number | boolean | null | undefined>;
  /** For events with no authenticated user (failed login). */
  actorEmail?: string;
}

const SECRET_KEY = /pass|token|secret|cookie|authorization|key/i;

function cleanMetadata(meta: AuditEntry["metadata"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta ?? {})) {
    if (v === undefined || v === null || SECRET_KEY.test(k)) continue;
    out[k.slice(0, 40)] = String(v).slice(0, 200);
  }
  return out;
}

/**
 * Records an administrative action. Called from trusted server code after the
 * outcome is known; the actor comes from the verified session, never the request body.
 * Never throws: an audit failure must not break the action itself.
 */
export async function audit(req: Request, entry: AuditEntry): Promise<void> {
  try {
    const user = req.user;
    await AuditLog.create({
      actorEmail: user?.email ?? entry.actorEmail?.slice(0, 254) ?? "unknown",
      ...(user ? { actorId: new mongoose.Types.ObjectId(user.id) } : {}),
      action: entry.action,
      category: entry.category,
      result: entry.result ?? "Success",
      resource: (entry.resource ?? "").slice(0, 200),
      resourceId: entry.resourceId ?? "",
      metadata: cleanMetadata(entry.metadata),
      ip: req.ip ?? "",
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}

/** For background work (the scheduler) where there is no request or signed-in admin. */
export async function auditSystem(entry: Omit<AuditEntry, "actorEmail">): Promise<void> {
  try {
    await AuditLog.create({
      actorEmail: "system (scheduler)",
      action: entry.action,
      category: entry.category,
      result: entry.result ?? "Success",
      resource: (entry.resource ?? "").slice(0, 200),
      resourceId: entry.resourceId ?? "",
      metadata: cleanMetadata(entry.metadata),
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}
