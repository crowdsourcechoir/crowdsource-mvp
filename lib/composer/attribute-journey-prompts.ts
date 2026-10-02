/**
 * Managed journeys store the participant's answer without an agent turn, so
 * Composer used to file every reply under "Untitled prompt".
 * When a turn has no recorded question, line it up with the journey's
 * interview prompts in order (name, text, video, photo — not sound pads).
 */

import type { AgentBrief } from "@/data/agentInterview";
import type { Event } from "@/data/mockEvents";
import { DEFAULT_NAME_QUESTION_PROMPT } from "@/lib/agent-name-question";
import { normalizePromptKey } from "@/lib/composer/group-answers-by-prompt";
import type { SongGardenConfig } from "@/lib/songgarden/config";
import {
  isAgentContributionStep,
  normalizeJourneySteps,
  synthesizeJourneySteps,
  type JourneyStep,
} from "@/lib/songgarden/journey-steps";

export type JourneyEventLike = {
  journeySteps?: unknown;
  songGardenConfig?: SongGardenConfig | null;
  agentBrief?: AgentBrief | null;
};

function promptTextOf(step: JourneyStep): string {
  if (step.kind === "name") return step.prompt?.trim() || DEFAULT_NAME_QUESTION_PROMPT;
  return step.prompt.trim();
}

function hasLegacyInterviewCopy(brief: AgentBrief | null | undefined): boolean {
  if (!brief) return false;
  if (brief.collectName === true) return true;
  if (brief.askAboutItems?.some((item) => item?.prompt?.trim())) return true;
  if (brief.askAbout?.some((item) => typeof item === "string" && item.trim())) return true;
  return false;
}

/** Prompts that create an interview turn, in journey order. Empty when the bloom has none. */
export function contributionPromptsForComposer(
  event: JourneyEventLike | null | undefined
): string[] {
  if (!event) return [];

  const explicit = normalizeJourneySteps(event.journeySteps);
  const fromConfig = normalizeJourneySteps(event.songGardenConfig?.journeySteps);
  let steps = explicit.length > 0 ? explicit : fromConfig;

  if (steps.length === 0) {
    if (!hasLegacyInterviewCopy(event.agentBrief)) return [];
    steps = synthesizeJourneySteps({
      journeySteps: undefined,
      songGardenConfig: event.songGardenConfig ?? null,
      agentBrief: event.agentBrief ?? null,
    } as Event);
  }

  const prompts: string[] = [];
  for (const step of steps) {
    if (!isAgentContributionStep(step)) continue;
    const text = promptTextOf(step);
    if (text) prompts.push(text);
  }
  return prompts;
}

type AnswerPromptLike = {
  questionText: string | null;
  questionExplicit?: boolean;
  createdAt?: string;
};

/** A stored question counts only when an agent turn asked it for this answer. */
export function isExplicitQuestion(answer: AnswerPromptLike): boolean {
  const existing = (answer.questionText ?? "").trim();
  if (!existing) return false;
  if (answer.questionExplicit === false) return false;
  return true;
}

/**
 * Journey prompts first, then any question someone in this bloom was actually asked
 * that is not already in the journey. That lets older replies line up even when
 * their own turns never stored the prompt.
 */
export function catalogPromptsForAnswers(
  journeyPrompts: string[],
  groups: AnswerPromptLike[][]
): string[] {
  const ordered = journeyPrompts.map((prompt) => prompt.trim()).filter(Boolean);
  const keys = new Set(ordered.map((prompt) => normalizePromptKey(prompt)));
  const extras: { text: string; at: string }[] = [];

  for (const answers of groups) {
    for (const answer of answers) {
      if (!isExplicitQuestion(answer)) continue;
      const text = (answer.questionText ?? "").trim();
      const key = normalizePromptKey(text);
      if (keys.has(key)) continue;
      keys.add(key);
      extras.push({ text, at: answer.createdAt ?? "" });
    }
  }

  extras.sort((a, b) => a.at.localeCompare(b.at));
  return [...ordered, ...extras.map((extra) => extra.text)];
}

export function attributeMissingAnswerPrompts<T extends AnswerPromptLike>(
  answers: T[],
  prompts: string[]
): Array<T & { promptIndex: number | null }> {
  const ordered = prompts.map((prompt) => prompt.trim()).filter(Boolean);
  let cursor = 0;

  return answers.map((answer) => {
    const existing = (answer.questionText ?? "").trim();
    if (isExplicitQuestion(answer)) {
      const fromCursor = ordered.findIndex(
        (prompt, index) => index >= cursor && normalizePromptKey(prompt) === normalizePromptKey(existing)
      );
      if (fromCursor >= 0) cursor = fromCursor + 1;
      const promptIndex =
        fromCursor >= 0
          ? fromCursor
          : ordered.findIndex((prompt) => normalizePromptKey(prompt) === normalizePromptKey(existing));
      return {
        ...answer,
        questionText: existing,
        promptIndex: promptIndex >= 0 ? promptIndex : null,
      };
    }

    if (cursor >= ordered.length) {
      return {
        ...answer,
        questionText: existing || null,
        promptIndex: null,
      };
    }

    const prompt = ordered[cursor];
    const promptIndex = cursor;
    cursor += 1;
    return { ...answer, questionText: prompt, promptIndex };
  });
}
