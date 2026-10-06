import type { AgentBrief } from "@/data/agentInterview";

export const DEFAULT_NAME_QUESTION_PROMPT =
  "What name would you like us to use for your contributions?";

export type NameBrief = Pick<AgentBrief, "collectName" | "nameQuestionPrompt"> | null | undefined;

export function collectsNameFromBrief(brief: NameBrief): boolean {
  return brief?.collectName !== false;
}

export function resolveNameQuestionPrompt(brief: NameBrief): string {
  const prompt = brief?.nameQuestionPrompt?.trim();
  return prompt || DEFAULT_NAME_QUESTION_PROMPT;
}

export function isNameQuestionPrompt(brief: NameBrief, message: string | null | undefined): boolean {
  if (!collectsNameFromBrief(brief) || !message) return false;
  return message.trim() === resolveNameQuestionPrompt(brief).trim();
}

/**
 * True when this submit is the journey's name step.
 * The client flag counts on every turn, not only the first message — a name
 * asked later in the journey still has to be saved on the participant.
 */
export function isIncomingNameStep(args: {
  journeyNameStep: boolean;
  lastAgentContent?: string | null;
  questionPrompt?: string | null;
  brief: NameBrief;
}): boolean {
  if (args.journeyNameStep) return true;
  if (isNameQuestionPrompt(args.brief, args.lastAgentContent)) return true;
  if (isNameQuestionPrompt(args.brief, args.questionPrompt)) return true;
  return false;
}
