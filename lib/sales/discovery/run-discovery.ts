import { listOrganizationTypes } from "../db/lookups";
import { createOrganization, findExistingOrganization } from "../db/organizations";
import { createDiscoveryRun, finishDiscoveryRun } from "../db/discoveryRuns";
import { normalizeOrgName } from "../dedupe";
import { activeSearchProvider, runSearch } from "./search";
import { buildDiscoveryQueries } from "./queryBuilder";
import { extractCandidatesFromSearchResult } from "./extractCandidates";
import { normalizeDiscoveryOptions, type DiscoveryRunOptions } from "./presets";
import { junkDiscoveryReason } from "./junkFilter";
import type { DiscoveryRun } from "../types";

/**
 * Hard cap on brand-new organization rows created per discovery run — a cost/volume control.
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
  options: ReturnType<typeof normalizeDiscoveryOptions>;
};

/**
 * Stage 0: finds brand-new candidate organizations that aren't in `organizations` yet.
 * Pass `options` from the admin UI (convention centers, custom focus, cities, year).
 * Cron should call with no options (default org-type rotation).
 */
export async function runDiscoveryRun(
  trigger: DiscoveryRun["trigger"] = "manual",
  rawOptions?: DiscoveryRunOptions | null
): Promise<DiscoveryRunSummary> {
  const options = normalizeDiscoveryOptions(rawOptions);
  const maxNew = options.maxNewOrganizations ?? MAX_NEW_ORGANIZATIONS_PER_RUN;
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
      options,
    };
  }

  const queryLog: DiscoveryRun["queries"] = [];
  const createdOrganizationIds: string[] = [];
  const createdNormalizedNamesThisRun = new Set<string>();
  let candidatesFound = 0;
  let candidatesNew = 0;
  let candidatesDuplicate = 0;
  let candidatesJunk = 0;
  let totalTokensInput = 0;
  let totalTokensOutput = 0;
  let totalCostUsd = 0;
  let model: string | undefined;
  let runError: string | null = null;

  try {
    const organizationTypes = await listOrganizationTypes();
    const queries = buildDiscoveryQueries(organizationTypes, options);

    for (const query of queries) {
      if (createdOrganizationIds.length >= maxNew) break;

      const searchResult = await runSearch(query);
      if (!searchResult || searchResult.error) {
        queryLog.push({ query, resultsCount: 0, candidatesExtracted: 0 });
        continue;
      }

      const extraction = await extractCandidatesFromSearchResult(searchResult, { mode: options.mode });
      if (extraction.model) model = extraction.model;
      totalTokensInput += extraction.tokensInput;
      totalTokensOutput += extraction.tokensOutput;
      totalCostUsd += extraction.costUsd;
      candidatesFound += extraction.candidates.length;
      queryLog.push({
        query,
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

        try {
          const junkReason = junkDiscoveryReason(name, candidate.websiteUrl);
          if (junkReason) {
            candidatesJunk += 1;
            createdNormalizedNamesThisRun.add(normalized);
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
              discoveryMode: options.mode,
              discoveryFocus: options.focus ?? null,
              discoveryCities: options.cities ?? null,
              discoveryYear: options.year ?? null,
            },
          });
          createdNormalizedNamesThisRun.add(normalized);
          createdOrganizationIds.push(created.id);
          candidatesNew += 1;
        } catch (candidateErr) {
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

  // Persist junk rejects in the query log so Recent runs can show why "found" ≠ "new"
  // without a schema migration on discovery_runs.
  if (candidatesJunk > 0) {
    queryLog.push({
      query: `(junk filter rejected ${candidatesJunk})`,
      resultsCount: 0,
      candidatesExtracted: 0,
    });
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
    options,
  };
}
