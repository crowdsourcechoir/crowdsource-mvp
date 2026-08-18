/** First nudge is due this many calendar days after last outbound with no reply. */
export const NUDGE_DUE_AFTER_DAYS = 7;

/** Cap on AI-generated nudges sent per opportunity (approved + sent). */
export const MAX_NUDGES_PER_OPPORTUNITY = 2;

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export const GMAIL_OWNER_KEY = "default";

export function gmailThreadUrl(threadId: string): string {
  return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
}

/** Add N calendar days to an ISO timestamp (UTC date arithmetic is fine for v1 cadence). */
export function addDaysIso(fromIso: string, days: number): string {
  const d = new Date(fromIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}
