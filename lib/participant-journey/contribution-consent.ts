import type { Event } from "@/data/mockEvents";

export const DEFAULT_CONTRIBUTION_CONSENT_TEXT =
  "Contributions may be incorporated into the live experience, recordings, and future Crowdsource Choir creations.";

export function requiresContributionConsent(event: Event): boolean {
  return event.agentBrief?.requireContributionConsent !== false;
}

export function contributionConsentText(event: Event): string {
  const text = event.agentBrief?.contributionConsentText?.trim();
  return text || DEFAULT_CONTRIBUTION_CONSENT_TEXT;
}
