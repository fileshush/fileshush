/**
 * Photo metadata (EXIF / GPS / XMP / IPTC / text) reader and remover.
 *
 * Everything here runs on bytes in the browser. Nothing is uploaded.
 *
 * How cleaning works:
 *  - JPEG, PNG and WebP are cleaned by removing metadata blocks from the file
 *    structure. The image data is copied byte for byte, so there is no quality
 *    loss.
 *  - A photo that is stored sideways with an orientation flag cannot keep that
 *    flag when "remove everything" is chosen. Those photos are redrawn once so
 *    they stay upright (this re-saves them; the result says so).
 *  - Every cleaned file is read again with the same reader, and the clean is
 *    rejected if anything private is still found.
 */

import exifr from "exifr";

export type ImageKind = "jpeg" | "png" | "webp";

export interface MetadataReport {
  kind: ImageKind;
  /** Any removable metadata at all (EXIF, XMP, IPTC, comments or text chunks). */
  found: boolean;
  hasExif: boolean;
  hasXmp: boolean;
  hasIptc: boolean;
  hasComments: boolean;
  gps?: { latitude: number; longitude: number };
  make?: string;
  model?: string;
  software?: string;
  artist?: string;
  copyright?: string;
  description?: string;
  /** Raw EXIF date, "YYYY:MM:DD HH:MM:SS". */
  dateTaken?: string;
  orientation?: number;
  /** EXIF fields other than the ones above (exposure, ISO, lens, and so on). */
  otherFieldCount: number;
}

export interface CleanOptions {
  /** Keep the date taken and the orientation flag (JPEG only). */
  keepDateAndOrientation: boolean;
}

export interface CleanResult {
  blob: Blob;
  mimeType: string;
  /** "lossless" = pixels untouched. "redrawn" = re-saved once to straighten the photo. */
  method: "lossless" | "redrawn";
  note?: string;
  before: MetadataReport;
  after: MetadataReport;
}

/* ------------------------------------------------------------------ */
/* Format detection and parsing                                        */
/* ------------------------------------------------------------------ */

export function detectKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  if (
    bytes.length > 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = "";
  for (let i = start; i < start + length && i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function startsWithAscii(bytes: Uint8Array, start: number, text: string): boolean {
  return ascii(bytes, start, text.length) === text;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

interface ParsedMetadata {
  exifBlob?: Uint8Array;
  hasXmp: boolean;
  hasIptc: boolean;
  hasComments: boolean;
}

interface JpegSegment {
  marker: number;
  start: number;
  end: number;
  dataStart: number;
}

function parseJpeg(bytes: Uint8Array): { segments: JpegSegment[]; sosStart: number } {
  const segments: JpegSegment[] = [];
  let i = 2;
  let sosStart = bytes.length;

  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }

    let marker = bytes[i + 1];
    while (marker === 0xff && i + 2 < bytes.length) {
      i += 1;
      marker = bytes[i + 1];
    }

    if (marker === 0xd9) break; // EOI
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }

    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    const end = Math.min(i + 2 + length, bytes.length);
    segments.push({ marker, start: i, end, dataStart: i + 4 });

    if (marker === 0xda) {
      sosStart = i; // start of scan: image data follows
      break;
    }
    i = end;
  }

  return { segments, sosStart };
}

const EXIF_HEADER = "Exif\0\0";
const XMP_HEADER = "http://ns.adobe.com/xap/1.0/\0";

/** Which JPEG segments are kept. Everything else that can carry metadata is dropped. */
function jpegKeeps(bytes: Uint8Array, segment: JpegSegment): boolean {
  const { marker, dataStart } = segment;

  if (marker === 0xfe) return false; // COM: free-text comment
  if (marker < 0xe0 || marker > 0xef) return true; // not an APPn segment

  if (marker === 0xe0) return true; // JFIF
  if (marker === 0xe2) {
    // keep the colour profile and multi-picture index, drop vendor extras
    return (
      startsWithAscii(bytes, dataStart, "ICC_PROFILE\0") ||
      startsWithAscii(bytes, dataStart, "MPF\0")
    );
  }
  if (marker === 0xee) return startsWithAscii(bytes, dataStart, "Adobe"); // colour transform
  return false; // APP1 (EXIF/XMP), APP13 (IPTC) and every other APPn
}

