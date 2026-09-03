import type { SongGardenConfig } from "@/lib/songgarden/config";

/** WorldJourney drives steps from config — agent LLM is not needed on each submit. */
export function eventHasManagedJourney(
  songGardenConfig: SongGardenConfig | null | undefined,
  journeySteps: unknown[] | null | undefined
): boolean {
  const fromConfig = songGardenConfig?.journeySteps;
  const steps = Array.isArray(journeySteps) && journeySteps.length > 0
    ? journeySteps
    : Array.isArray(fromConfig) && fromConfig.length > 0
      ? fromConfig
      : null;
  return Boolean(steps && steps.length > 0);
}

export const JOURNEY_MANAGED_STUB = {
  agentMessage: "",
  suggestedAnswerTypes: ["text"] as const,
  extractedTags: undefined,
  stopReason: "journey_managed" as const,
};
