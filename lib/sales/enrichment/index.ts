import { enrichWithApollo } from "./apollo";
import { enrichWithHunter } from "./hunter";
import type { EnrichmentInput, EnrichmentProvider, EnrichmentResult } from "./types";

export type { EnrichmentInput, EnrichmentProvider, EnrichmentResult } from "./types";

/**
 * Hunter is preferred for now — Apollo's people-enrichment/"match" endpoint (what
 * `enrichWithApollo` calls) is NOT actually included on Apollo's free plan, a valid API key on a
 * free account gets a `403 API_INACCESSIBLE` on every single call, "not included in your Free
 * plan ... All paid plans include full API access." Hunter's Email Finder endpoint, by contrast,
 * genuinely is included on Hunter's free plan (50 credits/month, verified against Hunter's own
 * docs and against real enrichment results in this project). Calling Apollo first and always
 * falling back to Hunter worked, but wasted a request + added latency on every single lookup, so
 * Hunter is called directly. Apollo is only used as an (unlikely) fallback if Hunter itself
 * errors and an Apollo key happens to be configured — revisit this ordering once Apollo is on a
 * paid plan.
 */
export function activeEnrichmentProvider(): EnrichmentProvider | null {
  if (process.env.HUNTER_API_KEY) return "hunter";
  if (process.env.APOLLO_API_KEY) return "apollo";
  return null;
}

export async function enrichContactEmail(input: EnrichmentInput): Promise<EnrichmentResult | null> {
  const hasApollo = Boolean(process.env.APOLLO_API_KEY);
  const hasHunter = Boolean(process.env.HUNTER_API_KEY);
  if (!hasApollo && !hasHunter) return null;

  if (!hasHunter) return enrichWithApollo(input);

  const hunterResult = await enrichWithHunter(input);
  if (hunterResult.status !== "error" || !hasApollo) return hunterResult;
  // Hunter errored outright (rate limit, timeout, HTTP failure — not just "no match found") and
  // an Apollo key happens to be configured too: retry with Apollo rather than losing the
  // enrichment attempt entirely. The caller/DB records whichever provider actually produced the
  // result, so this stays accurate regardless of which one is "preferred."
  return enrichWithApollo(input);
}
