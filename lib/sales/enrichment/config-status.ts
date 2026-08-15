/**
 * Contact enrichment config — Hunter.io is the sole provider.
 * Does not call providers — presence only (never returns key values).
 */
export type EnrichmentConfigStatus = {
  provider: "hunter";
  hunter: boolean;
  /** True when HUNTER_API_KEY is set. */
  ready: boolean;
  missing: ("HUNTER_API_KEY")[];
  /** Short message safe to show in admin UI / agent replies. */
  message: string | null;
};

export function getEnrichmentConfigStatus(): EnrichmentConfigStatus {
  const hunter = Boolean(process.env.HUNTER_API_KEY?.trim());
  const missing: EnrichmentConfigStatus["missing"] = [];
  if (!hunter) missing.push("HUNTER_API_KEY");

  return {
    provider: "hunter",
    hunter,
    ready: hunter,
    missing,
    message: hunter
      ? null
      : "HUNTER_API_KEY is missing — contact enrichment is off. Set it in Vercel Production and Cursor Cloud Agent secrets. Apollo is not used.",
  };
}
