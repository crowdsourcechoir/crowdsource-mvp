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

/**
 * Stored only in our gmail_connections.scopes array — never sent to Google.
 * Lets Resume sending work before the optional sends_enabled column exists
 * (Supabase SQL editor timed out on the heavier unique-index migration).
 */
export const GMAIL_SENDS_ENABLED_MARKER = "csc:gmail-sends-enabled";

export function hasSendsEnabledMarker(scopes: string[] | null | undefined): boolean {
  return Array.isArray(scopes) && scopes.includes(GMAIL_SENDS_ENABLED_MARKER);
}

export function withSendsEnabledMarker(scopes: string[] | null | undefined, enabled: boolean): string[] {
  const next = (Array.isArray(scopes) ? scopes : []).filter((scope) => scope !== GMAIL_SENDS_ENABLED_MARKER);
  if (enabled) next.push(GMAIL_SENDS_ENABLED_MARKER);
  return next;
}

/**
 * Open the exact thread in Joel’s connected Gmail account.
 * `u/0` is whichever Google account happens to be first in the browser — that is
 * what made these links land on a random inbox. `authuser` + `#all/` keeps the
 * thread even if it left Inbox.
 */
export function gmailThreadUrl(
  threadId: string,
  accountEmail?: string | null,
  messageId?: string | null
): string {
  const params = new URLSearchParams();
  const email = accountEmail?.trim();
  if (email) params.set("authuser", email);
  const query = params.toString();
  const hash =
    messageId && messageId.trim()
      ? `#search/rfc822msgid:${encodeURIComponent(messageId.trim())}`
      : `#all/${threadId}`;
  return `https://mail.google.com/mail/${query ? `?${query}` : ""}${hash}`;
}

/** Add N calendar days to an ISO timestamp (UTC date arithmetic is fine for v1 cadence). */
export function addDaysIso(fromIso: string, days: number): string {
  const d = new Date(fromIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}
