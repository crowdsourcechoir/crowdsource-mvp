import { listOrganizationTypes } from "../db/lookups";
import { createOrganization, findExistingOrganization, listKnownOrganizationDomains } from "../db/organizations";
import { createDiscoveryRun, finishDiscoveryRun } from "../db/discoveryRuns";
import { normalizeOrgName, extractDomain } from "../dedupe";
import {
  getDiscoveryExcludeDomainCount,
  getDiscoveryMaxNewOrganizationsPerRun,
} from "./config";
import { activeSearchProvider, runSearch, withExcludedDomains } from "./search";
import { buildDiscoveryQueries } from "./queryBuilder";
import { extractCandidatesFromSearchResult } from "./extractCandidates";
import type { DiscoveryRun } from "../types";

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
 * existing 10-stage pipeline always has fresh raw material beyond the seeded CSV lists.
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
  const maxNew = getDiscoveryMaxNewOrganizationsPerRun();

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
  const createdNormalizedNamesThisRun = new Set<string>();
  const createdDomainsThisRun = new Set<string>();
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
    const knownDomains = await listKnownOrganizationDomains(getDiscoveryExcludeDomainCount());
    const daySalt = Math.floor(Date.now() / 86_400_000);

    for (let qi = 0; qi < queries.length; qi++) {
      if (createdOrganizationIds.length >= maxNew) break;

      const baseQuery = queries[qi];
      // Rotate which known domains get `-site:` excludes so we don't always suppress the same set.
      const query = withExcludedDomains(baseQuery, knownDomains, daySalt + qi);
      const searchResult = await runSearch(query);
      if (!searchResult || searchResult.error) {
        queryLog.push({ query: baseQuery, resultsCount: 0, candidatesExtracted: 0 });
        continue;
      }

      const extraction = await extractCandidatesFromSearchResult(searchResult);
      if (extraction.model) model = extraction.model;
      totalTokensInput += extraction.tokensInput;
      totalTokensOutput += extraction.tokensOutput;
      totalCostUsd += extraction.costUsd;
      candidatesFound += extraction.candidates.length;
      queryLog.push({
        query: baseQuery,
        resultsCount: searchResult.results.length,
        candidatesExtracted: extraction.candidates.length,
      });

      for (const candidate of extraction.candidates) {
        if (createdOrganizationIds.length >= maxNew) break;
        const name = candidate.organizationName.trim();
        if (!name) continue;

        const normalized = normalizeOrgName(name);
        if (createdNormalizedNamesThisRun.has(normalized)) {
          candidatesDuplicate += 1;
          continue;
        }
        const domain = extractDomain(candidate.websiteUrl);
        if (domain && createdDomainsThisRun.has(domain)) {
          candidatesDuplicate += 1;
          createdNormalizedNamesThisRun.add(normalized);
          continue;
        }

        try {
          const existing = await findExistingOrganization(name, candidate.websiteUrl);
          if (existing) {
            candidatesDuplicate += 1;
            createdNormalizedNamesThisRun.add(normalized);
            if (domain) createdDomainsThisRun.add(domain);
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
          if (domain) createdDomainsThisRun.add(domain);
          createdOrganizationIds.push(created.id);
          candidatesNew += 1;
        } catch (candidateErr) {
          // One bad candidate (e.g. insert race) must not abort the whole discovery run —
          // otherwise the overnight top-up loop finds candidates but creates zero orgs and
          // the morning digest stays under its 10×70 target.
          console.error(
            `[discovery] candidate "${name}" failed:`,
            candidateErr instanceof Error ? candidateErr.message : candidateErr
          );
        }
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
