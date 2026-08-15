import type { EnrichmentInput, EnrichmentResult } from "./types";

const HUNTER_FINDER_URL = "https://api.hunter.io/v2/email-finder";
const FETCH_TIMEOUT_MS = 10000;

/**
 * Hunter.io Email Finder — sole contact-enrichment provider for the sales agent.
 * 1 credit per call only when an email is found (misses are free per Hunter docs).
 */
export async function enrichWithHunter(input: EnrichmentInput): Promise<EnrichmentResult> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return { provider: "hunter", status: "error", email: null, error: "HUNTER_API_KEY not configured" };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const url = new URL(HUNTER_FINDER_URL);
    url.searchParams.set("domain", input.domain);
    url.searchParams.set("first_name", input.firstName);
    url.searchParams.set("last_name", input.lastName);
    url.searchParams.set("api_key", apiKey);

    const res = await fetch(url.toString(), { signal: controller.signal, headers: { Accept: "application/json" } });
    clearTimeout(timeout);

    if (!res.ok) {
      return { provider: "hunter", status: "error", email: null, error: `Hunter HTTP ${res.status}` };
    }
    const body = (await res.json()) as { data?: { email?: string | null; score?: number | null } };
    const email = body.data?.email ?? null;
    return email ? { provider: "hunter", status: "found", email, error: null } : { provider: "hunter", status: "not_found", email: null, error: null };
  } catch (err) {
    return { provider: "hunter", status: "error", email: null, error: err instanceof Error ? err.message : "Hunter request failed" };
  }
}
