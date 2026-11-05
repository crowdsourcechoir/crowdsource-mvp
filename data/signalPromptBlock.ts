/**
 * Signal tab — modular prompt blocks for collective choice → Ableton trigger stubs.
 * Stored on `prompt_game_rounds.prompt_block` (jsonb). OSC/MIDI wiring comes later.
 */

export type MusicalLayerType = "harmonic" | "rhythmic" | "energy" | "fx" | "bass" | "vocal";

export type SignalPromptChoice = {
  id: string;
  label: string;
  /** Stub ID for future Ableton / OSC routing (namespaced, stable). */
  triggerId: string;
  /** Filled server-side after seed submissions are inserted. */
  submissionId?: string;
};

export type SignalPromptBlock = {
  version: 1;
  kind: "signal";
  layerType: MusicalLayerType;
  choices: SignalPromptChoice[];
};

/** Live Room Journey media cue (selfie / snap / short video). */
export type MediaPromptBlock = {
  version: 1;
  kind: "media";
  mediaType: "photo" | "sound" | "video";
  /** Optional facilitator note shown under the prompt. */
  hint?: string | null;
};

export type PromptBlock = SignalPromptBlock | MediaPromptBlock;

export function isMediaPromptBlock(block: PromptBlock | null | undefined): block is MediaPromptBlock {
  return block?.kind === "media";
}

export function isSignalPromptBlock(block: PromptBlock | null | undefined): block is SignalPromptBlock {
  return block?.kind === "signal";
}

export const DEFAULT_SELFIE_MEDIA_BLOCK: MediaPromptBlock = {
  version: 1,
  kind: "media",
  mediaType: "photo",
  hint: "Front camera · one still · tap to capture",
};

export const DEFAULT_SNAP_MEDIA_BLOCK: MediaPromptBlock = {
  version: 1,
  kind: "media",
  mediaType: "sound",
  hint: "One short snap · about a second",
};

const SIGNAL_DEVICE_PREFIX = "__signal_choice__:";

export function signalChoiceDeviceId(choiceId: string): string {
  return `${SIGNAL_DEVICE_PREFIX}${choiceId}`;
}

export function isSignalChoiceDeviceId(deviceId: string): boolean {
  return deviceId.startsWith("__signal_choice__:");
}

/** First harmonic-world prototype (2–5s preview stubs in Ableton later). */
export const DEFAULT_SIGNAL_HARMONIC_BLOCK: SignalPromptBlock = {
  version: 1,
  kind: "signal",
  layerType: "harmonic",
  choices: [
    { id: "ocean", label: "Ocean", triggerId: "ableton.stub.layer.harmonic.ocean" },
    { id: "fire", label: "Fire", triggerId: "ableton.stub.layer.harmonic.fire" },
    { id: "night", label: "Night", triggerId: "ableton.stub.layer.harmonic.night" },
    { id: "sunrise", label: "Sunrise", triggerId: "ableton.stub.layer.harmonic.sunrise" },
  ],
};

export function parsePromptBlock(raw: unknown): PromptBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;

  if (o.kind === "media") {
    const mediaType = o.mediaType;
    if (mediaType !== "photo" && mediaType !== "sound" && mediaType !== "video") return null;
    const hint = typeof o.hint === "string" ? o.hint.trim() : null;
    return { version: 1, kind: "media", mediaType, hint: hint || null };
  }

  if (o.kind !== "signal") return null;
  if (typeof o.layerType !== "string") return null;
  const layer = o.layerType as MusicalLayerType;
  const allowed: MusicalLayerType[] = ["harmonic", "rhythmic", "energy", "fx", "bass", "vocal"];
  if (!allowed.includes(layer)) return null;
  if (!Array.isArray(o.choices) || o.choices.length < 2 || o.choices.length > 6) return null;
  const choices: SignalPromptChoice[] = [];
  for (const c of o.choices) {
    if (!c || typeof c !== "object") return null;
    const row = c as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const triggerId = typeof row.triggerId === "string" ? row.triggerId.trim() : "";
    if (!id || !label || !triggerId) return null;
    const submissionId = typeof row.submissionId === "string" ? row.submissionId : undefined;
    choices.push({ id, label, triggerId, submissionId });
  }
  return { version: 1, kind: "signal", layerType: layer, choices };
}
