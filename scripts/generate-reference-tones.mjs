import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/tones");

/** Scale degrees 1, 4, 5, 6 in C (matches reference-tones.ts). */
const TONES = {
  1: 130.81,
  4: 174.61,
  5: 196.0,
  6: 220.0,
};

function writeToneWav(filePath, hz, durationSec = 3, sampleRate = 44100) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  const attack = 0.05;
  const release = 0.12;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let env = 1;
    if (t < attack) env = t / attack;
    else if (t > durationSec - release) env = Math.max(0, (durationSec - t) / release);

    const sample = Math.sin(2 * Math.PI * hz * t) * env * 0.35;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

fs.mkdirSync(outDir, { recursive: true });
for (const [degree, hz] of Object.entries(TONES)) {
  writeToneWav(path.join(outDir, `degree-${degree}.wav`), hz);
  console.log(`Wrote degree-${degree}.wav (${hz} Hz)`);
}
