/**
 * Peak extraction for SoundCloud-style waveforms.
 */

let sharedCtx: AudioContext | null = null;

function getSharedAudioContext(): AudioContext {
  const Ctx =
    typeof window !== "undefined"
      ? window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!Ctx) throw new Error("Web Audio is not available.");
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new Ctx();
  }
  return sharedCtx;
}

export function peaksFromSamples(samples: Float32Array | number[], barCount: number): number[] {
  const bars = Math.max(8, Math.min(512, Math.floor(barCount)));
  const len = samples.length;
  if (len === 0) return Array.from({ length: bars }, () => 0);
  const peaks: number[] = [];
  const step = len / bars;
  let max = 0;
  for (let i = 0; i < bars; i += 1) {
    const start = Math.floor(i * step);
    const end = Math.min(len, Math.floor((i + 1) * step));
    let peak = 0;
    for (let j = start; j < end; j += 1) {
      const v = Math.abs(samples[j] ?? 0);
      if (v > peak) peak = v;
    }
    peaks.push(peak);
    if (peak > max) max = peak;
  }
  if (max <= 0) return peaks;
  return peaks.map((p) => p / max);
}

export async function peaksFromAudioBuffer(
  arrayBuffer: ArrayBuffer,
  barCount: number
): Promise<{ peaks: number[]; durationSec: number }> {
  const ctx = getSharedAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume().catch(() => undefined);
  }
  const audio = await ctx.decodeAudioData(arrayBuffer.slice(0));
  const channel = audio.getChannelData(0);
  return {
    peaks: peaksFromSamples(channel, barCount),
    durationSec: audio.duration,
  };
}
