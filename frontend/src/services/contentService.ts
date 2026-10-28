import api from "./api";
import type { ContentItem, ContentType, ContentWorkflowStatus, PlatformKey } from "../types";

export interface ContentQuery {
  q?: string;
  brandId?: string;
  platform?: PlatformKey;
  status?: ContentWorkflowStatus;
  type?: ContentType;
  /** ISO range on scheduledAt (calendar). */
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface ContentListResult {
  items: ContentItem[];
  total: number;
  statusCounts: Record<string, number>;
}

export interface ContentInput {
  title: string;
  caption: string;
  hashtags: string[];
  brandId: string;
  platforms: PlatformKey[];
  /** Connected social accounts to publish to; platforms are derived from them on the server. */
  accountIds: string[];
  type: ContentType;
  scheduledAt: string | null;
  mediaIds: string[];
}

export async function listContent(query: ContentQuery): Promise<ContentListResult> {
  const { data } = await api.get("/admin/content", { params: query });
  return { items: data.data, total: data.meta.total, statusCounts: data.meta.statusCounts };
}

export const getContent = async (id: string): Promise<ContentItem> =>
  (await api.get(`/admin/content/${id}`)).data.data;

export const createContent = async (input: ContentInput): Promise<ContentItem> =>
  (await api.post("/admin/content", input)).data.data;

export const updateContent = async (id: string, input: Partial<ContentInput>): Promise<ContentItem> =>
  (await api.patch(`/admin/content/${id}`, input)).data.data;

export const changeContentStatus = async (
  id: string,
  status: ContentWorkflowStatus,
  scheduledAt?: string,
): Promise<ContentItem> =>
  (await api.post(`/admin/content/${id}/status`, { status, ...(scheduledAt ? { scheduledAt } : {}) })).data.data;

export const duplicateContent = async (id: string): Promise<ContentItem> =>
  (await api.post(`/admin/content/${id}/duplicate`)).data.data;

export const deleteContent = async (id: string): Promise<void> => {
  await api.delete(`/admin/content/${id}`);
};

export const rescheduleContent = async (id: string, scheduledAt: string): Promise<ContentItem> =>
  (await api.post(`/admin/content/${id}/reschedule`, { scheduledAt })).data.data;

/** Starts publishing immediately; the server finishes in the background (status becomes Publishing). */
export const publishContentNow = async (id: string): Promise<ContentItem> =>
  (await api.post(`/admin/content/${id}/publish-now`)).data.data;

/** Per-rule problems the server returns when a post can't be scheduled or published yet. */
export const apiProblems = (error: unknown): string[] =>
  (error as { response?: { data?: { problems?: string[] } } })?.response?.data?.problems ?? [];

/** The server message plus any validation problems, as one readable string. */
export function apiFullMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
  const problems = apiProblems(error);
  return problems.length ? `${message} ${problems.join(" ")}` : message;
}
