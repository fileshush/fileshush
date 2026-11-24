/**
 * Video/audio to MP3. Pure helpers (testable in Node) plus a thin ffmpeg.wasm glue.
 *
 * Files are read and converted in the browser. Only the converter CODE is
 * downloaded, from jsDelivr, and only after the user picks a file.
 */

export const BITRATES = [128, 192, 320] as const;
export type Bitrate = (typeof BITRATES)[number];

export const LARGE_FILE_BYTES = 1024 ** 3; // 1 GB

/** Pinned on purpose. Must match the installed @ffmpeg/core version. */
export const FFMPEG_CORE_VERSION = "0.12.10";
export const CORE_BASE_URL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

export const ACCEPTED_EXTENSIONS = ["mp4", "mov", "webm", "mkv", "wav", "m4a", "ogg", "flac"];

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : "";
}

export function isLargeFile(bytes: number): boolean {
  return bytes >= LARGE_FILE_BYTES;
}

/** "song.final.mp4" -> "song.final.mp3". Never returns an empty name. */
export function outputFileName(inputName: string): string {
  const clean = inputName.replace(/^.*[\\/]/, "").trim();
  const dot = clean.lastIndexOf(".");
  const base = dot > 0 ? clean.slice(0, dot) : clean;
  return `${base || "audio"}.mp3`;
}

/** Name used inside ffmpeg's virtual disk. Avoids odd characters in user file names. */
export function virtualInputName(inputName: string): string {
  const ext = fileExtension(inputName).replace(/[^a-z0-9]/g, "");
  return ext ? `input.${ext}` : "input";
}

/**
 * Parse "90", "90.5", "1:30", "01:02:03.5" into seconds.
 * Returns null for empty text, NaN-free numbers otherwise. Throws on bad text.
 */
export function parseTime(text: string): number | null {
  const value = text.trim();
  if (value === "") return null;
  if (!/^\d+(\.\d+)?(:\d{1,2}(\.\d+)?){0,2}$/.test(value) && !/^\d*\.?\d+$/.test(value)) {
    throw new Error(`"${text.trim()}" is not a time. Use seconds (90) or minutes:seconds (1:30).`);
  }
  const parts = value.split(":").map(Number);
  if (parts.length > 1 && parts.slice(1).some((p) => p >= 60)) {
    throw new Error(`"${value}" is not a time. Minutes and seconds must be under 60.`);
  }
  return parts.reduce((total, part) => total * 60 + part, 0);
}

export interface Trim {
  start: number;
  /** null = until the end. */
  end: number | null;
}

/** Validate the two trim boxes. `duration` (seconds) is optional and only used if known. */
export function parseTrim(startText: string, endText: string, duration?: number): Trim {
  const start = parseTime(startText) ?? 0;
  const end = parseTime(endText);
  if (end !== null && end <= start) throw new Error("The end time must be after the start time.");
  if (duration !== undefined && Number.isFinite(duration)) {
    if (start >= duration) throw new Error("The start time is after the end of the file.");
  }
  return { start, end };
}

/** Length in seconds of the part that will be kept, or null if unknown. */
export function trimmedSeconds(trim: Trim, duration?: number): number | null {
  const known = duration !== undefined && Number.isFinite(duration) ? duration : null;
  const end = trim.end !== null ? (known !== null ? Math.min(trim.end, known) : trim.end) : known;
  if (end === null) return null;
  return Math.max(0, end - trim.start);
}

/** Rough MP3 size: CBR bitrate x seconds. Real files differ by a little. */
export function estimateMp3Bytes(bitrateKbps: number, seconds: number): number {
  return Math.round((bitrateKbps * 1000 * seconds) / 8);
}

