/**
 * Hard outbound blocklist — cannot be overridden by env flags.
 * Added after accidental multi-send to Tyler Cofer (Seahawks), 2026-08-15.
 */
const HARD_BLOCKED_EMAILS = new Set([
  "tylerc@seahawks.com",
]);

export function normalizeEmailForBlocklist(email: string): string {
  return email.trim().toLowerCase();
}

export function isOutboundEmailBlocked(email: string | null | undefined): boolean {
  if (!email) return false;
  return HARD_BLOCKED_EMAILS.has(normalizeEmailForBlocklist(email));
}

export function assertOutboundEmailAllowed(email: string): void {
  if (isOutboundEmailBlocked(email)) {
    throw new Error(
      `Outbound email blocked for ${normalizeEmailForBlocklist(email)} — hard blocklist (do not send).`
    );
  }
}
