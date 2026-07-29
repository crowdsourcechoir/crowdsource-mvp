export type EnrichmentProvider = "apollo" | "hunter";

export type EnrichmentInput = {
  firstName: string;
  lastName: string;
  domain: string;
};

export type EnrichmentResult = {
  provider: EnrichmentProvider;
  status: "found" | "not_found" | "error";
  email: string | null;
  error: string | null;
  /** Hunter confidence 0–100 when available; used to reject low-confidence guesses. */
  score?: number | null;
};
