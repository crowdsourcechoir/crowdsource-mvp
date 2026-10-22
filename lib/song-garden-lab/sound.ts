import { heardConditions } from "./conditions";
import { clamp } from "./quantize";
import type { Conditions, Laws, Organism } from "./types";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export type SoundVoice = {
  id: string;
  midi: number;
  hz: number;
  /** Share of the air. The voices together sum to the thickness. */
  gain: number;
  /** 0..1 second partial, from how close density is to the ceiling. */
  partial: number;
  phase: number;
};

export type SoundFrame = {
  voices: SoundVoice[];
  /** Shared amplitude rate, from pulse. */
  tempoHz: number;
  /** Air thickness after the density ceiling. */
  thickness: number;
  /** 0..1 of the scale span, from tension. */
  distance: number;
  centerMidi: number;
};

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function noteName(midi: number): string {
  const rounded = Math.round(midi);
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${name}${octave}`;
}

/**
 * The speakers read the fold. Density caps thickness, pulse sets the tempo,
 * and tension is how far each stored register sits from the center of the scale.
 * The ribbon is not an input.
 */
export function sounding(organisms: Organism[], conditions: Conditions, laws: Laws): SoundFrame {
  const heard = heardConditions(conditions, laws);
  const ceiling = Math.max(0, laws.densityCeiling);
  const thickness = Math.min(Math.max(0, heard.density), ceiling);
  const distance = clamp(heard.tension);
  const tempoHz = 0.2 + clamp(heard.pulse) * 2.8;
  const share = organisms.length > 0 ? thickness / organisms.length : 0;
  const partial = ceiling > 0 ? thickness / ceiling : 0;
  const voices = organisms.map((organism) => {
    const midi = laws.scaleCenterMidi + (organism.genome.register - 0.5) * laws.scaleSpanSemitones * distance;
    return {
      id: organism.id,
      midi,
      hz: midiToHz(midi),
      gain: share,
      partial,
      phase: organism.motion.phase,
    };
  });
  return { voices, tempoHz, thickness, distance, centerMidi: laws.scaleCenterMidi };
}
