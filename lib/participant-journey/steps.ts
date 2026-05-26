import type { Event } from "@/data/mockEvents";
import {
  allEnabledGardenSlotsDone,
  DEFAULT_SOUND_TRANSITION_MESSAGE,
  firstIncompleteGardenIndex,
  gardenStepCount,
  getEnabledGardenSteps,
  resolveSongGardenConfig,
  type ResolvedGardenStep,
} from "@/lib/songgarden/config";

export {
  allEnabledGardenSlotsDone as allGardenSlotsDone,
  firstIncompleteGardenIndex,
  getEnabledGardenSteps,
  resolveSongGardenConfig,
  type ResolvedGardenStep,
};

export const SOUND_TRANSITION_MESSAGE = DEFAULT_SOUND_TRANSITION_MESSAGE;
export const DEFAULT_JOURNEY_FINAL_MESSAGE =
  "Your voice is now part of the choir. We'll experience it together live.";

const DEFAULT_LYRIC_COUNT = 6;

import {
  collectsNameFromBrief,
  DEFAULT_NAME_QUESTION_PROMPT,
  resolveNameQuestionPrompt,
} from "@/lib/agent-name-question";

export { DEFAULT_NAME_QUESTION_PROMPT };

export function collectsParticipantName(event: Event): boolean {
  return collectsNameFromBrief(event.agentBrief);
}

export function nameQuestionPrompt(event: Event): string {
  return resolveNameQuestionPrompt(event.agentBrief);
}

export function journeyNameStepCount(event: Event): number {
  return collectsParticipantName(event) ? 1 : 0;
}

export function lyricQuestionCount(event: Event): number {
  const items = event.agentBrief?.askAboutItems?.filter(
    (item) => typeof item?.prompt === "string" && item.prompt.trim().length > 0
  );
  if (items && items.length > 0) return items.length;

  const strings = event.agentBrief?.askAbout?.filter(
    (q): q is string => typeof q === "string" && q.trim().length > 0
  );
  if (strings && strings.length > 0) return strings.length;

  return DEFAULT_LYRIC_COUNT;
}

export type JourneyPhase = "landing" | "lyric" | "sound_transition" | "garden" | "final";

export type JourneyPosition = {
  phase: JourneyPhase;
  gardenSlotIndex: number;
  /** Bumped when interview config changes; invalidates stale saved progress. */
  interviewVersion?: string;
};

export function soundTransitionMessage(event: Event): string {
  return resolveSongGardenConfig(event).soundTransitionMessage;
}

export function journeyProgress(
  event: Event,
  position: JourneyPosition,
  /** 1-based index of the lyric question currently shown (0 while loading). */
  lyricQuestionIndex = 0
): {
  completed: number;
  total: number;
  pct: number;
} {
  const lyrics = lyricQuestionCount(event);
  const garden = gardenStepCount(event);
  const nameSteps = journeyNameStepCount(event);
  const total = nameSteps + lyrics + 1 + garden + 1;

  let completed = 0;
  switch (position.phase) {
    case "landing":
      completed = 0;
      break;
    case "lyric":
      completed = nameSteps + lyricQuestionIndex;
      break;
    case "sound_transition":
      completed = nameSteps + lyrics;
      break;
    case "garden":
      completed = nameSteps + lyrics + 1 + position.gardenSlotIndex;
      break;
    case "final":
      completed = total;
      break;
  }

  return {
    completed,
    total,
    pct: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}
