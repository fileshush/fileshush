/**
 * Image compressor: pure logic (no DOM), so it can be tested in Node.
 * The browser parts (canvas encoding) live in CompressTool.astro.
 */

export type OutputFormat = "same" | "jpeg" | "webp";
export type MimeType = "image/jpeg" | "image/png" | "image/webp";

export const SUPPORTED_TYPES: MimeType[] = ["image/jpeg", "image/png", "image/webp"];

/** Pick the mime type from the file type, falling back to the extension. */
export function detectMime(name: string, type: string): MimeType | null {
  const t = type.toLowerCase();
  if (t === "image/jpg") return "image/jpeg";
  if ((SUPPORTED_TYPES as string[]).includes(t)) return t as MimeType;
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}

export function outputMime(input: MimeType, format: OutputFormat): MimeType {
  if (format === "jpeg") return "image/jpeg";
  if (format === "webp") return "image/webp";
  return input;
}

/** PNG output through a canvas is always lossless, so quality has no effect. */
export function isLossy(mime: MimeType): boolean {
  return mime !== "image/png";
}

export function extensionFor(mime: MimeType): string {
  return mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
}

/** "photo.heic.jpg" -> "photo.heic-compressed.jpg"; extension follows the output type. */
export function compressedFileName(original: string, mime: MimeType): string {
  const dot = original.lastIndexOf(".");
  const base = dot > 0 ? original.slice(0, dot) : original;
  return `${base || "image"}-compressed.${extensionFor(mime)}`;
}

/** Shrink to fit inside maxW x maxH, keep the shape, never enlarge. 0/undefined = no limit. */
export function fitDimensions(
  width: number,
  height: number,
  maxWidth?: number,
  maxHeight?: number,
): { width: number; height: number } {
  let scale = 1;
  if (maxWidth && maxWidth > 0) scale = Math.min(scale, maxWidth / width);
  if (maxHeight && maxHeight > 0) scale = Math.min(scale, maxHeight / height);
  if (scale >= 1) return { width, height };
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Percent saved, rounded. Negative when the file grew. */
export function percentSaved(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round(((before - after) / before) * 100);
}

export interface SearchOptions {
  /** Accept a result this close below the target. Default 0.05 (5%). */
  tolerance?: number;
  minQuality?: number;
  maxQuality?: number;
  maxSteps?: number;
}

export interface SearchResult<T extends { size: number }> {
  /** Best encode found: the largest one that fits the target. Null if none fit. */
  best: T | null;
  quality: number;
  /** Smallest encode tried, used when nothing fits so the caller can report it. */
  smallest: T;
  steps: number;
  /** True when best is within tolerance of the target. */
  close: boolean;
}

/**
 * Binary search on quality for the largest file that is still <= targetBytes.
 * `encode` is injected (canvas in the browser, a fake in tests).
 */
export async function searchQuality<T extends { size: number }>(
  encode: (quality: number) => Promise<T>,
  targetBytes: number,
  options: SearchOptions = {},
): Promise<SearchResult<T>> {
  const tolerance = options.tolerance ?? 0.05;
  const minQ = options.minQuality ?? 0.05;
  const maxQ = options.maxQuality ?? 1;
  const maxSteps = options.maxSteps ?? 9;
  const floor = targetBytes * (1 - tolerance);

  let steps = 0;
  const top = await encode(maxQ);
  steps++;
  let smallest = top;
  if (top.size <= targetBytes) {
    // Already fits at top quality; no need to degrade.
    return { best: top, quality: maxQ, smallest, steps, close: top.size >= floor };
  }

  const bottom = await encode(minQ);
  steps++;
  smallest = bottom;
  if (bottom.size > targetBytes) {
    return { best: null, quality: minQ, smallest, steps, close: false };
  }

  let low = minQ;
  let high = maxQ;
  let best: T = bottom;
  let bestQ = minQ;
  while (steps < maxSteps) {
    const mid = (low + high) / 2;
    const result = await encode(mid);
    steps++;
    if (result.size <= targetBytes) {
      best = result;
      bestQ = mid;
      low = mid;
      if (result.size >= floor) break;
    } else {
      high = mid;
    }
  }
  return { best, quality: bestQ, smallest, steps, close: best.size >= floor };
}
