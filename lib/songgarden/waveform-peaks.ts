/**
 * Peak extraction for SoundCloud-style waveforms.
 *
 * Uses OfflineAudioContext so decode does not require a user gesture
 * (live AudioContext often stays suspended until click — and browsers
 * limit how many live contexts you can open).
 */

type OfflineCtxCtor = new (
  numberOfChannels: number,
  length: number,
  sampleRate: number
) => OfflineAudioContext;

function getOfflineAudioContextCtor(): OfflineCtxCtor {
  const w = typeof window !== "undefined" ? window : undefined;
  const Ctx =
    w?.OfflineAudioContext ||
    (w as unknown as { webkitOfflineAudioContext?: OfflineCtxCtor } | undefined)
      ?.webkitOfflineAudioContext;
  if (!Ctx) throw new Error("Web Audio is not available.");
  return Ctx;
}

/** Serialize decodes — OfflineAudioContext is cheap, but thrashing 80 at once stalls the main thread. */
let decodeChain: Promise<unknown> = Promise.resolve();

function enqueueDecode<T>(task: () => Promise<T>): Promise<T> {
  const run = decodeChain.then(task, task);
  decodeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
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
  return enqueueDecode(async () => {
    const Offline = getOfflineAudioContextCtor();
    // Dummy length/rate — only used so we can call decodeAudioData.
    const ctx = new Offline(1, 1, 44100);
    const audio = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channel = audio.getChannelData(0);
    return {
      peaks: peaksFromSamples(channel, barCount),
      durationSec: audio.duration,
    };
  });
}
