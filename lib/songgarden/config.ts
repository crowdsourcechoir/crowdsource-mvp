import type { Event } from "@/data/mockEvents";
import {
  BEAT_SLOTS,
  CHOIR_SLOTS,
  gardenSlotById,
  JOURNEY_GARDEN_SLOT_IDS,
  type BeatSlotId,
  type ChoirSlotId,
  type GardenSlotDef,
  type GardenSlotId,
} from "@/lib/songgarden/garden-slots";

export type SongGardenStepConfig = {
  slotId: GardenSlotId;
  enabled: boolean;
  prompt: string;
  phaseLabel: string;
  buttonLabel?: string;
  /**
   * Optional sibling slots the participant can perform *instead* of `slotId` — e.g. "add a
   * stomp, clap, or snap" as one moment rather than three sequential ones. The participant
   * picks exactly one; whichever they perform is what gets submitted/labeled, but the step
   * still completes under `slotId` for progress-tracking purposes (see firstIncompleteGardenIndex).
   */
  alternateSlotIds?: GardenSlotId[];
};

export type SongGardenConfig = {
  soundTransitionMessage: string;
  steps: SongGardenStepConfig[];
};

export type ResolvedGardenStep = SongGardenStepConfig & {
  slot: GardenSlotDef;
  alternateSlots?: GardenSlotDef[];
};

export const DEFAULT_SOUND_TRANSITION_MESSAGE = "Now let's build the sounds of the experience.";

export const GARDEN_SLOT_ADMIN_LABELS: Record<GardenSlotId, { name: string; group: string }> = {
  stomp: { name: "Stomp", group: "Beat" },
  clap: { name: "Clap", group: "Beat" },
  snap: { name: "Snap", group: "Beat" },
  tap: { name: "Tap", group: "Beat" },
  low: { name: "Low choir", group: "Choir" },
  mid: { name: "Mid choir", group: "Choir" },
  higher: { name: "Higher choir", group: "Choir" },
  highest: { name: "Highest choir", group: "Choir" },
  one_word: { name: "One word", group: "Word" },
  anything_else: { name: "World sound", group: "World" },
};

function defaultPhaseLabel(slotId: GardenSlotId): string {
  switch (slotId) {
    case "stomp":
    case "clap":
    case "snap":
    case "tap":
      return "BUILD THE BEAT";
    case "low":
    case "mid":
    case "higher":
    case "highest":
      return "BUILD THE CHOIR";
    case "one_word":
      return "ONE WORD";
    case "anything_else":
      return "WORLD SOUND";
    default:
      return "SOUND";
  }
}

function defaultPrompt(slotId: GardenSlotId): string {
  switch (slotId) {
    case "stomp":
      return "Add a stomp.";
    case "clap":
      return "Add a clap.";
    case "snap":
      return "Add a snap.";
    case "tap":
      return "Add a tap.";
    case "low":
    case "mid":
    case "higher":
    case "highest": {
      const label = GARDEN_SLOT_ADMIN_LABELS[slotId].name.replace(" choir", "");
      return `Sing OHH — ${label.toLowerCase()} pitch. Match the tone.`;
    }
    case "one_word":
      return "When you think of summer, what's the first word that comes to mind? Sing it.";
    case "anything_else":
      return "Your voice, your dog, the room around you — anything.";
    default:
      return String(slotId);
  }
}

function defaultButtonLabel(slotId: GardenSlotId): string | undefined {
  if (slotId === "one_word") return "SING IT";
  return undefined;
}

function defaultStep(slotId: GardenSlotId): SongGardenStepConfig {
  return {
    slotId,
    enabled: true,
    prompt: defaultPrompt(slotId),
    phaseLabel: defaultPhaseLabel(slotId),
    buttonLabel: defaultButtonLabel(slotId),
  };
}

export function defaultSongGardenConfig(): SongGardenConfig {
  return {
    soundTransitionMessage: DEFAULT_SOUND_TRANSITION_MESSAGE,
    steps: JOURNEY_GARDEN_SLOT_IDS.map((slotId) => defaultStep(slotId)),
  };
}