function parseMetadata(bytes: Uint8Array, kind: ImageKind): ParsedMetadata {
  const result: ParsedMetadata = { hasXmp: false, hasIptc: false, hasComments: false };

  if (kind === "jpeg") {
    const { segments } = parseJpeg(bytes);
    for (const segment of segments) {
      if (segment.marker === 0xe1) {
        if (startsWithAscii(bytes, segment.dataStart, EXIF_HEADER)) {
          result.exifBlob ??= bytes.subarray(segment.dataStart + EXIF_HEADER.length, segment.end);
        } else if (startsWithAscii(bytes, segment.dataStart, XMP_HEADER)) {
          result.hasXmp = true;
        } else {
          result.hasXmp = result.hasXmp || startsWithAscii(bytes, segment.dataStart, "http://ns.adobe.com/xmp/extension/");
        }
      } else if (segment.marker === 0xed) {
        result.hasIptc = true;
      } else if (segment.marker === 0xfe) {
        result.hasComments = true;
      }
    }
    return result;
  }

  if (kind === "png") {
    let i = 8;
    while (i + 8 <= bytes.length) {
      const length = readU32BE(bytes, i);
      const type = ascii(bytes, i + 4, 4);
      const dataStart = i + 8;
      if (type === "eXIf") {
        result.exifBlob ??= bytes.subarray(dataStart, dataStart + length);
      } else if (type === "iTXt" && startsWithAscii(bytes, dataStart, "XML:com.adobe.xmp")) {
        result.hasXmp = true;
      } else if (type === "tEXt" || type === "zTXt" || type === "iTXt" || type === "tIME") {
        result.hasComments = true;
      }
      i = dataStart + length + 4;
      if (type === "IEND") break;
    }
    return result;
  }

  // webp
  let i = 12;
  while (i + 8 <= bytes.length) {
    const type = ascii(bytes, i, 4);
    const length = readU32LE(bytes, i + 4);
    const dataStart = i + 8;
    if (type === "EXIF") {
      let blobStart = dataStart;
      if (startsWithAscii(bytes, blobStart, EXIF_HEADER)) blobStart += EXIF_HEADER.length;
      result.exifBlob ??= bytes.subarray(blobStart, dataStart + length);
    } else if (type === "XMP ") {
      result.hasXmp = true;
    }
    i = dataStart + length + (length % 2);
  }
  return result;
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
  );
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
  );
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

const NAMED_FIELDS = new Set([
  "Make",
  "Model",
  "Software",
  "Artist",
  "Copyright",
  "ImageDescription",
  "DateTimeOriginal",
  "CreateDate",
  "DateTime",
  "ModifyDate",
  "Orientation",
]);

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\0/g, "").trim();
  return trimmed || undefined;
}

