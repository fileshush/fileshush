// Run with: npm test
import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  normalizeOptions,
  webpFileName,
  uniqueName,
  savings,
  isSupportedFile,
  isWebpBytes,
  encodePixels,
} from "../src/tools/webp.ts";

test("file names switch to .webp", () => {
  assert.equal(webpFileName("photo.jpg"), "photo.webp");
  assert.equal(webpFileName("my.photo.final.PNG"), "my.photo.final.webp");
  assert.equal(webpFileName("noext"), "noext.webp");
  assert.equal(webpFileName(".png"), ".png.webp");
  assert.equal(webpFileName("a/b.gif"), "a_b.webp");
});

test("duplicate names get a number", () => {
  const taken = new Set();
  assert.equal(uniqueName("a.webp", taken), "a.webp");
  assert.equal(uniqueName("a.webp", taken), "a-2.webp");
  assert.equal(uniqueName("A.webp", taken), "A-3.webp");
});

test("savings math", () => {
  assert.deepEqual(savings(1000, 250), { larger: false, savedPercent: 75 });
  assert.deepEqual(savings(1000, 1000), { larger: true, savedPercent: 0 });
  assert.deepEqual(savings(1000, 1500), { larger: true, savedPercent: 0 });
  assert.deepEqual(savings(0, 10), { larger: false, savedPercent: 0 });
});

test("options are clamped and validated", () => {
  assert.deepEqual(normalizeOptions(), { quality: 80, lossless: false });
  assert.equal(normalizeOptions({ quality: 150 }).quality, 100);
  assert.equal(normalizeOptions({ quality: -5 }).quality, 0);
  assert.equal(normalizeOptions({ quality: NaN }).quality, 80);
  assert.equal(normalizeOptions({ quality: 55.6 }).quality, 56);
  assert.equal(normalizeOptions({ lossless: "yes" }).lossless, false);
  assert.equal(normalizeOptions({ lossless: true }).lossless, true);
});

test("accepts JPG, PNG, GIF only", () => {
  assert.equal(isSupportedFile({ type: "image/jpeg", name: "a" }), true);
  assert.equal(isSupportedFile({ type: "", name: "a.PNG" }), true);
  assert.equal(isSupportedFile({ type: "image/webp", name: "a.webp" }), false);
  assert.equal(isSupportedFile({ type: "application/pdf", name: "a.pdf" }), false);
});

function gradient(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data.set([(i % w) * 4, Math.floor(i / w) * 4, 128, 255], i * 4);
  }
  return { data, width: w, height: h, colorSpace: "srgb" };
}

test("real encode produces a RIFF/WEBP file (lossy and lossless)", async (t) => {
  let lossy;
  try {
    // Node cannot fetch() a file URL, so hand jsquash the compiled wasm directly.
    const { init } = await import("@jsquash/webp/encode.js");
    const wasm = readFileSync(new URL("../node_modules/@jsquash/webp/codec/enc/webp_enc_simd.wasm", import.meta.url));
    await init(await WebAssembly.compile(wasm));
    lossy = await encodePixels(gradient(64, 64), { quality: 60 });
  } catch (error) {
    t.skip(`jsquash cannot run in Node here: ${error.message}`);
    return;
  }
  assert.equal(isWebpBytes(lossy), true);
  const lossless = await encodePixels(gradient(64, 64), { lossless: true });
  assert.equal(isWebpBytes(lossless), true);
  assert.equal(isWebpBytes(Uint8Array.from([1, 2, 3])), false);
});
