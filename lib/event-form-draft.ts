/**
 * Persist bloom create/edit form drafts in localStorage so journey prompts
 * survive timeouts, navigation, and "Restore bloom" shells that only have a world.
 */

import type { AgentBrief } from "@/data/agentInterview";
import type { SongGardenConfig } from "@/lib/songgarden/config";
import {
  defaultJourneySteps,
  normalizeJourneySteps,
  type JourneyStep,
} from "@/lib/songgarden/journey-steps";

export const EVENT_FORM_DRAFT_KEY = "csc_event_form_draft_v1";

export type EventFormDraft = {
  version: 1;
  savedAt: number;
  slug: string;
  title: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  prompt: string;
  landingHeadline: string;
  landingCopy: string;
  ctaText: string;
  anthemCompletionMessage: string;
  agentThemeId: string | null;
  agentBrief: AgentBrief | null;
  songGardenConfig: SongGardenConfig | null;
  journeySteps: JourneyStep[];
  /** Existing event id when editing; empty for create. */
  eventId?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function journeyStepsHaveContent(steps: unknown): boolean {
  const normalized = normalizeJourneySteps(steps);
  if (normalized.length === 0) return false;
  return normalized.some((s) => {
    if (s.kind === "name") return true;
    return typeof s.prompt === "string" && s.prompt.trim().length > 0;
  });
}

/** True when steps match the stock create-form defaults (ignore unstable ids). */
export function isStockDefaultJourney(steps: unknown): boolean {
  const normalized = normalizeJourneySteps(steps);
  const defaults = defaultJourneySteps();
  if (normalized.length !== defaults.length) return false;
  return normalized.every((step, i) => {
    const d = defaults[i];
    if (step.kind !== d.kind) return false;
    const prompt = (step.prompt ?? "").trim();
    const dPrompt = (d.prompt ?? "").trim();
    if (prompt !== dPrompt) return false;
    if (step.kind === "prompt" && d.kind === "prompt") {
      return (
        Boolean(step.allowText) === Boolean(d.allowText) &&
        Boolean(step.allowAudio) === Boolean(d.allowAudio) &&
        Boolean(step.allowVideo) === Boolean(d.allowVideo) &&
        (step.slotId ?? "") === (d.slotId ?? "")
      );
    }
    return true;
  });
}

/** Only persist drafts the user has actually started (avoid wiping a good draft with stock defaults). */
export function shouldPersistDraft(input: {
  title?: string;
  slug?: string;
  journeySteps: unknown;
}): boolean {
  if (!journeyStepsHaveContent(input.journeySteps)) return false;
  if ((input.title ?? "").trim() || (input.slug ?? "").trim()) return true;
  return !isStockDefaultJourney(input.journeySteps);
}

export function readEventFormDraft(): EventFormDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(EVENT_FORM_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1) return null;
    const journeySteps = normalizeJourneySteps(parsed.journeySteps);
    if (!journeyStepsHaveContent(journeySteps)) return null;
    return {
      version: 1,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
      slug: typeof parsed.slug === "string" ? parsed.slug : "",
      title: typeof parsed.title === "string" ? parsed.title : "",
      description: typeof parsed.description === "string" ? parsed.description : "",
      date: typeof parsed.date === "string" ? parsed.date : "",
      time: typeof parsed.time === "string" ? parsed.time : "",
      venue: typeof parsed.venue === "string" ? parsed.venue : "",
      address: typeof parsed.address === "string" ? parsed.address : "",
      prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
      landingHeadline: typeof parsed.landingHeadline === "string" ? parsed.landingHeadline : "",
      landingCopy: typeof parsed.landingCopy === "string" ? parsed.landingCopy : "",
      ctaText: typeof parsed.ctaText === "string" ? parsed.ctaText : "",
      anthemCompletionMessage:
        typeof parsed.anthemCompletionMessage === "string" ? parsed.anthemCompletionMessage : "",
      agentThemeId:
        typeof parsed.agentThemeId === "string" || parsed.agentThemeId === null
          ? (parsed.agentThemeId as string | null)
          : null,
      agentBrief: (parsed.agentBrief as AgentBrief | null) ?? null,
      songGardenConfig: (parsed.songGardenConfig as SongGardenConfig | null) ?? null,
      journeySteps,
      eventId: typeof parsed.eventId === "string" ? parsed.eventId : undefined,
    };
  } catch {
    return null;
  }
}

