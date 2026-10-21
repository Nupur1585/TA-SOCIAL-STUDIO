import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { useBrands } from "../../context/BrandsContext";
import { formatBytes } from "../../lib/format";
import {
  ALLOWED_MIME,
  apiErrorMessage,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  uploadMedia,
} from "../../services/mediaService";
import type { MediaItem, MediaKind, PlatformKey } from "../../types";
import { Modal } from "../ui/Overlay";
import { Notice } from "../ui/ListControls";

const IMAGE_KINDS: MediaKind[] = ["Image", "Carousel"];
const VIDEO_KINDS: MediaKind[] = ["Video", "Reel", "Short"];
const ALL_PLATFORMS: PlatformKey[] = ["instagram", "facebook", "youtube", "linkedin", "x"];

function validate(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type)) {
    return "Unsupported file type. Use JPG, PNG, WEBP, GIF, MP4, WEBM or MOV.";
  }
  const isVideo = file.type.startsWith("video/");
  if (file.size > (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES)) {
    return isVideo ? "Videos must be 100 MB or smaller." : "Images must be 15 MB or smaller.";
  }
  return null;
}

function readDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? video.duration : undefined);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    };
    video.src = url;
  });
}

export function UploadMediaModal({
  defaultBrandId,
  onClose,
  onUploaded,
}: {
  defaultBrandId?: string;
  onClose: () => void;
  onUploaded: (item: MediaItem) => void;
}) {
  const { brands, selectedBrandId } = useBrands();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [brandId, setBrandId] = useState(defaultBrandId ?? selectedBrandId);
  const [kind, setKind] = useState<MediaKind>("Image");
  const [platforms, setPlatforms] = useState<PlatformKey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const uploading = progress !== null && !done;
  const isVideo = file?.type.startsWith("video/") ?? false;
  const brand = brands.find((b) => b.id === brandId);

  const pick = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    const problem = validate(f);
    if (problem) {
      setFile(null);
      setError(problem);
      return;
    }
    setError(null);
    setFile(f);
    setTitle((t) => t || f.name.replace(/\.[^.]+$/, ""));
    setKind(f.type.startsWith("video/") ? "Video" : "Image");
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: pick,
    multiple: false,
    noClick: true,
    disabled: uploading || done,
  });

  const togglePlatform = (p: PlatformKey) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const submit = async () => {
    if (!file) return setError("Choose a file to upload.");
    if (!title.trim()) return setError("Enter a title.");
    setError(null);
    setProgress(0);
    try {
      const duration = isVideo ? await readDuration(file) : undefined;
      const item = await uploadMedia(
        {
          file,
          title: title.trim(),
          brandId,
          kind,
          platforms,
          ...(duration !== undefined ? { duration } : {}),
        },
        setProgress,
      );
      setDone(true);
      onUploaded(item);
      setTimeout(onClose, 900);
    } catch (e) {
      setProgress(null);
      setError(apiErrorMessage(e, "Upload failed. Check that the backend is running and try again."));
    }
  };

  const fieldCls =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400";

  return (
    <Modal title="Upload Media" onClose={uploading ? () => {} : onClose}>
      <div className="space-y-4">
        <div
          {...getRootProps()}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center ${
            isDragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"
          }`}
        >
          <input {...getInputProps()} accept={ALLOWED_MIME.join(",")} aria-label="Choose media file" />
          <UploadCloud size={28} className="text-blue-600" />
          {file ? (
            <p className="mt-2 text-sm font-medium text-slate-800">
              {file.name} <span className="font-normal text-slate-500">({formatBytes(file.size)})</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Drag a file here, or</p>
          )}
          <button
            type="button"
            onClick={open}
            disabled={uploading || done}
            className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {file ? "Choose a different file" : "Browse files"}
          </button>
          <p className="mt-3 text-xs text-slate-500">JPG, PNG, WEBP, GIF up to 15 MB · MP4, WEBM, MOV up to 100 MB</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} className={`mt-1 ${fieldCls}`} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Brand
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={`mt-1 ${fieldCls}`}>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Media type
            <select value={kind} onChange={(e) => setKind(e.target.value as MediaKind)} className={`mt-1 ${fieldCls}`}>
              {(isVideo ? VIDEO_KINDS : IMAGE_KINDS).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Suitable for platforms</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALL_PLATFORMS.map((p) => {
              const available = brand?.platforms.includes(p) ?? true;
              const on = platforms.includes(p);
              return (
                <label
                  key={p}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                    on ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"
                  } ${available ? "" : "opacity-40"}`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    disabled={!available}
                    onChange={() => togglePlatform(p)}
                  />
                  {p === "x" ? "X" : p}
                </label>
              );
            })}
          </div>
        </fieldset>

        {uploading && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">Uploading… {progress}%</p>
          </div>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {done && (
          <Notice tone="success">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} /> Upload complete.
            </span>
          </Notice>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={uploading || done || !file}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {uploading && <Loader2 size={16} className="animate-spin" />}
            Upload
          </button>
        </div>
      </div>
    </Modal>
  );
}
