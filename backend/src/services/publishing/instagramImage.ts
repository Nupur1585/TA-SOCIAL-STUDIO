import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { uploadDir } from "../../middleware/upload.js";

/** Instagram's API only takes JPEG. Other still-image types are converted once and the result is reused. */
export const IG_VARIANT = "ig";
const variantDir = path.join(uploadDir, "ig");

/** Stored under UPLOAD_DIR/ig/<original name without extension>.jpg; the original upload is never touched. */
export const instagramVariantPath = (filename: string) => path.join(variantDir, `${path.parse(path.basename(filename)).name}.jpg`);

export const needsInstagramConversion = (mimeType: string) => mimeType.startsWith("image/") && mimeType !== "image/jpeg";

export class ImageConversionError extends Error {}

const inFlight = new Map<string, Promise<void>>();

/**
 * Makes sure an Instagram-ready JPEG exists for this upload and returns the file to publish.
 * JPEG uploads are used as they are. Others (PNG, WEBP, GIF) are converted once (animated images: first frame
 * only, transparency flattened onto white) and reused. Throws ImageConversionError for unreadable images.
 */
export async function ensureInstagramJpeg(filename: string, mimeType: string): Promise<{ path: string; converted: boolean }> {
  const source = path.join(uploadDir, path.basename(filename));
  if (!needsInstagramConversion(mimeType)) return { path: source, converted: false };
  const target = instagramVariantPath(filename);

  let srcStat;
  try {
    srcStat = await fs.stat(source);
  } catch {
    throw new ImageConversionError("The original image file is missing from storage.");
  }
  const existing = await fs.stat(target).catch(() => null);
  if (existing && existing.size > 0 && existing.mtimeMs >= srcStat.mtimeMs) return { path: target, converted: true };

  // Two posts using the same image at once must not write the same file.
  let job = inFlight.get(target);
  if (!job) {
    job = convert(source, target).finally(() => inFlight.delete(target));
    inFlight.set(target, job);
  }
  await job;
  return { path: target, converted: true };
}

async function convert(source: string, target: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  try {
    const animated = ((await sharp(source, { animated: true }).metadata()).pages ?? 1) > 1;
    if (animated) console.warn("[publish] animated image: only its first frame is published to Instagram");
    await sharp(source, { failOn: "error" }) // reads the first frame only
      .rotate() // honour EXIF orientation
      .flatten({ background: "#ffffff" }) // JPEG has no transparency
      .jpeg({ quality: 90 })
      .toFile(temp);
    await fs.rename(temp, target);
  } catch {
    await fs.rm(temp, { force: true }).catch(() => undefined);
    throw new ImageConversionError("The image could not be converted to JPEG for Instagram. The file may be corrupted or in an unsupported format.");
  }
}

/** Removes the generated JPEG when its media item is deleted. */
export async function removeInstagramVariant(filename: string): Promise<void> {
  await fs.rm(instagramVariantPath(filename), { force: true }).catch(() => undefined);
}
