/** Hunter usage policy — shared by the pipeline and Settings → Hunter enrichment. */

/** Verifier calls allowed per pipeline run (each completed check costs 0.5 credit). */
export const MAX_HUNTER_VERIFY_PER_RUN = 5;

/**
 * Find-more / Domain Search: keep spend on net-new orgs, not deep-mining one grid.
 * Re-exported from hunter-org-budget for Settings readouts.
 */
export {
  MAX_HUNTER_CONTACTS_PER_ORG,
  MAX_HUNTER_CREDITS_PER_ORG,
} from "./hunter-org-budget";

/** Product-fixed Hunter cost rules, shown as readouts in Settings. */
export const HUNTER_COST_RULES: { action: string; cost: string }[] = [
  { action: "Email Finder", cost: "1 credit only when an email is found — misses are free" },
  { action: "Email Verifier", cost: "0.5 credit per completed check — unknown / failed are free" },
  { action: "Domain Search", cost: "1 credit per 1–10 emails returned" },
  {
    action: "Find more contacts (per org)",
    cost: "Top 3 people · ≤3 credits total — prefer new orgs over deeper digs",
  },
  { action: "Account balance", cost: "Free" },
];
