import type { EnrichmentInput, EnrichmentResult } from "./types";

const APOLLO_MATCH_URL = "https://api.apollo.io/api/v1/people/match";
const FETCH_TIMEOUT_MS = 10000;

/**
 * Apollo.io People Enrichment ("match") — self-serve REST API, API key generated in
 * account settings, available on every Apollo plan (including free). Matches a person by
 * first name + last name + employer domain and, when found, returns their work email.
 * `reveal_personal_emails=false` keeps this to professional/work emails only — never a
 * personal address. Consumes an Apollo credit only when Apollo actually returns matched data
 * (per Apollo's own pricing docs), not on a miss.
 */
export async function enrichWithApollo(input: EnrichmentInput): Promise<EnrichmentResult> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return { provider: "apollo", status: "error", email: null, error: "APOLLO_API_KEY not configured" };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const url = new URL(APOLLO_MATCH_URL);
    url.searchParams.set("first_name", input.firstName);
    url.searchParams.set("last_name", input.lastName);
    url.searchParams.set("domain", input.domain);
    url.searchParams.set("reveal_personal_emails", "false");
    url.searchParams.set("reveal_phone_number", "false");

    const res = await fetch(url.toString(), {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "x-api-key": apiKey },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { provider: "apollo", status: "error", email: null, error: `Apollo HTTP ${res.status}` };
    }
    const body = (await res.json()) as { person?: { email?: string | null; email_status?: string | null } | null };
    const email = body.person?.email ?? null;
    if (email && email !== "email_not_unlocked@domain.com") {
      return { provider: "apollo", status: "found", email, error: null };
    }
    return { provider: "apollo", status: "not_found", email: null, error: null };
  } catch (err) {
    return { provider: "apollo", status: "error", email: null, error: err instanceof Error ? err.message : "Apollo request failed" };
  }
}
