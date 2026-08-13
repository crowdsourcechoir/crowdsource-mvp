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
  /** Helper line under the prompt (defaults to "Your first name is fine."). */
  responseHint?: string;
};

/** Per-prompt capture length (sound / voice / video). */
export const RECORD_SECONDS_MIN = 1;
export const RECORD_SECONDS_MAX = 60;
export const DEFAULT_FREE_SOUND_SECONDS = 10;
export const DEFAULT_VOICE_SECONDS = 20;
export const DEFAULT_VIDEO_SECONDS = 20;

/**
 * One customizable contribution prompt. Response channels are independent toggles —
 * text, voice (audio), video, and/or sound clip (at least one required).
 */
export type JourneyPromptStep = {
  id: string;
  kind: "prompt";
  prompt: string;
  categoryLabel?: string;
  allowText?: boolean;
  /**
   * Audio recording (mic). Optional `slotId` tags it for canvas/composition
   * (tap, clap, choir…). Omit slotId for an open recording — same capture either way.
   * `allowSound` is a legacy alias kept in sync with allowAudio.
   */
  allowAudio?: boolean;
  allowVideo?: boolean;
  /** @deprecated Alias of allowAudio — normalized to match allowAudio. */
  allowSound?: boolean;
  /** Optional composition pad. Omit / empty = free sound with custom length. */
  slotId?: GardenSlotId;
  phaseLabel?: string;
  buttonLabel?: string;
  alternateSlotIds?: GardenSlotId[];
  /**
   * Max recording length in seconds for sound / voice / video on this prompt.
   * Sound pads use their short defaults only when this is unset.
   */
  recordSeconds?: number;
  requireEmailCaptcha?: boolean;
};

export function clampRecordSeconds(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  const n = Math.round(raw);
  if (n < RECORD_SECONDS_MIN || n > RECORD_SECONDS_MAX) return undefined;
  return n;
}

export function readRecordSeconds(item: object): number | undefined {
  return clampRecordSeconds((item as { recordSeconds?: unknown }).recordSeconds);
}

/** Resolve capture duration for a prompt channel. */
export function resolvePromptRecordMs(
  step: Pick<JourneyPromptStep, "recordSeconds" | "slotId" | "allowSound" | "allowAudio" | "allowVideo">,
  channel: "sound" | "audio" | "video"
): number {
  const custom = clampRecordSeconds(step.recordSeconds);
  if (custom != null) return custom * 1000;

  if (channel === "sound") {
    const slotId = isGardenSlotId(step.slotId) ? step.slotId : null;
    if (slotId) {
      const slot = gardenSlotById(slotId);
      if (slot) return slot.recordMs;
    }
    return DEFAULT_FREE_SOUND_SECONDS * 1000;
  }
  if (channel === "video") return DEFAULT_VIDEO_SECONDS * 1000;
  return DEFAULT_VOICE_SECONDS * 1000;
}

/** @deprecated Legacy shape — migrated to JourneyPromptStep with allowSound. */
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

export type JourneyStep = JourneyNameStep | JourneyPromptStep;

export type ResolvedJourneySoundStep = {
  id: string;
  /** Null when this is a free sound (no composition pad). */
  slotId: GardenSlotId | null;
  /** True when there is no stomp/clap/… pad — just a timed recording. */
  isFree: boolean;
  prompt: string;
  categoryLabel?: string;
  phaseLabel?: string;
  buttonLabel?: string;
  alternateSlotIds?: GardenSlotId[];
  slot: GardenSlotDef;
  alternateSlots?: GardenSlotDef[];
  recordMs: number;
};

