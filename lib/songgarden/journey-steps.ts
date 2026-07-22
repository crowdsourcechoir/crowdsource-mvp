import type { AgentBrief } from "@/data/agentInterview";
import type { Event } from "@/data/mockEvents";
import { DEFAULT_NAME_QUESTION_PROMPT } from "@/lib/agent-name-question";
import {
  defaultPhaseLabelForSlot,
  defaultPromptForSlot,
  defaultButtonLabelForSlot,
  GARDEN_SLOT_ADMIN_LABELS,
  type SongGardenConfig,
  type SongGardenStepConfig,
} from "@/lib/songgarden/config";
import {
  gardenSlotById,
  type GardenSlotDef,
  type GardenSlotId,
} from "@/lib/songgarden/garden-slots";

export type JourneyNameStep = {
  id: string;
  kind: "name";
  prompt?: string;
};

export type JourneyTextStep = {
  id: string;
  kind: "text";
  prompt: string;
  allowAudio?: boolean;
  allowVideo?: boolean;
  requireEmailCaptcha?: boolean;
};

export type JourneySoundStep = {
  id: string;
  kind: "sound";
  slotId: GardenSlotId;
  prompt: string;
  phaseLabel?: string;
  buttonLabel?: string;
  alternateSlotIds?: GardenSlotId[];
};

export type JourneyStep = JourneyNameStep | JourneyTextStep | JourneySoundStep;

export type ResolvedJourneySoundStep = JourneySoundStep & {
  slot: GardenSlotDef;
  alternateSlots?: GardenSlotDef[];
};

