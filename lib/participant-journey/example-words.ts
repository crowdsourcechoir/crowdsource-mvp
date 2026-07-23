export const DEFAULT_NAME_RESPONSE_HINT = "Your first name is fine.";

export function questionResponseHint(
  question: string | null | undefined,
  options?: { isName?: boolean; isEmail?: boolean }
): string | null {
  if (options?.isEmail) return null;
  if (options?.isName) return DEFAULT_NAME_RESPONSE_HINT;
  if (!question?.trim()) return null;

  const q = question.toLowerCase();
  if (/email|address/.test(q)) return null;
  if (/name/.test(q) && /your|first|what/.test(q)) {
    return DEFAULT_NAME_RESPONSE_HINT;
  }
  if (/finish this line|complete this|fill in/.test(q)) {
    return "Finish the line in your own words.";
  }
  // Don't echo "one word / short phrase" — the prompt itself already says that.
  return null;
}
