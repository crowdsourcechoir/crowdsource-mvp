import { analyzePcm, type AnalysisReading } from "./analyze";
import { encodePcmWav } from "@/lib/songgarden/pcm-wav";
import { ROOM_PADS, STARTER_ID, type RoomPadId } from "./room";
import type { Genome } from "./types";

const RATE = 16000;

function noiseBurst(seconds: number, amp: number, decay: number): Float32Array {
  const length = Math.round(seconds * RATE);
  const out = new Float32Array(length);
  let seed = 17;
  for (let i = 0; i < length; i += 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const white = (seed / 0x7fffffff) * 2 - 1;
    out[i] = white * amp * Math.exp((-i / RATE) * decay);
  }
  return out;
}

function tone(hz: number, seconds: number, amp: number): Float32Array {
  const length = Math.round(seconds * RATE);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const env = Math.min(1, i / (0.02 * RATE)) * Math.min(1, (length - i) / (0.05 * RATE));
    out[i] = Math.sin((2 * Math.PI * hz * i) / RATE) * amp * env;
  }
  return out;
}

export function starterSamples(padId: RoomPadId): Float32Array {
  if (padId === "clap") return noiseBurst(0.18, 0.85, 28);
  if (padId === "tap") return tone(1800, 0.06, 0.7);
  if (padId === "voice") return tone(220, 1.4, 0.35);
  return noiseBurst(1.6, 0.12, 1.2);
}

export function starterReading(padId: RoomPadId): AnalysisReading {
  return analyzePcm(starterSamples(padId), RATE);
}

export function starterGenome(padId: RoomPadId): Genome {
  return starterReading(padId).genome;
}

export function starterWav(padId: RoomPadId): Uint8Array {
  return encodePcmWav([starterSamples(padId)], RATE);
}

export function starterBlob(padId: RoomPadId): Blob {
  const bytes = starterWav(padId);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: "audio/wav" });
}

export const STARTER_GENOMES: { id: string; genome: Genome }[] = ROOM_PADS.map((pad) => ({
  id: `${pad.id}:${STARTER_ID}`,
  genome: starterGenome(pad.id),
}));