export function buildFfmpegArgs(opts: {
  input: string;
  output: string;
  bitrate: number;
  trim?: Trim;
}): string[] {
  if (!(BITRATES as readonly number[]).includes(opts.bitrate)) {
    throw new Error("Choose 128, 192 or 320 kbps.");
  }
  const args: string[] = [];
  const trim = opts.trim;
  if (trim && trim.start > 0) args.push("-ss", String(trim.start));
  args.push("-i", opts.input);
  if (trim && trim.end !== null) args.push("-t", String(+(trim.end - trim.start).toFixed(3)));
  args.push(
    "-vn", // drop video
    "-map", "0:a:0", // first audio track; fails clearly if there is none
    "-c:a", "libmp3lame",
    "-b:a", `${opts.bitrate}k`,
    "-y",
    opts.output,
  );
  return args;
}

/** Turn ffmpeg's log text into a plain message. */
export function explainFailure(log: string, fileName = "This file"): string {
  const text = log.toLowerCase();
  if (/stream map .*matches no streams|does not contain any stream|output file does not contain/.test(text)) {
    return `${fileName} has no audio track, so there is nothing to convert to MP3.`;
  }
  if (/invalid data found when processing input|moov atom not found|could not find codec parameters/.test(text)) {
    return `${fileName} looks damaged or is not a supported audio/video file.`;
  }
  if (/memory access out of bounds|out of memory|cannot enlarge memory|abort/.test(text)) {
    return `${fileName} is too big for this browser to convert. Try a computer, or a smaller file.`;
  }
  return `${fileName} could not be converted. It may be damaged or in an unsupported format.`;
}

/* ------------------------------------------------------------------ */
/* ffmpeg.wasm glue (browser only, not covered by Node tests)          */
/* ------------------------------------------------------------------ */

type FFmpegInstance = import("@ffmpeg/ffmpeg").FFmpeg;
let loading: Promise<FFmpegInstance> | null = null;
let logBuffer: string[] = [];
let progressHandler: ((ratio: number) => void) | null = null;

/** Loads ffmpeg once. Call only after the user has chosen a file. */
export function loadFfmpeg(): Promise<FFmpegInstance> {
  if (!loading) {
    loading = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);
      const ffmpeg = new FFmpeg();
      ffmpeg.on("log", ({ message }) => {
        logBuffer.push(message);
        if (logBuffer.length > 200) logBuffer.shift();
      });
      ffmpeg.on("progress", ({ progress }) => progressHandler?.(progress));
      try {
        await ffmpeg.load({
          coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm"),
        });
      } catch {
        throw new Error(
          "The converter code could not be downloaded from jsDelivr (a code host). Check your internet connection and try again. Your file was not uploaded anywhere.",
        );
      }
      return ffmpeg;
    })();
    loading.catch(() => {
      loading = null; // allow retry
    });
  }
  return loading;
}

export async function convertToMp3(
  file: File,
  opts: { bitrate: number; trim?: Trim; onProgress?: (ratio: number) => void },
): Promise<Blob> {
  const ffmpeg = await loadFfmpeg();
  const input = virtualInputName(file.name);
  const output = "output.mp3";
  logBuffer = [];
  progressHandler = opts.onProgress ?? null;
  try {
    await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()));
    const code = await ffmpeg.exec(buildFfmpegArgs({ input, output, bitrate: opts.bitrate, trim: opts.trim }));
    if (code !== 0) throw new Error(explainFailure(logBuffer.join("\n"), file.name));
    const data = (await ffmpeg.readFile(output)) as Uint8Array;
    if (data.byteLength === 0) {
      throw new Error("Nothing was produced. Check that the trim range is inside the file.");
    }
    return new Blob([data as BlobPart], { type: "audio/mpeg" });
  } catch (error) {
    if (error instanceof Error && error.message.includes(file.name)) throw error;
    throw new Error(explainFailure(`${logBuffer.join("\n")} ${error instanceof Error ? error.message : ""}`, file.name));
  } finally {
    progressHandler = null;
    await ffmpeg.deleteFile(input).catch(() => {});
    await ffmpeg.deleteFile(output).catch(() => {});
  }
}
