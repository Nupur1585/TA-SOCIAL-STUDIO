import api from "./api";
import type { ContentItem, ContentType, ContentWorkflowStatus, PlatformKey } from "../types";

export interface ContentQuery {
  q?: string;
  brandId?: string;
  platform?: PlatformKey;
  status?: ContentWorkflowStatus;
  type?: ContentType;
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
