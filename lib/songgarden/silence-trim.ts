/**
 * Leading/trailing silence detection for Song Garden clips.
 *
 * Uses RMS + a noise-floor gate so room hiss (~0.02–0.05) is not treated as
 * content. Peak-only gating used to skip trim on every real-mic take.
 */

export type SilenceTrimSettings = {
  /** Absolute floor; adaptive gate is usually higher. */
  threshold: number;
  windowSamples: number;
  paddingMs: number;
  minContentMs: number;
};

export const DEFAULT_SILENCE_TRIM: SilenceTrimSettings = {
  threshold: 0.008,
  windowSamples: 512,
  paddingMs: 20,
  minContentMs: 80,
};

export type SilenceBounds = {
  startSample: number;
  endSample: number;
  leadSilentSamples: number;
  trailSilentSamples: number;
  trimmed: boolean;
};

function windowRms(channels: Float32Array[], from: number, to: number): number {
  let sum = 0;
  let n = 0;
  for (const ch of channels) {
    const end = Math.min(to, ch.length);
    for (let i = Math.max(0, from); i < end; i += 1) {
      const v = ch[i] ?? 0;
      sum += v * v;
      n += 1;
    }
  }
  return n === 0 ? 0 : Math.sqrt(sum / n);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[i] ?? 0;
}

/**
 * Find first/last non-silent windows. Trims leading and trailing silence.
 * If content would be too short or signal never rises above the noise floor,
 * returns full range (trimmed=false).
 */
export function detectSilenceBounds(
  channels: Float32Array[],
  sampleRate: number,
  settings: SilenceTrimSettings = DEFAULT_SILENCE_TRIM
): SilenceBounds {
  const length = channels[0]?.length ?? 0;
  if (length === 0 || channels.length === 0) {
    return {
      startSample: 0,
      endSample: 0,
      leadSilentSamples: 0,
      trailSilentSamples: 0,
      trimmed: false,
    };
  }

  const win = Math.max(32, settings.windowSamples);
  const padSamples = Math.round((settings.paddingMs / 1000) * sampleRate);
  const minSamples = Math.round((settings.minContentMs / 1000) * sampleRate);

  const rms: number[] = [];
  let peak = 0;
  for (let i = 0; i < length; i += win) {
    const r = windowRms(channels, i, Math.min(i + win, length));
    rms.push(r);
    if (r > peak) peak = r;
  }

  const sorted = [...rms].sort((a, b) => a - b);
  const floor = Math.max(percentile(sorted, 0.12), 1e-5);
  const contrast = peak >= Math.max(floor * 3.4, settings.threshold * 2.5);

  if (!contrast) {
    return {
      startSample: 0,
      endSample: length,
      leadSilentSamples: 0,
      trailSilentSamples: 0,
      trimmed: false,
    };
  }

  let gate = Math.max(floor * 3.2, peak * 0.07, settings.threshold);
  gate = Math.min(gate, peak * 0.28);

  let firstLoud = -1;
  let lastLoud = -1;
  for (let w = 0; w < rms.length; w += 1) {
    if ((rms[w] ?? 0) >= gate) {
      if (firstLoud < 0) firstLoud = w * win;
      lastLoud = Math.min(length, (w + 1) * win);
    }
  }

  if (firstLoud < 0 || lastLoud <= firstLoud) {
    return {
      startSample: 0,
      endSample: length,
      leadSilentSamples: 0,
      trailSilentSamples: 0,
      trimmed: false,
    };
  }

  let start = Math.max(0, firstLoud - padSamples);
  let end = Math.min(length, lastLoud + padSamples);

  if (end - start < minSamples) {
    const mid = Math.floor((start + end) / 2);
    start = Math.max(0, mid - Math.floor(minSamples / 2));
    end = Math.min(length, start + minSamples);
    start = Math.max(0, end - minSamples);
  }

  const trimmed = start > 0 || end < length;
  return {
    startSample: start,
    endSample: end,
    leadSilentSamples: start,
    trailSilentSamples: length - end,
    trimmed,
  };
}

/** Peak absolute sample in a channel region. */
export function peakAbs(channel: Float32Array, from: number, to: number): number {
  let peak = 0;
  const end = Math.min(to, channel.length);
  for (let i = Math.max(0, from); i < end; i++) {
    const v = Math.abs(channel[i] ?? 0);
    if (v > peak) peak = v;
  }
  return peak;
}

/** Peak across all channels for a window. */
export function peakAbsMulti(channels: Float32Array[], from: number, to: number): number {
  let peak = 0;
  for (const ch of channels) {
    const p = peakAbs(ch, from, to);
    if (p > peak) peak = p;
  }
  return peak;
}

export function samplesToMs(samples: number, sampleRate: number): number {
  if (!sampleRate) return 0;
  return Math.round((samples / sampleRate) * 1000);
}

/** Slice each channel to [start, end). */
export function sliceChannels(
  channels: Float32Array[],
  startSample: number,
  endSample: number
): Float32Array[] {
  return channels.map((ch) => ch.slice(startSample, endSample));
}
