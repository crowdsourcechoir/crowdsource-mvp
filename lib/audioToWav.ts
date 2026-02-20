/**
 * Decode webm (or other) audio from a data URL to an AudioBuffer, then encode as 16-bit PCM WAV.
 * Produces a high-fidelity WAV file suitable for professional use.
 */
export async function dataUrlToWavBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  const arrayBuffer = await res.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
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

  // RIFF header
  writeStr("RIFF");
  view.setUint32(offset, totalSize - 8, true);
  offset += 4;
  writeStr("WAVE");

  // fmt chunk
  writeStr("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4; // chunk size
  view.setUint16(offset, 1, true);
  offset += 2; // PCM = 1
  view.setUint16(offset, numChannels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true);
  offset += 4; // byte rate
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2; // bits per sample

  // data chunk
  writeStr("data");
  view.setUint32(offset, dataSize, true);
  offset += 4;

  // Interleave channels and convert float32 (-1..1) to 16-bit signed
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      const int16 = sample < 0 ? sample * 32768 : sample * 32767;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}
