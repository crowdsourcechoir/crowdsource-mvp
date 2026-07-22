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
import { gardenSlotMomentLabel } from "@/lib/song-garden-v2/moment-labels";

/** Suggestions for the freeform eyebrow field (optional). */
export const JOURNEY_CATEGORY_PRESETS = [
  "Your Words",
  "Your Sounds",
  "Your Face",
  "Your World",
  "Your Name",
  "Your Rhythm",
  "Your Voice",
] as const;

export type JourneyNameStep = {
  id: string;
  kind: "name";
  prompt?: string;
  categoryLabel?: string;
};

/**
 * One customizable contribution prompt. Response channels are independent toggles —
 * text, audio, and/or video (at least one required).
 */
export type JourneyPromptStep = {
  id: string;
  kind: "prompt";
  prompt: string;
  categoryLabel?: string;
  allowText?: boolean;
  allowAudio?: boolean;
  allowVideo?: boolean;
  requireEmailCaptcha?: boolean;
};

export type JourneySoundStep = {
  id: string;
  kind: "sound";
  slotId: GardenSlotId;
  prompt: string;
  categoryLabel?: string;
  phaseLabel?: string;
  buttonLabel?: string;
  alternateSlotIds?: GardenSlotId[];
};

export type JourneyStep = JourneyNameStep | JourneyPromptStep | JourneySoundStep;

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

function readCategoryLabel(item: object): string | undefined {
  const raw = (item as { categoryLabel?: unknown }).categoryLabel;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed || undefined;
}

function readPrompt(item: object): string {
  return typeof (item as { prompt?: unknown }).prompt === "string"
    ? (item as { prompt: string }).prompt
    : "";
}

/** Normalize response toggles so at least one channel stays on. */
export function normalizePromptChannels(step: {
  allowText?: boolean;
  allowAudio?: boolean;
  allowVideo?: boolean;
}): Pick<JourneyPromptStep, "allowText" | "allowAudio" | "allowVideo"> {
  const allowText = step.allowText !== false;
  const allowAudio = Boolean(step.allowAudio);
  const allowVideo = Boolean(step.allowVideo);
  if (!allowText && !allowAudio && !allowVideo) {
    return { allowText: true, allowAudio: false, allowVideo: false };
  }
  return { allowText, allowAudio, allowVideo };
}

export function defaultCategoryLabelForStep(
  kind: JourneyStep["kind"],
  slotId?: GardenSlotId
): string {
  if (kind === "name") return "Your Name";
  if (kind === "prompt") return "Your Words";
  if (kind === "sound" && slotId) return gardenSlotMomentLabel(slotId);
  return "Your Sounds";
}

export function resolveCategoryLabel(step: JourneyStep): string {
  const custom = step.categoryLabel?.trim();
  if (custom) return custom;
  if (step.kind === "sound") return defaultCategoryLabelForStep("sound", step.slotId);
  if (step.kind === "prompt") {
    const channels = normalizePromptChannels(step);
    if (channels.allowAudio && !channels.allowText && !channels.allowVideo) return "Your Voice";
    if (channels.allowVideo && !channels.allowText && !channels.allowAudio) return "Your Face";
    return "Your Words";
  }
  return defaultCategoryLabelForStep(step.kind);
}

export function isAgentContributionStep(
  step: JourneyStep
): step is JourneyNameStep | JourneyPromptStep {
  return step.kind === "name" || step.kind === "prompt";
}

export function defaultJourneySteps(): JourneyStep[] {
  return [
    {
      id: newStepId(),
      kind: "name",
      prompt: DEFAULT_NAME_QUESTION_PROMPT,
      categoryLabel: "Your Name",
    },
    {
      id: newStepId(),
      kind: "prompt",
      prompt: "What's a word or phrase you want to plant in this Song Garden?",
      categoryLabel: "Your Words",
      allowText: true,
      allowAudio: false,
      allowVideo: false,
    },
    {
      id: newStepId(),
      kind: "sound",
      slotId: "stomp",
      prompt: "Add a stomp, clap, or snap.",
      categoryLabel: "Your Sounds",
      phaseLabel: defaultPhaseLabelForSlot("stomp"),
      alternateSlotIds: ["clap", "snap"],
    },
  ];
}

