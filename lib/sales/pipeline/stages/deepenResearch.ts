import { activeSearchProvider, runSearch } from "../../discovery/search";
import { fetchAndExtractFromUrl, type ResearchStageOutput } from "./research";
import type { Organization } from "../../types";

/** Near-miss band: worth a second, search-backed research pass aimed at lifting the score to 70+. */
export const DEEPEN_MIN_SCORE = 45;
export const DEEPEN_MAX_SCORE = 70;

const MAX_DEEPEN_QUERIES = 6;
const MAX_DEEPEN_PAGES = 8;
const SKIP_URL_PATTERN = /facebook\.com|twitter\.com|x\.com|instagram\.com|linkedin\.com|youtube\.com|tiktok\.com/i;

export type DeepenFocus = "full" | "dates";

function isDateGap(text: string): boolean {
  return /\b(date|dates|timing|schedule|when|calendar)\b/i.test(text);
}

/**
 * Builds search queries for the deepen pass.
 * Date/schedule queries are first-class (not an afterthought), and scorer-reported gaps
 * are interleaved rather than appended-then-sliced-away (the previous bug dropped them).
 */
export function buildDeepenQueries(
  org: Organization,
  missingInformation: string[],
  focus: DeepenFocus = "full"
): string[] {
  const name = org.name;
  const dateQuery = `${name} national convention OR annual conference dates OR "March" OR schedule OR "save the date"`;
  const attendanceQuery = `${name} annual conference OR convention attendance OR registrants`;
  const leadershipQuery = `${name} "executive director" OR "program director" OR "events director" OR leadership`;
  const sponsorshipQuery = `${name} sponsorship OR exhibitors OR "annual report" OR membership`;

  const gapQueries = missingInformation
    .slice(0, 3)
    .map((gap) => gap.replace(/\s+/g, " ").trim().slice(0, 80))
    .filter((cleaned) => cleaned.length >= 12)
    .map((cleaned) => `${name} ${cleaned}`);

  if (focus === "dates") {
    const dateGaps = gapQueries.filter(isDateGap);
    return [dateQuery, ...dateGaps, `${name} convention OR conference "2026" OR "2027" OR "2028"`].slice(
      0,
      MAX_DEEPEN_QUERIES
    );
  }

  // Prefer date + attendance + leadership; slot gap queries ahead of sponsorship so they aren't dropped.
  const ordered = [dateQuery, attendanceQuery, leadershipQuery, ...gapQueries, sponsorshipQuery];
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const q of ordered) {
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(q);
    if (deduped.length >= MAX_DEEPEN_QUERIES) break;
  }
  return deduped;
}

/**
 * Second-pass research for opportunities that scored below the digest bar but look salvageable,
 * or that are missing a calendar event date despite an otherwise strong score.
 * Uses the same Tavily/Serper keys as discovery to find extra pages (dates, attendance, leadership,
 * sponsorship) beyond the org's own nav, then extracts findings with the same untrusted-content
 * boundary as stage 2. No-ops (zero cost) when no search provider is configured.
 *
 * Tracked as another `research` agent_runs row so we don't need a DB stage-constraint migration.
 */
export async function runDeepenResearchPass(
  org: Organization,
  pipelineRunId: string,
  missingInformation: string[],
  focus: DeepenFocus = "full"
): Promise<{ output: ResearchStageOutput & { queriesRun: string[]; urlsFetched: string[]; focus: DeepenFocus }; model?: string; tokensInput?: number; tokensOutput?: number; costUsd?: number }> {
  const empty = {
    output: {
      pagesAttempted: 0,
      pagesFetched: 0,
      findingsCreated: 0,
      namedPeopleMentioned: [] as ResearchStageOutput["namedPeopleMentioned"],
      queriesRun: [] as string[],
      urlsFetched: [] as string[],
      focus,
    },
  };

  if (!activeSearchProvider()) return empty;

  const queries = buildDeepenQueries(org, missingInformation, focus);
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
      focus,
    },
    model,
    tokensInput: totalTokensInput,
    tokensOutput: totalTokensOutput,
    costUsd: totalCostUsd,
  };
}
