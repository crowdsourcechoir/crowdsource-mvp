import { activeSearchProvider, runSearch } from "../../discovery/search";
import { fetchAndExtractFromUrl, type ResearchStageOutput } from "./research";
import type { Organization } from "../../types";

/** Near-miss band: worth a second, search-backed research pass aimed at lifting the score to 70+. */
export const DEEPEN_MIN_SCORE = 45;
export const DEEPEN_MAX_SCORE = 70;

const MAX_DEEPEN_QUERIES = 3;
const MAX_DEEPEN_PAGES = 5;
const SKIP_URL_PATTERN = /facebook\.com|twitter\.com|x\.com|instagram\.com|linkedin\.com|youtube\.com|tiktok\.com/i;

function buildDeepenQueries(org: Organization, missingInformation: string[]): string[] {
  const name = org.name;
  const queries = [
    `${name} annual conference OR convention attendance OR registrants`,
    `${name} "executive director" OR "program director" OR "events director" OR leadership`,
    `${name} sponsorship OR exhibitors OR "annual report" OR membership`,
  ];
  for (const gap of missingInformation.slice(0, 2)) {
    const cleaned = gap.replace(/\s+/g, " ").trim().slice(0, 80);
    if (cleaned.length >= 12) queries.push(`${name} ${cleaned}`);
  }
  return queries.slice(0, MAX_DEEPEN_QUERIES);
}

/**
 * Second-pass research for opportunities that scored below the digest bar but look salvageable.
 * Uses the same Tavily/Serper keys as discovery to find extra pages (attendance, leadership,
 * sponsorship) beyond the org's own nav, then extracts findings with the same untrusted-content
 * boundary as stage 2. No-ops (zero cost) when no search provider is configured.
 *
 * Tracked as another `research` agent_runs row so we don't need a DB stage-constraint migration.
 */
export async function runDeepenResearchPass(
  org: Organization,
  pipelineRunId: string,
  missingInformation: string[]
): Promise<{ output: ResearchStageOutput & { queriesRun: string[]; urlsFetched: string[] }; model?: string; tokensInput?: number; tokensOutput?: number; costUsd?: number }> {
  const empty = {
    output: {
      pagesAttempted: 0,
      pagesFetched: 0,
      findingsCreated: 0,
      namedPeopleMentioned: [] as ResearchStageOutput["namedPeopleMentioned"],
      queriesRun: [] as string[],
      urlsFetched: [] as string[],
    },
  };

  if (!activeSearchProvider()) return empty;

  const queries = buildDeepenQueries(org, missingInformation);
  const candidateUrls: string[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const result = await runSearch(query);
    if (!result || result.error) continue;
    for (const item of result.results) {
      if (!item.url || SKIP_URL_PATTERN.test(item.url) || seen.has(item.url)) continue;
      seen.add(item.url);
      candidateUrls.push(item.url);
      if (candidateUrls.length >= MAX_DEEPEN_PAGES) break;
    }
    if (candidateUrls.length >= MAX_DEEPEN_PAGES) break;
  }

  if (candidateUrls.length === 0) {
    return { ...empty, output: { ...empty.output, queriesRun: queries } };
  }

  let pagesAttempted = 0;
  let pagesFetched = 0;
  let findingsCreated = 0;
  let totalTokensInput = 0;
  let totalTokensOutput = 0;
  let totalCostUsd = 0;
  let model: string | undefined;
  const namedPeopleMentioned: ResearchStageOutput["namedPeopleMentioned"] = [];
  const urlsFetched: string[] = [];

  for (const url of candidateUrls.slice(0, MAX_DEEPEN_PAGES)) {
    pagesAttempted += 1;
    const page = await fetchAndExtractFromUrl(org, pipelineRunId, url);
    if (page.fetched) {
      pagesFetched += 1;
      urlsFetched.push(url);
    }
    findingsCreated += page.findingsCreated;
    namedPeopleMentioned.push(...page.namedPeople);
    if (page.usage.model) model = page.usage.model;
    totalTokensInput += page.usage.tokensInput;
    totalTokensOutput += page.usage.tokensOutput;
    totalCostUsd += page.usage.costUsd;
  }

  return {
    output: {
      pagesAttempted,
      pagesFetched,
      findingsCreated,
      namedPeopleMentioned,
      queriesRun: queries,
      urlsFetched,
    },
    model,
    tokensInput: totalTokensInput,
    tokensOutput: totalTokensOutput,
    costUsd: totalCostUsd,
  };
}