function promptFromLegacyChannels(
  id: string,
  prompt: string,
  categoryLabel: string | undefined,
  opts: {
    allowText?: boolean;
    allowAudio?: boolean;
    allowVideo?: boolean;
    requireEmailCaptcha?: boolean;
  }
): JourneyPromptStep {
  const channels = normalizePromptChannels(opts);
  let label = categoryLabel?.trim() || "";
  if (!label) {
    if (channels.allowAudio && !channels.allowText && !channels.allowVideo) label = "Your Voice";
    else if (channels.allowVideo && !channels.allowText && !channels.allowAudio) label = "Your Face";
    else label = "Your Words";
  }
  return {
    id,
    kind: "prompt",
    prompt,
    categoryLabel: label,
    ...channels,
    requireEmailCaptcha: Boolean(opts.requireEmailCaptcha) && channels.allowText,
  };
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
    const categoryLabel = readCategoryLabel(item as object);
    const prompt = readPrompt(item as object);

    if (kind === "name") {
      if (hasName) continue;
      hasName = true;
      steps.push({
        id,
        kind: "name",
        ...(prompt.trim() ? { prompt: prompt.trim() } : {}),
        categoryLabel: categoryLabel || "Your Name",
      });
      continue;
    }

    // Unified prompt + migrate legacy text/audio/video kinds.
    if (kind === "prompt" || kind === "text" || kind === "audio" || kind === "video") {
      let allowText = Boolean((item as { allowText?: unknown }).allowText);
      let allowAudio = Boolean((item as { allowAudio?: unknown }).allowAudio);
      let allowVideo = Boolean((item as { allowVideo?: unknown }).allowVideo);

      if (kind === "text") {
        // Old text steps: text on; audio/video were optional toggles.
        allowText = true;
        allowAudio = Boolean((item as { allowAudio?: unknown }).allowAudio);
        allowVideo = Boolean((item as { allowVideo?: unknown }).allowVideo);
      } else if (kind === "audio") {
        allowText = false;
        allowAudio = true;
        allowVideo = false;
      } else if (kind === "video") {
        allowText = false;
        allowAudio = false;
        allowVideo = true;
      } else if (kind === "prompt") {
        // If none of the new flags are present, default to text.
        const hasAnyFlag =
          (item as { allowText?: unknown }).allowText !== undefined ||
          (item as { allowAudio?: unknown }).allowAudio !== undefined ||
          (item as { allowVideo?: unknown }).allowVideo !== undefined;
        if (!hasAnyFlag) {
          allowText = true;
          allowAudio = false;
          allowVideo = false;
        }
      }

      steps.push(
        promptFromLegacyChannels(id, prompt, categoryLabel, {
          allowText,
          allowAudio,
          allowVideo,
          requireEmailCaptcha: Boolean((item as { requireEmailCaptcha?: unknown }).requireEmailCaptcha),
        })
      );
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
        prompt: prompt.trim() || defaultPromptForSlot(slotId),
        categoryLabel: categoryLabel || defaultCategoryLabelForStep("sound", slotId),
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
      categoryLabel: "Your Name",
    });
  }

  const items = brief?.askAboutItems?.filter(
    (item) => typeof item?.prompt === "string" && item.prompt.trim().length > 0
  );
  if (items?.length) {
    for (const item of items) {
      const allowAudio = Boolean(item.allowAudio);
      const allowVideo = Boolean(item.allowVideo);
      // Single media flag → media-only. Both flags → text with optional media (legacy).
      const allowText =
        (!allowAudio && !allowVideo) || (allowAudio && allowVideo);
      steps.push(
        promptFromLegacyChannels(newStepId(), item.prompt.trim(), undefined, {
          allowText,
          allowAudio,
          allowVideo,
          requireEmailCaptcha: Boolean(item.requireEmailCaptcha),
        })
      );
    }
  } else {
    const strings = brief?.askAbout?.filter(
      (q): q is string => typeof q === "string" && q.trim().length > 0
    );
    for (const prompt of strings ?? []) {
      steps.push(createJourneyPromptStep(prompt.trim()));
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
      categoryLabel: defaultCategoryLabelForStep("sound", step.slotId),
      phaseLabel: step.phaseLabel?.trim() || defaultPhaseLabelForSlot(step.slotId),
      ...(step.buttonLabel?.trim() ? { buttonLabel: step.buttonLabel.trim() } : {}),
      ...(step.alternateSlotIds?.length ? { alternateSlotIds: step.alternateSlotIds } : {}),
    });
  }

  return steps.length > 0 ? steps : defaultJourneySteps();
}

