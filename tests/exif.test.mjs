// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectKind,
  readMetadata,
  stripMetadata,
  buildMinimalExif,
  insertExifIntoJpeg,
  formatCoordinates,
  formatExifDate,
} from "../src/tools/exif.ts";

import { asc, u16, u32, fullExifTiff, segment, BASE_JPEG, jpegWith, privateJpeg } from "./fixtures.mjs";

/* ---------- reading ---------- */

test("detects formats by their bytes, not their names", () => {
  assert.equal(detectKind(BASE_JPEG), "jpeg");
  assert.equal(detectKind(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])), "png");
  assert.equal(detectKind(Uint8Array.from([...asc("RIFF"), 0, 0, 0, 0, ...asc("WEBP"), 0])), "webp");
  assert.equal(detectKind(Uint8Array.from(asc("GIF89a....."))), null);
});

test("reads location, camera, software, date and orientation from a JPEG", async () => {
  const report = await readMetadata(privateJpeg({ orientation: 6 }));
  assert.equal(report.found, true);
  assert.equal(report.make, "TestCam");
  assert.equal(report.model, "Model X");
  assert.equal(report.software, "EditorPro 9");
  assert.equal(report.dateTaken, "2026:05:12 09:41:07");
  assert.equal(report.orientation, 6);
  assert.equal(report.hasXmp, true);
  assert.equal(report.hasIptc, true);
  assert.equal(report.hasComments, true);
  assert.equal(formatCoordinates(report.gps), "6.9271, 79.8612");
  assert.equal(formatExifDate(report.dateTaken), "12 May 2026, 09:41");
});

test("a photo with no metadata is reported as clean", async () => {
  const report = await readMetadata(BASE_JPEG);
  assert.equal(report.found, false);
  assert.equal(report.gps, undefined);
});

/* ---------- removing ---------- */

test("JPEG: stripping removes everything private and leaves the image data identical", async () => {
  const input = privateJpeg();
  const output = stripMetadata(input, "jpeg");
  const after = await readMetadata(output);
  assert.equal(after.found, false);
  assert.equal(after.gps, undefined);
  assert.equal(after.make, undefined);
  assert.ok(!Buffer.from(output).includes("secret"));
  assert.ok(!Buffer.from(output).includes("my house"));

  // The compressed image (from the start-of-scan marker on) is byte-identical.
  const sos = (bytes) => {
    for (let i = 2; i < bytes.length - 1; i++) if (bytes[i] === 0xff && bytes[i + 1] === 0xda) return i;
    return -1;
  };
  assert.deepEqual(output.subarray(sos(output)), input.subarray(sos(input)));
  // And the JFIF header and quantisation tables were kept.
  assert.ok(Buffer.from(output).includes("JFIF"));
});

test("JPEG: keeping date and orientation keeps only those two fields", async () => {
  const input = privateJpeg({ orientation: 6 });
  const before = await readMetadata(input);
  const stripped = stripMetadata(input, "jpeg");
  const tiff = buildMinimalExif({ orientation: before.orientation, dateTaken: before.dateTaken });
  const output = insertExifIntoJpeg(stripped, tiff);

  const after = await readMetadata(output);
  assert.equal(after.orientation, 6);
  assert.equal(after.dateTaken, "2026:05:12 09:41:07");
  assert.equal(after.gps, undefined);
  assert.equal(after.make, undefined);
  assert.equal(after.model, undefined);
  assert.equal(after.software, undefined);
  assert.equal(after.hasXmp, false);
  assert.equal(after.hasIptc, false);
  assert.equal(after.hasComments, false);
  assert.equal(after.otherFieldCount, 0);
  assert.equal(detectKind(output), "jpeg");
});

test("minimal EXIF handles each field on its own", async () => {
  assert.equal(buildMinimalExif({}), null);
  const onlyOrientation = insertExifIntoJpeg(BASE_JPEG, buildMinimalExif({ orientation: 3 }));
  assert.equal((await readMetadata(onlyOrientation)).orientation, 3);
  const onlyDate = insertExifIntoJpeg(BASE_JPEG, buildMinimalExif({ dateTaken: "2020:01:02 03:04:05" }));
  assert.equal((await readMetadata(onlyDate)).dateTaken, "2020:01:02 03:04:05");
  // a malformed date is dropped rather than written
  assert.equal(buildMinimalExif({ dateTaken: "yesterday" }), null);
});

function crc32(bytes) {
  let c, crc = 0xffffffff;
  for (const b of bytes) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const pngChunk = (type, data) => {
  const body = [...asc(type), ...data];
  return [...u32(data.length), ...body, ...u32(crc32(Uint8Array.from(body)))];
};

test("PNG: removes text, EXIF and time chunks, keeps the picture chunks exactly", async () => {
  const ihdr = pngChunk("IHDR", [...u32(1), ...u32(1), 8, 2, 0, 0, 0]);
  const idat = pngChunk("IDAT", [0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x04, 0x00, 0x01]);
  const iend = pngChunk("IEND", []);
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const input = Uint8Array.from([
    ...sig, ...ihdr,
    ...pngChunk("tEXt", [...asc("Author\0Jane Doe")]),
    ...pngChunk("eXIf", [...fullExifTiff()]),
    ...pngChunk("tIME", [0x07, 0xea, 5, 12, 9, 41, 7]),
    ...idat, ...iend,
  ]);

  const before = await readMetadata(input);
  assert.equal(before.found, true);
  assert.equal(before.make, "TestCam");
  assert.ok(before.gps);

  const output = stripMetadata(input, "png");
  const after = await readMetadata(output);
  assert.equal(after.found, false);
  assert.deepEqual(output, Uint8Array.from([...sig, ...ihdr, ...idat, ...iend]));
});

test("WebP: removes EXIF and XMP chunks and clears the header flags", async () => {
  const chunk = (type, data) => [...asc(type), ...[data.length & 255, (data.length >> 8) & 255, 0, 0], ...data, ...(data.length % 2 ? [0] : [])];
  const vp8x = (flags) => chunk("VP8X", [flags, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const vp8l = chunk("VP8L", [0x2f, 0, 0, 0, 0, 0, 0, 0]);
  const exifBody = [...asc("Exif\0\0"), ...fullExifTiff()];
  const build = (chunks) => {
    const body = [...asc("WEBP"), ...chunks.flat()];
    return Uint8Array.from([...asc("RIFF"), body.length & 255, (body.length >> 8) & 255, (body.length >> 16) & 255, 0, ...body]);
  };
  const input = build([vp8x(0x08 | 0x04), vp8l, chunk("EXIF", exifBody), chunk("XMP ", asc("<xmp/>"))]);

  const before = await readMetadata(input);
  assert.equal(before.make, "TestCam");
  assert.ok(before.gps);
  assert.equal(before.hasXmp, true);

  const output = stripMetadata(input, "webp");
  const after = await readMetadata(output);
  assert.equal(after.found, false);
  assert.deepEqual(output, build([vp8x(0), vp8l]));
  // RIFF size field matches the real length
  assert.equal(output[4] | (output[5] << 8) | (output[6] << 16), output.length - 8);
});

test("file names get a -clean suffix", async () => {
  const { cleanFileName } = await import("../src/tools/exif.ts");
  assert.equal(cleanFileName("holiday.jpg"), "holiday-clean.jpg");
  assert.equal(cleanFileName("a.b.png"), "a.b-clean.png");
  assert.equal(cleanFileName("noext"), "noext-clean");
});