export async function readMetadata(bytes: Uint8Array): Promise<MetadataReport> {
  const kind = detectKind(bytes);
  if (!kind) throw new Error("This is not a JPG, PNG or WebP image.");

  const parsed = parseMetadata(bytes, kind);
  const report: MetadataReport = {
    kind,
    found: false,
    hasExif: Boolean(parsed.exifBlob),
    hasXmp: parsed.hasXmp,
    hasIptc: parsed.hasIptc,
    hasComments: parsed.hasComments,
    otherFieldCount: 0,
  };

  if (parsed.exifBlob && parsed.exifBlob.length > 8) {
    try {
      const fields = (await exifr.parse(parsed.exifBlob, {
        tiff: true,
        ifd0: true,
        exif: true,
        gps: true,
        interop: false,
        ifd1: false,
        mergeOutput: true,
        translateValues: false,
        reviveValues: false,
      } as never)) as Record<string, unknown> | undefined;

      if (fields) {
        report.make = text(fields.Make);
        report.model = text(fields.Model);
        report.software = text(fields.Software);
        report.artist = text(fields.Artist);
        report.copyright = text(fields.Copyright);
        report.description = text(fields.ImageDescription);
        report.dateTaken =
          text(fields.DateTimeOriginal) ?? text(fields.CreateDate) ?? text(fields.DateTime);
        if (typeof fields.Orientation === "number") report.orientation = fields.Orientation;

        const latitude = coordinate(fields.GPSLatitude, fields.GPSLatitudeRef);
        const longitude = coordinate(fields.GPSLongitude, fields.GPSLongitudeRef);
        if (latitude !== undefined && longitude !== undefined) {
          report.gps = { latitude, longitude };
        }

        report.otherFieldCount = Object.keys(fields).filter(
          (key) => !NAMED_FIELDS.has(key) && !key.startsWith("GPS"),
        ).length;
      }
    } catch {
      // The block is there but unreadable. It still counts as metadata to remove.
    }
  }

  report.found = report.hasExif || report.hasXmp || report.hasIptc || report.hasComments;
  return report;
}

function coordinate(value: unknown, ref: unknown): number | undefined {
  if (!Array.isArray(value) || value.length < 3) return undefined;
  const [degrees, minutes, seconds] = value.map(Number);
  if (![degrees, minutes, seconds].every(Number.isFinite)) return undefined;
  let result = degrees + minutes / 60 + seconds / 3600;
  if (ref === "S" || ref === "W") result = -result;
  return result;
}

/** "6.9271, 79.8612" */
export function formatCoordinates(gps: { latitude: number; longitude: number }): string {
  return `${gps.latitude.toFixed(4)}, ${gps.longitude.toFixed(4)}`;
}

/** "2026:05:12 09:41:07" -> "12 May 2026, 09:41" */
export function formatExifDate(raw: string): string {
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})/.exec(raw);
  if (!match) return raw;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(match[2]) - 1];
  if (!month) return raw;
  return `${Number(match[3])} ${month} ${match[1]}, ${match[4]}:${match[5]}`;
}

/* ------------------------------------------------------------------ */
/* Removing                                                            */
/* ------------------------------------------------------------------ */

/** Removes every metadata block and copies everything else byte for byte. */
export function stripMetadata(bytes: Uint8Array, kind: ImageKind): Uint8Array {
  if (kind === "jpeg") return stripJpeg(bytes);
  if (kind === "png") return stripPng(bytes);
  return stripWebp(bytes);
}

function stripJpeg(bytes: Uint8Array): Uint8Array {
  const { segments, sosStart } = parseJpeg(bytes);
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  for (const segment of segments) {
    if (segment.start >= sosStart) break;
    if (jpegKeeps(bytes, segment)) parts.push(bytes.subarray(segment.start, segment.end));
  }
  parts.push(bytes.subarray(sosStart));
  return concat(parts);
}

const PNG_DROP = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

