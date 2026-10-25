import type { Request, Response } from "express";
import { z } from "zod";
import AuditLog, { AUDIT_CATEGORIES, AUDIT_RESULTS } from "../models/AuditLog.js";
import { toCsv } from "../utils/csv.js";
import { escapeRegex } from "./mediaController.js";

const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(AUDIT_CATEGORIES).optional(),
  user: z.string().trim().max(254).optional(),
  result: z.enum(AUDIT_RESULTS).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(8),
});

function buildFilter(p: z.infer<typeof querySchema>, withResult = true) {
  const f: Record<string, unknown> = {};
  if (p.q) {
    const rx = { $regex: escapeRegex(p.q), $options: "i" };
    f["$or"] = [{ action: rx }, { actorEmail: rx }, { resource: rx }];
  }
  if (p.category) f["category"] = p.category;
  if (p.user) f["actorEmail"] = p.user;
  if (withResult && p.result) f["result"] = p.result;
  if (p.from || p.to) {
    f["createdAt"] = {
      ...(p.from ? { $gte: new Date(p.from) } : {}),
      ...(p.to ? { $lte: new Date(p.to) } : {}),
    };
  }
  return f;
}

const serialize = (l: {
  _id: unknown;
  actorEmail: string;
  action: string;
  category: string;
  resource?: string | null;
  resourceId?: string | null;
  result: string;
  metadata?: unknown;
  createdAt?: Date;
}) => ({
  id: String(l._id),
  actorEmail: l.actorEmail,
  action: l.action,
  category: l.category,
  resource: l.resource ?? "",
  resourceId: l.resourceId ?? "",
  result: l.result,
  metadata: l.metadata instanceof Map ? Object.fromEntries(l.metadata) : (l.metadata ?? {}),
  createdAt: l.createdAt,
});

export async function listAudit(req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid filters" });
  const p = parsed.data;
  const filter = buildFilter(p);
  const base = buildFilter(p, false);

  const [items, total, byResult, admins, users] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: p.sort === "oldest" ? 1 : -1 })
      .skip((p.page - 1) * p.limit)
      .limit(p.limit)
      .lean(),
    AuditLog.countDocuments(filter),
    AuditLog.aggregate<{ _id: string; n: number }>([{ $match: base }, { $group: { _id: "$result", n: { $sum: 1 } } }]),
    AuditLog.distinct("actorEmail", { createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } }),
    AuditLog.distinct("actorEmail"),
  ]);
  const count = (r: string) => byResult.find((x) => x._id === r)?.n ?? 0;

  res.json({
    success: true,
    data: items.map(serialize),
    meta: {
      page: p.page,
      limit: p.limit,
      total,
      summary: {
        total: byResult.reduce((a, b) => a + b.n, 0),
        success: count("Success"),
        failed: count("Failed"),
        activeAdmins: admins.length,
      },
      users,
    },
  });
}

export async function exportAudit(req: Request, res: Response) {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid filters" });
  const p = parsed.data;
  const rows = await AuditLog.find(buildFilter(p))
    .sort({ createdAt: p.sort === "oldest" ? 1 : -1 })
    .limit(10000)
    .lean();
  const csv = toCsv(
    ["Date & Time", "Administrator", "Action", "Category", "Resource", "Result"],
    rows.map((r) => [r.createdAt?.toISOString() ?? "", r.actorEmail, r.action, r.category, r.resource ?? "", r.result]),
  );
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="activity-logs.csv"');
  res.send(csv);
}
