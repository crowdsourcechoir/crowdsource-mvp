/** Hunter usage policy — shared by the pipeline and Settings → Hunter enrichment. */

/** Verifier calls allowed per pipeline run (each completed check costs 0.5 credit). */
export const MAX_HUNTER_VERIFY_PER_RUN = 5;

/** Product-fixed Hunter cost rules, shown as readouts in Settings. */
export const HUNTER_COST_RULES: { action: string; cost: string }[] = [
  { action: "Email Finder", cost: "1 credit only when an email is found — misses are free" },
  { action: "Email Verifier", cost: "0.5 credit per completed check — unknown / failed are free" },
  { action: "Domain Search", cost: "1 credit per 1–10 emails returned" },
  { action: "Account balance", cost: "Free" },
];