function newStepId(): string {
  return `js_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const VALID_SLOT_IDS = new Set<string>(Object.keys(GARDEN_SLOT_ADMIN_LABELS));

function isGardenSlotId(id: unknown): id is GardenSlotId {
  return typeof id === "string" && VALID_SLOT_IDS.has(id);
}

/** Preserve spaces while editing — do not trim. */
function readCategoryLabel(item: object): string | undefined {
  const raw = (item as { categoryLabel?: unknown }).categoryLabel;
  return typeof raw === "string" ? raw : undefined;
}

/** Preserve spaces while editing — do not trim. */
function readPrompt(item: object): string {
  return typeof (item as { prompt?: unknown }).prompt === "string"
    ? (item as { prompt: string }).prompt
    : "";
}

function readButtonLabel(item: object): string | undefined {
  const raw = (item as { buttonLabel?: unknown }).buttonLabel;
  return typeof raw === "string" ? raw : undefined;
}

function readPhaseLabel(item: object): string | undefined {
  const raw = (item as { phaseLabel?: unknown }).phaseLabel;
  return typeof raw === "string" ? raw : undefined;
}

function readAlternateSlotIds(item: object, slotId: GardenSlotId): GardenSlotId[] | undefined {
  const raw = (item as { alternateSlotIds?: unknown }).alternateSlotIds;
  if (!Array.isArray(raw)) return undefined;
  const ids = raw.filter((alt): alt is GardenSlotId => isGardenSlotId(alt) && alt !== slotId);
  return ids.length ? ids : undefined;
}

/** Normalize response toggles so at least one channel stays on. */
export function normalizePromptChannels(step: {
  allowText?: boolean;
  allowAudio?: boolean;
  allowVideo?: boolean;
  allowSound?: boolean;
}): {
  allowText: boolean;
  allowAudio: boolean;
  allowVideo: boolean;
  allowSound: boolean;
} {
  // Sound is legacy alias for Audio — one recording channel, optional composition pad.
  const wantsAudio = Boolean(step.allowAudio) || Boolean(step.allowSound);
  const allowAudio = wantsAudio;
  const allowSound = wantsAudio;
  const allowVideo = Boolean(step.allowVideo);
  let allowText: boolean;
  if (step.allowText === false) allowText = false;
  else if (step.allowText === true) allowText = true;
  else allowText = !allowAudio && !allowVideo;

  if (!allowText && !allowAudio && !allowVideo) {
    return { allowText: true, allowAudio: false, allowVideo: false, allowSound: false };
  }
  return { allowText, allowAudio, allowVideo, allowSound };
}

/** True when this prompt records audio (garden clip; optional composition category). */
export function promptAllowsAudioRecording(step: {
  allowAudio?: boolean;
  allowSound?: boolean;
}): boolean {
  return normalizePromptChannels(step).allowAudio;
}

export function defaultCategoryLabelForStep(
  kind: "name" | "prompt" | "sound",
  slotId?: GardenSlotId
): string {
  if (kind === "name") return "Your Name";
  if (kind === "sound" && slotId) return gardenSlotMomentLabel(slotId);
  if (kind === "sound") return "Your Sounds";
  return "Your Words";
}

export function resolveCategoryLabel(step: JourneyStep): string {
  const custom = step.categoryLabel?.trim();
  if (custom) return custom;
  if (step.kind === "prompt") {
    const channels = normalizePromptChannels(step);
    if (channels.allowAudio && !channels.allowText && !channels.allowVideo) {
      return step.slotId
        ? defaultCategoryLabelForStep("sound", step.slotId)
        : "Your Sounds";
    }
    if (channels.allowVideo && !channels.allowText && !channels.allowAudio) {
      return "Your Face";
    }
    return "Your Words";
  }
  return defaultCategoryLabelForStep("name");
}

/** True when the step needs the agent interview / text-media conversation path. */
export function isAgentContributionStep(
  step: JourneyStep
): step is JourneyNameStep | JourneyPromptStep {
  if (step.kind === "name") return true;
  if (step.kind !== "prompt") return false;
  const channels = normalizePromptChannels(step);
  // Audio recordings plant in the garden (SoundMomentPad) — not the agent interview.
  return channels.allowText || channels.allowVideo;
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
      allowSound: false,
    },
    createJourneySoundPromptStep(undefined, {
      prompt: "Record a sound from the world around you.",
      categoryLabel: "Your Sounds",
      buttonLabel: "Add Your World",
      recordSeconds: DEFAULT_FREE_SOUND_SECONDS,
    }),
  ];
}

function buildPromptStep(
  id: string,
  prompt: string,
  categoryLabel: string | undefined,
  opts: {
    allowText?: boolean;
    allowAudio?: boolean;
    allowVideo?: boolean;
    allowSound?: boolean;
    requireEmailCaptcha?: boolean;
    slotId?: GardenSlotId | null;
    phaseLabel?: string;
    buttonLabel?: string;
    alternateSlotIds?: GardenSlotId[];
    recordSeconds?: number;
  }
): JourneyPromptStep {
  const channels = normalizePromptChannels(opts);
  const recordSeconds = clampRecordSeconds(opts.recordSeconds);
  const hasPad = channels.allowAudio && isGardenSlotId(opts.slotId);
  const slotId = hasPad ? (opts.slotId as GardenSlotId) : undefined;
  return {
    id,
    kind: "prompt",
    prompt,
    categoryLabel: typeof categoryLabel === "string" ? categoryLabel : "",
    ...channels,
    requireEmailCaptcha: Boolean(opts.requireEmailCaptcha) && channels.allowText,
    ...(recordSeconds != null
      ? { recordSeconds }
      : channels.allowAudio && !slotId
        ? { recordSeconds: DEFAULT_FREE_SOUND_SECONDS }
        : {}),
    ...(channels.allowAudio
      ? {
          ...(slotId ? { slotId } : {}),
          phaseLabel:
            typeof opts.phaseLabel === "string" && opts.phaseLabel.length > 0
              ? opts.phaseLabel
              : slotId
                ? defaultPhaseLabelForSlot(slotId)
                : "YOUR SOUND",
          buttonLabel:
            typeof opts.buttonLabel === "string"
              ? opts.buttonLabel
              : slotId
                ? defaultButtonLabelForSlot(slotId) || "Record"
                : "Record",
          ...(slotId && opts.alternateSlotIds?.length
            ? { alternateSlotIds: opts.alternateSlotIds }
            : {}),
        }
      : {}),
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
      const responseHint =
        typeof (item as { responseHint?: unknown }).responseHint === "string"
          ? (item as { responseHint: string }).responseHint
          : undefined;
      steps.push({
        id,
        kind: "name",
        ...(typeof (item as { prompt?: unknown }).prompt === "string" ? { prompt } : {}),
        categoryLabel: typeof categoryLabel === "string" ? categoryLabel : "Your Name",
        ...(responseHint !== undefined ? { responseHint } : {}),
      });
      continue;
    }

    // Unified prompt + migrate legacy text/audio/video/sound kinds.
    if (kind === "prompt" || kind === "text" || kind === "audio" || kind === "video") {
      let allowText = Boolean((item as { allowText?: unknown }).allowText);
      let allowAudio = Boolean((item as { allowAudio?: unknown }).allowAudio);
      let allowVideo = Boolean((item as { allowVideo?: unknown }).allowVideo);
      let allowSound = Boolean((item as { allowSound?: unknown }).allowSound);

      if (kind === "text") {
        allowText = true;
        allowAudio = Boolean((item as { allowAudio?: unknown }).allowAudio);
        allowVideo = Boolean((item as { allowVideo?: unknown }).allowVideo);
        allowSound = false;
      } else if (kind === "audio") {
        allowText = false;
        allowAudio = true;
        allowVideo = false;
        allowSound = false;
      } else if (kind === "video") {
        allowText = false;
        allowAudio = false;
        allowVideo = true;
        allowSound = false;
      } else if (kind === "prompt") {
        const hasAnyFlag =
          (item as { allowText?: unknown }).allowText !== undefined ||
          (item as { allowAudio?: unknown }).allowAudio !== undefined ||
          (item as { allowVideo?: unknown }).allowVideo !== undefined ||
          (item as { allowSound?: unknown }).allowSound !== undefined;
        if (!hasAnyFlag) {
          allowText = true;
          allowAudio = false;
          allowVideo = false;
          allowSound = false;
        } else {
          // Preserve explicit false for allowText when other flags are present.
          if ((item as { allowText?: unknown }).allowText === false) allowText = false;
          else if ((item as { allowText?: unknown }).allowText === true) allowText = true;
          else allowText = Boolean((item as { allowText?: unknown }).allowText);
        }
      }

      let slotId: GardenSlotId | undefined = isGardenSlotId(
        (item as { slotId?: unknown }).slotId
      )
        ? ((item as { slotId: GardenSlotId }).slotId)
        : undefined;
      const recordSeconds = readRecordSeconds(item as object);
      // Composition category is optional on any audio recording.
      if (allowAudio || allowSound) {
        if (slotId && seenSlots.has(slotId)) {
          slotId = undefined;
        } else if (slotId) {
          seenSlots.add(slotId);
        }
      } else {
        slotId = undefined;
      }

      steps.push(
        buildPromptStep(id, prompt, categoryLabel, {
          allowText,
          allowAudio: allowAudio || allowSound,
          allowVideo,
          allowSound: allowAudio || allowSound,
          requireEmailCaptcha: Boolean((item as { requireEmailCaptcha?: unknown }).requireEmailCaptcha),
          slotId: slotId ?? null,
          phaseLabel: readPhaseLabel(item as object),
          buttonLabel: readButtonLabel(item as object),
          alternateSlotIds: slotId ? readAlternateSlotIds(item as object, slotId) : undefined,
          recordSeconds:
            recordSeconds ??
            ((allowAudio || allowSound) && !slotId ? DEFAULT_FREE_SOUND_SECONDS : undefined),
        })
      );
      continue;
    }

    if (kind === "sound") {
      const slotId = (item as { slotId?: unknown }).slotId;
      if (!isGardenSlotId(slotId) || seenSlots.has(slotId)) continue;
      seenSlots.add(slotId);
      const recordSeconds = readRecordSeconds(item as object);
      steps.push(
        buildPromptStep(
          id,
          prompt.length > 0 ? prompt : defaultPromptForSlot(slotId),
          typeof categoryLabel === "string" ? categoryLabel : gardenSlotMomentLabel(slotId),
          {
            allowText: false,
            allowAudio: true,
            allowVideo: false,
            allowSound: true,
            slotId,
            phaseLabel: readPhaseLabel(item as object),
            buttonLabel: readButtonLabel(item as object),
            alternateSlotIds: readAlternateSlotIds(item as object, slotId),
            recordSeconds,
          }
        )
      );
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
      const allowText = (!allowAudio && !allowVideo) || (allowAudio && allowVideo);
      steps.push(
        buildPromptStep(newStepId(), item.prompt.trim(), undefined, {
          allowText,
          allowAudio,
          allowVideo,
          allowSound: false,
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
    steps.push(
      createJourneySoundPromptStep(step.slotId, {
        prompt: step.prompt?.trim() || defaultPromptForSlot(step.slotId),
        categoryLabel: gardenSlotMomentLabel(step.slotId),
        phaseLabel: step.phaseLabel?.trim() || defaultPhaseLabelForSlot(step.slotId),
        buttonLabel: step.buttonLabel?.trim() || defaultButtonLabelForSlot(step.slotId) || "Add sound",
        alternateSlotIds: step.alternateSlotIds,
      })
    );
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

  const askAboutItems = normalized
    .filter((s): s is JourneyPromptStep => s.kind === "prompt")
    .filter((s) => {
      const channels = normalizePromptChannels(s);
      return (
        s.prompt.trim().length > 0 &&
        (channels.allowText || channels.allowVideo)
      );
    })
    .map((s) => {
      const channels = normalizePromptChannels(s);
      return {
        prompt: s.prompt.trim(),
        allowAudio: false,
        allowVideo: channels.allowVideo,
        allowMedia: channels.allowVideo,
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

  const soundPrompts = normalized.filter(
    (s): s is JourneyPromptStep =>
      s.kind === "prompt" &&
      promptAllowsAudioRecording(s) &&
      isGardenSlotId(s.slotId)
  );

  const steps: SongGardenStepConfig[] = soundPrompts.map((s) => {
    const slotId = s.slotId as GardenSlotId;
    return {
      slotId,
      enabled: true,
      prompt: s.prompt.trim() || defaultPromptForSlot(slotId),
      phaseLabel: s.phaseLabel?.trim() || defaultPhaseLabelForSlot(slotId),
      ...(s.buttonLabel?.trim() ? { buttonLabel: s.buttonLabel.trim() } : {}),
      ...(s.alternateSlotIds?.length ? { alternateSlotIds: s.alternateSlotIds } : {}),
    };
  });

  const songGardenConfig: SongGardenConfig = {
    soundTransitionMessage:
      prevGarden?.soundTransitionMessage?.trim() ||
      "Now let's build the sounds of the experience.",
    steps,
    journeySteps: normalized,
    ...(typeof prevGarden?.completionEyebrow === "string"
      ? { completionEyebrow: prevGarden.completionEyebrow }
      : {}),
  };

  return { agentBrief, songGardenConfig };
}

export function resolveSoundStep(step: JourneyPromptStep): ResolvedJourneySoundStep | null {
  const channels = normalizePromptChannels(step);
  if (!channels.allowAudio) return null;

  const padId = isGardenSlotId(step.slotId) ? step.slotId : null;
  const isFree = !padId;
  const recordMs = resolvePromptRecordMs(step, "sound");

  let slot: GardenSlotDef;
  if (padId) {
    const base = gardenSlotById(padId);
    if (!base) return null;
    slot = { ...base, recordMs };
  } else {
    slot = {
      id: "anything_else",
      label: (step.buttonLabel?.trim() || "RECORD").toUpperCase().slice(0, 14),
      category: "other",
      recordMs,
    };
  }

  const alternateSlots =
    padId && step.alternateSlotIds
      ? step.alternateSlotIds
          .map((id) => {
            const base = gardenSlotById(id);
            return base ? { ...base, recordMs } : null;
          })
          .filter((s): s is GardenSlotDef => s != null)
      : undefined;

  return {
    id: step.id,
    slotId: padId,
    isFree,
    prompt: step.prompt,
    categoryLabel: step.categoryLabel,
    phaseLabel:
      step.phaseLabel ||
      (padId ? defaultPhaseLabelForSlot(padId) : "YOUR SOUND"),
    buttonLabel:
      step.buttonLabel ||
      (padId ? defaultButtonLabelForSlot(padId) || "Record" : "Record"),
    ...(padId && step.alternateSlotIds?.length ? { alternateSlotIds: step.alternateSlotIds } : {}),
    slot,
    ...(alternateSlots?.length ? { alternateSlots } : {}),
    recordMs,
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
    allowSound: false,
  };
}

export function createJourneyNameStep(prompt = DEFAULT_NAME_QUESTION_PROMPT): JourneyNameStep {
  return {
    id: newStepId(),
    kind: "name",
    prompt,
    categoryLabel: "Your Name",
    responseHint: "",
  };
}

export function createJourneySoundPromptStep(
  slotId?: GardenSlotId,
  overrides?: {
    prompt?: string;
    categoryLabel?: string;
    phaseLabel?: string;
    buttonLabel?: string;
    alternateSlotIds?: GardenSlotId[];
    recordSeconds?: number;
  }
): JourneyPromptStep {
  const pad = slotId && isGardenSlotId(slotId) ? slotId : undefined;
  return buildPromptStep(
    newStepId(),
    overrides?.prompt ?? (pad ? defaultPromptForSlot(pad) : "Record a sound for this garden."),
    overrides?.categoryLabel ?? (pad ? gardenSlotMomentLabel(pad) : "Your Sounds"),
    {
      allowText: false,
      allowAudio: true,
      allowVideo: false,
      allowSound: true,
      slotId: pad ?? null,
      phaseLabel: overrides?.phaseLabel,
      buttonLabel:
        overrides?.buttonLabel ?? (pad ? defaultButtonLabelForSlot(pad) ?? "Record" : "Record"),
      alternateSlotIds: pad ? overrides?.alternateSlotIds : undefined,
      recordSeconds:
        overrides?.recordSeconds ?? (pad ? undefined : DEFAULT_FREE_SOUND_SECONDS),
    }
  );
}

/** @deprecated Use createJourneySoundPromptStep */
export function createJourneySoundStep(slotId: GardenSlotId): JourneyPromptStep {
  return createJourneySoundPromptStep(slotId);
}

/** @deprecated Use createJourneyPromptStep */
export function createJourneyTextStep(prompt = ""): JourneyPromptStep {
  return createJourneyPromptStep(prompt);
}

/** @deprecated Use createJourneyPromptStep with allowAudio */
export function createJourneyAudioStep(
  prompt = "Would you be willing to sing your phrase?"
): JourneyPromptStep {
  return createJourneySoundPromptStep(undefined, {
    prompt,
    categoryLabel: "Your Sounds",
    buttonLabel: "Record",
    recordSeconds: DEFAULT_VOICE_SECONDS,
  });
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
    allowSound: false,
  };
}
