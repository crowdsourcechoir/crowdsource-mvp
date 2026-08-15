/**
 * Hard outbound blocklist — cannot be overridden by env flags.
 * Cleared 2026-08-15 after Joel asked to re-add Tyler Cofer to the Seahawks queue.
 * Keep the helper so a future incident can re-block specific addresses quickly.
 */
const HARD_BLOCKED_EMAILS = new Set<string>([
  // intentionally empty — tylerc@seahawks.com was removed at Joel's request
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
