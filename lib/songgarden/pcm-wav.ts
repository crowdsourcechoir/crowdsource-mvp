/**
 * 16-bit PCM WAV decode/encode. Works in Node and the browser (no AudioContext).
 */

export type PcmWav = {
  sampleRate: number;
  channels: Float32Array[];
};

function readFourCC(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

/** Decode a standard 16-bit PCM WAV. Returns null if the format isn't supported. */
export function decodePcmWav(bytes: ArrayBuffer | Uint8Array): PcmWav | null {
  const buf = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  if (buf.byteLength < 44) return null;
  const view = new DataView(buf);
  if (readFourCC(view, 0) !== "RIFF" || readFourCC(view, 8) !== "WAVE") return null;

  let offset = 12;
  let sampleRate = 0;
  let numChannels = 0;
  let bitsPerSample = 0;
  let audioFormat = 0;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= view.byteLength) {
    const id = readFourCC(view, offset);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (id === "fmt " && size >= 16) {
      audioFormat = view.getUint16(start, true);
      numChannels = view.getUint16(start + 2, true);
      sampleRate = view.getUint32(start + 4, true);
      bitsPerSample = view.getUint16(start + 14, true);
    } else if (id === "data") {
      dataOffset = start;
      dataSize = size;
      break;
    }
    offset = start + size + (size % 2);
  }

  if (audioFormat !== 1 || bitsPerSample !== 16 || numChannels < 1 || sampleRate < 1 || dataOffset < 0) {
    return null;
  }

  const frameSize = numChannels * 2;
  const frames = Math.floor(Math.max(0, Math.min(dataSize, view.byteLength - dataOffset)) / frameSize);
  const channels: Float32Array[] = Array.from({ length: numChannels }, () => new Float32Array(frames));
  let p = dataOffset;
  for (let i = 0; i < frames; i += 1) {
    for (let c = 0; c < numChannels; c += 1) {
      const s = view.getInt16(p, true);
      channels[c][i] = s < 0 ? s / 32768 : s / 32767;
      p += 2;
    }
  }
  return { sampleRate, channels };
}

export function encodePcmWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  const numChannels = Math.max(1, channels.length);
  const length = channels[0]?.length ?? 0;
  const dataSize = length * numChannels * 2;
  const totalSize = 44 + dataSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  let offset = 0;
  const writeStr = (str: string) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset++, str.charCodeAt(i));
  };

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
  view.setUint32(offset, sampleRate * numChannels * 2, true);
  offset += 4;
  view.setUint16(offset, numChannels * 2, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeStr("data");
  view.setUint32(offset, dataSize, true);
  offset += 4;

  for (let i = 0; i < length; i += 1) {
    for (let c = 0; c < numChannels; c += 1) {
      const sample = Math.max(-1, Math.min(1, channels[c]?.[i] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
      offset += 2;
    }
  }
  return new Uint8Array(buffer);
}
