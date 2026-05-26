export type AskAboutItemLike = {
  prompt: string;
  requireEmailCaptcha?: boolean;
};

/** Email+captcha is allowed only on the final question — keeps early steps friction-free. */
export function normalizeAskAboutEmailCaptcha<T extends AskAboutItemLike>(items: T[]): T[] {
  if (items.length === 0) return items;
  const lastIdx = items.length - 1;
  return items.map((item, idx) => ({
    ...item,
    requireEmailCaptcha: idx === lastIdx ? !!item.requireEmailCaptcha : false,
  }));
}

export function getEmailCaptchaQuestion(
  items: AskAboutItemLike[] | undefined | null
): AskAboutItemLike | null {
  const trimmed = (items ?? []).filter(
    (item) => typeof item?.prompt === "string" && item.prompt.trim().length > 0
  );
  const normalized = normalizeAskAboutEmailCaptcha(trimmed);
  if (normalized.length === 0) return null;
  const last = normalized[normalized.length - 1];
  return last.requireEmailCaptcha ? last : null;
}

export function isEmailCaptchaPrompt(
  items: AskAboutItemLike[] | undefined | null,
  agentMessage: string
): boolean {
  const question = getEmailCaptchaQuestion(items);
  if (!question) return false;
  return question.prompt.trim() === agentMessage.trim();
}
