"use client";

import { useState, FormEvent, useEffect } from "react";
import AddressMap from "./AddressMap";
import { getAgentThemes } from "@/data/agentInterview";
import type { AgentTheme } from "@/data/agentInterview";
import type { AgentBrief } from "@/data/agentInterview";
import { normalizeAskAboutEmailCaptcha } from "@/lib/agent-brief-email-captcha";
import { DEFAULT_NAME_QUESTION_PROMPT } from "@/lib/participant-journey/steps";
import { DEFAULT_CONTRIBUTION_CONSENT_TEXT } from "@/lib/participant-journey/contribution-consent";
import {
  defaultSongGardenConfig,
  GARDEN_SLOT_ADMIN_LABELS,
  normalizeSongGardenConfig,
  type SongGardenConfig,
} from "@/lib/songgarden/config";
import {
  createJourneyNameStep,
  createJourneyPromptStep,
  DEFAULT_FREE_SOUND_SECONDS,
  DEFAULT_VIDEO_SECONDS,
  defaultJourneySteps,
  normalizeJourneySteps,
  normalizePromptChannels,
  RECORD_SECONDS_MAX,
  RECORD_SECONDS_MIN,
  clampRecordSeconds,
  resolveJourneySteps,
  syncLegacyFromJourneySteps,
  type JourneyPromptStep,
  type JourneyStep,
} from "@/lib/songgarden/journey-steps";
import { COMPLETION_MOMENT_LABEL } from "@/lib/song-garden-v2/moment-labels";
import { JOURNEY_GARDEN_SLOT_IDS, type GardenSlotId } from "@/lib/songgarden/garden-slots";
import { canonicalEventSlug, publicEventPath } from "@/lib/event-slug-aliases";
import {
  normalizeWorldConfigInput,
  WORLD_ANIMATION_PRESETS,
  type WorldConfig,
} from "@/lib/song-garden-v2/world-config";
import FileDropZone from "@/components/ui/FileDropZone";
import {
  clearEventFormDraft,
  journeyStepsHaveContent,
  readEventFormDraft,
  shouldPersistDraft,
  writeEventFormDraft,
} from "@/lib/event-form-draft";

export type EventFormValues = {
  title: string;
  slug: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  prompt: string;
  heroImage: string;
  heroImageMode: "bw" | "color";
  landingHeadline: string;
  landingCopy: string;
  ctaText: string;
  anthemCompletionMessage: string;
  songGardenConfig: SongGardenConfig;
  agentThemeId: string | null;
  agentBrief: AgentBrief | null;
  /** Unified ordered prompts (name / text / sound). */
  journeySteps: JourneyStep[];
  /** Song Garden V2 world config. Optional — every field falls back to a derived default when empty. */
  worldConfig: WorldConfig | null;
};

const EMPTY_WORLD_CONFIG_FORM: WorldConfig = {
  title: "",
  heroArtworkUrl: null,
  logoUrl: null,
  primaryColor: "#1a0f2d",
  accentColor: "#CFFF81",
  animationPreset: "particles",
  ambientSoundtrackUrl: null,
  aiArtworkPrompt: null,
  worldSceneStages: [],
  worldStoryboard: [],
  presenceSimulationEnabled: true,
};

type EventFormProps = {
  onSubmit: (values: EventFormValues) => Promise<void> | void;
  initialValues?: Partial<EventFormValues>;
  submitLabel?: string;
  /** Shown after a successful submit (e.g. before redirect). */
  submitSuccessMessage?: string;
  /** Existing event id — used for hero signed-upload path naming. */
  eventId?: string;
};

const initialValues: EventFormValues = {
  title: "",
  slug: "",
  description: "",
  date: "",
  time: "",
  venue: "",
  address: "",
  // Used only for the "no agent" public event view.
  // The agent interview is the default, so this is safe as a hidden default.
  prompt: "Let's do it.",
  heroImage: "",
  heroImageMode: "bw",
  landingHeadline: "We're crowdsourcing a song for this event. Want to help create it?",
  landingCopy: "",
  ctaText: "Let's make an anthem",
  anthemCompletionMessage: "Thanks! Your answers will help shape the song we're making.",
  songGardenConfig: defaultSongGardenConfig(),
  agentThemeId: null,
  agentBrief: null,
  journeySteps: defaultJourneySteps(),
  worldConfig: null,
};

const MONTH_ABBREV = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const TEMPLATE_DEFAULTS: Record<
  "birthday" | "fundraiser" | "other",
  {
    eventType: string;
    emotionalArc: string;
    askAboutItems: Array<{
      prompt: string;
      allowAudio?: boolean;
      allowVideo?: boolean;
      requireEmailCaptcha?: boolean;
    }>;
  }
> = {
  birthday: {
    eventType: "birthday",
    emotionalArc: "fun -> heartfelt -> celebratory",
    askAboutItems: [
      { prompt: "In one word, how would you describe [person]?" },
      { prompt: "What's one thing you love or admire about [person]?" },
      { prompt: "What's a funny or \"classic [person]\" moment you've witnessed?" },
      { prompt: "What is [person]'s superpower?" },
      { prompt: "What do you wish for [person] in the next 50 years?" },
      { prompt: "Finish this line: \"[person], you are...\"" },
      { prompt: "What else would you like to say about [person]?", allowAudio: true, allowVideo: true },
      { prompt: "What email should we send your anthem to?", requireEmailCaptcha: true },
    ],
  },
  fundraiser: {
    eventType: "fundraiser",
    emotionalArc: "gratitude -> impact -> hope",
    askAboutItems: [
      { prompt: "Why this cause matters to you" },
      { prompt: "A moment of impact you've seen" },
      { prompt: "What support you hope to inspire" },
      { prompt: "What email should we send your anthem to?", requireEmailCaptcha: true },
    ],
  },
  other: {
    eventType: "other",
    emotionalArc: "engaging -> reflective -> inspiring",
    askAboutItems: [
      { prompt: "How you're connected to this event" },
      { prompt: "A standout moment or insight" },
      { prompt: "What message you'd like to share" },
      { prompt: "What email should we send your anthem to?", requireEmailCaptcha: true },
    ],
  },
};
const SAVED_AGENT_TEMPLATES_KEY = "csc_agent_saved_templates_v1";

type SavedAgentTemplate = {
  id: string;
  name: string;
  eventType: "birthday" | "fundraiser" | "other" | string;
  whoWhat?: string;
  emotionalArc?: string;
  collectName?: boolean;
  nameQuestionPrompt?: string;
  askAboutItems: Array<{
    prompt: string;
    allowAudio?: boolean;
    allowVideo?: boolean;
    requireEmailCaptcha?: boolean;
  }>;
};

function formatDateForSlug(dateStr: string): string {
  if (!dateStr) return "";
  // Parse as local date (YYYY-MM-DD) so slug matches calendar day; avoid UTC midnight shifting to previous day
  const parts = dateStr.split("-").map(Number);
  const [, month1, day] = parts;
  if (!month1 || !day || month1 < 1 || month1 > 12) return "";
  const month = MONTH_ABBREV[month1 - 1];
  return `csc-${month}${day}`;
}

