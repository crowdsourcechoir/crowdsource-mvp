import { blobToWavBlob } from "@/lib/audioToWav";

export async function prepareWavFromBlob(
  source: Blob
): Promise<{ blob: Blob; durationMs: number | null }> {
  const wav = await blobToWavBlob(source);
  const durationMs = await new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(wav);
    const audio = new Audio(url);
    audio.addEventListener("loadedmetadata", () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : null);
    });
    audio.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      resolve(null);
    });
  });
  return { blob: wav, durationMs };
}
