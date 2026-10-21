import fs from "node:fs";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";

export const uploadDir = path.resolve(process.env["UPLOAD_DIR"] || "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** Allowed MIME type -> stored extension. The extension is never taken from the client. */
const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${uuid()}${ALLOWED[file.mimetype] ?? ""}`),
});

const uploader = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED[file.mimetype]) return cb(null, true);
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "file"));
  },
});

/** Checks the real file header so a renamed or spoofed file is rejected. */
export function matchesSignature(filePath: string, mimeType: string): boolean {
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(16);
  try {
    fs.readSync(fd, buf, 0, 16, 0);
  } finally {
    fs.closeSync(fd);
  }
  const ascii = (a: number, b: number) => buf.subarray(a, b).toString("latin1");
  switch (mimeType) {
    case "image/jpeg":
      return buf[0] === 0xff && buf[1] === 0xd8;
    case "image/png":
      return buf[0] === 0x89 && ascii(1, 4) === "PNG";
    case "image/gif":
      return ascii(0, 3) === "GIF";
    case "image/webp":
      return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
    case "video/mp4":
    case "video/quicktime":
      return ascii(4, 8) === "ftyp";
    case "video/webm":
      return buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
    default:
      return false;
  }
}

export function removeFile(filename: string) {
  fs.rm(path.join(uploadDir, path.basename(filename)), { force: true }, () => {});
}

/** Runs multer and turns its errors into 400 JSON responses. */
export function singleUpload(req: Request, res: Response, next: NextFunction) {
  uploader.single("file")(req, res, (error: unknown) => {
    if (!error) return next();
    let message = "Upload failed";
    if (error instanceof multer.MulterError) {
      message =
        error.code === "LIMIT_FILE_SIZE"
          ? "File is too large (max 100 MB for videos, 15 MB for images)"
          : error.code === "LIMIT_UNEXPECTED_FILE"
            ? "Unsupported file type. Use JPG, PNG, WEBP, GIF, MP4, WEBM or MOV."
            : "Invalid upload";
    }
    res.status(400).json({ success: false, message });
  });
}
