import { searchWithTavily } from "./tavily";
import { searchWithSerper } from "./serper";
import type { SearchProvider, SearchQueryResult } from "./types";

export type { SearchProvider, SearchQueryResult, SearchResultItem } from "./types";

/**
 * Tavily is preferred (results are pre-summarized for LLM consumption); Serper is the
 * automatic fallback. Both are self-serve REST APIs with a free tier — a runtime choice based
 * on whichever key is configured, exactly like lib/sales/enrichment/index.ts's Apollo/Hunter
 * selection, so switching providers is an env var change, not a code change.
 */
export function activeSearchProvider(): SearchProvider | null {
  if (process.env.TAVILY_API_KEY) return "tavily";
  if (process.env.SERPER_API_KEY) return "serper";
  return null;
}

export async function runSearch(query: string): Promise<SearchQueryResult | null> {
  const provider = activeSearchProvider();
  if (!provider) return null;
  return provider === "tavily" ? searchWithTavily(query) : searchWithSerper(query);
}
