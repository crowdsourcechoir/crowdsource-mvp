export function questionResponseHint(
  question: string | null | undefined,
  options?: { isName?: boolean; isEmail?: boolean }
): string | null {
  if (options?.isEmail) return null;
  if (options?.isName) return "Your first name is fine.";
  if (!question?.trim()) return null;

  const q = question.toLowerCase();
  if (/one word|short phrase|few words|in a word/.test(q)) {
    return "One word or a short phrase.";
  }
  if (/email|address/.test(q)) return null;
  if (/name/.test(q) && /your|first|what/.test(q)) {
    return "Your first name is fine.";
  }
  if (/finish this line|complete this|fill in/.test(q)) {
    return "Finish the line in your own words.";
  }
  return "One word or a short phrase.";
}
