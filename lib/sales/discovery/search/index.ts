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

/**
 * Append a rotating slice of `-site:domain` clauses so queries dig past orgs we already have.
 * Kept short — search engines truncate very long queries.
 */
export function withExcludedDomains(query: string, domains: string[], daySalt = 0): string {
  if (domains.length === 0) return query;
  const maxExcludes = 8;
  const start = domains.length === 0 ? 0 : daySalt % domains.length;
  const rotated = [...domains.slice(start), ...domains.slice(0, start)];
  const excludes = rotated
    .slice(0, maxExcludes)
    .map((d) => `-site:${d}`)
    .join(" ");
  return `${query} ${excludes}`.trim();
}

export async function runSearch(query: string): Promise<SearchQueryResult | null> {
  const provider = activeSearchProvider();
  if (!provider) return null;
  return provider === "tavily" ? searchWithTavily(query) : searchWithSerper(query);
}
