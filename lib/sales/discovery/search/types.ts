export type SearchProvider = "tavily" | "serper";

export type SearchResultItem = {
  title: string;
  url: string;
  snippet: string;
};

export type SearchQueryResult = {
  provider: SearchProvider;
  query: string;
  results: SearchResultItem[];
  error: string | null;
};
