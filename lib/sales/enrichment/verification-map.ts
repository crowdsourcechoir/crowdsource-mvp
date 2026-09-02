import type { Contact } from "@/lib/sales/types";
import type { HunterVerifierResult } from "./hunter-verifier";

/**
 * Map a Hunter Email Verifier payload onto our contact status.
 * Only a live SMTP-ok, non-catch-all "valid" is sendable.
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

export function hunterVerifierBlocksSend(status: Contact["emailVerificationStatus"]): boolean {
  return status === "invalid" || status === "risky" || status === "unverified";
}
