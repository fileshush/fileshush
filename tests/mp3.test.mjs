// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseTime, parseTrim, trimmedSeconds, estimateMp3Bytes, buildFfmpegArgs,
  outputFileName, virtualInputName, isLargeFile, explainFailure, CORE_BASE_URL, fileExtension,
} from "../src/tools/mp3.ts";

test("parseTime handles seconds and clock formats", () => {
  assert.equal(parseTime(""), null);
  assert.equal(parseTime("  "), null);
  assert.equal(parseTime("90"), 90);
  assert.equal(parseTime("90.5"), 90.5);
  assert.equal(parseTime("1:30"), 90);
  assert.equal(parseTime("01:02:03.5"), 3723.5);
});

test("parseTime rejects junk", () => {
  for (const bad of ["abc", "-5", "1:75", "1::2", "1:2:3:4"]) assert.throws(() => parseTime(bad), bad);
});

test("parseTrim validates order and duration", () => {
  assert.deepEqual(parseTrim("", ""), { start: 0, end: null });
  assert.deepEqual(parseTrim("10", "1:00"), { start: 10, end: 60 });
  assert.throws(() => parseTrim("30", "30"), /after the start/);
  assert.throws(() => parseTrim("40", "30"), /after the start/);
  assert.throws(() => parseTrim("100", "", 50), /after the end/);
});

test("trimmedSeconds", () => {
  assert.equal(trimmedSeconds({ start: 0, end: null }), null);
  assert.equal(trimmedSeconds({ start: 10, end: null }, 100), 90);
  assert.equal(trimmedSeconds({ start: 10, end: 500 }, 100), 90);
  assert.equal(trimmedSeconds({ start: 10, end: 40 }), 30);
});

test("estimateMp3Bytes", () => {
  assert.equal(estimateMp3Bytes(128, 60), 960000);
  assert.equal(estimateMp3Bytes(320, 10), 400000);
});

test("buildFfmpegArgs without trim", () => {
  assert.deepEqual(buildFfmpegArgs({ input: "input.mp4", output: "output.mp3", bitrate: 192 }), [
    "-i", "input.mp4", "-vn", "-map", "0:a:0", "-c:a", "libmp3lame", "-b:a", "192k", "-y", "output.mp3",
  ]);
});

test("buildFfmpegArgs with trim", () => {
  const args = buildFfmpegArgs({ input: "i.wav", output: "o.mp3", bitrate: 320, trim: { start: 5, end: 12.5 } });
  assert.deepEqual(args.slice(0, 5), ["-ss", "5", "-i", "i.wav", "-t"]);
  assert.equal(args[5], "7.5");
  assert.ok(args.includes("320k"));
  const startOnly = buildFfmpegArgs({ input: "i", output: "o", bitrate: 128, trim: { start: 3, end: null } });
  assert.ok(startOnly.includes("-ss") && !startOnly.includes("-t"));
});

test("buildFfmpegArgs rejects odd bitrate", () => {
  assert.throws(() => buildFfmpegArgs({ input: "i", output: "o", bitrate: 100 }));
});

test("file names", () => {
  assert.equal(outputFileName("talk.final.MP4"), "talk.final.mp3");
  assert.equal(outputFileName("C:\\x\\clip.mov"), "clip.mp3");
  assert.equal(outputFileName("noext"), "noext.mp3");
  assert.equal(outputFileName(".mp4"), ".mp4.mp3");
  assert.equal(outputFileName(""), "audio.mp3");
  assert.equal(virtualInputName("my vid (1).MKV"), "input.mkv");
  assert.equal(virtualInputName("weird"), "input");
  assert.equal(fileExtension("a.b.flac"), "flac");
});

test("large file warning at 1 GB", () => {
  assert.equal(isLargeFile(1024 ** 3 - 1), false);
  assert.equal(isLargeFile(1024 ** 3), true);
});

test("explainFailure gives plain messages", () => {
  assert.match(explainFailure("Stream map '0:a:0' matches no streams.", "a.mp4"), /no audio track/);
  assert.match(explainFailure("moov atom not found", "a.mp4"), /damaged/);
  assert.match(explainFailure("memory access out of bounds"), /too big/);
  assert.match(explainFailure("???"), /could not be converted/);
});

test("core URL is pinned to an exact version", () => {
  assert.match(CORE_BASE_URL, /^https:\/\/cdn\.jsdelivr\.net\/npm\/@ffmpeg\/core@\d+\.\d+\.\d+\//);
});
