import type { Contact } from "@/lib/sales/types";
import type { HunterVerifierResult } from "./hunter-verifier";

/**
 * Map a Hunter Email Verifier payload onto our contact status.
 * `verified_deliverable` is SMTP-ok non-catch-all. Catch-all / accept_all maps to
 * `risky` (shown in UI) but does not block send — Joel decides.
 */
export function mapHunterVerifierToContactStatus(
  result: HunterVerifierResult
): Contact["emailVerificationStatus"] {
  if (!result.ok || !result.status) return "unverified";
  if (result.status === "invalid" || result.status === "disposable" || result.gibberish) {
    return "invalid";
  }
  if (result.status === "valid" && result.smtpCheck && !result.acceptAll) {
    return "verified_deliverable";
  }
  if (
    result.status === "accept_all" ||
    result.status === "webmail" ||
    result.status === "unknown" ||
    result.acceptAll
  ) {
    return "risky";
  }
  if (result.status === "valid") return "risky";
  return "unverified";
}

/** Hard bounce only — soft Hunter results (risky / accept_all) do not block send. */
export function hunterVerifierBlocksSend(status: Contact["emailVerificationStatus"]): boolean {
  return status === "invalid";
}
