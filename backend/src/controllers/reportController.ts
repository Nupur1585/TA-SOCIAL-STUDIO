import fs from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { uploadDir } from "../middleware/upload.js";
import Content from "../models/Content.js";
import Media, { PLATFORMS } from "../models/Media.js";
import Report, { REPORT_FORMATS, REPORT_STATUSES, REPORT_TYPES } from "../models/Report.js";
import { audit } from "../utils/audit.js";
import { resolveBrand } from "../utils/brands.js";
import { toCsv } from "../utils/csv.js";
import { brandIdSchema, escapeRegex } from "./mediaController.js";

const reportDir = path.join(uploadDir, "reports");
fs.mkdirSync(reportDir, { recursive: true });

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    brandId: z.union([brandIdSchema, z.literal("all")]),
    // Ignored: the name is read from the Brand record on the server.
    brandName: z.string().trim().max(100).optional(),
    type: z.enum(REPORT_TYPES),
    format: z.enum(REPORT_FORMATS),
    startDate: z.iso.datetime({ offset: true }),
    endDate: z.iso.datetime({ offset: true }),
    platforms: z.array(z.enum(PLATFORMS)).max(PLATFORMS.length).default([]),
  })
  .refine((d) => new Date(d.startDate) <= new Date(d.endDate), { message: "End date must be after the start date" });

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  brandId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  type: z.enum(REPORT_TYPES).optional(),
  status: z.enum(REPORT_STATUSES).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  sort: z.enum(["newest", "oldest", "name"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(6),
});

type ReportDoc = mongoose.HydratedDocument<mongoose.InferSchemaType<typeof Report.schema>>;

const serialize = (r: ReportDoc) => ({
  id: String(r._id),
  name: r.name,
  brandId: r.brandId,
  brandName: r.brandName,
  type: r.type,
  format: r.format,
  startDate: r.startDate,
  endDate: r.endDate,
  platforms: r.platforms,
  status: r.status,
  size: r.size ?? null,
  rowCount: r.rowCount ?? null,
  error: r.error ?? null,
  createdByEmail: r.createdByEmail,
  createdAt: r.createdAt,
});

interface Table {
  title: string;
  header: string[];
  rows: string[][];
  summary: [string, string][];
}

/** Builds the report table from real Content / Media records. */
async function buildTable(r: ReportDoc): Promise<Table> {
  const range = { $gte: r.startDate, $lte: r.endDate };
  const brand = r.brandId === "all" ? {} : { brandId: r.brandId };
  const plat = r.platforms.length ? { platforms: { $in: r.platforms } } : {};
  const iso = (d?: Date | null) => (d ? d.toISOString() : "");
  const tally = (vals: string[]): [string, string][] => {
    const m = new Map<string, number>();
    vals.forEach((v) => m.set(v, (m.get(v) ?? 0) + 1));
    return [...m.entries()].map(([k, v]) => [k, String(v)]);
  };

  if (r.type === "Publishing History") {
    const posts = await Content.find({ ...brand, ...plat, createdAt: range, "targets.0": { $exists: true } }).sort({ createdAt: -1 }).limit(5000).lean();
    const rows: string[][] = [];
    for (const p of posts) {
      for (const t of p.targets) {
        rows.push([p.title, p.brandId, t.platform, t.status, String(t.attempts ?? 0), iso(t.lastAttemptAt), iso(t.publishedAt), t.publishedUrl ?? "", t.error ?? ""]);
      }
    }
    return {
      title: "Publishing History",
      header: ["Title", "Brand", "Platform", "Result", "Attempts", "Last attempt", "Published", "Link", "Error"],
      rows,
      summary: [["Publishing attempts", String(rows.length)], ...tally(rows.map((x) => `Result: ${x[3]}`))],
    };
  }

  if (r.type === "Media Inventory") {
    const media = await Media.find({ ...brand, ...plat, createdAt: range }).sort({ createdAt: -1 }).limit(5000).lean();
    return {
      title: "Media Inventory",
      header: ["Title", "Brand", "Type", "Platforms", "Size (KB)", "Uploaded"],
      rows: media.map((m) => [m.title, m.brandId, m.kind, m.platforms.join(" "), String(Math.round(m.size / 1024)), iso(m.createdAt)]),
      summary: [["Total files", String(media.length)], ...tally(media.map((m) => `Type: ${m.kind}`))],
    };
  }

  const dateField = r.type === "Schedule Overview" ? "scheduledAt" : "createdAt";
  const content = await Content.find({ ...brand, ...plat, [dateField]: range })
    .sort({ [dateField]: 1 })
    .limit(5000)
    .lean();
  return {
    title: r.type,
    header: ["Title", "Brand", "Type", "Status", "Platforms", "Scheduled", "Created"],
    rows: content.map((c) => [c.title, c.brandId, c.type, c.status, c.platforms.join(" "), iso(c.scheduledAt), iso(c.createdAt)]),
    summary: [
      ["Total content", String(content.length)],
      ...tally(content.map((c) => `Status: ${c.status}`)),
      ...tally(content.map((c) => `Type: ${c.type}`)),
    ],
  };
}