function stripPng(bytes: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let i = 8;
  while (i + 8 <= bytes.length) {
    const length = readU32BE(bytes, i);
    const type = ascii(bytes, i + 4, 4);
    const end = Math.min(i + 8 + length + 4, bytes.length);
    if (!PNG_DROP.has(type)) parts.push(bytes.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return concat(parts);
}

function stripWebp(bytes: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= bytes.length) {
    const type = ascii(bytes, i, 4);
    const length = readU32LE(bytes, i + 4);
    const end = Math.min(i + 8 + length + (length % 2), bytes.length);
    if (type !== "EXIF" && type !== "XMP ") {
      const chunk = bytes.slice(i, end);
      if (type === "VP8X" && chunk.length > 8) {
        chunk[8] &= ~(0x08 | 0x04); // clear the "has EXIF" and "has XMP" flags
      }
      chunks.push(chunk);
    }
    i = end;
  }

  const body = concat(chunks);
  const header = new Uint8Array(12);
  header.set(bytes.subarray(0, 12));
  const riffSize = body.length + 4; // "WEBP" + chunks
  header[4] = riffSize & 0xff;
  header[5] = (riffSize >> 8) & 0xff;
  header[6] = (riffSize >> 16) & 0xff;
  header[7] = (riffSize >>> 24) & 0xff;
  return concat([header, body]);
}

/**
 * Builds a tiny EXIF block holding only an orientation flag and/or the date
 * taken. Used by "keep date and orientation".
 */
export function buildMinimalExif(fields: { orientation?: number; dateTaken?: string }): Uint8Array | null {
  const orientation =
    fields.orientation && fields.orientation >= 1 && fields.orientation <= 8
      ? fields.orientation
      : undefined;
  const date =
    fields.dateTaken && /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(fields.dateTaken)
      ? fields.dateTaken
      : undefined;
  if (!orientation && !date) return null;

  // Layout (big-endian): header (8) | IFD0 | Exif IFD | date string
  const ifd0Entries = (orientation ? 1 : 0) + (date ? 1 : 0);
  const ifd0Size = 2 + ifd0Entries * 12 + 4;
  const exifIfdOffset = 8 + ifd0Size;
  const exifIfdSize = date ? 2 + 12 + 4 : 0;
  const dateOffset = exifIfdOffset + exifIfdSize;
  const total = dateOffset + (date ? 20 : 0);

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  out.set([0x4d, 0x4d], 0); // "MM"
  view.setUint16(2, 0x002a);
  view.setUint32(4, 8);

  let at = 8;
  view.setUint16(at, ifd0Entries);
  at += 2;
  if (orientation) {
    view.setUint16(at, 0x0112); // Orientation
    view.setUint16(at + 2, 3); // SHORT
    view.setUint32(at + 4, 1);
    view.setUint16(at + 8, orientation);
    at += 12;
  }
  if (date) {
    view.setUint16(at, 0x8769); // Exif IFD pointer
    view.setUint16(at + 2, 4); // LONG
    view.setUint32(at + 4, 1);
    view.setUint32(at + 8, exifIfdOffset);
    at += 12;
  }
  view.setUint32(at, 0); // no next IFD

  if (date) {
    at = exifIfdOffset;
    view.setUint16(at, 1);
    view.setUint16(at + 2, 0x9003); // DateTimeOriginal
    view.setUint16(at + 4, 2); // ASCII
    view.setUint32(at + 6, 20);
    view.setUint32(at + 10, dateOffset);
    view.setUint32(at + 14, 0);
    for (let i = 0; i < date.length; i++) out[dateOffset + i] = date.charCodeAt(i);
  }
  return out;
}

/** Puts an EXIF block into a JPEG that has none. */
export function insertExifIntoJpeg(jpeg: Uint8Array, tiff: Uint8Array): Uint8Array {
  const payloadLength = EXIF_HEADER.length + tiff.length;
  const segment = new Uint8Array(4 + payloadLength);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment[2] = ((payloadLength + 2) >> 8) & 0xff;
  segment[3] = (payloadLength + 2) & 0xff;
  for (let i = 0; i < EXIF_HEADER.length; i++) segment[4 + i] = EXIF_HEADER.charCodeAt(i);
  segment.set(tiff, 4 + EXIF_HEADER.length);

  // Place it after a JFIF header when there is one, otherwise right after SOI.
  let at = 2;
  if (jpeg[2] === 0xff && jpeg[3] === 0xe0) at = 2 + 2 + ((jpeg[4] << 8) | jpeg[5]);
  return concat([jpeg.subarray(0, at), segment, jpeg.subarray(at)]);
}

/* ------------------------------------------------------------------ */
/* Cleaning a file (browser)                                           */
/* ------------------------------------------------------------------ */

const MIME: Record<ImageKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const MAX_REDRAW_PIXELS = 100_000_000;

export function cleanBytes(
  bytes: Uint8Array,
  kind: ImageKind,
  before: MetadataReport,
  options: CleanOptions,
): Uint8Array {
  const stripped = stripMetadata(bytes, kind);
  if (options.keepDateAndOrientation && kind === "jpeg") {
    const tiff = buildMinimalExif({
      orientation: before.orientation,
      dateTaken: before.dateTaken,
    });
    if (tiff) return insertExifIntoJpeg(stripped, tiff);
  }
  return stripped;
}

async function redraw(file: Blob, kind: ImageKind): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    if (bitmap.width * bitmap.height > MAX_REDRAW_PIXELS) {
      throw new Error("Image is too large to straighten in the browser.");
    }
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available.");
    context.drawImage(bitmap, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, MIME[kind], kind === "png" ? undefined : 0.92),
    );
    if (!blob || blob.type !== MIME[kind]) throw new Error("This browser cannot save that format.");
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    bitmap.close();
  }
}

