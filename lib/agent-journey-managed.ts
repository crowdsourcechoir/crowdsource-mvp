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

export const JOURNEY_MANAGED_STUB = {
  agentMessage: "",
  suggestedAnswerTypes: ["text"] as const,
  extractedTags: undefined,
  stopReason: "journey_managed" as const,
};