export function writeEventFormDraft(
  draft: Omit<EventFormDraft, "version" | "savedAt"> & { savedAt?: number }
): void {
  if (typeof window === "undefined") return;
  if (
    !shouldPersistDraft({
      title: draft.title,
      slug: draft.slug,
      journeySteps: draft.journeySteps,
    })
  ) {
    return;
  }
  try {
    const payload: EventFormDraft = {
      version: 1,
      savedAt: draft.savedAt ?? Date.now(),
      slug: draft.slug ?? "",
      title: draft.title ?? "",
      description: draft.description ?? "",
      date: draft.date ?? "",
      time: draft.time ?? "",
      venue: draft.venue ?? "",
      address: draft.address ?? "",
      prompt: draft.prompt ?? "",
      landingHeadline: draft.landingHeadline ?? "",
      landingCopy: draft.landingCopy ?? "",
      ctaText: draft.ctaText ?? "",
      anthemCompletionMessage: draft.anthemCompletionMessage ?? "",
      agentThemeId: draft.agentThemeId ?? null,
      agentBrief: draft.agentBrief ?? null,
      songGardenConfig: draft.songGardenConfig ?? null,
      journeySteps: normalizeJourneySteps(draft.journeySteps),
      eventId: draft.eventId,
    };
    localStorage.setItem(EVENT_FORM_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode — ignore; create path still posts to API.
  }
}

export function clearEventFormDraft(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(EVENT_FORM_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/** True when draft should fill an empty bloom (create shell or orphan restore). */
export function draftMatchesBloom(
  draft: EventFormDraft | null,
  opts: { slug?: string | null; eventId?: string | null }
): boolean {
  if (!draft || !journeyStepsHaveContent(draft.journeySteps)) return false;
  const slug = (opts.slug ?? "").trim().toLowerCase();
  const eventId = (opts.eventId ?? "").trim();
  if (eventId && draft.eventId && draft.eventId === eventId) return true;
  if (slug && draft.slug.trim().toLowerCase() === slug) return true;
  // Orphan prefix often matches draft slug; also allow recent unmatched draft (< 48h).
  if (!slug && !eventId) return Date.now() - draft.savedAt < 48 * 60 * 60 * 1000;
  if (slug && !draft.slug.trim()) return Date.now() - draft.savedAt < 48 * 60 * 60 * 1000;
  return Date.now() - draft.savedAt < 48 * 60 * 60 * 1000;
}

export function draftToRestorePayload(draft: EventFormDraft) {
  return {
    title: draft.title || undefined,
    slug: draft.slug || undefined,
    description: draft.description || undefined,
    date: draft.date || undefined,
    time: draft.time || undefined,
    venue: draft.venue || undefined,
    address: draft.address || undefined,
    prompt: draft.prompt || undefined,
    landingHeadline: draft.landingHeadline || undefined,
    landingCopy: draft.landingCopy || undefined,
    ctaText: draft.ctaText || undefined,
    anthemCompletionMessage: draft.anthemCompletionMessage || undefined,
    agentThemeId: draft.agentThemeId,
    agentBrief: draft.agentBrief,
    songGardenConfig: draft.songGardenConfig
      ? { ...draft.songGardenConfig, journeySteps: draft.journeySteps }
      : { soundTransitionMessage: "", steps: [], journeySteps: draft.journeySteps },
    journeySteps: draft.journeySteps,
  };
}
