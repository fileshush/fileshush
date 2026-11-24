/**
 * YouTube thumbnail safe-zone helpers. Pure functions, no DOM.
 * Sizes and overlay boxes are approximations drawn for this site.
 */

export const THUMB_WIDTH = 1280;
export const THUMB_HEIGHT = 720;
export const MAX_THUMB_BYTES = 2 * 1024 * 1024;
export const SHORTS_WIDTH = 1080;
export const SHORTS_HEIGHT = 1920;
export const MAX_COMPARE = 3;
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif"] as const;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Level = "ok" | "warn";

export interface Check {
  id: "size" | "ratio" | "bytes" | "type";
  level: Level;
  message: string;
}

export interface ThumbInfo {
  width: number;
  height: number;
  bytes: number;
  type?: string;
}

export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) [a, b] = [b, a % b];
  return a;
}

/** "16:9" style ratio text. */
export function aspectLabel(width: number, height: number): string {
  if (!(width > 0) || !(height > 0)) return "unknown";
  const d = gcd(width, height);
  return `${Math.round(width) / d}:${Math.round(height) / d}`;
}

/** True when the shape is 16:9 within a small tolerance. */
export function isSixteenByNine(width: number, height: number): boolean {
  if (!(width > 0) || !(height > 0)) return false;
  return Math.abs(width / height - 16 / 9) < 0.01;
}

export function checkThumbnail(info: ThumbInfo): Check[] {
  const checks: Check[] = [];
  const { width, height, bytes, type } = info;

  if (width === THUMB_WIDTH && height === THUMB_HEIGHT) {
    checks.push({ id: "size", level: "ok", message: "Size is 1280×720." });
  } else if (width < THUMB_WIDTH || height < THUMB_HEIGHT) {
    checks.push({
      id: "size",
      level: "warn",
      message: `Size is ${width}×${height}. YouTube recommends 1280×720; this is smaller and may look soft.`,
    });
  } else {
    checks.push({
      id: "size",
      level: "warn",
      message: `Size is ${width}×${height}. YouTube recommends 1280×720.`,
    });
  }

  if (isSixteenByNine(width, height)) {
    checks.push({ id: "ratio", level: "ok", message: "Shape is 16:9." });
  } else {
    checks.push({
      id: "ratio",
      level: "warn",
      message: `Shape is ${aspectLabel(width, height)}, not 16:9. The edges may be cropped or get black bars.`,
    });
  }

  if (bytes > MAX_THUMB_BYTES) {
    checks.push({
      id: "bytes",
      level: "warn",
      message: "File is over 2 MB. YouTube may reject it. Save it smaller.",
    });
  } else {
    checks.push({ id: "bytes", level: "ok", message: "File is under 2 MB." });
  }

  if (type && !(ALLOWED_TYPES as readonly string[]).includes(type)) {
    checks.push({
      id: "type",
      level: "warn",
      message: "YouTube accepts JPG, PNG and GIF thumbnails. Convert this file first.",
    });
  }
  return checks;
}

/** Approximate timestamp badge (bottom-right) for a thumbnail of this size. */
export function timestampBox(width: number, height: number): Box {
  const w = width * 0.15;
  const h = height * 0.075;
  const margin = width * 0.012;
  return { x: width - margin - w, y: height - margin - h, width: w, height: h };
}

export type ShortsZoneId = "top" | "caption" | "actions";
export interface ShortsZone extends Box {
  id: ShortsZoneId;
  label: string;
}

/** Approximate areas the Shorts player draws over a vertical video. */
export function shortsZones(width = SHORTS_WIDTH, height = SHORTS_HEIGHT): ShortsZone[] {
  return [
    { id: "top", label: "Top bar", x: 0, y: 0, width, height: height * 0.1 },
    {
      id: "actions",
      label: "Buttons",
      x: width * 0.84,
      y: height * 0.5,
      width: width * 0.16,
      height: height * 0.35,
    },
    {
      id: "caption",
      label: "Title and channel",
      x: 0,
      y: height * 0.78,
      width: width * 0.84,
      height: height * 0.22,
    },
  ];
}

/** Share of the frame a box covers, 0 to 1. */
export function areaShare(box: Box, width: number, height: number): number {
  return (box.width * box.height) / (width * height);
}

export interface Layout {
  id: "home" | "search" | "sidebar" | "mobile";
  label: string;
  /** Thumbnail width in CSS pixels at real size. */
  thumbWidth: number;
}

export const LAYOUTS: Layout[] = [
  { id: "home", label: "Home grid", thumbWidth: 360 },
  { id: "search", label: "Search result", thumbWidth: 360 },
  { id: "sidebar", label: "Up next", thumbWidth: 168 },
  { id: "mobile", label: "Mobile feed", thumbWidth: 375 },
];

/** Real-size width, shrunk to fit a container, never below 1. */
export function fitWidth(thumbWidth: number, available: number): number {
  if (!(available > 0)) return thumbWidth;
  return Math.max(1, Math.min(thumbWidth, Math.floor(available)));
}

/** Height for a width at 16:9. */
export function heightFor(width: number): number {
  return Math.round((width * 9) / 16);
}

/** Trim whitespace and cap length so long titles do not break layouts. */
export function cleanLabel(text: string, fallback: string, max = 100): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t ? t.slice(0, max) : fallback;
}
