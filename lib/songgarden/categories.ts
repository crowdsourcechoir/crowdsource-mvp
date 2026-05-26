import type { SonggardenCategoryId } from "./types";

export type SonggardenCategory = {
  id: SonggardenCategoryId;
  label: string;
  hint: string;
  /** Short nudge shown when this category is selected */
  direction: string;
  /** Placeholder for the label field */
  example: string;
};

export const SONGGARDEN_CATEGORIES: SonggardenCategory[] = [
  {
    id: "ambient",
    label: "Ambient",
    hint: "Rain, wind, room tone",
    direction: "Capture the space around you — weather, air, silence between notes.",
    example: "Rain off the roof",
  },
  {
    id: "foley",
    label: "Foley",
    hint: "Footsteps, doors, objects",
    direction: "Everyday actions and objects — what you touch, open, or walk on.",
    example: "Heavy door closing",
  },
  {
    id: "percussion",
    label: "Percussion",
    hint: "Claps, taps, hits",
    direction: "Rhythmic hits and pulses — body, surfaces, found beats.",
    example: "Two claps in the hall",
  },
  {
    id: "vocal",
    label: "Vocal",
    hint: "Hums, shouts, phrases",
    direction: "Your voice — a hum, a word, a crowd shout, a breath.",
    example: "Hum on the walk over",
  },
  {
    id: "texture",
    label: "Texture",
    hint: "Rustle, scrape, noise",
    direction: "Rough, granular, or strange — friction, static, grit.",
    example: "Jacket rustle",
  },
  {
    id: "other",
    label: "Other",
    hint: "Anything else",
    direction: "Doesn't fit above? Drop it here — we'll sort it on the canvas.",
    example: "Describe your sound",
  },
];

export function songgardenCategoryLabel(id: SonggardenCategoryId): string {
  return SONGGARDEN_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function songgardenCategoryById(id: SonggardenCategoryId): SonggardenCategory | undefined {
  return SONGGARDEN_CATEGORIES.find((c) => c.id === id);
}

export function sanitizeSoundFilename(label: string, ext = "wav"): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return `${base || "sound"}.${ext}`;
}
