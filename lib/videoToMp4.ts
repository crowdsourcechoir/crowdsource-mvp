/**
 * Convert webm video (data URL) to MP4 blob using ffmpeg.wasm.
 * Used for high-fidelity download in professional settings.
 */
let ffmpegInstance: import("@ffmpeg/ffmpeg").FFmpeg | null = null;

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
    const res = await fetch(dataUrl);
    return res.blob();
  }
  const res = await fetch(dataUrl);
  const arrayBuffer = await res.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

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