function newStepId(): string {
  return `js_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const VALID_SLOT_IDS = new Set<string>(Object.keys(GARDEN_SLOT_ADMIN_LABELS));

function isGardenSlotId(id: unknown): id is GardenSlotId {
  return typeof id === "string" && VALID_SLOT_IDS.has(id);
}

/** Short starter journey for new events. */
export function defaultJourneySteps(): JourneyStep[] {
  return [
    {
      id: newStepId(),
      kind: "name",
      prompt: DEFAULT_NAME_QUESTION_PROMPT,
    },
    {
      id: newStepId(),
      kind: "text",
      prompt: "What's a word or phrase you want to plant in this Song Garden?",
    },
    {
      id: newStepId(),
      kind: "sound",
      slotId: "stomp",
      prompt: "Add a stomp, clap, or snap.",
      phaseLabel: defaultPhaseLabelForSlot("stomp"),
      alternateSlotIds: ["clap", "snap"],
    },
  ];
}

export function normalizeJourneySteps(raw: unknown): JourneyStep[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const steps: JourneyStep[] = [];
  let hasName = false;
  const seenSlots = new Set<GardenSlotId>();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const kind = (item as { kind?: unknown }).kind;
    const id =
      typeof (item as { id?: unknown }).id === "string" && (item as { id: string }).id.trim()
        ? (item as { id: string }).id.trim()
        : newStepId();

    if (kind === "name") {
      if (hasName) continue;
      hasName = true;
      const prompt =
        typeof (item as { prompt?: unknown }).prompt === "string"
          ? (item as { prompt: string }).prompt.trim()
          : "";
      steps.push({
        id,
        kind: "name",
        ...(prompt ? { prompt } : {}),
      });
      continue;
    }

    if (kind === "text") {
      const prompt =
        typeof (item as { prompt?: unknown }).prompt === "string"
          ? (item as { prompt: string }).prompt
          : "";
      // Allow empty prompts while editing in admin; submit/sync filters empties.
      steps.push({
        id,
        kind: "text",
        prompt,
        allowAudio: Boolean((item as { allowAudio?: unknown }).allowAudio),
        allowVideo: Boolean((item as { allowVideo?: unknown }).allowVideo),
        requireEmailCaptcha: Boolean((item as { requireEmailCaptcha?: unknown }).requireEmailCaptcha),
      });
      continue;
    }

    if (kind === "sound") {
      const slotId = (item as { slotId?: unknown }).slotId;
      if (!isGardenSlotId(slotId) || seenSlots.has(slotId)) continue;
      seenSlots.add(slotId);
      const alternateSlotIds = Array.isArray((item as { alternateSlotIds?: unknown }).alternateSlotIds)
        ? ((item as { alternateSlotIds: unknown[] }).alternateSlotIds.filter(
            (alt): alt is GardenSlotId => isGardenSlotId(alt) && alt !== slotId
          ) as GardenSlotId[])
        : undefined;
      const promptRaw =
        typeof (item as { prompt?: unknown }).prompt === "string"
          ? (item as { prompt: string }).prompt.trim()
          : "";
      const phaseLabel =
        typeof (item as { phaseLabel?: unknown }).phaseLabel === "string"
          ? (item as { phaseLabel: string }).phaseLabel.trim()
          : "";
      const buttonLabel =
        typeof (item as { buttonLabel?: unknown }).buttonLabel === "string"
          ? (item as { buttonLabel: string }).buttonLabel.trim()
          : "";
      steps.push({
        id,
        kind: "sound",
        slotId,
        prompt: promptRaw || defaultPromptForSlot(slotId),
        phaseLabel: phaseLabel || defaultPhaseLabelForSlot(slotId),
        ...(buttonLabel || defaultButtonLabelForSlot(slotId)
          ? { buttonLabel: buttonLabel || defaultButtonLabelForSlot(slotId) }
          : {}),
        ...(alternateSlotIds?.length ? { alternateSlotIds } : {}),
      });
    }
  }

  return steps;
}

/**
 * Resolve the unified journey. Prefers explicit journeySteps; otherwise synthesizes
 * from collectName + askAboutItems + enabled garden steps only (not the full catalog).
 */
export function resolveJourneySteps(event: Event | null | undefined): JourneyStep[] {
  const fromEvent = normalizeJourneySteps(event?.journeySteps);
  if (fromEvent.length > 0) return fromEvent;

  const fromConfig = normalizeJourneySteps(event?.songGardenConfig?.journeySteps);
  if (fromConfig.length > 0) return fromConfig;

  return synthesizeJourneySteps(event);
}

export function synthesizeJourneySteps(event: Event | null | undefined): JourneyStep[] {
  const steps: JourneyStep[] = [];
  const brief = event?.agentBrief;

  if (brief?.collectName !== false) {
    steps.push({
      id: newStepId(),
      kind: "name",
      prompt: brief?.nameQuestionPrompt?.trim() || DEFAULT_NAME_QUESTION_PROMPT,
    });
  }

  const items = brief?.askAboutItems?.filter(
    (item) => typeof item?.prompt === "string" && item.prompt.trim().length > 0
  );
  if (items?.length) {
    for (const item of items) {
      steps.push({
        id: newStepId(),
        kind: "text",
        prompt: item.prompt.trim(),
        allowAudio: Boolean(item.allowAudio),
        allowVideo: Boolean(item.allowVideo),
        requireEmailCaptcha: Boolean(item.requireEmailCaptcha),
      });
    }
  } else {
    const strings = brief?.askAbout?.filter(
      (q): q is string => typeof q === "string" && q.trim().length > 0
    );
    for (const prompt of strings ?? []) {
      steps.push({ id: newStepId(), kind: "text", prompt: prompt.trim() });
    }
  }

  const gardenSteps = event?.songGardenConfig?.steps ?? [];
  for (const step of gardenSteps) {
    if (!step?.slotId || !isGardenSlotId(step.slotId)) continue;
    if (step.enabled === false) continue;
    steps.push({
      id: newStepId(),
      kind: "sound",
      slotId: step.slotId,
      prompt: step.prompt?.trim() || defaultPromptForSlot(step.slotId),
      phaseLabel: step.phaseLabel?.trim() || defaultPhaseLabelForSlot(step.slotId),
      ...(step.buttonLabel?.trim() ? { buttonLabel: step.buttonLabel.trim() } : {}),
      ...(step.alternateSlotIds?.length ? { alternateSlotIds: step.alternateSlotIds } : {}),
    });
  }

  return steps.length > 0 ? steps : defaultJourneySteps();
}

/** Sync legacy agentBrief + songGardenConfig.steps from a unified journey list. */
export function syncLegacyFromJourneySteps(
  journeySteps: JourneyStep[],
  prevBrief: AgentBrief | null | undefined,
  prevGarden: SongGardenConfig | null | undefined
): { agentBrief: AgentBrief; songGardenConfig: SongGardenConfig } {
  const normalized = normalizeJourneySteps(journeySteps);
  const nameStep = normalized.find((s): s is JourneyNameStep => s.kind === "name");
  const textSteps = normalized.filter(
    (s): s is JourneyTextStep => s.kind === "text" && s.prompt.trim().length > 0
  );
  const soundSteps = normalized.filter((s): s is JourneySoundStep => s.kind === "sound");

  const askAboutItems = textSteps.map((s) => ({
    prompt: s.prompt.trim(),
    allowAudio: Boolean(s.allowAudio),
    allowVideo: Boolean(s.allowVideo),
    requireEmailCaptcha: Boolean(s.requireEmailCaptcha),
  }));

  const agentBrief: AgentBrief = {
    ...(prevBrief ?? {}),
    collectName: Boolean(nameStep),
    nameQuestionPrompt: nameStep?.prompt?.trim() || DEFAULT_NAME_QUESTION_PROMPT,
    askAboutItems,
    askAbout: askAboutItems.map((item) => item.prompt),
  };

  const steps: SongGardenStepConfig[] = soundSteps.map((s) => ({
    slotId: s.slotId,
    enabled: true,
    prompt: s.prompt,
    phaseLabel: s.phaseLabel || defaultPhaseLabelForSlot(s.slotId),
    ...(s.buttonLabel ? { buttonLabel: s.buttonLabel } : {}),
    ...(s.alternateSlotIds?.length ? { alternateSlotIds: s.alternateSlotIds } : {}),
  }));

  const songGardenConfig: SongGardenConfig = {
    soundTransitionMessage:
      prevGarden?.soundTransitionMessage?.trim() ||
      "Now let's build the sounds of the experience.",
    steps,
    journeySteps: normalized,
  };

  return { agentBrief, songGardenConfig };
}

export function resolveSoundStep(step: JourneySoundStep): ResolvedJourneySoundStep | null {
  const slot = gardenSlotById(step.slotId);
  if (!slot) return null;
  const alternateSlots = step.alternateSlotIds
    ?.map((id) => gardenSlotById(id))
    .filter((s): s is GardenSlotDef => s != null);
  return {
    ...step,
    slot,
    ...(alternateSlots?.length ? { alternateSlots } : {}),
  };
}

export function journeyStepCount(event: Event | null | undefined): number {
  return resolveJourneySteps(event).length;
}

export function createJourneyTextStep(prompt = ""): JourneyTextStep {
  return { id: newStepId(), kind: "text", prompt };
}

export function createJourneyNameStep(prompt = DEFAULT_NAME_QUESTION_PROMPT): JourneyNameStep {
  return { id: newStepId(), kind: "name", prompt };
}

export function createJourneySoundStep(slotId: GardenSlotId): JourneySoundStep {
  return {
    id: newStepId(),
    kind: "sound",
    slotId,
    prompt: defaultPromptForSlot(slotId),
    phaseLabel: defaultPhaseLabelForSlot(slotId),
    ...(defaultButtonLabelForSlot(slotId) ? { buttonLabel: defaultButtonLabelForSlot(slotId) } : {}),
  };
}
