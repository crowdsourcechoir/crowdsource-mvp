import { halton, quantize01 } from "./quantize";
import type { Genome, StructuralAxis } from "./types";
import { STRUCTURAL_AXES } from "./types";

const HALTON_BASES = [2, 3, 5, 7, 11, 13];

export type NamedGenome = { id: string; genome: Genome };

/** Thirty genomes spread across the six axes. Values are quantized. */
export function haltonGenomes(count = 30): NamedGenome[] {
  return Array.from({ length: count }, (_, n) => {
    const index = n + 1;
    const genome = {
      force: 0,
      sustain: 0,
      stillness: 0,
      brightness: 0,
      articulation: 0,
      motion: 0,
      pitchConfidence: 0,
      register: 0.5,
      motionSource: "synthetic" as const,
    };
    STRUCTURAL_AXES.forEach((axis, axisIndex) => {
      genome[axis] = quantize01(halton(index, HALTON_BASES[axisIndex]));
    });
    return { id: `h${String(index).padStart(2, "0")}`, genome };
  });
}

/** Published field of twelve. Contribution #4 is id h04. */
export function publishedField(): NamedGenome[] {
  return haltonGenomes(12);
}

export function axisOf(genome: Genome, axis: StructuralAxis): number {
  return genome[axis];
}
