/** Classify Gmail inbound: live reply vs auto-reply vs bounce. */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const BOUNCE_FROM_RE =
  /mailer-daemon|postmaster@|mail delivery subsystem|undeliverable/i;
const BOUNCE_SUBJECT_RE =
  /delivery status notification|undeliverable|mail delivery failed|returned mail|failure notice|delivery failure/i;
const AUTO_SUBJECT_RE =
  /^(auto:|automatic reply|out of office|ooo\b|autoreply|auto-reply)/i;
const AUTO_SNIPPET_RE =
  /out of (the )?office|automatic reply|auto-?reply|on leave until|away from (the office|email)|this is an automated/i;

export type InboundKind = "live" | "auto" | "bounce";

export type InboundHeaders = {
  from?: string | null;
  subject?: string | null;
  autoSubmitted?: string | null;
  xAutoreply?: string | null;
  precedence?: string | null;
  xFailedRecipients?: string | null;
};

export function extractEmailAddresses(value: string | null | undefined): string[] {
  if (!value) return [];
  const matches = value.match(EMAIL_RE);
  return (matches ?? []).map((email) => email.toLowerCase());
}

export function looksLikeBounce(input: {
  from?: string | null;
  subject?: string | null;
  xFailedRecipients?: string | null;
}): boolean {
  if (input.xFailedRecipients?.trim()) return true;
  if (input.from && BOUNCE_FROM_RE.test(input.from)) return true;
  if (input.subject && BOUNCE_SUBJECT_RE.test(input.subject)) return true;
  return false;
}

export function looksLikeAutoReply(input: {
  subject?: string | null;
  snippet?: string | null;
  autoSubmitted?: string | null;
  xAutoreply?: string | null;
  precedence?: string | null;
}): boolean {
  const autoSubmitted = input.autoSubmitted?.trim().toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") return true;
  if (input.xAutoreply?.trim()) return true;
  const precedence = input.precedence?.trim().toLowerCase();
  if (precedence === "auto_reply" || precedence === "bulk" || precedence === "junk") return true;
  if (input.subject && AUTO_SUBJECT_RE.test(input.subject.trim())) return true;
  if (input.snippet && AUTO_SNIPPET_RE.test(input.snippet)) return true;
  return false;
}

export function classifyInbound(input: InboundHeaders & { snippet?: string | null }): InboundKind {
  if (looksLikeBounce(input)) return "bounce";
  if (looksLikeAutoReply(input)) return "auto";
  return "live";
}

export function failedRecipientsFromBounce(input: {
  xFailedRecipients?: string | null;
  snippet?: string | null;
  to?: string | null;
}): string[] {
  const fromHeader = extractEmailAddresses(input.xFailedRecipients);
  if (fromHeader.length) return Array.from(new Set(fromHeader));
  const fromSnippet = extractEmailAddresses(input.snippet);
  const skip = /mailer-daemon|postmaster/i;
  const filtered = fromSnippet.filter((email) => !skip.test(email));
  if (filtered.length) return Array.from(new Set(filtered));
  return Array.from(new Set(extractEmailAddresses(input.to)));
}

export function sendKindFromMetadata(metadata: Record<string, unknown> | null | undefined): "initial" | "nudge" {
  return metadata?.kind === "nudge" ? "nudge" : "initial";
}

export function replyKindFromActivity(input: {
  metadata?: Record<string, unknown> | null;
  snippet?: string | null;
}): "live" | "auto" {
  const meta = input.metadata ?? {};
  const stored = meta.replyKind ?? meta.kind;
  if (stored === "auto") return "auto";
  if (stored === "live") return "live";
  const snippet =
    input.snippet ?? (typeof meta.snippet === "string" ? meta.snippet : null);
  const subject = typeof meta.subject === "string" ? meta.subject : null;
  return looksLikeAutoReply({ subject, snippet }) ? "auto" : "live";
}
