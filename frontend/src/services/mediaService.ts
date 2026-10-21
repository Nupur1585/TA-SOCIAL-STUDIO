import api from "./api";
import type { MediaItem, MediaKind, PlatformKey } from "../types";

export interface MediaQuery {
  q?: string;
  brandId?: string;
  kind?: MediaKind;
  platform?: PlatformKey;
  sort?: "newest" | "oldest" | "name";
  page?: number;
  limit?: number;
}

export interface MediaListResult {
  items: MediaItem[];
  total: number;
  kindCounts: Record<string, number>;
  brandCounts: Record<string, number>;
}

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export const mediaFileUrl = (id: string, download = false) =>
  `${api.defaults.baseURL}/admin/media/${id}/file${download ? "?download=1" : ""}`;

export const apiErrorMessage = (error: unknown, fallback: string): string => {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message ?? fallback;
};

export async function listMedia(query: MediaQuery): Promise<MediaListResult> {
  const { data } = await api.get("/admin/media", { params: query });
  return {
    items: data.data,
    total: data.meta.total,
    kindCounts: data.meta.kindCounts,
    brandCounts: data.meta.brandCounts,
  };
}

export interface UploadInput {
  file: File;
  title: string;
  brandId: string;
  kind: MediaKind;
  platforms: PlatformKey[];
  duration?: number;
}

export async function uploadMedia(input: UploadInput, onProgress: (pct: number) => void): Promise<MediaItem> {
  const form = new FormData();
  form.append("title", input.title);
  form.append("brandId", input.brandId);
  form.append("kind", input.kind);
  form.append("platforms", input.platforms.join(","));
  if (input.duration !== undefined) form.append("duration", String(input.duration));
  form.append("file", input.file);
  const { data } = await api.post("/admin/media", form, {
    // The shared client defaults to JSON, which would corrupt a multipart body.
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => e.total && onProgress(Math.round((e.loaded / e.total) * 100)),
  });
  return data.data;
}

export async function deleteMedia(id: string): Promise<void> {
  await api.delete(`/admin/media/${id}`);
}

export async function downloadMedia(item: MediaItem): Promise<void> {
  const { data } = await api.get(`/admin/media/${item.id}/file`, { params: { download: 1 }, responseType: "blob" });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = item.title;
  a.click();
  URL.revokeObjectURL(url);
}

export const getMedia = async (id: string): Promise<MediaItem> => (await api.get(`/admin/media/${id}`)).data.data;
