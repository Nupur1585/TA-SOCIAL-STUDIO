import api from "./api";
import type { PlatformKey } from "../types";

export type ReportType = "Content Summary" | "Schedule Overview" | "Media Inventory";
export type ReportFormat = "PDF" | "CSV";
export type ReportStatus = "Ready" | "Processing" | "Scheduled" | "Failed";

export interface ReportItem {
  id: string;
  name: string;
  brandId: string;
  brandName: string;
  type: ReportType;
  format: ReportFormat;
  startDate: string;
  endDate: string;
  platforms: PlatformKey[];
  status: ReportStatus;
  size: number | null;
  rowCount: number | null;
  error: string | null;
  createdByEmail: string;
  createdAt: string;
}

export interface ReportQuery {
  q?: string;
  brandId?: string;
  type?: ReportType;
  status?: ReportStatus;
  from?: string;
  to?: string;
  sort?: "newest" | "oldest" | "name";
  page?: number;
  limit?: number;
}

export interface ReportList {
  items: ReportItem[];
  total: number;
  summary: { total: number; ready: number; scheduled: number; failed: number };
}

export interface CreateReportInput {
  name: string;
  brandId: string;
  brandName: string;
  type: ReportType;
  format: ReportFormat;
  startDate: string;
  endDate: string;
  platforms: PlatformKey[];
}

export async function listReports(query: ReportQuery): Promise<ReportList> {
  const { data } = await api.get("/admin/reports", { params: query });
  return { items: data.data, total: data.meta.total, summary: data.meta.summary };
}

export const createReport = async (input: CreateReportInput): Promise<ReportItem> =>
  (await api.post("/admin/reports", input)).data.data;

export const deleteReport = async (id: string): Promise<void> => {
  await api.delete(`/admin/reports/${id}`);
};

/** Saves a blob returned by the API as a file in the browser. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadReport(report: ReportItem): Promise<void> {
  const { data } = await api.get(`/admin/reports/${report.id}/download`, { responseType: "blob" });
  saveBlob(data, `${report.name}.${report.format.toLowerCase()}`);
}
