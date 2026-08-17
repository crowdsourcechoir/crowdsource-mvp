import {
  decodeBlobToAudioBuffer,
  encodeAudioBufferToWavBlob,
  encodePcmToWavBlob,
} from "@/lib/audioToWav";
import {
  DEFAULT_SILENCE_TRIM,
  detectSilenceBounds,
  samplesToMs,
  sliceChannels,
  type SilenceTrimSettings,
} from "@/lib/songgarden/silence-trim";

export type TrimStatus = "trimmed" | "skipped" | "none";

export type PreparedSonggardenWav = {
  /** Playable WAV (silence trimmed on both ends when possible). */
  blob: Blob;
  /** Full untrimmed WAV — kept so Joel can audition / restore. */
  originalBlob: Blob;
  durationMs: number | null;
  originalDurationMs: number | null;
  trimLeadMs: number;
  trimTrailMs: number;
  trimStatus: TrimStatus;
};

function channelsFromBuffer(audioBuffer: AudioBuffer): Float32Array[] {
  const channels: Float32Array[] = [];
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }
  return channels;
}

/**
 * Decode → 16-bit WAV, keep original, trim leading+trailing silence for pads.
 * Adaptive RMS gate (see silence-trim.ts). The upload API re-trims as a backup.
 */
export async function prepareWavFromBlob(
  source: Blob,
  settings: SilenceTrimSettings = DEFAULT_SILENCE_TRIM
): Promise<PreparedSonggardenWav> {
  const audioBuffer = await decodeBlobToAudioBuffer(source);
  const channels = channelsFromBuffer(audioBuffer);
  const sampleRate = audioBuffer.sampleRate;
  const originalBlob = encodeAudioBufferToWavBlob(audioBuffer);
  const originalDurationMs = samplesToMs(audioBuffer.length, sampleRate);

  const bounds = detectSilenceBounds(channels, sampleRate, settings);

  if (!bounds.trimmed) {
    return {
      blob: originalBlob,
      originalBlob,
      durationMs: originalDurationMs || null,
      originalDurationMs: originalDurationMs || null,
      trimLeadMs: 0,
      trimTrailMs: 0,
      trimStatus: "skipped",
    };
  }

  const sliced = sliceChannels(channels, bounds.startSample, bounds.endSample);
  const blob = encodePcmToWavBlob(sliced, sampleRate);
  const durationMs = samplesToMs(bounds.endSample - bounds.startSample, sampleRate);

  return {
    blob,
    originalBlob,
    durationMs: durationMs || null,
    originalDurationMs: originalDurationMs || null,
    trimLeadMs: samplesToMs(bounds.leadSilentSamples, sampleRate),
    trimTrailMs: samplesToMs(bounds.trailSilentSamples, sampleRate),
    trimStatus: "trimmed",
  };
}
