// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectMime,
  outputMime,
  isLossy,
  compressedFileName,
  fitDimensions,
  percentSaved,
  searchQuality,
} from "../src/tools/compress.ts";

// Fake encoder: size grows smoothly with quality.
const fake = (scale) => async (q) => ({ size: Math.round(q * q * scale), q });

test("detects types by mime, then extension", () => {
  assert.equal(detectMime("a.bin", "image/jpeg"), "image/jpeg");
  assert.equal(detectMime("a.PNG", ""), "image/png");
  assert.equal(detectMime("a.jpeg", ""), "image/jpeg");
  assert.equal(detectMime("a.gif", "image/gif"), null);
});

test("output format and lossy flag", () => {
  assert.equal(outputMime("image/png", "same"), "image/png");
  assert.equal(outputMime("image/png", "webp"), "image/webp");
  assert.equal(isLossy("image/png"), false);
  assert.equal(isLossy("image/webp"), true);
});

test("file names", () => {
  assert.equal(compressedFileName("holiday.PNG", "image/jpeg"), "holiday-compressed.jpg");
  assert.equal(compressedFileName("a.b.jpg", "image/webp"), "a.b-compressed.webp");
  assert.equal(compressedFileName("noext", "image/png"), "noext-compressed.png");
});

test("dimension math never enlarges and keeps shape", () => {
  assert.deepEqual(fitDimensions(4000, 3000, 1000), { width: 1000, height: 750 });
  assert.deepEqual(fitDimensions(4000, 3000, 0, 600), { width: 800, height: 600 });
  assert.deepEqual(fitDimensions(4000, 3000, 1000, 500), { width: 667, height: 500 });
  assert.deepEqual(fitDimensions(800, 600, 2000, 2000), { width: 800, height: 600 });
  assert.deepEqual(fitDimensions(800, 600), { width: 800, height: 600 });
  assert.deepEqual(fitDimensions(10000, 1, 100), { width: 100, height: 1 });
});

test("percent saved", () => {
  assert.equal(percentSaved(1000, 250), 75);
  assert.equal(percentSaved(1000, 1200), -20);
  assert.equal(percentSaved(0, 0), 0);
});

test("target search lands within 5% below the target", async () => {
  for (const target of [100_000, 200_000, 500_000]) {
    const r = await searchQuality(fake(target * 2.5), target);
    assert.ok(r.best);
    assert.ok(r.best.size <= target, "never over target");
    assert.ok(r.best.size >= target * 0.95, `close enough: ${r.best.size}`);
    assert.equal(r.close, true);
    assert.ok(r.steps <= 9);
  }
});

test("already small image keeps top quality", async () => {
  const r = await searchQuality(fake(50_000), 100_000);
  assert.equal(r.quality, 1);
  assert.equal(r.steps, 1);
});

test("impossible target reports no fit and the smallest attempt", async () => {
  const r = await searchQuality(async (q) => ({ size: 10_000 + q * 1000 }), 5_000);
  assert.equal(r.best, null);
  assert.equal(r.close, false);
  assert.ok(r.smallest.size > 5_000);
});

test("stepwise encoder (jumps) still returns something under target", async () => {
  const r = await searchQuality(async (q) => ({ size: q < 0.5 ? 40_000 : 90_000 }), 60_000);
  assert.ok(r.best && r.best.size <= 60_000);
  assert.equal(r.close, false);
});
