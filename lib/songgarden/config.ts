import type { Event } from "@/data/mockEvents";
import {
  BEAT_SLOTS,
  CHOIR_SLOTS,
  gardenSlotById,
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
  /** Unified ordered journey (V2). When present, source of truth for WorldJourney. */
  journeySteps?: unknown[];
  /** Landing-screen eyebrow (defaults to "Welcome to the Song Garden"). */
  welcomeEyebrow?: string;
  /** Final-screen eyebrow (defaults to "You're Part Of It"). */
  completionEyebrow?: string;
  /** Final-screen button (defaults to "Let's do it again"). */
  completionButtonText?: string;
  /** When false, the closing screen has no button. Default true. */
  showCompletionButton?: boolean;
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

export function defaultPhaseLabelForSlot(slotId: GardenSlotId): string {
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

export function defaultPromptForSlot(slotId: GardenSlotId): string {
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

export function defaultButtonLabelForSlot(slotId: GardenSlotId): string | undefined {
  if (slotId === "one_word") return "SING IT";
  return undefined;
}

function defaultStep(slotId: GardenSlotId): SongGardenStepConfig {
  return {
    slotId,
    enabled: true,
    prompt: defaultPromptForSlot(slotId),
    phaseLabel: defaultPhaseLabelForSlot(slotId),
    buttonLabel: defaultButtonLabelForSlot(slotId),
  };
}

/** Short default — only what you add. No full pad catalog. */
export function defaultSongGardenConfig(): SongGardenConfig {
  return {
    soundTransitionMessage: DEFAULT_SOUND_TRANSITION_MESSAGE,
    steps: [
      {
        ...defaultStep("stomp"),
        prompt: "Add a stomp, clap, or snap.",
        alternateSlotIds: ["clap", "snap"],
      },
    ],
  };
}

function pickScreenCopy(input: Partial<SongGardenConfig> | null | undefined): Pick<
  SongGardenConfig,
  "welcomeEyebrow" | "completionEyebrow" | "completionButtonText" | "showCompletionButton"
> {
  return {
    ...(typeof input?.welcomeEyebrow === "string" ? { welcomeEyebrow: input.welcomeEyebrow } : {}),
    ...(typeof input?.completionEyebrow === "string"
      ? { completionEyebrow: input.completionEyebrow }
      : {}),
    ...(typeof input?.completionButtonText === "string"
      ? { completionButtonText: input.completionButtonText }
      : {}),
    ...(typeof input?.showCompletionButton === "boolean"
      ? { showCompletionButton: input.showCompletionButton }
      : {}),
  };
}

/** Closing-screen CTA is on unless explicitly turned off. */
export function isCompletionButtonVisible(config: SongGardenConfig | null | undefined): boolean {
  return config?.showCompletionButton !== false;
}

export function normalizeSongGardenConfig(
  input: Partial<SongGardenConfig> | null | undefined
): SongGardenConfig {
  const defaults = defaultSongGardenConfig();
  if (!input?.steps?.length) {
    return {
      ...defaults,
      ...(Array.isArray(input?.journeySteps) ? { journeySteps: input.journeySteps } : {}),
      soundTransitionMessage:
        input?.soundTransitionMessage?.trim() || defaults.soundTransitionMessage,
      ...pickScreenCopy(input),
    };
  }

  const seen = new Set<GardenSlotId>();
  const steps: SongGardenStepConfig[] = [];

  for (const raw of input.steps) {
    if (!raw?.slotId || !GARDEN_SLOT_ADMIN_LABELS[raw.slotId] || seen.has(raw.slotId)) continue;
    seen.add(raw.slotId);
    const alternateSlotIds = Array.isArray(raw.alternateSlotIds)
      ? raw.alternateSlotIds.filter(
          (id): id is GardenSlotId =>
            typeof id === "string" && id !== raw.slotId && Boolean(GARDEN_SLOT_ADMIN_LABELS[id as GardenSlotId])
        )
      : undefined;
    steps.push({
      slotId: raw.slotId,
      enabled: raw.enabled !== false,
      prompt: raw.prompt?.trim() || defaultPromptForSlot(raw.slotId),
      phaseLabel: raw.phaseLabel?.trim() || defaultPhaseLabelForSlot(raw.slotId),
      buttonLabel: raw.buttonLabel?.trim() || defaultButtonLabelForSlot(raw.slotId),
      ...(alternateSlotIds?.length ? { alternateSlotIds } : {}),
    });
  }

  if (steps.length === 0) {
    return {
      ...defaults,
      ...(Array.isArray(input.journeySteps) ? { journeySteps: input.journeySteps } : {}),
      soundTransitionMessage:
        input.soundTransitionMessage?.trim() || defaults.soundTransitionMessage,
      ...pickScreenCopy(input),
    };
  }

  return {
    soundTransitionMessage: input.soundTransitionMessage?.trim() || defaults.soundTransitionMessage,
    steps,
    ...(Array.isArray(input.journeySteps) ? { journeySteps: input.journeySteps } : {}),
    ...pickScreenCopy(input),
  };
}

export function resolveSongGardenConfig(event: Event | null | undefined): SongGardenConfig {
  return normalizeSongGardenConfig(event?.songGardenConfig ?? null);
}

export function getEnabledGardenSteps(event: Event | null | undefined): ResolvedGardenStep[] {
  // Prefer unified journey sound order when present (avoids legacy full-catalog noise).
  try {
    // Lazy import avoided — resolve via songGardenConfig.journeySteps or event.journeySteps inline.
    const rawJourney =
      (event as Event & { journeySteps?: unknown })?.journeySteps ??
      event?.songGardenConfig?.journeySteps;
    if (Array.isArray(rawJourney) && rawJourney.length > 0) {
      const fromJourney: ResolvedGardenStep[] = [];
      const seen = new Set<GardenSlotId>();
      for (const item of rawJourney) {
        if (!item || typeof item !== "object") continue;
        if ((item as { kind?: string }).kind !== "sound") continue;
        const slotId = (item as { slotId?: GardenSlotId }).slotId;
        if (!slotId || !GARDEN_SLOT_ADMIN_LABELS[slotId] || seen.has(slotId)) continue;
        seen.add(slotId);
        const slot = gardenSlotById(slotId);
        if (!slot) continue;
        const alternateSlotIds = Array.isArray((item as { alternateSlotIds?: GardenSlotId[] }).alternateSlotIds)
          ? (item as { alternateSlotIds: GardenSlotId[] }).alternateSlotIds.filter(
              (id) => id !== slotId && GARDEN_SLOT_ADMIN_LABELS[id]
            )
          : undefined;
        const alternateSlots = alternateSlotIds
          ?.map((id) => gardenSlotById(id))
          .filter((s): s is GardenSlotDef => s != null);
        fromJourney.push({
          slotId,
          enabled: true,
          prompt:
            (typeof (item as { prompt?: string }).prompt === "string" &&
              (item as { prompt: string }).prompt.trim()) ||
            defaultPromptForSlot(slotId),
          phaseLabel:
            (typeof (item as { phaseLabel?: string }).phaseLabel === "string" &&
              (item as { phaseLabel: string }).phaseLabel.trim()) ||
            defaultPhaseLabelForSlot(slotId),
          buttonLabel:
            (typeof (item as { buttonLabel?: string }).buttonLabel === "string" &&
              (item as { buttonLabel: string }).buttonLabel.trim()) ||
            defaultButtonLabelForSlot(slotId),
          ...(alternateSlotIds?.length ? { alternateSlotIds } : {}),
          slot,
          ...(alternateSlots?.length ? { alternateSlots } : {}),
        });
      }
      if (fromJourney.length > 0) return fromJourney;
    }
  } catch {
    // fall through to legacy steps
  }

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
