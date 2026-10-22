import { QUANTIZE_STEPS, type Genome, type StructuralAxis } from "./types";
import { STRUCTURAL_AXES } from "./types";

export function clamp(n: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, n));
}

/** Fixed-grid quantize. Same input, same genome, on every device. */
export function quantize01(normalized: number): number {
  return Math.round(clamp(normalized) * QUANTIZE_STEPS) / QUANTIZE_STEPS;
}

export function quantizeGenome(genome: Genome): Genome {
  const next = { ...genome };
  for (const axis of STRUCTURAL_AXES) {
    next[axis] = quantize01(genome[axis]);
  }
  next.pitchConfidence = quantize01(genome.pitchConfidence);
  next.register = quantize01(genome.register);
  return next;
}

export function genomeKey(genome: Genome): string {
  const axes = STRUCTURAL_AXES.map((axis) => axisValue(genome, axis).toFixed(5));
  return [
    ...axes,
    genome.pitchConfidence.toFixed(5),
    genome.register.toFixed(5),
    genome.motionSource,
  ].join("|");
}

function axisValue(genome: Genome, axis: StructuralAxis): number {
  return genome[axis];
}

/** Halton radical inverse. Index starts at 1. */
export function halton(index: number, base: number): number {
  let f = 1;
  let result = 0;
  let i = index;
  while (i > 0) {
    f /= base;
    result += f * (i % base);
    i = Math.floor(i / base);
  }
  return result;
}
