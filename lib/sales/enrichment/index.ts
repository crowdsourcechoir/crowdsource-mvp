import { enrichWithApollo } from "./apollo";
import { enrichWithHunter } from "./hunter";
import type { EnrichmentInput, EnrichmentProvider, EnrichmentResult } from "./types";

export type { EnrichmentInput, EnrichmentProvider, EnrichmentResult } from "./types";

/**
 * Apollo is preferred (broader database, phone/title data available in the same call if ever
 * needed later); Hunter is the automatic fallback. Both are self-serve REST APIs — this is a
 * runtime choice based on whichever key is configured, not a build-time one, so switching
 * providers is just an env var change, no code change or redeploy of logic needed.
 *
 * IMPORTANT, learned the hard way: Apollo's people-enrichment/"match" endpoint (what
 * `enrichWithApollo` calls) is NOT actually included on Apollo's free plan — a valid API key on
 * a free account gets a `403 API_INACCESSIBLE` on every call, "not included in your Free plan
 * ... All paid plans include full API access." Hunter's Email Finder endpoint, by contrast,
 * genuinely is included on Hunter's free plan (50 credits/month, verified against Hunter's own
 * docs). So this reports "apollo" as the *configured* preference below, but `enrichContactEmail`
 * always falls back to Hunter at runtime when Apollo errors out and a Hunter key is also present
 * — otherwise setting an Apollo key alone (free plan) would silently never enrich anything.
 */
export function activeEnrichmentProvider(): EnrichmentProvider | null {
  if (process.env.APOLLO_API_KEY) return "apollo";
  if (process.env.HUNTER_API_KEY) return "hunter";
  return null;
}

export async function enrichContactEmail(input: EnrichmentInput): Promise<EnrichmentResult | null> {
  const hasApollo = Boolean(process.env.APOLLO_API_KEY);
  const hasHunter = Boolean(process.env.HUNTER_API_KEY);
  if (!hasApollo && !hasHunter) return null;

  if (!hasApollo) return enrichWithHunter(input);

  const apolloResult = await enrichWithApollo(input);
  if (apolloResult.status !== "error" || !hasHunter) return apolloResult;
  // Apollo errored outright (plan restriction, timeout, HTTP failure — not just "no match found")
  // and a Hunter key is available too: retry this same lookup with Hunter rather than losing the
  // enrichment attempt entirely. The caller/DB record whichever provider actually produced the
  // result (`result.provider`), so this stays accurate even though Apollo is "preferred."
  return enrichWithHunter(input);
}
