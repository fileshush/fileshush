/**
 * Image to WebP conversion (JPG, PNG, GIF first frame).
 * Runs in the browser. Nothing is uploaded.
 *
 * Encoding uses @jsquash/webp (WebAssembly), loaded only when first needed.
 * If that fails, the browser's own canvas WebP encoder is used instead.
 */

export interface WebpOptions {
  /** 0 to 100. Ignored when lossless is on. */
  quality: number;
  lossless: boolean;
}

export const DEFAULT_OPTIONS: WebpOptions = { quality: 80, lossless: false };

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/gif"];

export interface WebpResult {
  blob: Blob;
  originalSize: number;
  newSize: number;
  /** True when the WebP file is not smaller than the original. */
  larger: boolean;
  /** Whole percent saved. 0 when not smaller. */
  savedPercent: number;
  engine: "jsquash" | "canvas";
}

/** Clamp and sanitize options. Bad numbers fall back to the defaults. */
export function normalizeOptions(input: Partial<WebpOptions> = {}): WebpOptions {
  const raw = Number(input.quality);
  const quality = Number.isFinite(raw)
    ? Math.min(100, Math.max(0, Math.round(raw)))
    : DEFAULT_OPTIONS.quality;
  return { quality, lossless: input.lossless === true };
}

/** "photo.final.jpg" becomes "photo.final.webp". */
export function webpFileName(name: string): string {
  const clean = name.replace(/[\\/]/g, "_").trim();
  const dot = clean.lastIndexOf(".");
  const base = dot > 0 ? clean.slice(0, dot) : clean;
  return `${base || "image"}.webp`;
}

/** Give repeated names a number so a ZIP never holds two files with one name. */
export function uniqueName(name: string, taken: Set<string>): string {
  let candidate = name;
  let n = 2;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  while (taken.has(candidate.toLowerCase())) candidate = `${base}-${n++}${ext}`;
  taken.add(candidate.toLowerCase());
  return candidate;
}

export function savings(originalSize: number, newSize: number): { larger: boolean; savedPercent: number } {
  if (originalSize <= 0 || newSize >= originalSize) return { larger: newSize >= originalSize && originalSize > 0, savedPercent: 0 };
  return { larger: false, savedPercent: Math.round(((originalSize - newSize) / originalSize) * 100) };
}

export function isSupportedFile(file: { type: string; name: string }): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  return !file.type && /\.(jpe?g|png|gif)$/i.test(file.name);
}

/** True when bytes start with RIFF....WEBP. */
export function isWebpBytes(bytes: Uint8Array): boolean {
  const at = (i: number, s: string) => [...s].every((c, k) => bytes[i + k] === c.charCodeAt(0));
  return bytes.length >= 12 && at(0, "RIFF") && at(8, "WEBP");
}

/** Encode raw pixels to WebP bytes with jsquash. */
export async function encodePixels(image: ImageData, options: Partial<WebpOptions>): Promise<Uint8Array> {
  const opts = normalizeOptions(options);
  const { default: encode } = await import("@jsquash/webp/encode.js");
  const buffer = await encode(image, {
    quality: opts.quality,
    lossless: opts.lossless ? 1 : 0,
    // Keep colour under fully clear pixels only when lossless asks for exact output.
    exact: opts.lossless ? 1 : 0,
  });
  return new Uint8Array(buffer);
}

async function decodeToCanvas(file: File): Promise<{ canvas: HTMLCanvasElement; image: ImageData }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This file could not be read as an image. It may be damaged.");
  }
  try {
    if (!bitmap.width || !bitmap.height) throw new Error("This image has no size.");
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not prepare the image.");
    ctx.drawImage(bitmap, 0, 0);
    return { canvas, image: ctx.getImageData(0, 0, canvas.width, canvas.height) };
  } finally {
    bitmap.close();
  }
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob && blob.type === "image/webp" ? resolve(blob) : reject(new Error("This browser cannot create WebP files."))),
      "image/webp",
      quality / 100,
    );
  });
}

/** Browser only. Converts one file. Throws a readable Error on failure. */
export async function convertToWebp(file: File, options: Partial<WebpOptions>): Promise<WebpResult> {
  const opts = normalizeOptions(options);
  if (!isSupportedFile(file)) throw new Error("Only JPG, PNG and GIF images are supported.");
  if (file.size === 0) throw new Error("This file is empty.");

  const { canvas, image } = await decodeToCanvas(file);

  let blob: Blob;
  let engine: WebpResult["engine"] = "jsquash";
  try {
    const bytes = await encodePixels(image, opts);
    if (!isWebpBytes(bytes)) throw new Error("bad output");
    blob = new Blob([bytes as BlobPart], { type: "image/webp" });
  } catch {
    engine = "canvas";
    blob = await canvasToWebp(canvas, opts.lossless ? 100 : opts.quality);
  }

  const { larger, savedPercent } = savings(file.size, blob.size);
  return { blob, originalSize: file.size, newSize: blob.size, larger, savedPercent, engine };
}
