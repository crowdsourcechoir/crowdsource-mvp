import type { SonggardenCategoryId } from "./types";

export type BeatSlotId = "stomp" | "clap" | "snap" | "tap";
export type ChoirSlotId = "low" | "mid" | "higher" | "highest";
export type GardenSlotId = BeatSlotId | ChoirSlotId | "one_word" | "anything_else";

export type GardenSlotDef = {
  id: GardenSlotId;
  label: string;
  category: SonggardenCategoryId;
  recordMs: number;
  /** Scale degree for choir reference (1, 4, 5, 6) */
  harmonyDegree?: 1 | 4 | 5 | 6;
};

export const BEAT_SLOTS: GardenSlotDef[] = [
  { id: "stomp", label: "STOMP", category: "percussion", recordMs: 1800 },
  { id: "clap", label: "CLAP", category: "percussion", recordMs: 1400 },
  { id: "snap", label: "SNAP", category: "percussion", recordMs: 1200 },
  { id: "tap", label: "TAP", category: "percussion", recordMs: 1400 },
];

export const CHOIR_SLOTS: GardenSlotDef[] = [
  { id: "low", label: "LOW", category: "vocal", recordMs: 5000, harmonyDegree: 1 },
  { id: "mid", label: "MID", category: "vocal", recordMs: 5000, harmonyDegree: 4 },
  { id: "higher", label: "HIGHER", category: "vocal", recordMs: 5000, harmonyDegree: 5 },
  { id: "highest", label: "HIGHEST", category: "vocal", recordMs: 5000, harmonyDegree: 6 },
];

export const ONE_WORD_SLOT: GardenSlotDef = {
  id: "one_word",
  label: "ONE WORD",
  category: "vocal",
  recordMs: 3500,
};

export const ANYTHING_ELSE_SLOT: GardenSlotDef = {
  id: "anything_else",
  label: "ONE MORE",
  category: "other",
  recordMs: 5000,
};

/** Linear sound steps after lyric questions (default order). */
export const JOURNEY_GARDEN_SLOT_IDS: GardenSlotId[] = [
  ...BEAT_SLOTS.map((s) => s.id),
  ...CHOIR_SLOTS.map((s) => s.id),
  "one_word",
  "anything_else",
];

export const JOURNEY_GARDEN_SLOTS: GardenSlotDef[] = JOURNEY_GARDEN_SLOT_IDS.map(
  (id) => gardenSlotById(id)!
).filter(Boolean);

export function gardenSlotById(id: GardenSlotId): GardenSlotDef | undefined {
  if (id === "one_word") return ONE_WORD_SLOT;
  if (id === "anything_else") return ANYTHING_ELSE_SLOT;
  return [...BEAT_SLOTS, ...CHOIR_SLOTS].find((s) => s.id === id);
}

/** Required pads for the completion celebration (grid mode). */
export const REQUIRED_SLOT_IDS: GardenSlotId[] = [
  ...BEAT_SLOTS.map((s) => s.id),
  ...CHOIR_SLOTS.map((s) => s.id),
  "one_word",
];
