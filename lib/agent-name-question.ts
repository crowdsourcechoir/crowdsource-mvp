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