export default function EventForm({
  onSubmit,
  initialValues: initialProp,
  submitLabel = "Create Event",
  submitSuccessMessage = "Event created.",
  eventId,
}: EventFormProps) {
  const [values, setValues] = useState<EventFormValues>(() => {
    const merged = {
      ...initialValues,
      ...initialProp,
      songGardenConfig: normalizeSongGardenConfig(
        initialProp?.songGardenConfig ?? initialValues.songGardenConfig
      ),
      worldConfig: initialProp?.worldConfig ?? initialValues.worldConfig,
    };
    const journeySteps =
      normalizeJourneySteps(initialProp?.journeySteps).length > 0
        ? normalizeJourneySteps(initialProp?.journeySteps)
        : resolveJourneySteps({
            id: "draft",
            slug: merged.slug,
            title: merged.title,
            description: merged.description,
            date: merged.date,
            time: merged.time,
            venue: merged.venue,
            address: merged.address,
            prompt: merged.prompt,
            heroImage: merged.heroImage,
            agentBrief: merged.agentBrief,
            songGardenConfig: merged.songGardenConfig,
            journeySteps: initialProp?.journeySteps,
          });
    return { ...merged, journeySteps };
  });
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [themes, setThemes] = useState<AgentTheme[]>([]);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<SavedAgentTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");

  // AI storyboard generation (Runway) — see app/api/events/[id]/generate-storyboard/route.ts.
  const [runwayStatus, setRunwayStatus] = useState<{
    checked: boolean;
    configured: boolean;
    creditBalance?: number;
    tier?: string;
    error?: string;
  } | null>(null);
  const [aiVibePrompt, setAiVibePrompt] = useState<string>(
    () => initialProp?.worldConfig?.aiArtworkPrompt?.trim() || ""
  );
  /** Place/atmosphere refs for storyboard AI (Runway uses up to 3). */
  const [aiReferencePhotos, setAiReferencePhotos] = useState<string[]>([]);
  const [uploadingAiRefs, setUploadingAiRefs] = useState(false);
  const [aiFrameCount, setAiFrameCount] = useState<number>(4);
  const [aiGenerating, setAiGenerating] = useState(false);
  /** When set, only that storyboard frame index is regenerating. */
  const [aiRegeneratingFrame, setAiRegeneratingFrame] = useState<number | null>(null);
  const [aiGenError, setAiGenError] = useState<string | null>(null);
  const [aiGenNotice, setAiGenNotice] = useState<string | null>(null);

  useEffect(() => {
    getAgentThemes().then(setThemes).catch(() => setThemes([]));
  }, []);

  // Create flow: restore unsaved journey prompts after a timeout / failed create.
  useEffect(() => {
    if (eventId) return;
    if (journeyStepsHaveContent(initialProp?.journeySteps)) return;
    const draft = readEventFormDraft();
    if (!draft || !shouldPersistDraft(draft)) return;
    setValues((v) => ({
      ...v,
      title: draft.title || v.title,
      slug: draft.slug || v.slug,
      description: draft.description || v.description,
      date: draft.date || v.date,
      time: draft.time || v.time,
      venue: draft.venue || v.venue,
      address: draft.address || v.address,
      prompt: draft.prompt || v.prompt,
      landingHeadline: draft.landingHeadline || v.landingHeadline,
      landingCopy: draft.landingCopy || v.landingCopy,
      ctaText: draft.ctaText || v.ctaText,
      anthemCompletionMessage: draft.anthemCompletionMessage || v.anthemCompletionMessage,
      agentThemeId: draft.agentThemeId ?? v.agentThemeId,
      agentBrief: draft.agentBrief ?? v.agentBrief,
      songGardenConfig: draft.songGardenConfig
        ? normalizeSongGardenConfig({ ...draft.songGardenConfig, journeySteps: draft.journeySteps })
        : v.songGardenConfig,
      journeySteps: draft.journeySteps,
    }));
  }, [eventId, initialProp?.journeySteps]);

  // Autosave prompts so Restore bloom / refresh don't lose the journey.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      !shouldPersistDraft({
        title: values.title,
        slug: values.slug,
        journeySteps: values.journeySteps,
      })
    ) {
      return;
    }
    const t = window.setTimeout(() => {
      writeEventFormDraft({
        eventId,
        slug: values.slug,
        title: values.title,
        description: values.description,
        date: values.date,
        time: values.time,
        venue: values.venue,
        address: values.address,
        prompt: values.prompt,
        landingHeadline: values.landingHeadline,
        landingCopy: values.landingCopy,
        ctaText: values.ctaText,
        anthemCompletionMessage: values.anthemCompletionMessage,
        agentThemeId: values.agentThemeId,
        agentBrief: values.agentBrief,
        songGardenConfig: values.songGardenConfig,
        journeySteps: values.journeySteps,
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [
    eventId,
    values.slug,
    values.title,
    values.description,
    values.date,
    values.time,
    values.venue,
    values.address,
    values.prompt,
    values.landingHeadline,
    values.landingCopy,
    values.ctaText,
    values.anthemCompletionMessage,
    values.agentThemeId,
    values.agentBrief,
    values.songGardenConfig,
    values.journeySteps,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(SAVED_AGENT_TEMPLATES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSavedTemplates(
          parsed.filter((t) => t && typeof t.name === "string" && Array.isArray(t.askAboutItems))
        );
      }
    } catch {
      setSavedTemplates([]);
    }
  }, []);

  useEffect(() => {
    if (values.agentThemeId || themes.length === 0) return;
    const preferred =
      themes.find((t) => t.key === "conference") ??
      themes.find((t) => t.key === "birthday") ??
      themes.find((t) => t.key === "fundraiser") ??
      themes[0];
    if (!preferred) return;
    setValues((v) => ({ ...v, agentThemeId: preferred.id }));
  }, [themes, values.agentThemeId]);

  useEffect(() => {
    if (values.agentBrief) return;
    setValues((v) => ({
      ...v,
      agentBrief: {
        eventType: "custom",
        collectName: true,
        nameQuestionPrompt: DEFAULT_NAME_QUESTION_PROMPT,
        requireContributionConsent: true,
        contributionConsentText: DEFAULT_CONTRIBUTION_CONSENT_TEXT,
        askAboutItems: [],
        askAbout: [],
      },
    }));
    // Intentionally run once so new events start in custom mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (slugManuallyEdited || !values.date) return;
    setValues((v) => ({ ...v, slug: formatDateForSlug(values.date) }));
  }, [values.date, slugManuallyEdited]);

  function setJourneySteps(next: JourneyStep[]) {
    // Normalize only when adding/removing/reordering structure — not on every keystroke
    // (trimming would swallow spaces in eyebrow/prompt fields).
    setValues((v) => ({ ...v, journeySteps: normalizeJourneySteps(next) }));
  }

  function updateJourneyStep(index: number, patch: Partial<JourneyStep>) {
    setValues((v) => {
      const next = [...v.journeySteps];
      const cur = next[index];
      if (!cur) return v;
      const merged = { ...cur, ...patch } as JourneyStep;
      // Explicit undefined clears optional fields (e.g. storyboardFrameIndex → Auto).
      for (const key of Object.keys(patch) as Array<keyof JourneyStep>) {
        if (patch[key] === undefined) {
          delete (merged as Record<string, unknown>)[key as string];
        }
      }
      next[index] = merged;
      return { ...v, journeySteps: next };
    });
  }

  function moveJourneyStep(index: number, dir: -1 | 1) {
    setValues((v) => {
      const next = [...v.journeySteps];
      const j = index + dir;
      if (j < 0 || j >= next.length) return v;
      const tmp = next[index];
      next[index] = next[j];
      next[j] = tmp;
      return { ...v, journeySteps: next };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const journeySteps = normalizeJourneySteps(values.journeySteps);
    if (journeySteps.length === 0) {
      setSubmitError("Add at least one journey step (prompt or name).");
      return;
    }
    const { agentBrief: syncedBrief, songGardenConfig: syncedGarden } = syncLegacyFromJourneySteps(
      journeySteps,
      values.agentBrief,
      {
        ...(values.songGardenConfig ?? defaultSongGardenConfig()),
        completionEyebrow: values.songGardenConfig?.completionEyebrow,
      }
    );
    const brief: AgentBrief = {
      ...syncedBrief,
      eventType: values.agentBrief?.eventType ?? syncedBrief.eventType,
      whoWhat: values.agentBrief?.whoWhat,
      emotionalArc: values.agentBrief?.emotionalArc,
      requireContributionConsent: values.agentBrief?.requireContributionConsent !== false,
      contributionConsentText:
        values.agentBrief?.contributionConsentText?.trim() || DEFAULT_CONTRIBUTION_CONSENT_TEXT,
      askAboutItems: normalizeAskAboutEmailCaptcha(syncedBrief.askAboutItems ?? []),
      askAbout: normalizeAskAboutEmailCaptcha(syncedBrief.askAboutItems ?? []).map((i) => i.prompt),
    };
    setIsSubmitting(true);
    try {
      const songGardenConfig = normalizeSongGardenConfig({
        ...syncedGarden,
        journeySteps,
      });
      // Keep draft until the API confirms — clears only after success.
      writeEventFormDraft({
        eventId,
        slug: values.slug,
        title: values.title,
        description: values.description,
        date: values.date,
        time: values.time,
        venue: values.venue,
        address: values.address,
        prompt: values.prompt,
        landingHeadline: values.landingHeadline,
        landingCopy: values.landingCopy,
        ctaText: values.ctaText,
        anthemCompletionMessage: values.anthemCompletionMessage,
        agentThemeId: values.agentThemeId,
        agentBrief: brief,
        songGardenConfig,
        journeySteps,
      });
      await onSubmit({
        ...values,
        journeySteps,
        agentBrief: brief,
        songGardenConfig,
        worldConfig: normalizeWorldConfigInput({
          ...(values.worldConfig ?? EMPTY_WORLD_CONFIG_FORM),
          // Vibe lives in local state for the AI controls — always fold it into the saved world.
          aiArtworkPrompt: aiVibePrompt.trim() || null,
        }),
      });
      clearEventFormDraft();
      setSuccess(true);
    } catch (err) {
      setSuccess(false);
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function setBrief<K extends keyof AgentBrief>(key: K, value: AgentBrief[K]) {
    setValues((v) => ({
      ...v,
      agentBrief: { ...(v.agentBrief ?? {}), [key]: value } as AgentBrief,
    }));
  }

  function persistSavedTemplates(next: SavedAgentTemplate[]) {
    setSavedTemplates(next);
    if (typeof window === "undefined") return;
    localStorage.setItem(SAVED_AGENT_TEMPLATES_KEY, JSON.stringify(next));
  }

  function journeyFromAskAboutItems(
    askAboutItems: SavedAgentTemplate["askAboutItems"],
    opts?: { collectName?: boolean; nameQuestionPrompt?: string }
  ): JourneyStep[] {
    const steps: JourneyStep[] = [];
    if (opts?.collectName !== false) {
      steps.push(createJourneyNameStep(opts?.nameQuestionPrompt || DEFAULT_NAME_QUESTION_PROMPT));
    }
    for (const item of askAboutItems) {
      if (!item.prompt?.trim()) continue;
      const allowAudio = Boolean(item.allowAudio);
      const allowVideo = Boolean(item.allowVideo);
      const allowText = (!allowAudio && !allowVideo) || (allowAudio && allowVideo);
      steps.push({
        ...createJourneyPromptStep(item.prompt.trim()),
        ...normalizePromptChannels({ allowText, allowAudio, allowVideo }),
        requireEmailCaptcha: Boolean(item.requireEmailCaptcha) && allowText,
      });
    }
    return steps.length > 0 ? steps : defaultJourneySteps();
  }

  function togglePromptChannel(
    index: number,
    channel: "allowText" | "allowAudio" | "allowVideo"
  ) {
    setValues((v) => {
      const cur = v.journeySteps[index];
      if (!cur || cur.kind !== "prompt") return v;
      const channels = normalizePromptChannels(cur);
      const turningAudioOn = channel === "allowAudio" && !channels.allowAudio;
      const nextChannels = normalizePromptChannels({
        ...channels,
        [channel]: !channels[channel],
      });
      const next = [...v.journeySteps];
      next[index] = {
        ...cur,
        ...nextChannels,
        requireEmailCaptcha: Boolean(cur.requireEmailCaptcha) && nextChannels.allowText,
        ...(turningAudioOn
          ? {
              // Open recording by default — composition category is optional.
              slotId: undefined,
              alternateSlotIds: undefined,
              buttonLabel: cur.buttonLabel || "Record",
              recordSeconds:
                clampRecordSeconds(cur.recordSeconds) ?? DEFAULT_FREE_SOUND_SECONDS,
            }
          : {}),
        ...(!nextChannels.allowAudio
          ? { slotId: undefined, alternateSlotIds: undefined }
          : {}),
      };
      return { ...v, journeySteps: next };
    });
  }

  function applySavedTemplate(tpl: SavedAgentTemplate) {
    const matchedTheme =
      themes.find((t) => t.key === tpl.eventType) ??
      (tpl.eventType === "other" ? themes.find((t) => t.key === "conference") : undefined) ??
      null;
    const journeySteps = journeyFromAskAboutItems(tpl.askAboutItems, {
      collectName: tpl.collectName,
      nameQuestionPrompt: tpl.nameQuestionPrompt,
    });
    setValues((v) => ({
      ...v,
      agentThemeId: matchedTheme?.id ?? v.agentThemeId ?? null,
      journeySteps,
      agentBrief: {
        ...(v.agentBrief ?? {}),
        eventType: tpl.eventType,
        whoWhat: tpl.whoWhat,
        emotionalArc: tpl.emotionalArc,
        collectName: tpl.collectName,
        nameQuestionPrompt: tpl.nameQuestionPrompt,
        askAboutItems: tpl.askAboutItems,
        askAbout: tpl.askAboutItems.map((item) => item.prompt),
      },
    }));
  }

  function applyCustomBrief() {
    setThemeError(null);
    setValues((v) => ({
      ...v,
      journeySteps: v.journeySteps.length > 0 ? v.journeySteps : defaultJourneySteps(),
      agentBrief: {
        ...(v.agentBrief ?? {}),
        eventType: "custom",
      },
    }));
  }

  function saveCurrentAsTemplate() {
    const trimmed = templateName.trim();
    if (!trimmed) {
      setThemeError("Add a template name before saving.");
      return;
    }
    const askAboutItems = normalizeAskAboutEmailCaptcha(
      values.journeySteps
        .filter((s): s is JourneyPromptStep => s.kind === "prompt")
        .map((x) => {
          const channels = normalizePromptChannels(x);
          return {
            prompt: x.prompt.trim(),
            allowAudio: channels.allowAudio,
            allowVideo: channels.allowVideo,
            requireEmailCaptcha: Boolean(x.requireEmailCaptcha) && channels.allowText,
          };
        })
        .filter((x) => x.prompt.length > 0)
    );
    if (askAboutItems.length === 0 && !values.journeySteps.some((s) => s.kind === "name")) {
      setThemeError("Add at least one prompt or name step before saving a template.");
      return;
    }
    const nameStep = values.journeySteps.find((s) => s.kind === "name");
    const eventTypeRaw = (values.agentBrief?.eventType ?? "other").toLowerCase();
    const normalizedType: SavedAgentTemplate["eventType"] =
      eventTypeRaw === "birthday" || eventTypeRaw === "fundraiser" || eventTypeRaw === "other"
        ? eventTypeRaw
        : "other";
    const tpl: SavedAgentTemplate = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed,
      eventType: normalizedType,
      whoWhat: values.agentBrief?.whoWhat,
      emotionalArc: values.agentBrief?.emotionalArc,
      collectName: Boolean(nameStep),
      nameQuestionPrompt:
        (nameStep && "prompt" in nameStep && nameStep.prompt?.trim()) || DEFAULT_NAME_QUESTION_PROMPT,
      askAboutItems,
    };
    persistSavedTemplates([tpl, ...savedTemplates]);
    setTemplateName("");
    setThemeError(null);
  }

  function setWorldConfigField<K extends keyof WorldConfig>(key: K, value: WorldConfig[K]) {
    setValues((v) => ({
      ...v,
      worldConfig: { ...(v.worldConfig ?? EMPTY_WORLD_CONFIG_FORM), [key]: value },
    }));
  }

  async function checkRunwayStatus() {
    setRunwayStatus({ checked: false, configured: false });
    try {
      const res = await fetch("/api/admin/runway-status");
      const data = await res.json();
      setRunwayStatus({
        checked: true,
        configured: Boolean(data.configured),
        creditBalance: typeof data.creditBalance === "number" ? data.creditBalance : undefined,
        tier: data.tier,
        error: data.error,
      });
    } catch {
      setRunwayStatus({ checked: true, configured: false, error: "Could not reach the server." });
    }
  }

  async function handleAiReferencePhotoFiles(files: File[]) {
    if (files.length === 0) return;

    const MAX_REFS = 3;
    const MAX_REF_BYTES = 20 * 1024 * 1024;
    const DATA_URL_SAFE_BYTES = 3 * 1024 * 1024;

    const isImageFile = (f: File) =>
      f.type.startsWith("image/") ||
      (!f.type && /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(f.name));

    const images = files.filter(isImageFile);
    if (images.length === 0) {
      setAiGenError("That file didn’t look like an image. Use JPEG, PNG, or WebP.");
      return;
    }

    const room = Math.max(0, MAX_REFS - aiReferencePhotos.length);
    if (room === 0) {
      setAiGenError("Already at 3 reference photos (Runway’s max). Remove one first.");
      return;
    }
    const batch = images.slice(0, room);
    for (const file of batch) {
      if (file.size > MAX_REF_BYTES) {
        setAiGenError(`“${file.name}” is over 20MB. Compress it and try again.`);
        return;
      }
    }

    setUploadingAiRefs(true);
    setAiGenError(null);
    try {
      const eventIdForPath = values.slug?.trim() || eventId || "draft";
      const prepareRes = await fetch("/api/events/storyboard-refs/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: eventIdForPath,
          existingCount: aiReferencePhotos.length,
          files: batch.map((file) => ({
            name: file.name,
            contentType: file.type?.startsWith("image/") ? file.type : "image/jpeg",
            size: file.size,
          })),
        }),
      });
      const prepareBody = (await prepareRes.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        uploads?: Array<{ signedUrl: string; publicUrl: string; contentType: string }>;
      };

      if (prepareRes.ok && prepareBody.uploads?.length) {
        const urls: string[] = [];
        for (let i = 0; i < prepareBody.uploads.length; i += 1) {
          const upload = prepareBody.uploads[i];
          const file = batch[i];
          const put = await fetch(upload.signedUrl, {
            method: "PUT",
            headers: { "Content-Type": upload.contentType },
            body: file,
          });
          if (!put.ok) {
            throw new Error(`Could not upload “${file.name}”. Try again.`);
          }
          urls.push(upload.publicUrl);
        }
        setAiReferencePhotos((prev) => [...prev, ...urls].slice(0, MAX_REFS));
        return;
      }

      if (prepareBody.code === "not_configured") {
        const small = batch.filter((f) => f.size <= DATA_URL_SAFE_BYTES);
        if (small.length === 0) {
          throw new Error(
            "Storage isn’t configured and files are over ~3MB. Configure Supabase storage for larger refs."
          );
        }
        const dataUrls = await Promise.all(
          small.map(
            (file) =>
              new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result;
                  if (typeof result === "string" && result.startsWith("data:")) resolve(result);
                  else reject(new Error(`Could not read “${file.name}”.`));
                };
                reader.onerror = () => reject(new Error(`Could not read “${file.name}”.`));
                reader.readAsDataURL(file);
              })
          )
        );
        setAiReferencePhotos((prev) => [...prev, ...dataUrls].slice(0, MAX_REFS));
        if (small.length < batch.length) {
          setAiGenNotice("Storage isn’t configured — only smaller photos were added as local data URLs.");
        }
        return;
      }

      throw new Error(prepareBody.error || "Could not prepare reference upload.");
    } catch (err) {
      setAiGenError(err instanceof Error ? err.message : "Reference upload failed.");
    } finally {
      setUploadingAiRefs(false);
    }
  }

  async function handleGenerateStoryboard() {
    setAiGenError(null);
    setAiGenNotice(null);
    if (!aiVibePrompt.trim()) {
      setAiGenError("Describe the vibe (place, mood, community) first — the AI invents a new world from that.");
      return;
    }
    setAiGenerating(true);
    try {
      const eventIdForPath = values.slug?.trim() || "draft";
      const res = await fetch(`/api/events/${encodeURIComponent(eventIdForPath)}/generate-storyboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vibePrompt: aiVibePrompt,
          frameCount: aiFrameCount,
          ...(aiReferencePhotos.length ? { referenceUrls: aiReferencePhotos } : {}),
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.frames) && data.frames.length) {
        setValues((v) => ({
          ...v,
          worldConfig: {
            ...(v.worldConfig ?? EMPTY_WORLD_CONFIG_FORM),
            worldStoryboard: data.frames,
            aiArtworkPrompt: aiVibePrompt.trim() || null,
          },
        }));
      }
      if (!res.ok) {
        const partial = Array.isArray(data.frames) ? data.frames.length : 0;
        setAiGenError(
          partial > 0
            ? `${data.error} (${partial}/${aiFrameCount} frames generated before this — kept below, click Generate again to retry the rest.)`
            : data.error || "Generation failed."
        );
      } else {
        const refNote =
          aiReferencePhotos.length > 1
            ? ` (guided by ${aiReferencePhotos.length} reference photos)`
            : aiReferencePhotos.length === 1
              ? " (guided by your reference photo)"
              : "";
        setAiGenNotice(
          `Generated ${data.frames.length} new world frames${refNote} (still + 10s loop each). Review below, then Save to keep them.`
        );
      }
    } catch {
      setAiGenError("Could not reach the server.");
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleRegenerateFrame(frameIndex: number) {
    setAiGenError(null);
    setAiGenNotice(null);
    if (!aiVibePrompt.trim()) {
      setAiGenError("Describe the vibe first, then create another variation of this frame.");
      return;
    }
    const existing = values.worldConfig?.worldStoryboard ?? [];
    setAiRegeneratingFrame(frameIndex);
    try {
      const eventIdForPath = values.slug?.trim() || "draft";
      const siblingSceneUrls = existing.map((f) => f.sceneUrl ?? null);
      const siblingCount = siblingSceneUrls.filter(
        (url, idx) => idx !== frameIndex && Boolean(url)
      ).length;
      const res = await fetch(`/api/events/${encodeURIComponent(eventIdForPath)}/generate-storyboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vibePrompt: aiVibePrompt,
          // Intensity / sibling continuity keyed to the source frame; result is appended, not replaced.
          frameIndex,
          frameCount: Math.max(existing.length, frameIndex + 1, aiFrameCount),
          siblingSceneUrls,
          ...(aiReferencePhotos.length ? { referenceUrls: aiReferencePhotos } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiGenError(data.error || `Could not create a variation of frame ${frameIndex + 1}.`);
        return;
      }
      if (data.frame) {
        const next = [...existing, data.frame];
        setValues((v) => ({
          ...v,
          worldConfig: {
            ...(v.worldConfig ?? EMPTY_WORLD_CONFIG_FORM),
            worldStoryboard: next,
            aiArtworkPrompt: aiVibePrompt.trim() || null,
          },
        }));
        setAiGenNotice(
          siblingCount > 0
            ? `Added frame ${next.length} as a variation of frame ${frameIndex + 1} (original kept). Use × to dump ones you don’t want, then Save.`
            : `Added frame ${next.length} as a variation of frame ${frameIndex + 1} (original kept). Use × to dump ones you don’t want, then Save.`
        );
      }
    } catch {
      setAiGenError("Could not reach the server.");
    } finally {
      setAiRegeneratingFrame(null);
    }
  }

  function handleSlugChange(next: string) {
    setSlugManuallyEdited(true);
    setValues((v) => ({ ...v, slug: next }));
  }

  async function handleHeroFiles(files: File[]) {
    const file = files[0];
    if (!file) return;

    const isImage =
      file.type.startsWith("image/") ||
      (!file.type && /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(file.name));
    if (!isImage) {
      setSubmitError("That file didn’t look like an image. Use JPEG, PNG, or WebP.");
      return;
    }

    const MAX_HERO_BYTES = 20 * 1024 * 1024;
    /** Keep data-URL fallback under Vercel’s ~4.5MB body limit (base64 expands ~33%). */
    const DATA_URL_SAFE_BYTES = 3 * 1024 * 1024;

    if (file.size > MAX_HERO_BYTES) {
      setSubmitError(
        `“${file.name}” is over 20MB. Compress it or use a smaller photo.`
      );
      return;
    }

    setUploadingHero(true);
    setSubmitError(null);
    try {
      // Direct-to-storage signed upload (bypasses Vercel FUNCTION_PAYLOAD_TOO_LARGE).
      const prepareRes = await fetch("/api/events/hero-upload/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          contentType: file.type?.startsWith("image/") ? file.type : "image/jpeg",
          size: file.size,
          eventId: eventId || values.slug?.trim() || undefined,
        }),
      });
      const prepareBody = (await prepareRes.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        upload?: { signedUrl: string; publicUrl: string; contentType: string };
      };

      if (prepareRes.ok && prepareBody.upload) {
        const put = await fetch(prepareBody.upload.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": prepareBody.upload.contentType },
          body: file,
        });
        if (!put.ok) {
          throw new Error(`Upload failed (${put.status}). Try again.`);
        }
        setValues((v) => ({ ...v, heroImage: prepareBody.upload!.publicUrl }));
        return;
      }

      if (prepareBody.code === "not_configured") {
        if (file.size > DATA_URL_SAFE_BYTES) {
          setSubmitError(
            "Storage isn’t configured for large heroes. Keep images under ~3MB, or set up Supabase storage."
          );
          return;
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Could not read that image."));
          reader.readAsDataURL(file);
        });
        setValues((v) => ({ ...v, heroImage: dataUrl }));
        return;
      }

      throw new Error(prepareBody.error || "Could not prepare hero upload.");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Hero upload failed.");
    } finally {
      setUploadingHero(false);
    }
  }

  const inputClass =
    "mt-0.5 block w-full rounded-lg border border-gray-700/50 bg-[#222] px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none";
  const labelClass = "block text-xs font-medium text-gray-400";
  const sectionClass = "space-y-3 border-t border-gray-800 pt-5";
  const sectionTitleClass = "text-xs font-semibold uppercase tracking-wider text-gray-500";
  const chipClass =
    "rounded-md border border-gray-700 bg-[#1a1a1a] px-2 py-0.5 text-[11px] font-medium text-gray-300 hover:bg-[#252525] disabled:opacity-40";

  return (
    <form noValidate onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl space-y-3">
      {submitError && (
        <div className="rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {submitError}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-800/60 bg-green-900/20 px-3 py-2 text-sm text-green-300">
          {submitSuccessMessage}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="title" className={labelClass}>
            Title
          </label>
          <input
            id="title"
            type="text"
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="slug" className={labelClass}>
            Public URL
          </label>
          <div className="mt-0.5 flex overflow-hidden rounded-lg border border-gray-700/50 bg-[#222]">
            <span className="flex items-center border-r border-gray-700/50 bg-[#1a1a1a] px-3 py-2 text-sm text-gray-500">
              /e/
            </span>
            <input
              id="slug"
              type="text"
              placeholder="csc-mar1 (auto from date)"
              value={values.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-0"
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="description" className={labelClass}>
            Description
          </label>
          <textarea
            id="description"
            rows={2}
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="date" className={labelClass}>
            Date
          </label>
          <input
            id="date"
            type="date"
            value={values.date}
            onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))}
            className={`${inputClass} [color-scheme:dark]`}
          />
        </div>
        <div>
          <label htmlFor="time" className={labelClass}>
            Time
          </label>
          <input
            id="time"
            type="time"
            value={values.time}
            onChange={(e) => setValues((v) => ({ ...v, time: e.target.value }))}
            className={`${inputClass} [color-scheme:dark]`}
          />
        </div>
        <div>
          <label htmlFor="venue" className={labelClass}>
            Venue
          </label>
          <input
            id="venue"
            type="text"
            value={values.venue}
            onChange={(e) => setValues((v) => ({ ...v, venue: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="address" className={labelClass}>
            Address
          </label>
          <input
            id="address"
            type="text"
            value={values.address}
            onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <AddressMap venue={values.venue} address={values.address} className="mt-0" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="heroImage" className={labelClass}>
            Hero image
          </label>
          <div className="mt-0.5 flex flex-wrap items-stretch gap-2">
            <input
              id="heroImage"
              type="text"
              placeholder="https://… or drop / upload"
              value={values.heroImage}
              onChange={(e) => setValues((v) => ({ ...v, heroImage: e.target.value }))}
              className={`${inputClass} mt-0 min-w-0 flex-1`}
            />
            <FileDropZone
              variant="compact"
              accept="image/*"
              disabled={uploadingHero}
              label={uploadingHero ? "Uploading…" : "Upload"}
              onFiles={(files) => void handleHeroFiles(files)}
            />
            {values.heroImage && (
              <div className="h-9 w-14 shrink-0 overflow-hidden rounded border border-gray-700 bg-[#1f1f1f]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={values.heroImage} alt="Preview" className="h-full w-full object-cover" />
              </div>
            )}
          </div>
          <div className="mt-2">
            <FileDropZone
              variant="panel"
              accept="image/*"
              disabled={uploadingHero}
              label={uploadingHero ? "Uploading…" : "Drop hero image here"}
              hint="Or click to browse · up to 20MB · large photos go straight to storage"
              onFiles={(files) => void handleHeroFiles(files)}
            />
          </div>
        </div>
      </div>
      <section className={sectionClass}>
        <h3 className={sectionTitleClass}>Event details</h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="landingHeadline" className={labelClass}>
              Landing headline
            </label>
            <input
              id="landingHeadline"
              type="text"
              value={values.landingHeadline}
              onChange={(e) => setValues((v) => ({ ...v, landingHeadline: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="landingCopy" className={labelClass}>
              Supporting copy
            </label>
            <textarea
              id="landingCopy"
              rows={2}
              value={values.landingCopy}
              onChange={(e) => setValues((v) => ({ ...v, landingCopy: e.target.value }))}
              className={inputClass}
              placeholder="Optional short subheading under the headline."
            />
          </div>
          <div>
            <label htmlFor="ctaText" className={labelClass}>
              CTA button text
            </label>
            <input
              id="ctaText"
              type="text"
              value={values.ctaText}
              onChange={(e) => setValues((v) => ({ ...v, ctaText: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="completionEyebrow" className={labelClass}>
              Completion eyebrow
            </label>
            <input
              id="completionEyebrow"
              type="text"
              value={values.songGardenConfig?.completionEyebrow ?? ""}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  songGardenConfig: {
                    ...(v.songGardenConfig ?? defaultSongGardenConfig()),
                    completionEyebrow: e.target.value,
                  },
                }))
              }
              className={inputClass}
              placeholder={COMPLETION_MOMENT_LABEL}
            />
          </div>
          <div>
            <label htmlFor="anthemCompletionMessage" className={labelClass}>
              Completion message
            </label>
            <textarea
              id="anthemCompletionMessage"
              rows={2}
              value={values.anthemCompletionMessage}
              onChange={(e) => setValues((v) => ({ ...v, anthemCompletionMessage: e.target.value }))}
              className={inputClass}
            />
          </div>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={values.agentBrief?.requireContributionConsent !== false}
              onChange={(e) => setBrief("requireContributionConsent", e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-[#1f1f1f]"
            />
            <span className="text-sm text-gray-300">Require contribution consent on landing</span>
          </label>
          {values.agentBrief?.requireContributionConsent !== false && (
            <div>
              <label htmlFor="contributionConsentText" className={labelClass}>
                Consent checkbox text
              </label>
              <textarea
                id="contributionConsentText"
                rows={2}
                value={
                  values.agentBrief?.contributionConsentText ?? DEFAULT_CONTRIBUTION_CONSENT_TEXT
                }
                onChange={(e) => setBrief("contributionConsentText", e.target.value)}
                className={inputClass}
              />
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="heroImageMode" className={labelClass}>
                Default photo mode
              </label>
              <select
                id="heroImageMode"
                value={values.heroImageMode}
                onChange={(e) =>
                  setValues((v) => ({ ...v, heroImageMode: e.target.value === "color" ? "color" : "bw" }))
                }
                className={inputClass}
              >
                <option value="bw">Black and white</option>
                <option value="color">Full color</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className={sectionTitleClass}>World</h3>
          <a
            href={publicEventPath(values.slug || "your-slug")}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-gray-500 hover:text-gray-300"
          >
            Public link /e/{canonicalEventSlug(values.slug || "…")}
          </a>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={labelClass}>World title</span>
            <input
              type="text"
              value={values.worldConfig?.title ?? ""}
              onChange={(e) => setWorldConfigField("title", e.target.value)}
              placeholder={values.title || "Defaults to event title"}
              className={inputClass}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={labelClass}>Hero artwork URL</span>
            <input
              type="text"
              value={values.worldConfig?.heroArtworkUrl ?? ""}
              onChange={(e) => setWorldConfigField("heroArtworkUrl", e.target.value || null)}
              placeholder={values.heroImage || "Defaults to event hero image"}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Primary color</span>
            <input
              type="text"
              value={values.worldConfig?.primaryColor ?? EMPTY_WORLD_CONFIG_FORM.primaryColor}
              onChange={(e) => setWorldConfigField("primaryColor", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Accent color</span>
            <input
              type="text"
              value={values.worldConfig?.accentColor ?? EMPTY_WORLD_CONFIG_FORM.accentColor}
              onChange={(e) => setWorldConfigField("accentColor", e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Animation</span>
            <select
              value={values.worldConfig?.animationPreset ?? "particles"}
              onChange={(e) =>
                setWorldConfigField(
                  "animationPreset",
                  e.target.value as WorldConfig["animationPreset"]
                )
              }
              className={inputClass}
            >
              {WORLD_ANIMATION_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Ambient soundtrack URL</span>
            <input
              type="text"
              value={values.worldConfig?.ambientSoundtrackUrl ?? ""}
              onChange={(e) => setWorldConfigField("ambientSoundtrackUrl", e.target.value || null)}
              placeholder="Optional .mp3/.wav"
              className={inputClass}
            />
          </label>
        </div>

        <div className="space-y-2.5 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={labelClass}>Storyboard frames</span>
            <button type="button" onClick={checkRunwayStatus} className={chipClass}>
              Check Runway credits
            </button>
          </div>
          {runwayStatus && (
            <p className="text-[11px]">
              {!runwayStatus.checked ? (
                <span className="text-gray-500">Checking…</span>
              ) : !runwayStatus.configured ? (
                <span className="text-amber-400">RUNWAYML_API_SECRET not set on server.</span>
              ) : runwayStatus.error ? (
                <span className="text-amber-400">{runwayStatus.error}</span>
              ) : (
                <span className="text-emerald-400">
                  Connected{runwayStatus.tier ? ` — ${runwayStatus.tier}` : ""}
                  {typeof runwayStatus.creditBalance === "number"
                    ? `, ${runwayStatus.creditBalance} credits`
                    : ""}
                </span>
              )}
            </p>
          )}

          <label className="block">
            <span className={labelClass}>Vibe prompt (required for AI)</span>
            <textarea
              value={aiVibePrompt}
              onChange={(e) => {
                const next = e.target.value;
                setAiVibePrompt(next);
                setWorldConfigField("aiArtworkPrompt", next.trim() || null);
              }}
              placeholder="e.g. Sphere Las Vegas at desert sunset — Mojave dunes, bioluminescent mycelial garden…"
              rows={3}
              className={inputClass}
            />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <span className={labelClass}>Reference photos (optional · up to 3)</span>
              <FileDropZone
                variant="inline"
                multiple
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadingAiRefs || aiGenerating || aiReferencePhotos.length >= 3}
                label={
                  uploadingAiRefs
                    ? "Uploading…"
                    : aiReferencePhotos.length >= 3
                      ? "At 3 photos — remove one to add more"
                      : aiReferencePhotos.length > 0
                        ? "Drop more photos, or click to browse"
                        : "Drop reference photos or click"
                }
                hint="JPEG / PNG / WebP · up to 20MB each · Runway uses up to 3"
                onFiles={(files) => void handleAiReferencePhotoFiles(files)}
              />
            </div>
            <label className="block w-20">
              <span className={labelClass}>Frames</span>
              <input
                type="number"
                min={2}
                max={6}
                value={aiFrameCount}
                onChange={(e) => setAiFrameCount(Math.max(2, Math.min(6, Number(e.target.value) || 4)))}
                className={inputClass}
              />
            </label>
            <button
              type="button"
              onClick={handleGenerateStoryboard}
              disabled={aiGenerating || aiRegeneratingFrame != null || uploadingAiRefs}
              className="rounded-lg bg-[#CFFF81] px-3 py-2 text-xs font-semibold text-[#1a0f2d] hover:bg-[#bdf25e] disabled:opacity-50"
            >
              {aiGenerating ? "Generating…" : "Generate with AI"}
            </button>
          </div>
          <p className="text-[11px] text-gray-500">
            <span className="text-gray-400">Regen</span> adds another variation and keeps the original —
            dump with × when you don’t want a frame.{" "}
            <span className="text-gray-400">Generate with AI</span> rebuilds a new set (replaces the list
            in this form until you Save).
          </p>
          {aiReferencePhotos.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {aiReferencePhotos.map((src, i) => (
                <div key={`${src.slice(0, 48)}-${i}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Reference ${i + 1}`}
                    className="h-12 w-20 rounded object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAiReferencePhotos((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-[10px] text-white hover:bg-rose-600"
                    aria-label={`Remove reference ${i + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setAiReferencePhotos([])}
                className={chipClass}
              >
                Clear all
              </button>
            </div>
          )}
          {aiGenError && <p className="text-[11px] text-rose-400">{aiGenError}</p>}
          {aiGenNotice && <p className="text-[11px] text-emerald-400">{aiGenNotice}</p>}

          <div className="divide-y divide-gray-800/80">
            {(values.worldConfig?.worldStoryboard ?? []).map((frame, i) => (
              <div key={i} className="flex flex-col gap-1.5 py-2 sm:flex-row sm:items-center">
                <span className="w-14 shrink-0 text-[11px] font-medium text-gray-500">Frame {i + 1}</span>
                {frame.sceneUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={frame.sceneUrl}
                    alt=""
                    className="h-10 w-16 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="h-10 w-16 shrink-0 rounded bg-gray-800/80" />
                )}
                <input
                  type="text"
                  value={frame.videoUrl ?? ""}
                  onChange={(e) => {
                    const frames = [...(values.worldConfig?.worldStoryboard ?? [])];
                    frames[i] = { ...frames[i], videoUrl: e.target.value || null };
                    setWorldConfigField("worldStoryboard", frames);
                  }}
                  placeholder="Video URL"
                  className={`${inputClass} flex-1`}
                />
                <input
                  type="text"
                  value={frame.sceneUrl ?? ""}
                  onChange={(e) => {
                    const frames = [...(values.worldConfig?.worldStoryboard ?? [])];
                    frames[i] = { ...frames[i], sceneUrl: e.target.value || null };
                    setWorldConfigField("worldStoryboard", frames);
                  }}
                  placeholder="Still URL"
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => handleRegenerateFrame(i)}
                  disabled={aiGenerating || aiRegeneratingFrame != null}
                  className={chipClass}
                  title="Create another AI variation — keeps this frame; dump with × if you don’t want one"
                >
                  {aiRegeneratingFrame === i ? "…" : "Regen"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const frames = (values.worldConfig?.worldStoryboard ?? []).filter((_, idx) => idx !== i);
                    setWorldConfigField("worldStoryboard", frames);
                  }}
                  disabled={aiGenerating || aiRegeneratingFrame != null}
                  className={chipClass}
                  title="Dump this frame from the board"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const frames = [
                ...(values.worldConfig?.worldStoryboard ?? []),
                { sceneUrl: null, videoUrl: null },
              ];
              setWorldConfigField("worldStoryboard", frames);
            }}
            className={chipClass}
          >
            + Add frame
          </button>
        </div>

        <details className="group pt-1">
          <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-300">
            Legacy growth stages
          </summary>
          <p className="mt-1 text-[11px] text-gray-500">
            Used only when storyboard is empty. Threshold % + scene image URL.
          </p>
          <div className="mt-2 space-y-1.5">
            {(values.worldConfig?.worldSceneStages ?? []).map((stage, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(stage.threshold * 100)}
                  onChange={(e) => {
                    const stages = [...(values.worldConfig?.worldSceneStages ?? [])];
                    stages[i] = {
                      ...stages[i],
                      threshold: Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100,
                    };
                    setWorldConfigField("worldSceneStages", stages);
                  }}
                  className={`${inputClass} w-16`}
                  aria-label="Threshold %"
                />
                <span className="text-[11px] text-gray-500">%</span>
                <input
                  type="text"
                  value={stage.sceneUrl}
                  onChange={(e) => {
                    const stages = [...(values.worldConfig?.worldSceneStages ?? [])];
                    stages[i] = { ...stages[i], sceneUrl: e.target.value };
                    setWorldConfigField("worldSceneStages", stages);
                  }}
                  placeholder="Scene image URL"
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const stages = (values.worldConfig?.worldSceneStages ?? []).filter((_, idx) => idx !== i);
                    setWorldConfigField("worldSceneStages", stages);
                  }}
                  className={chipClass}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const stages = [
                  ...(values.worldConfig?.worldSceneStages ?? []),
                  { threshold: 0, sceneUrl: "" },
                ];
                setWorldConfigField("worldSceneStages", stages);
              }}
              className={chipClass}
            >
              + Add stage
            </button>
          </div>
        </details>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={values.worldConfig?.presenceSimulationEnabled ?? true}
            onChange={(e) => setWorldConfigField("presenceSimulationEnabled", e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span className="text-sm text-gray-300">Show ambient &quot;others are here&quot; activity</span>
        </label>

        {values.worldConfig && (
          <button
            type="button"
            onClick={() => setValues((v) => ({ ...v, worldConfig: null }))}
            className={chipClass}
          >
            Reset world defaults
          </button>
        )}
      </section>

      <section className={sectionClass}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className={sectionTitleClass}>Journey</h3>
          <p className="text-[11px] text-gray-500">
            Ordered prompts — set eyebrow, Accept channels, and optionally tie a World storyboard
            frame so the background changes on that step
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label className={labelClass}>Template seed</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(
                [
                  { id: "custom", label: "Custom", themeKey: null },
                  { id: "birthday", label: "Birthday", themeKey: "birthday" },
                  { id: "fundraiser", label: "Fundraiser", themeKey: "fundraiser" },
                  { id: "other", label: "Other", themeKey: "conference" },
                ] as const
              ).map((opt) => {
                const eventType = (values.agentBrief?.eventType ?? "custom").toLowerCase();
                const active =
                  opt.id === "custom"
                    ? eventType === "custom"
                    : eventType === opt.id ||
                      themes.find((t) => t.id === values.agentThemeId)?.key === opt.themeKey;
                const themeForOpt = opt.themeKey ? themes.find((t) => t.key === opt.themeKey) : null;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={async () => {
                      if (opt.id === "custom") {
                        applyCustomBrief();
                        return;
                      }
                      let theme: AgentTheme | null = themeForOpt ?? null;
                      if (!theme) {
                        try {
                          const fresh = await getAgentThemes();
                          setThemes(fresh);
                          theme = fresh.find((t) => t.key === (opt.themeKey ?? "")) ?? null;
                        } catch {
                          theme = null;
                        }
                      }
                      setThemeError(null);
                      const local = TEMPLATE_DEFAULTS[opt.id];
                      const journeySteps = journeyFromAskAboutItems(local.askAboutItems, {
                        collectName: true,
                      });
                      setValues((v) => ({
                        ...v,
                        agentThemeId: theme?.id ?? v.agentThemeId ?? null,
                        journeySteps,
                        agentBrief: {
                          ...(v.agentBrief ?? {}),
                          eventType: local.eventType,
                          askAboutItems: local.askAboutItems,
                          askAbout: local.askAboutItems.map((item) => item.prompt),
                          emotionalArc: local.emotionalArc,
                        },
                      }));
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      active
                        ? "bg-gray-700 text-white"
                        : "border border-gray-700 text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {themeError && <p className="mt-1 text-xs text-amber-300">{themeError}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="saveTemplateName" className={labelClass}>
              Save as template
            </label>
            <input
              id="saveTemplateName"
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Team appreciation"
              className={inputClass}
            />
          </div>
          <button type="button" onClick={saveCurrentAsTemplate} className={chipClass + " min-h-[34px] px-3"}>
            Save
          </button>
        </div>
        {savedTemplates.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {savedTemplates.map((tpl) => (
              <div key={tpl.id} className="flex items-center gap-0.5">
                <button type="button" onClick={() => applySavedTemplate(tpl)} className={chipClass}>
                  {tpl.name}
                </button>
                <button
                  type="button"
                  onClick={() => persistSavedTemplates(savedTemplates.filter((x) => x.id !== tpl.id))}
                  className="rounded-md border border-red-900/40 px-1.5 py-0.5 text-[11px] text-red-300 hover:bg-red-950/40"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="divide-y divide-gray-800/80">
          {values.journeySteps.map((step, idx) => {
            const usedSlots = new Set(
              values.journeySteps
                .filter(
                  (s): s is JourneyPromptStep =>
                    s.kind === "prompt" &&
                    Boolean(normalizePromptChannels(s).allowAudio) &&
                    Boolean(s.slotId)
                )
                .map((s) => s.slotId as GardenSlotId)
            );
            const kindLabel = step.kind === "prompt" ? "Prompt" : "Name";
            const channels = step.kind === "prompt" ? normalizePromptChannels(step) : null;
            return (
              <div key={step.id} className="space-y-1.5 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="w-5 text-[11px] font-medium text-gray-500">{idx + 1}</span>
                  <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {kindLabel}
                  </span>
                  <span className="flex-1" />
                  <button type="button" disabled={idx === 0} onClick={() => moveJourneyStep(idx, -1)} className={chipClass}>
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={idx === values.journeySteps.length - 1}
                    onClick={() => moveJourneyStep(idx, 1)}
                    className={chipClass}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setJourneySteps(values.journeySteps.filter((_, i) => i !== idx))}
                    className="rounded-md border border-red-900/40 px-2 py-0.5 text-[11px] text-red-300 hover:bg-red-950/40"
                  >
                    Delete
                  </button>
                </div>

                <label className="block">
                  <span className={labelClass}>Eyebrow</span>
                  <input
                    type="text"
                    value={step.categoryLabel ?? ""}
                    onChange={(e) => updateJourneyStep(idx, { categoryLabel: e.target.value })}
                    className={inputClass}
                    placeholder={step.kind === "name" ? "Your Name" : "e.g. Your Words"}
                  />
                </label>

                <label className="block max-w-xs">
                  <span className={labelClass}>Background frame</span>
                  <select
                    className={inputClass}
                    value={
                      typeof step.storyboardFrameIndex === "number"
                        ? String(step.storyboardFrameIndex)
                        : ""
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (!raw) {
                        updateJourneyStep(idx, { storyboardFrameIndex: undefined });
                        return;
                      }
                      updateJourneyStep(idx, {
                        storyboardFrameIndex: Number(raw),
                      });
                    }}
                    disabled={(values.worldConfig?.worldStoryboard?.length ?? 0) === 0}
                  >
                    <option value="">
                      {(values.worldConfig?.worldStoryboard?.length ?? 0) === 0
                        ? "Auto (add storyboard frames in World)"
                        : "Auto / hold previous"}
                    </option>
                    {(values.worldConfig?.worldStoryboard ?? []).map((frame, fi) => (
                      <option key={`frame-${fi}`} value={fi}>
                        Frame {fi + 1}
                        {frame.videoUrl ? " (video)" : frame.sceneUrl ? " (still)" : ""}
                      </option>
                    ))}
                  </select>
                  <span className="mt-0.5 block text-[11px] text-gray-500">
                    When this step starts, switch the world background to that plate. Leave Auto to
                    keep the previous tied frame (or progress-based if none yet).
                  </span>
                </label>

                {step.kind === "name" && (
                  <>
                    <label className="block">
                      <span className={labelClass}>Prompt</span>
                      <input
                        type="text"
                        value={step.prompt ?? ""}
                        onChange={(e) => updateJourneyStep(idx, { prompt: e.target.value })}
                        className={inputClass}
                        placeholder={DEFAULT_NAME_QUESTION_PROMPT}
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Helper text</span>
                      <input
                        type="text"
                        value={step.responseHint ?? ""}
                        onChange={(e) => updateJourneyStep(idx, { responseHint: e.target.value })}
                        className={inputClass}
                        placeholder="Your first name is fine."
                      />
                    </label>
                  </>
                )}

                {step.kind === "prompt" && channels && (
                  <>
                    <label className="block">
                      <span className={labelClass}>Prompt</span>
                      <input
                        type="text"
                        value={step.prompt}
                        onChange={(e) => updateJourneyStep(idx, { prompt: e.target.value })}
                        className={inputClass}
                        placeholder="What participants see"
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="mr-1 text-[11px] text-gray-500">Accept:</span>
                      {(
                        [
                          { key: "allowText" as const, label: "Text" },
                          { key: "allowAudio" as const, label: "Audio" },
                          { key: "allowVideo" as const, label: "Video" },
                        ] as const
                      ).map(({ key, label }) => {
                        const on = channels[key];
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => togglePromptChannel(idx, key)}
                            className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                              on
                                ? "border border-sky-600/60 bg-sky-900/30 text-sky-200"
                                : chipClass
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                      {channels.allowText && (
                        <button
                          type="button"
                          onClick={() =>
                            updateJourneyStep(idx, {
                              requireEmailCaptcha: !step.requireEmailCaptcha,
                            })
                          }
                          className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                            step.requireEmailCaptcha
                              ? "border border-emerald-600/60 bg-emerald-900/25 text-emerald-200"
                              : chipClass
                          }`}
                        >
                          Email+Captcha
                        </button>
                      )}
                    </div>
                    {(channels.allowAudio || channels.allowVideo) && (
                      <label className="block max-w-[12rem]">
                        <span className={labelClass}>Record length (seconds)</span>
                        <input
                          type="number"
                          min={RECORD_SECONDS_MIN}
                          max={RECORD_SECONDS_MAX}
                          step={1}
                          value={
                            step.recordSeconds ??
                            (channels.allowAudio
                              ? DEFAULT_FREE_SOUND_SECONDS
                              : DEFAULT_VIDEO_SECONDS)
                          }
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw.trim() === "") {
                              updateJourneyStep(idx, { recordSeconds: undefined });
                              return;
                            }
                            const n = Number(raw);
                            updateJourneyStep(idx, {
                              recordSeconds: clampRecordSeconds(n) ?? undefined,
                            });
                          }}
                          className={inputClass}
                        />
                      </label>
                    )}
                    {channels.allowAudio && (
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        <label className="block">
                          <span className={labelClass}>Composition category (optional)</span>
                          <select
                            value={step.slotId ?? ""}
                            onChange={(e) => {
                              const next = e.target.value;
                              if (!next) {
                                updateJourneyStep(idx, {
                                  slotId: undefined,
                                  alternateSlotIds: undefined,
                                  recordSeconds:
                                    clampRecordSeconds(step.recordSeconds) ??
                                    DEFAULT_FREE_SOUND_SECONDS,
                                });
                                return;
                              }
                              updateJourneyStep(idx, {
                                slotId: next as GardenSlotId,
                              });
                            }}
                            className={inputClass}
                          >
                            <option value="">Open — no category</option>
                            {JOURNEY_GARDEN_SLOT_IDS.map((id) => (
                              <option
                                key={id}
                                value={id}
                                disabled={usedSlots.has(id) && id !== step.slotId}
                              >
                                {GARDEN_SLOT_ADMIN_LABELS[id].name} ({GARDEN_SLOT_ADMIN_LABELS[id].group})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className={labelClass}>Button text</span>
                          <input
                            type="text"
                            value={step.buttonLabel ?? ""}
                            onChange={(e) =>
                              updateJourneyStep(idx, { buttonLabel: e.target.value })
                            }
                            className={inputClass}
                            placeholder="Record"
                          />
                        </label>
                        {step.slotId ? (
                          <div className="flex flex-wrap gap-1 sm:col-span-2">
                            <span className="mr-1 self-center text-[11px] text-gray-500">
                              Also allow:
                            </span>
                            {JOURNEY_GARDEN_SLOT_IDS.filter((id) => id !== step.slotId).map(
                              (id) => {
                                const on = step.alternateSlotIds?.includes(id);
                                return (
                                  <button
                                    key={id}
                                    type="button"
                                    onClick={() => {
                                      const cur = new Set(step.alternateSlotIds ?? []);
                                      if (cur.has(id)) cur.delete(id);
                                      else cur.add(id);
                                      updateJourneyStep(idx, {
                                        alternateSlotIds: Array.from(cur) as GardenSlotId[],
                                      });
                                    }}
                                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                                      on
                                        ? "border border-emerald-600/60 bg-emerald-900/25 text-emerald-200"
                                        : chipClass
                                    }`}
                                  >
                                    {GARDEN_SLOT_ADMIN_LABELS[id].name}
                                  </button>
                                );
                              }
                            )}
                            <p className="w-full text-[11px] text-gray-500">
                              Optional — for canvas/composition. e.g. Mid choir + Also allow Clap.
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-500 sm:col-span-2">
                            All audio is just a recording. Set length above (tap ≈ 5s, phrase ≈ 10s,
                            ambient ≈ 30s). Add a composition category only if you want it on the
                            canvas.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setJourneySteps([...values.journeySteps, createJourneyPromptStep()])}
            className={chipClass}
          >
            + Add prompt
          </button>
          <button
            type="button"
            disabled={values.journeySteps.some((s) => s.kind === "name")}
            onClick={() => setJourneySteps([...values.journeySteps, createJourneyNameStep()])}
            className={`${chipClass} disabled:opacity-40`}
          >
            + Name
          </button>
        </div>
      </section>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
