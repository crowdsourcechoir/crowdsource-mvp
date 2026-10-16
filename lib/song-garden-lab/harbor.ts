import { syntheticGenome } from "./laws";
import { quantize01, quantizeGenome } from "./quantize";
import type { Genome } from "./types";

export type HarborKind = "Voice" | "Line" | "Hit";

export type HarborNote = {
  id: string;
  kind: HarborKind;
  label: string;
};

/** The eight contributions that open the harbor field. */
export const HARBOR_STARTER: HarborNote[] = [
  { id: "s1", kind: "Voice", label: "Harbor whistle" },
  { id: "s2", kind: "Line", label: "We came for the tide" },
  { id: "s3", kind: "Hit", label: "Dock stomp" },
  { id: "s4", kind: "Voice", label: "Low hum under the pier" },
  { id: "s5", kind: "Line", label: "Lights on the water" },
  { id: "s6", kind: "Hit", label: "Two claps, then one" },
  { id: "s7", kind: "Voice", label: "Name sung once" },
  { id: "s8", kind: "Line", label: "Stay until the last boat" },
];

export const HARBOR_NEXT: Record<HarborKind, string[]> = {
  Voice: ["A breath before the chorus", "Someone humming the hook", "A call from the back row"],
  Line: ["Hold the last word", "Say it with the room", "Leave a silence after"],
  Hit: ["Heel on the floor", "A snap on two", "Hands once, together"],
};

const BIAS: Record<HarborKind, Pick<Genome, "force" | "sustain" | "stillness" | "brightness" | "articulation" | "motion">> = {
  Voice: { force: 0.42, sustain: 0.86, stillness: 0.12, brightness: 0.38, articulation: 0.22, motion: 0.48 },
  Line: { force: 0.3, sustain: 0.62, stillness: 0.28, brightness: 0.74, articulation: 0.5, motion: 0.18 },
  Hit: { force: 0.9, sustain: 0.1, stillness: 0.62, brightness: 0.5, articulation: 0.94, motion: 0.58 },
};

function fnv(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function salt(text: string, lane: number): number {
  return (fnv(`${lane}:${text}`) % 1000) / 999;
}

/** A phrase keeps one genome. Kind sets the gesture; the words nudge it. */
export function genomeForHarbor(kind: HarborKind, label: string): Genome {
  const bias = BIAS[kind];
  const key = `${kind}:${label}`;
  const mix = (axis: keyof typeof bias, lane: number) => quantize01(bias[axis] * 0.74 + salt(key, lane) * 0.26);
  const voice = kind === "Voice";
  return quantizeGenome(
    syntheticGenome({
      force: mix("force", 1),
      sustain: mix("sustain", 2),
      stillness: mix("stillness", 3),
      brightness: mix("brightness", 4),
      articulation: mix("articulation", 5),
      motion: mix("motion", 6),
      pitchConfidence: voice ? quantize01(0.72 + salt(key, 7) * 0.2) : 0,
      register: voice ? quantize01(0.25 + salt(key, 8) * 0.5) : 0.5,
      motionSource: voice ? "pitch" : "flux",
    })
  );
}

export function harborPlanting(note: HarborNote): { id: string; genome: Genome } {
  return { id: note.id, genome: genomeForHarbor(note.kind, note.label) };
}

export function harborNotes(list: HarborNote[]): Record<string, HarborNote> {
  const notes: Record<string, HarborNote> = {};
  for (const note of list) notes[note.id] = note;
  return notes;
}

/** How full the point field is. Empty still glows a little. Eighteen living bodies fill it. */
export function harborEnergy(living: number): number {
  return Math.max(0.08, Math.min(1, living / 18));
}

export function nextHarborNote(kind: HarborKind, plantedCount: number): HarborNote {
  const options = HARBOR_NEXT[kind];
  return {
    id: `n${plantedCount}`,
    kind,
    label: options[plantedCount % options.length],
  };
}
