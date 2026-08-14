/**
 * Browser WAV encode/decode helpers for Song Garden.
 * 16-bit PCM WAV — DAW-friendly for Ableton Live / Push / MPD.
 */

function getAudioContext(): AudioContext {
  return new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
}

export async function decodeBlobToAudioBuffer(blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = getAudioContext();
  try {
    return await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    void audioContext.close?.();
  }
}

/** Encode an AudioBuffer (or channel arrays) as 16-bit PCM WAV. */
export function encodePcmToWavBlob(
  channels: Float32Array[],
  sampleRate: number
): Blob {
  const numChannels = Math.max(1, channels.length);
  const length = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  let offset = 0;

  function writeStr(str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset++, str.charCodeAt(i));
    }
  }

  writeStr("RIFF");
  view.setUint32(offset, totalSize - 8, true);
  offset += 4;
  writeStr("WAVE");

  writeStr("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, numChannels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;

  writeStr("data");
  view.setUint32(offset, dataSize, true);
  offset += 4;

  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c]?.[i] ?? 0));
      const int16 = sample < 0 ? sample * 32768 : sample * 32767;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export function encodeAudioBufferToWavBlob(audioBuffer: AudioBuffer): Blob {
  const channels: Float32Array[] = [];
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }
  return encodePcmToWavBlob(channels, audioBuffer.sampleRate);
}

/**
 * Decode webm (or other) audio from a data URL to an AudioBuffer, then encode as 16-bit PCM WAV.
 * Produces a high-fidelity WAV file suitable for professional use.
 */
export async function dataUrlToWavBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const audioBuffer = await decodeBlobToAudioBuffer(blob);
  return encodeAudioBufferToWavBlob(audioBuffer);
}

/** Convert any decodable audio blob to 16-bit PCM WAV (browser only). */
export async function blobToWavBlob(blob: Blob): Promise<Blob> {
  const audioBuffer = await decodeBlobToAudioBuffer(blob);
  return encodeAudioBufferToWavBlob(audioBuffer);
}
