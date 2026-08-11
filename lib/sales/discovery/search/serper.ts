import { getDiscoveryMaxResultsPerQuery } from "../config";
import type { SearchQueryResult, SearchResultItem } from "./types";

const SERPER_SEARCH_URL = "https://google.serper.dev/search";
const FETCH_TIMEOUT_MS = 15000;

/**
 * Serper.dev — self-serve Google-results-as-JSON API, free-tier API key from the dashboard, no
 * sales process. Used only as a fallback when TAVILY_API_KEY isn't configured (see
 * lib/sales/discovery/search/index.ts for provider selection) — same fallback shape as
 * Hunter.io behind Apollo.io in lib/sales/enrichment.
 */
export async function searchWithSerper(query: string): Promise<SearchQueryResult> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return { provider: "serper", query, results: [], error: "SERPER_API_KEY not configured" };

  const maxResults = getDiscoveryMaxResultsPerQuery();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(SERPER_SEARCH_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
      body: JSON.stringify({ q: query, num: maxResults }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { provider: "serper", query, results: [], error: `Serper HTTP ${res.status}` };
    }
    const body = (await res.json()) as { organic?: { title?: string; link?: string; snippet?: string }[] };
    const results: SearchResultItem[] = (body.organic ?? [])
      .filter((r) => r.title && r.link)
      .map((r) => ({ title: r.title as string, url: r.link as string, snippet: (r.snippet ?? "").slice(0, 800) }));
    return { provider: "serper", query, results, error: null };
  } catch (err) {
    return { provider: "serper", query, results: [], error: err instanceof Error ? err.message : "Serper request failed" };
  }
}