/** Metadata that is still allowed to be present after cleaning. */
function leftovers(after: MetadataReport, options: CleanOptions): string[] {
  const problems: string[] = [];
  if (after.gps) problems.push("location");
  if (after.make || after.model) problems.push("camera");
  if (after.software || after.artist || after.copyright || after.description) {
    problems.push("author or software");
  }
  if (after.hasXmp) problems.push("XMP data");
  if (after.hasIptc) problems.push("IPTC data");
  if (after.hasComments) problems.push("comments");
  if (after.otherFieldCount > 0) problems.push("camera settings");
  if (!options.keepDateAndOrientation && after.hasExif) problems.push("EXIF data");
  return problems;
}

export async function cleanImage(file: File, options: CleanOptions): Promise<CleanResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectKind(bytes);
  if (!kind) throw new Error("This is not a JPG, PNG or WebP image.");

  const before = await readMetadata(bytes);
  const sideways = before.orientation !== undefined && before.orientation > 1;
  // Date and orientation are only ever kept in JPEG files.
  let keptTags = options.keepDateAndOrientation && kind === "jpeg";

  let output: Uint8Array;
  let method: CleanResult["method"] = "lossless";
  let note: string | undefined;

  if (sideways && !keptTags) {
    try {
      output = await redraw(file, kind);
      method = "redrawn";
      note = "This photo was stored sideways, so it was re-saved once to stay upright.";
    } catch {
      // Could not straighten it: keep the orientation flag so it still displays upright.
      if (kind === "jpeg") {
        output = cleanBytes(bytes, kind, before, { keepDateAndOrientation: true });
        keptTags = true;
        note = "Too large to straighten here, so only the orientation flag was kept.";
      } else {
        output = stripMetadata(bytes, kind);
        note = "Too large to straighten here. The photo may display sideways in some apps.";
      }
    }
  } else {
    output = cleanBytes(bytes, kind, before, options);
    if (options.keepDateAndOrientation && kind !== "jpeg") {
      note = "Date and orientation can only be kept in JPEG files, so everything was removed.";
    }
  }

  // Read the new file again with the same reader. Never hand back a file that fails.
  const after = await readMetadata(output);
  const problems = leftovers(after, { keepDateAndOrientation: keptTags });
  if (problems.length > 0) {
    throw new Error(`The cleaned file still contains ${problems.join(", ")}.`);
  }

  const copy = new Uint8Array(output.length);
  copy.set(output);
  return {
    blob: new Blob([copy], { type: MIME[kind] }),
    mimeType: MIME[kind],
    method,
    note,
    before,
    after,
  };
}

/** "photo.jpg" -> "photo-clean.jpg" */
export function cleanFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return `${name}-clean`;
  return `${name.slice(0, dot)}-clean${name.slice(dot)}`;
}
