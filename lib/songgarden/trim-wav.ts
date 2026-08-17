/**
 * Server-safe WAV silence trim (no AudioContext).
 * Used on upload so playable clips are gated even when the browser skipped.
 */

import { decodePcmWav, encodePcmWav } from "./pcm-wav";
import {
  DEFAULT_SILENCE_TRIM,
  detectSilenceBounds,
  samplesToMs,
  sliceChannels,
  type SilenceTrimSettings,
} from "./silence-trim";

export type AppliedWavTrim = {
  playable: Uint8Array;
  original: Uint8Array;
  durationMs: number;
  originalDurationMs: number;
  trimLeadMs: number;
  trimTrailMs: number;
  trimStatus: "trimmed" | "skipped";
};

function asUint8(bytes: ArrayBuffer | Uint8Array): Uint8Array {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

/** Decode a 16-bit WAV, trim leading/trailing silence, re-encode. Null if not PCM WAV. */
export function applySilenceTrimToWav(
  bytes: ArrayBuffer | Uint8Array,
  settings: SilenceTrimSettings = DEFAULT_SILENCE_TRIM
): AppliedWavTrim | null {
  const original = asUint8(bytes);
  const decoded = decodePcmWav(original);
  if (!decoded) return null;

  const { channels, sampleRate } = decoded;
  const originalDurationMs = samplesToMs(channels[0]?.length ?? 0, sampleRate);
  const bounds = detectSilenceBounds(channels, sampleRate, settings);

  if (!bounds.trimmed) {
    return {
      playable: original,
      original,
      durationMs: originalDurationMs,
      originalDurationMs,
      trimLeadMs: 0,
      trimTrailMs: 0,
      trimStatus: "skipped",
    };
  }

  const sliced = sliceChannels(channels, bounds.startSample, bounds.endSample);
  return {
    playable: encodePcmWav(sliced, sampleRate),
    original,
    durationMs: samplesToMs(bounds.endSample - bounds.startSample, sampleRate),
    originalDurationMs,
    trimLeadMs: samplesToMs(bounds.leadSilentSamples, sampleRate),
    trimTrailMs: samplesToMs(bounds.trailSilentSamples, sampleRate),
    trimStatus: "trimmed",
  };
}
