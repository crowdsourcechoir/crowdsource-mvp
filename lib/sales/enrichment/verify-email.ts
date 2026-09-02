import { updateContactVerification } from "@/lib/sales/db/contacts";
import type { Contact } from "@/lib/sales/types";
import { verifyWithHunter } from "./hunter-verifier";
import { mapHunterVerifierToContactStatus } from "./verification-map";

export type VerifyEmailOutcome = {
  status: Contact["emailVerificationStatus"];
  error: string | null;
  hunterStatus: string | null;
};

/** Live Hunter SMTP check. Does not invent an address. */
export async function verifyEmailAddress(email: string): Promise<VerifyEmailOutcome> {
  const hunter = await verifyWithHunter(email);
  if (!hunter.ok) {
    return { status: "unverified", error: hunter.error, hunterStatus: hunter.status };
  }
  return {
    status: mapHunterVerifierToContactStatus(hunter),
    error: null,
    hunterStatus: hunter.status,
  };
}

export async function verifyAndStoreContactEmail(contactId: string, email: string): Promise<VerifyEmailOutcome> {
  const outcome = await verifyEmailAddress(email);
  if (outcome.status !== "unverified") {
    await updateContactVerification(contactId, outcome.status);
  }
  return outcome;
}