function writePdf(file: string, r: ReportDoc, t: Table): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const out = fs.createWriteStream(file);
    out.on("finish", resolve);
    out.on("error", reject);
    doc.on("error", reject);
    doc.pipe(out);

    doc.fontSize(20).text(r.name);
    doc.moveDown(0.3).fontSize(10).fillColor("#64748b");
    doc.text(`${t.title} · ${r.brandName}`);
    doc.text(`${r.startDate.toISOString().slice(0, 10)} to ${r.endDate.toISOString().slice(0, 10)}`);
    doc.text(`Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC by ${r.createdByEmail}`);
    doc.moveDown().fillColor("#0f172a").fontSize(12).text("Summary");
    doc.fontSize(10);
    t.summary.forEach(([k, v]) => doc.text(`${k}: ${v}`));
    doc.moveDown().fontSize(12).text("Details");
    doc.fontSize(8);
    if (t.rows.length === 0) doc.text("No records found for the selected filters.");
    // Plain text rows (title column first) keep the layout robust for any data.
    t.rows.slice(0, 500).forEach((row) => {
      doc.text(row.filter(Boolean).join("  |  "), { width: 515 });
    });
    if (t.rows.length > 500) doc.text(`… ${t.rows.length - 500} more rows. Use CSV for the full list.`);
    doc.end();
  });
}

export async function createReport(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? "Invalid report" });
  }
  const d = parsed.data;
  let brandName = "All Brands";
  if (d.brandId !== "all") {
    const brand = await resolveBrand(d.brandId);
    if (!brand.ok) return res.status(400).json({ success: false, message: brand.message });
    brandName = brand.brand.name;
  }
  const report = await Report.create({
    name: d.name,
    brandId: d.brandId,
    brandName,
    type: d.type,
    format: d.format,
    startDate: new Date(d.startDate),
    endDate: new Date(d.endDate),
    platforms: d.platforms,
    status: "Processing",
    createdBy: new mongoose.Types.ObjectId(req.user!.id),
    createdByEmail: req.user!.email,
  });

  const filename = `${uuid()}.${d.format.toLowerCase()}`;
  const file = path.join(reportDir, filename);
  try {
    const table = await buildTable(report);
    if (d.format === "CSV") await fs.promises.writeFile(file, toCsv(table.header, table.rows), "utf8");
    else await writePdf(file, report, table);
    const stat = await fs.promises.stat(file);
    // Ready only after the file exists on disk.
    report.set({ status: "Ready", filename, size: stat.size, rowCount: table.rows.length });
    await report.save();
    await audit(req, { action: "Generated report", category: "Reports", resource: report.name, resourceId: String(report._id), metadata: { format: d.format, type: d.type } });
    res.status(201).json({ success: true, data: serialize(report) });
  } catch (error) {
    console.error("Report generation failed", error);
    fs.rm(file, { force: true }, () => {});
    report.set({ status: "Failed", error: "Report generation failed" });
    await report.save();
    await audit(req, { action: "Generated report", category: "Reports", result: "Failed", resource: report.name, resourceId: String(report._id) });
    res.status(500).json({ success: false, message: "Report generation failed", data: serialize(report) });
  }
}

export async function listReports(req: Request, res: Response) {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid filters" });
  const p = parsed.data;

  const f: Record<string, unknown> = {};
  if (p.q) f["name"] = { $regex: escapeRegex(p.q), $options: "i" };
  if (p.brandId) f["brandId"] = p.brandId;
  if (p.type) f["type"] = p.type;
  if (p.status) f["status"] = p.status;
  // Reports whose period overlaps the requested range.
  if (p.from) f["endDate"] = { $gte: new Date(p.from) };
  if (p.to) f["startDate"] = { $lte: new Date(p.to) };

  const sortBy = ({ newest: { createdAt: -1 }, oldest: { createdAt: 1 }, name: { name: 1 } } as const)[p.sort] as Record<string, 1 | -1>;
  const [items, total, byStatus] = await Promise.all([
    Report.find(f).sort(sortBy).skip((p.page - 1) * p.limit).limit(p.limit),
    Report.countDocuments(f),
    Report.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const n = (s: string) => byStatus.find((x) => x._id === s)?.n ?? 0;

  res.json({
    success: true,
    data: items.map(serialize),
    meta: {
      page: p.page,
      limit: p.limit,
      total,
      summary: { total: byStatus.reduce((a, b) => a + b.n, 0), ready: n("Ready"), scheduled: n("Scheduled"), failed: n("Failed") },
    },
  });
}

async function find(req: Request, res: Response) {
  const id = String(req.params["id"]);
  const doc = mongoose.isValidObjectId(id) ? await Report.findById(id) : null;
  if (!doc) res.status(404).json({ success: false, message: "Report not found" });
  return doc;
}

export async function getReport(req: Request, res: Response) {
  const doc = await find(req, res);
  if (doc) res.json({ success: true, data: serialize(doc) });
}

export async function downloadReport(req: Request, res: Response) {
  const doc = await find(req, res);
  if (!doc) return;
  if (doc.status !== "Ready" || !doc.filename) {
    return res.status(409).json({ success: false, message: "Report is not ready for download" });
  }
  const safe = doc.name.replace(/[^\w\- ]+/g, "").trim() || "report";
  res.setHeader("Content-Type", doc.format === "PDF" ? "application/pdf" : "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${safe}.${doc.format.toLowerCase()}"`);
  res.sendFile(path.join(reportDir, path.basename(doc.filename)), (error) => {
    if (error && !res.headersSent) res.status(404).json({ success: false, message: "Report file is missing" });
  });
}

export async function deleteReport(req: Request, res: Response) {
  const doc = await find(req, res);
  if (!doc) return;
  await doc.deleteOne();
  if (doc.filename) fs.rm(path.join(reportDir, path.basename(doc.filename)), { force: true }, () => {});
  await audit(req, { action: "Deleted report", category: "Reports", resource: doc.name, resourceId: String(doc._id) });
  res.json({ success: true });
}
