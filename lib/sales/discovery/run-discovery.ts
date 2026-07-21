import { listOrganizationTypes } from "../db/lookups";
import { createOrganization, findExistingOrganization } from "../db/organizations";
import { createDiscoveryRun, finishDiscoveryRun } from "../db/discoveryRuns";
import { normalizeOrgName } from "../dedupe";
import { activeSearchProvider, runSearch } from "./search";
import { buildDiscoveryQueries } from "./queryBuilder";
import { extractCandidatesFromSearchResult } from "./extractCandidates";
import type { DiscoveryRun } from "../types";

/**
 * Hard cap on brand-new organization rows created per discovery run — a cost/volume control,
 * not a quality one (mirrors MAX_ENRICHMENT_PER_RUN in enrichContacts.ts). Chosen so nightly
 * discovery tops up the top of the funnel without ever threatening the 30-50/day human-review
 * budget on its own: these rows still have to go through the full 10-stage pipeline and land in
 * the approval queue before they cost a human any time, and most nights the existing
 * ~270-organization seeded pool is still the dominant source of queue volume anyway.
 */
const MAX_NEW_ORGANIZATIONS_PER_RUN = 15;

export type DiscoveryRunSummary = {
  discoveryRunId: string;
  status: DiscoveryRun["status"];
  provider: DiscoveryRun["provider"];
  candidatesFound: number;
  candidatesNew: number;
  candidatesDuplicate: number;
  createdOrganizationIds: string[];
  queries: DiscoveryRun["queries"];
  error: string | null;
};

/**
 * Stage 0: finds brand-new candidate organizations that aren't in `organizations` yet, so the
 * existing 10-stage pipeline always has fresh raw material to work through once the original
 * seeded set is exhausted. Runs BEFORE normalize/stage 1 — there's no organization row yet when
 * this runs, so it's a sibling of pipeline_runs, not a per-organization pipeline stage.
 *
 * No-op (zero cost, zero API calls) if neither TAVILY_API_KEY nor SERPER_API_KEY is configured
 * — identical graceful-degradation shape to lib/sales/enrichment.
 *
 * Never invents an organization: every created row traces back to a specific search result
 * (query + source URL), exactly like research_findings trace to research_sources.
 */
export async function runDiscoveryRun(trigger: DiscoveryRun["trigger"] = "manual"): Promise<DiscoveryRunSummary> {
  const provider = activeSearchProvider();
  const discoveryRun = await createDiscoveryRun(trigger);

  if (!provider) {
    await finishDiscoveryRun(discoveryRun.id, {
      status: "succeeded",
      provider: null,
      queries: [],
      candidatesFound: 0,
      candidatesNew: 0,
      candidatesDuplicate: 0,
      createdOrganizationIds: [],
    });
    return {
      discoveryRunId: discoveryRun.id,
      status: "succeeded",
      provider: null,
      candidatesFound: 0,
      candidatesNew: 0,
      candidatesDuplicate: 0,
      createdOrganizationIds: [],
      queries: [],
      error: null,
    };
  }

  const queryLog: DiscoveryRun["queries"] = [];
  const createdOrganizationIds: string[] = [];
  const createdNormalizedNamesThisRun = new Set<string>(); // avoids a redundant DB round-trip when two queries surface the same org within one run
  let candidatesFound = 0;
  let candidatesNew = 0;
  let candidatesDuplicate = 0;
  let totalTokensInput = 0;
  let totalTokensOutput = 0;
  let totalCostUsd = 0;
  let model: string | undefined;
  let runError: string | null = null;

  try {
    const organizationTypes = await listOrganizationTypes();
    const queries = buildDiscoveryQueries(organizationTypes);

    for (const query of queries) {
      if (createdOrganizationIds.length >= MAX_NEW_ORGANIZATIONS_PER_RUN) break;

      const searchResult = await runSearch(query);
      if (!searchResult || searchResult.error) {
        queryLog.push({ query, resultsCount: 0, candidatesExtracted: 0 });
        continue;
      }

      const extraction = await extractCandidatesFromSearchResult(searchResult);
      if (extraction.model) model = extraction.model;
      totalTokensInput += extraction.tokensInput;
      totalTokensOutput += extraction.tokensOutput;
      totalCostUsd += extraction.costUsd;
      candidatesFound += extraction.candidates.length;
      queryLog.push({ query, resultsCount: searchResult.results.length, candidatesExtracted: extraction.candidates.length });

      for (const candidate of extraction.candidates) {
        if (createdOrganizationIds.length >= MAX_NEW_ORGANIZATIONS_PER_RUN) break;
        const name = candidate.organizationName.trim();
        if (!name) continue;

        const normalized = normalizeOrgName(name);
        if (createdNormalizedNamesThisRun.has(normalized)) {
          candidatesDuplicate += 1;
          continue;
        }

        const existing = await findExistingOrganization(name, candidate.websiteUrl);
        if (existing) {
          candidatesDuplicate += 1;
          createdNormalizedNamesThisRun.add(normalized);
          continue;
        }

        const created = await createOrganization({
          name,
          websiteUrl: candidate.websiteUrl,
          source: "ai_discovered",
          importMetadata: {
            discoveryQuery: candidate.query,
            discoverySourceUrl: candidate.sourceUrl,
            discoveryRationale: candidate.rationale,
            discoveryRunId: discoveryRun.id,
          },
        });
        createdNormalizedNamesThisRun.add(normalized);
        createdOrganizationIds.push(created.id);
        candidatesNew += 1;
      }
    }
  } catch (err) {
    runError = err instanceof Error ? err.message : "Discovery run failed";
  }

  const status: DiscoveryRun["status"] = runError ? "failed" : "succeeded";
  await finishDiscoveryRun(discoveryRun.id, {
    status,
    provider,
    queries: queryLog,
    candidatesFound,
    candidatesNew,
    candidatesDuplicate,
    createdOrganizationIds,
    model,
    tokensInput: totalTokensInput,
    tokensOutput: totalTokensOutput,
    costUsd: totalCostUsd,
    error: runError,
  });

  return {
    discoveryRunId: discoveryRun.id,
    status,
    provider,
    candidatesFound,
    candidatesNew,
    candidatesDuplicate,
    createdOrganizationIds,
    queries: queryLog,
    error: runError,
  };
}
