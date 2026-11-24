// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aspectLabel, isSixteenByNine, checkThumbnail, timestampBox, shortsZones,
  areaShare, fitWidth, heightFor, cleanLabel, MAX_THUMB_BYTES,
} from "../src/tools/safeZone.ts";

const ids = (c, level) => c.filter((x) => x.level === level).map((x) => x.id);

test("aspect labels", () => {
  assert.equal(aspectLabel(1280, 720), "16:9");
  assert.equal(aspectLabel(1080, 1920), "9:16");
  assert.equal(aspectLabel(0, 10), "unknown");
});

test("16:9 detection has tolerance", () => {
  assert.equal(isSixteenByNine(1920, 1080), true);
  assert.equal(isSixteenByNine(1280, 721), true);
  assert.equal(isSixteenByNine(1000, 1000), false);
  assert.equal(isSixteenByNine(0, 0), false);
});

test("perfect thumbnail has no warnings", () => {
  const c = checkThumbnail({ width: 1280, height: 720, bytes: 500000, type: "image/png" });
  assert.deepEqual(ids(c, "warn"), []);
});

test("warns on small size, wrong shape, big file, wrong type", () => {
  const c = checkThumbnail({ width: 640, height: 640, bytes: MAX_THUMB_BYTES + 1, type: "image/webp" });
  assert.deepEqual(ids(c, "warn").sort(), ["bytes", "ratio", "size", "type"]);
});

test("exactly 2 MB is fine; bigger 16:9 only warns on size", () => {
  assert.deepEqual(ids(checkThumbnail({ width: 1280, height: 720, bytes: MAX_THUMB_BYTES }), "warn"), []);
  assert.deepEqual(ids(checkThumbnail({ width: 1920, height: 1080, bytes: 1 }), "warn"), ["size"]);
});

test("timestamp box sits inside the bottom-right corner", () => {
  const b = timestampBox(1280, 720);
  assert.ok(b.x > 640 && b.y > 360);
  assert.ok(b.x + b.width <= 1280 && b.y + b.height <= 720);
  assert.ok(areaShare(b, 1280, 720) < 0.05);
});

test("shorts zones stay inside the frame", () => {
  for (const z of shortsZones()) {
    assert.ok(z.x >= 0 && z.y >= 0 && z.x + z.width <= 1080.001 && z.y + z.height <= 1920.001, z.id);
  }
  assert.equal(shortsZones().length, 3);
});

test("fitWidth and heightFor", () => {
  assert.equal(fitWidth(360, 300.7), 300);
  assert.equal(fitWidth(168, 500), 168);
  assert.equal(fitWidth(360, 0), 360);
  assert.equal(heightFor(360), 203);
});

test("cleanLabel", () => {
  assert.equal(cleanLabel("   ", "Title"), "Title");
  assert.equal(cleanLabel("  a   b ", "x"), "a b");
  assert.equal(cleanLabel("abcdef", "x", 3), "abc");
});