export function normalizeSongGardenConfig(
  input: Partial<SongGardenConfig> | null | undefined
): SongGardenConfig {
  const defaults = defaultSongGardenConfig();
  if (!input?.steps?.length) return defaults;

  const defaultBySlot = new Map(defaults.steps.map((step) => [step.slotId, step]));
  const seen = new Set<GardenSlotId>();
  const steps: SongGardenStepConfig[] = [];

  for (const raw of input.steps) {
    if (!raw?.slotId || !defaultBySlot.has(raw.slotId) || seen.has(raw.slotId)) continue;
    seen.add(raw.slotId);
    const def = defaultBySlot.get(raw.slotId)!;
    const alternateSlotIds = Array.isArray(raw.alternateSlotIds)
      ? raw.alternateSlotIds.filter(
          (id): id is GardenSlotId => typeof id === "string" && id !== raw.slotId && defaultBySlot.has(id)
        )
      : undefined;
    steps.push({
      slotId: raw.slotId,
      enabled: raw.enabled !== false,
      prompt: raw.prompt?.trim() || def.prompt,
      phaseLabel: raw.phaseLabel?.trim() || def.phaseLabel,
      buttonLabel: raw.buttonLabel?.trim() || def.buttonLabel,
      ...(alternateSlotIds?.length ? { alternateSlotIds } : {}),
    });
  }

  for (const slotId of JOURNEY_GARDEN_SLOT_IDS) {
    if (!seen.has(slotId)) {
      steps.push(defaultBySlot.get(slotId)!);
    }
  }

  return {
    soundTransitionMessage: input.soundTransitionMessage?.trim() || defaults.soundTransitionMessage,
    steps,
  };
}

export function resolveSongGardenConfig(event: Event | null | undefined): SongGardenConfig {
  return normalizeSongGardenConfig(event?.songGardenConfig ?? null);
}

export function getEnabledGardenSteps(event: Event | null | undefined): ResolvedGardenStep[] {
  const config = resolveSongGardenConfig(event);
  return config.steps
    .filter((step) => step.enabled)
    .map((step) => {
      const slot = gardenSlotById(step.slotId);
      if (!slot) return null;
      const alternateSlots = step.alternateSlotIds
        ?.map((id) => gardenSlotById(id))
        .filter((s): s is GardenSlotDef => s != null);
      return { ...step, slot, ...(alternateSlots?.length ? { alternateSlots } : {}) };
    })
    .filter((step): step is ResolvedGardenStep => step != null);
}

export function gardenStepCount(event: Event | null | undefined): number {
  return getEnabledGardenSteps(event).length;
}

const BEAT_SLOT_IDS = new Set<BeatSlotId>(BEAT_SLOTS.map((s) => s.id as BeatSlotId));
const CHOIR_SLOT_IDS = new Set<ChoirSlotId>(CHOIR_SLOTS.map((s) => s.id as ChoirSlotId));

function isBeatSlotId(id: GardenSlotId): id is BeatSlotId {
  return BEAT_SLOT_IDS.has(id as BeatSlotId);
}

function isChoirSlotId(id: GardenSlotId): id is ChoirSlotId {
  return CHOIR_SLOT_IDS.has(id as ChoirSlotId);
}

/** Slab order in the progress strip — follows admin step order within each row. */
export function compositionStripSlotOrder(event: Event | null | undefined): {
  beat: BeatSlotId[];
  choir: ChoirSlotId[];
} {
  const config = resolveSongGardenConfig(event);
  const beat: BeatSlotId[] = [];
  const choir: ChoirSlotId[] = [];
  const beatSeen = new Set<BeatSlotId>();
  const choirSeen = new Set<ChoirSlotId>();

  for (const step of config.steps) {
    const { slotId } = step;
    if (isBeatSlotId(slotId) && !beatSeen.has(slotId)) {
      beat.push(slotId);
      beatSeen.add(slotId);
    }
    if (isChoirSlotId(slotId) && !choirSeen.has(slotId)) {
      choir.push(slotId);
      choirSeen.add(slotId);
    }
  }

  for (const slot of BEAT_SLOTS) {
    const id = slot.id as BeatSlotId;
    if (!beatSeen.has(id)) beat.push(id);
  }
  for (const slot of CHOIR_SLOTS) {
    const id = slot.id as ChoirSlotId;
    if (!choirSeen.has(id)) choir.push(id);
  }

  return { beat, choir };
}

export function firstIncompleteGardenIndex(
  event: Event | null | undefined,
  done: Set<GardenSlotId>
): number {
  const steps = getEnabledGardenSteps(event);
  const idx = steps.findIndex((step) => !done.has(step.slot.id));
  return idx >= 0 ? idx : Math.max(0, steps.length - 1);
}

export function allEnabledGardenSlotsDone(
  event: Event | null | undefined,
  done: Set<GardenSlotId>
): boolean {
  const steps = getEnabledGardenSteps(event);
  if (steps.length === 0) return true;
  return steps.every((step) => done.has(step.slot.id));
}
