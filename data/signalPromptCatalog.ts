import type { MusicalLayerType, SignalPromptBlock, SignalPromptChoice } from "@/data/signalPromptBlock";

export type SignalCatalogEntry = {
  /** Stable id for logs / future automation */
  id: string;
  /** Short label on host buttons */
  buttonLabel: string;
  /** Audience-facing question */
  promptText: string;
  block: SignalPromptBlock;
};

function stub(layer: MusicalLayerType, choiceId: string): string {
  return `ableton.stub.layer.${layer}.${choiceId}`;
}

function choices(
  layer: MusicalLayerType,
  pairs: readonly { readonly id: string; readonly label: string }[]
): SignalPromptChoice[] {
  return pairs.map((p) => ({
    id: p.id,
    label: p.label,
    triggerId: stub(layer, p.id),
  }));
}

function block(
  layer: MusicalLayerType,
  pairs: readonly { readonly id: string; readonly label: string }[]
): SignalPromptBlock {
  return { version: 1, kind: "signal", layerType: layer, choices: choices(layer, pairs) };
}

/**
 * All preset Signal rounds (one collective vote each, 4 choices).
 * Order: harmonic → rhythm → energy → bass → FX → vocal.
 */
export const SIGNAL_CATALOG: readonly SignalCatalogEntry[] = [
  {
    id: "harmonic_worlds",
    buttonLabel: "Harmonic worlds",
    promptText: "Where should the harmonic world drift next?",
    block: block("harmonic", [
      { id: "ocean", label: "Ocean" },
      { id: "fire", label: "Fire" },
      { id: "night", label: "Night" },
      { id: "sunrise", label: "Sunrise" },
    ]),
  },
  {
    id: "rhythm_worlds",
    buttonLabel: "Rhythm worlds",
    promptText: "Which rhythm should carry the room?",
    block: block("rhythmic", [
      { id: "heartbeat", label: "Heartbeat" },
      { id: "floating", label: "Floating" },
      { id: "driving", label: "Driving" },
      { id: "dancing", label: "Dancing" },
    ]),
  },
  {
    id: "energy_worlds",
    buttonLabel: "Energy worlds",
    promptText: "Where should the energy move next?",
    block: block("energy", [
      { id: "wonder", label: "Wonder" },
      { id: "lift", label: "Lift" },
      { id: "tension", label: "Tension" },
      { id: "release", label: "Release" },
    ]),
  },
  {
    id: "bass_worlds",
    buttonLabel: "Bass worlds",
    promptText: "Which bass world do we lean into?",
    block: block("bass", [
      { id: "warm", label: "Warm" },
      { id: "heavy", label: "Heavy" },
      { id: "rolling", label: "Rolling" },
      { id: "pulsing", label: "Pulsing" },
    ]),
  },
  {
    id: "fx_worlds",
    buttonLabel: "FX worlds",
    promptText: "Which space should open around us?",
    block: block("fx", [
      { id: "vast", label: "Vast" },
      { id: "dream", label: "Dream" },
      { id: "storm", label: "Storm" },
      { id: "glitch", label: "Glitch" },
    ]),
  },
  {
    id: "vocal_worlds",
    buttonLabel: "Vocal worlds",
    promptText: "Which vocal texture should lift the crowd?",
    block: block("vocal", [
      { id: "hook", label: "Hook" },
      { id: "mantra", label: "Mantra" },
      { id: "chant", label: "Chant" },
      { id: "breath", label: "Breath" },
    ]),
  },
] as const;

const LAYER_ORDER: MusicalLayerType[] = ["harmonic", "rhythmic", "energy", "bass", "fx", "vocal"];

const LAYER_SECTION_TITLE: Record<MusicalLayerType, string> = {
  harmonic: "Harmonic",
  rhythmic: "Rhythm",
  energy: "Energy",
  bass: "Bass",
  fx: "FX",
  vocal: "Vocal",
};

export function signalCatalogGrouped(): { layer: MusicalLayerType; title: string; entries: SignalCatalogEntry[] }[] {
  return LAYER_ORDER.map((layer) => ({
    layer,
    title: LAYER_SECTION_TITLE[layer],
    entries: SIGNAL_CATALOG.filter((e) => e.block.layerType === layer),
  }));
}

export function getSignalCatalogEntry(id: string): SignalCatalogEntry | undefined {
  return SIGNAL_CATALOG.find((e) => e.id === id);
}
