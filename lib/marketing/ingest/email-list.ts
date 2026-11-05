import { normalizeMarketingEmail } from "../ids";

export type ParsedEmailList = {
  emails: string[];
  duplicateRows: number;
  invalidRows: number;
};

/** Pull unique emails out of a Mailchimp CSV or a plain list. */
export function parseEmailList(text: string): ParsedEmailList {
  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const seen = new Set<string>();
  const emails: string[] = [];
  let duplicateRows = 0;
  let invalidRows = 0;
  let match: RegExpExecArray | null;
  while ((match = emailPattern.exec(text))) {
    const email = normalizeMarketingEmail(match[0] ?? "");
    if (!email) {
      invalidRows += 1;
      continue;
    }
    if (seen.has(email)) {
      duplicateRows += 1;
      continue;
    }
    seen.add(email);
    emails.push(email);
  }
  return { emails, duplicateRows, invalidRows };
}
