import type { SearchProvider, SearchQueryResult } from "./types";

export type { SearchProvider, SearchQueryResult, SearchResultItem } from "./types";

/**
 * Web search (Tavily / Serper) is disabled. Hunter.io is the only paid sales API.
 * Discovery, deepen-research, and enrichment "search=1" must no-op here even if
 * TAVILY_API_KEY / SERPER_API_KEY remain in Vercel env.
 */
export function activeSearchProvider(): SearchProvider | null {
  return null;
}

export async function runSearch(_query: string): Promise<SearchQueryResult | null> {
  return null;
}

export const SEARCH_DISABLED_REASON =
  "Web search (Tavily) is off. Hunter is the only sales API — add organizations and contacts yourself.";
