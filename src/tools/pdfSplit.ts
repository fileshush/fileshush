/**
 * PDF splitting: page-range parsing, chunk planning and the real split.
 * Everything runs on bytes in the browser. Nothing is uploaded.
 * Page numbers are 1-based for people, 0-based inside pdf-lib.
 */

import { PDFDocument } from "pdf-lib";

export type RangeResult = { ok: true; pages: number[] } | { ok: false; error: string };

/** Parse "1-3, 5, 8" into sorted, unique page numbers. Also accepts "5-3" (reversed) and ";" separators. */
export function parsePageRanges(input: string, pageCount: number): RangeResult {
  const text = input.trim();
  if (text === "") return { ok: false, error: "Type some pages, for example 1-3, 5, 8." };
  const picked = new Set<number>();
  for (const raw of text.split(/[,;]/)) {
    const part = raw.trim();
    if (part === "") continue;
    const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(part);
    if (!m) return { ok: false, error: `"${part}" is not a page or a range.` };
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    for (const n of [a, b]) {
      if (n < 1 || n > pageCount) {
        return { ok: false, error: `Page ${n} does not exist. This PDF has ${pageCount} ${pageCount === 1 ? "page" : "pages"}.` };
      }
    }
    for (let n = Math.min(a, b); n <= Math.max(a, b); n++) picked.add(n);
  }
  if (picked.size === 0) return { ok: false, error: "Type some pages, for example 1-3, 5, 8." };
  return { ok: true, pages: [...picked].sort((x, y) => x - y) };
}

/** Turn page numbers back into a short text like "1-3, 5, 8". */
export function formatPageRanges(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    out.push(j > i ? `${sorted[i]}-${sorted[j]}` : String(sorted[i]));
    i = j + 1;
  }
  return out.join(", ");
}

/** Groups of page numbers, one group per output file. */
export function planChunks(pageCount: number, size: number): number[][] {
  const step = Math.max(1, Math.floor(size) || 1);
  const chunks: number[][] = [];
  for (let start = 1; start <= pageCount; start += step) {
    const chunk: number[] = [];
    for (let n = start; n < start + step && n <= pageCount; n++) chunk.push(n);
    chunks.push(chunk);
  }
  return chunks;
}

/** "report.pdf" + [3,4] -> "report-pages-3-4.pdf", zero padded so ZIPs sort well. */
export function chunkFileName(original: string, pages: number[], pageCount: number): string {
  const base = original.replace(/\.pdf$/i, "") || "document";
  const width = String(pageCount).length;
  const pad = (n: number) => String(n).padStart(width, "0");
  const first = pages[0];
  const last = pages[pages.length - 1];
  const label = pages.length === 1 ? `page-${pad(first)}` : `pages-${pad(first)}-${pad(last)}`;
  return `${base}-${label}.pdf`;
}

export type PdfErrorKind = "password" | "corrupt";

export class PdfError extends Error {
  kind: PdfErrorKind;
  constructor(kind: PdfErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export const PASSWORD_MESSAGE =
  "This PDF is password-protected. Remove the password first, then try again.";
export const CORRUPT_MESSAGE =
  "This file could not be read as a PDF. It may be damaged or not a PDF.";

export function toPdfError(error: unknown): PdfError {
  if (error instanceof PdfError) return error;
  const name = error instanceof Error ? error.name : "";
  const msg = error instanceof Error ? error.message : "";
  if (/encrypt|password/i.test(name + " " + msg)) return new PdfError("password", PASSWORD_MESSAGE);
  return new PdfError("corrupt", CORRUPT_MESSAGE);
}

/** Open a PDF with pdf-lib. Throws PdfError for encrypted or damaged files. */
export async function loadPdf(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes); // throws EncryptedPDFError when protected
  } catch (error) {
    throw toPdfError(error);
  }
}

/** Build one PDF containing the given 1-based pages of `source`, in the order given. */
export async function extractPages(source: PDFDocument, pages: number[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, pages.map((n) => n - 1));
  copied.forEach((page) => out.addPage(page));
  return out.save();
}

/** Split into many PDFs: one per group of page numbers. */
export async function splitIntoChunks(
  source: PDFDocument,
  chunks: number[][],
  onProgress?: (done: number, total: number) => void,
): Promise<{ pages: number[]; bytes: Uint8Array }[]> {
  const results: { pages: number[]; bytes: Uint8Array }[] = [];
  for (const pages of chunks) {
    results.push({ pages, bytes: await extractPages(source, pages) });
    onProgress?.(results.length, chunks.length);
    await new Promise<void>((r) => setTimeout(r, 0));
  }
  return results;
}
