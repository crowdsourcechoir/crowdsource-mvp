/**
 * Which contact-enrichment API keys are present in this runtime.
 * Does not call providers — presence only (never returns key values).
 */
export type EnrichmentConfigStatus = {
  hunter: boolean;
  apollo: boolean;
  /** True when at least one provider key is set. */
  ready: boolean;
  /** Env var names that are missing. Both are required for agents + full fallback. */
  missing: ("HUNTER_API_KEY" | "APOLLO_API_KEY")[];
  /** Short message safe to show in admin UI / agent replies. */
  message: string | null;
};

export function getEnrichmentConfigStatus(): EnrichmentConfigStatus {
  const hunter = Boolean(process.env.HUNTER_API_KEY?.trim());
  const apollo = Boolean(process.env.APOLLO_API_KEY?.trim());
  const missing: EnrichmentConfigStatus["missing"] = [];
  if (!hunter) missing.push("HUNTER_API_KEY");
  if (!apollo) missing.push("APOLLO_API_KEY");

  let message: string | null = null;
  if (missing.length === 2) {
    message =
      "Contact enrichment is off — set HUNTER_API_KEY and APOLLO_API_KEY (Vercel Production + Cursor Cloud Agent secrets). Without them the sales queue cannot get verified emails.";
  } else if (!hunter) {
    message =
      "HUNTER_API_KEY is missing. Hunter is the free-tier Email Finder; without it enrichment falls back to Apollo only (often 403 on free Apollo plans).";
  } else if (!apollo) {
    message =
      "APOLLO_API_KEY is missing. Set it so enrichment can fall back when Hunter errors or returns no match.";
  }

  return {
    hunter,
    apollo,
    ready: hunter || apollo,
    missing,
    message,
  };
}
