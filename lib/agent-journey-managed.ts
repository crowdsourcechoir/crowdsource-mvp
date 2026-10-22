import type { Event } from "@/data/mockEvents";
import type { SongGardenConfig } from "@/lib/songgarden/config";
import { resolveJourneySteps } from "@/lib/songgarden/journey-steps";

/** WorldJourney drives steps from config or agent brief — agent LLM is not needed on each submit. */
export function eventHasManagedJourney(
  songGardenConfig: SongGardenConfig | null | undefined,
  journeySteps: unknown[] | null | undefined,
  agentBrief?: unknown | null
): boolean {
  const eventLike = {
    agentBrief: agentBrief ?? null,
    songGardenConfig: songGardenConfig ?? null,
    journeySteps: Array.isArray(journeySteps) ? journeySteps : undefined,
  } as Event;

  return resolveJourneySteps(eventLike).length > 0;
}

const JOURNEY_PROMPT_MAX = 4000;

/** Prompt the participant just answered. Empty when the client did not send one. */
export function readJourneyPrompt(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const raw = (body as { journeyPrompt?: unknown }).journeyPrompt;
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.length > JOURNEY_PROMPT_MAX ? trimmed.slice(0, JOURNEY_PROMPT_MAX) : trimmed;
}

export const JOURNEY_MANAGED_STUB = {
  agentMessage: "",
  suggestedAnswerTypes: ["text"] as const,
  extractedTags: undefined,
  stopReason: "journey_managed" as const,
};
