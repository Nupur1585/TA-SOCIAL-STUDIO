import api from "./api";
import { saveBlob } from "./reportService";

export type AuditCategory =
  | "Authentication"
  | "Content"
  | "Media"
  | "Brands"
  | "Scheduling"
  | "Reports"
  | "Settings"
  | "User Management";
export type AuditResult = "Success" | "Failed" | "Warning";

export const AUDIT_CATEGORIES: AuditCategory[] = [
  "Authentication",
  "Content",
  "Media",
  "Brands",
  "Scheduling",
  "Reports",
  "Settings",
  "User Management",
];

export interface AuditEntry {
  id: string;
  actorEmail: string;
  action: string;
  category: AuditCategory;
  resource: string;
  resourceId: string;
  result: AuditResult;
  metadata: Record<string, string>;
  createdAt: string;
}

export interface AuditQuery {
  q?: string;
  category?: AuditCategory;
  user?: string;
  result?: AuditResult;
  from?: string;
  to?: string;
  sort?: "newest" | "oldest";
  page?: number;
  limit?: number;
}

export interface AuditList {
  items: AuditEntry[];
  total: number;
  users: string[];
  summary: { total: number; success: number; failed: number; activeAdmins: number };
}

export async function listAudit(query: AuditQuery): Promise<AuditList> {
  const { data } = await api.get("/admin/audit", { params: query });
  return { items: data.data, total: data.meta.total, users: data.meta.users, summary: data.meta.summary };
}

export async function exportAudit(query: AuditQuery): Promise<void> {
  const { page: _page, limit: _limit, ...filters } = query;
  const { data } = await api.get("/admin/audit/export", { params: filters, responseType: "blob" });
  saveBlob(data, "activity-logs.csv");
}