export function syncLegacyFromJourneySteps(
  journeySteps: JourneyStep[],
  prevBrief: AgentBrief | null | undefined,
  prevGarden: SongGardenConfig | null | undefined
): { agentBrief: AgentBrief; songGardenConfig: SongGardenConfig } {
  const normalized = normalizeJourneySteps(journeySteps);
  const nameStep = normalized.find((s): s is JourneyNameStep => s.kind === "name");
  const soundSteps = normalized.filter((s): s is JourneySoundStep => s.kind === "sound");

  const askAboutItems = normalized
    .filter((s): s is JourneyPromptStep => s.kind === "prompt")
    .filter((s) => s.prompt.trim().length > 0)
    .map((s) => {
      const channels = normalizePromptChannels(s);
      return {
        prompt: s.prompt.trim(),
        allowAudio: channels.allowAudio,
        allowVideo: channels.allowVideo,
        // Legacy field: media-only steps still need a turn; text optional is implied by flags.
        allowMedia: channels.allowAudio || channels.allowVideo,
        requireEmailCaptcha: Boolean(s.requireEmailCaptcha) && channels.allowText,
      };
    });

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

export function createJourneyPromptStep(prompt = ""): JourneyPromptStep {
  return {
    id: newStepId(),
    kind: "prompt",
    prompt,
    categoryLabel: "",
    allowText: true,
    allowAudio: false,
    allowVideo: false,
  };
}

export function createJourneyNameStep(prompt = DEFAULT_NAME_QUESTION_PROMPT): JourneyNameStep {
  return { id: newStepId(), kind: "name", prompt, categoryLabel: "Your Name" };
}

export function createJourneySoundStep(slotId: GardenSlotId): JourneySoundStep {
  return {
    id: newStepId(),
    kind: "sound",
    slotId,
    prompt: defaultPromptForSlot(slotId),
    categoryLabel: defaultCategoryLabelForStep("sound", slotId),
    phaseLabel: defaultPhaseLabelForSlot(slotId),
    ...(defaultButtonLabelForSlot(slotId) ? { buttonLabel: defaultButtonLabelForSlot(slotId) } : {}),
  };
}

/** @deprecated Use createJourneyPromptStep */
export function createJourneyTextStep(prompt = ""): JourneyPromptStep {
  return createJourneyPromptStep(prompt);
}

/** @deprecated Use createJourneyPromptStep with allowAudio */
export function createJourneyAudioStep(prompt = "Would you be willing to sing your phrase?"): JourneyPromptStep {
  return {
    id: newStepId(),
    kind: "prompt",
    prompt,
    categoryLabel: "Your Voice",
    allowText: false,
    allowAudio: true,
    allowVideo: false,
  };
}

/** @deprecated Use createJourneyPromptStep with allowVideo */
export function createJourneyVideoStep(prompt = "Share a short video."): JourneyPromptStep {
  return {
    id: newStepId(),
    kind: "prompt",
    prompt,
    categoryLabel: "Your Face",
    allowText: false,
    allowAudio: false,
    allowVideo: true,
  };
}
