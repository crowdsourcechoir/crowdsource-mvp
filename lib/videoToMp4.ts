/**
 * Convert webm video (data URL) to MP4 blob using ffmpeg.wasm.
 * Used for high-fidelity download in professional settings.
 * Decodes data URLs directly (no fetch) to avoid URL length limits that produce 0-byte blobs.
 */
let ffmpegInstance: import("@ffmpeg/ffmpeg").FFmpeg | null = null;

/** Decode a data URL to raw bytes. Avoids fetch() so long videos don't hit URL length limits. */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) throw new Error("Invalid data URL");
  const base64 = dataUrl.slice(comma + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getFFmpeg(): Promise<import("@ffmpeg/ffmpeg").FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const ffmpeg = new FFmpeg();
  await ffmpeg.load();
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export async function videoDataUrlToMp4Blob(dataUrl: string): Promise<Blob> {
  if (dataUrl.startsWith("data:video/mp4")) {
    const data = dataUrlToBytes(dataUrl);
    return new Blob([data as BlobPart], { type: "video/mp4" });
  }
  const data = dataUrlToBytes(dataUrl);

  const ffmpeg = await getFFmpeg();
  await ffmpeg.writeFile("input.webm", data);
  await ffmpeg.exec([
    "-i", "input.webm",
    "-c:v", "libx264",
    "-c:a", "aac",
    "-movflags", "+faststart",
    "output.mp4",
  ]);
  const out = await ffmpeg.readFile("output.mp4");
  await ffmpeg.deleteFile("input.webm");
  await ffmpeg.deleteFile("output.mp4");

  const mp4Data =
    out instanceof Uint8Array ? out : new Uint8Array((out as unknown) as ArrayBuffer);
  const copy = new Uint8Array(mp4Data.length);
  copy.set(mp4Data);
  return new Blob([copy], { type: "video/mp4" });
}
