// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  parsePageRanges,
  formatPageRanges,
  planChunks,
  chunkFileName,
  loadPdf,
  extractPages,
  splitIntoChunks,
  PdfError,
} from "../src/tools/pdfSplit.ts";

async function makePdf(n) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) doc.addPage([200 + i, 300]);
  return doc.save();
}

test("parses singles, ranges and mixed lists", () => {
  assert.deepEqual(parsePageRanges("1-3, 5, 8", 10), { ok: true, pages: [1, 2, 3, 5, 8] });
  assert.deepEqual(parsePageRanges("7", 10), { ok: true, pages: [7] });
  assert.deepEqual(parsePageRanges(" 2 - 4 ;6 ", 10), { ok: true, pages: [2, 3, 4, 6] });
});

test("removes duplicates, sorts, and accepts reversed ranges", () => {
  assert.deepEqual(parsePageRanges("5,1-3,2", 10), { ok: true, pages: [1, 2, 3, 5] });
  assert.deepEqual(parsePageRanges("4-2", 10), { ok: true, pages: [2, 3, 4] });
  assert.deepEqual(parsePageRanges("1,,2,", 10), { ok: true, pages: [1, 2] });
});

test("rejects empty, junk and out-of-range input with clear messages", () => {
  for (const bad of ["", "   ", ",", "abc", "1-", "-3", "1-2-3", "1.5", "0", "-1"]) {
    assert.equal(parsePageRanges(bad, 10).ok, false, bad);
  }
  const r = parsePageRanges("1-11", 10);
  assert.equal(r.ok, false);
  assert.match(r.error, /Page 11 does not exist/);
  assert.match(parsePageRanges("0", 10).error, /Page 0/);
});

test("formats page numbers back into ranges", () => {
  assert.equal(formatPageRanges([1, 2, 3, 5, 8]), "1-3, 5, 8");
  assert.equal(formatPageRanges([8, 5, 5, 1]), "1, 5, 8");
  assert.equal(formatPageRanges([]), "");
  const pages = [1, 2, 4, 9, 10];
  assert.deepEqual(parsePageRanges(formatPageRanges(pages), 10).pages, pages);
});

test("plans chunks of N pages, last one may be shorter", () => {
  assert.deepEqual(planChunks(5, 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(planChunks(4, 4), [[1, 2, 3, 4]]);
  assert.deepEqual(planChunks(3, 10), [[1, 2, 3]]);
  assert.deepEqual(planChunks(3, 1), [[1], [2], [3]]);
  assert.deepEqual(planChunks(3, 0), [[1], [2], [3]]);
  assert.deepEqual(planChunks(0, 2), []);
  assert.equal(planChunks(200, 7).flat().length, 200);
});

test("names output files with padded page numbers", () => {
  assert.equal(chunkFileName("report.pdf", [3], 12), "report-page-03.pdf");
  assert.equal(chunkFileName("Report.PDF", [3, 4], 12), "Report-pages-03-04.pdf");
  assert.equal(chunkFileName("", [1], 5), "document-page-1.pdf");
});

test("extracts the chosen pages into a new PDF", async () => {
  const src = await loadPdf(await makePdf(6));
  const out = await PDFDocument.load(await extractPages(src, [2, 5, 6]));
  assert.equal(out.getPageCount(), 3);
  assert.equal(out.getPage(0).getWidth(), 201); // original page 2
  assert.equal(out.getPage(1).getWidth(), 204); // original page 5
});

test("splits every page and every N pages with correct page counts", async () => {
  const src = await loadPdf(await makePdf(7));
  const each = await splitIntoChunks(src, planChunks(7, 1));
  assert.equal(each.length, 7);
  for (const f of each) assert.equal((await PDFDocument.load(f.bytes)).getPageCount(), 1);

  const progress = [];
  const byThree = await splitIntoChunks(src, planChunks(7, 3), (d, t) => progress.push([d, t]));
  const counts = [];
  for (const f of byThree) counts.push((await PDFDocument.load(f.bytes)).getPageCount());
  assert.deepEqual(counts, [3, 3, 1]);
  assert.deepEqual(progress.at(-1), [3, 3]);
});

test("gives clear errors for corrupt and password-protected files", async () => {
  await assert.rejects(loadPdf(new TextEncoder().encode("not a pdf")), (e) => e instanceof PdfError && e.kind === "corrupt");
  // Mark a real PDF as encrypted by adding an /Encrypt entry to its trailer.
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.context.trailerInfo.Encrypt = doc.context.obj({});
  const encrypted = await doc.save();
  await assert.rejects(loadPdf(encrypted), (e) => e instanceof PdfError && e.kind === "password");
});
