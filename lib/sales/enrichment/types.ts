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
};
