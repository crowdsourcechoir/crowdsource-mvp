/**
 * Silence detection for Song Garden pad samples.
 * Pure PCM helpers — usable from browser (AudioBuffer channels) and Node tests.
 */

export type SilenceTrimSettings = {
  /** Peak absolute amplitude below this counts as silence (linear 0–1). */
  threshold: number;
  /** Analysis hop / window in samples. */
  windowSamples: number;
  /** Never return a clip shorter than this (ms). */
  minContentMs: number;
  /** Keep this much audio before first / after last non-silent window (ms). */
  paddingMs: number;
};

export const DEFAULT_SILENCE_TRIM: SilenceTrimSettings = {
  threshold: 0.012,
  windowSamples: 256,
  minContentMs: 80,
  paddingMs: 12,
};

export type SilenceBounds = {
  startSample: number;
  endSample: number;
  leadSilentSamples: number;
  trailSilentSamples: number;
  trimmed: boolean;
};

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

/**
 * Find first/last non-silent windows. Trims leading and trailing silence.
 * If content would be too short or signal never rises, returns full range (trimmed=false).
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

  let firstLoud = -1;
  let lastLoud = -1;

  for (let i = 0; i < length; i += win) {
    const to = Math.min(i + win, length);
    if (peakAbsMulti(channels, i, to) >= settings.threshold) {
      if (firstLoud < 0) firstLoud = i;
      lastLoud = to;
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
