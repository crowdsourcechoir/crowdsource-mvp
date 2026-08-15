import { enrichWithHunter } from "./hunter";
import type { EnrichmentInput, EnrichmentProvider, EnrichmentResult } from "./types";

export type { EnrichmentInput, EnrichmentProvider, EnrichmentResult } from "./types";
export { getEnrichmentConfigStatus } from "./config-status";
export type { EnrichmentConfigStatus } from "./config-status";
export { getHunterAccountCredits } from "./hunter-account";

/**
 * Hunter.io is the sole contact-enrichment provider for the sales agent.
 * Apollo is intentionally unused (even if APOLLO_API_KEY is still in env).
 */
export function activeEnrichmentProvider(): EnrichmentProvider | null {
  if (process.env.HUNTER_API_KEY?.trim()) return "hunter";
  return null;
}

export async function enrichContactEmail(input: EnrichmentInput): Promise<EnrichmentResult | null> {
  if (!process.env.HUNTER_API_KEY?.trim()) return null;
  return enrichWithHunter(input);
}
