import { getDiscoveryMaxResultsPerQuery } from "../config";
import type { SearchQueryResult, SearchResultItem } from "./types";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const FETCH_TIMEOUT_MS = 15000;

/**
 * Tavily Search API — self-serve REST API purpose-built for feeding LLM pipelines (results
 * come back as clean title/url/content triples, no HTML scraping needed on our end). API key
 * generated instantly from the Tavily dashboard, generous free tier, no sales process — same
 * self-serve bar as Apollo/Hunter in lib/sales/enrichment. Preferred over Serper here because
 * its results are already summarized/relevance-scored for exactly this "feed it to a model"
 * use case, which is all stage 0 needs.
 */
export async function searchWithTavily(query: string): Promise<SearchQueryResult> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return { provider: "tavily", query, results: [], error: "TAVILY_API_KEY not configured" };

  const maxResults = getDiscoveryMaxResultsPerQuery();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query, search_depth: "basic", max_results: maxResults }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { provider: "tavily", query, results: [], error: `Tavily HTTP ${res.status}` };
    }
    const body = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    const results: SearchResultItem[] = (body.results ?? [])
      .filter((r) => r.title && r.url)
      .map((r) => ({ title: r.title as string, url: r.url as string, snippet: (r.content ?? "").slice(0, 800) }));
    return { provider: "tavily", query, results, error: null };
  } catch (err) {
    return { provider: "tavily", query, results: [], error: err instanceof Error ? err.message : "Tavily request failed" };
  }
}
