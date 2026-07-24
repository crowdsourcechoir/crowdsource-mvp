import { listUnprocessedOrganizations } from "../db/organizations";
import { getLastSucceededDigestRun } from "../db/digestRuns";
import { listQueueItems } from "../db/queue";
import { assembleQueueItemDetail } from "../db/assemble";
import { runDiscoveryRun } from "../discovery/run-discovery";
import { runPipelineBatch, type PipelineBatchSummary } from "../pipeline/run-pipeline-batch";
import { runPipelineForOrganization } from "../pipeline/run-pipeline";
import { DEEPEN_MAX_SCORE, DEEPEN_MIN_SCORE } from "../pipeline/stages/deepenResearch";
import {
  getDigestAlreadySentWindowMs,
  getDigestMinScore,
  getDigestTargetCount,
  getDigestTopupTimeBudgetMs,
} from "./config";
import { loadQualifyingDigestItems, sendDailyDigest, type DigestSendResult } from "./send";

export type DigestEnsureResult = {
  status: "succeeded" | "deferred" | "already_sent" | "skipped_no_provider" | "failed";
  qualifyingCount: number;
  targetCount: number;
  minScore: number;
  topupBatches: number;
  discoveryRuns: number;
  nearMissReprocesses: number;
  pipelineSummaries: PipelineBatchSummary[];
  send?: DigestSendResult;
  error?: string;
};

const MAX_DISCOVERY_RUNS_PER_ENSURE = 2;
const MAX_NEAR_MISS_REPROCESSES_PER_ENSURE = 3;

/**
 * Pending queue orgs whose latest score sits in the deepen band (45–69) — candidates for a
 * reprocess that runs the new search-backed deepen pass and may lift them over 70.
 */
async function listNearMissOrganizationIds(limit: number): Promise<string[]> {
  const pending = await listQueueItems("pending");
  const details = (
    await Promise.all(pending.map((qi) => assembleQueueItemDetail(qi.opportunityId)))
  ).filter((d): d is NonNullable<typeof d> => d !== null);

  const scored = details
    .map((d) => ({
      organizationId: d.organization.id,
      score: d.score?.totalScore ?? -1,
    }))
    .filter((d) => d.score >= DEEPEN_MIN_SCORE && d.score < DEEPEN_MAX_SCORE)
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const row of scored) {
    if (seen.has(row.organizationId)) continue;
    seen.add(row.organizationId);
    ids.push(row.organizationId);
    if (ids.length >= limit) break;
  }
  return ids;
}

/**
 * Cron orchestrator: keep the overnight pipeline working until at least
 * `SALES_DIGEST_TARGET_COUNT` queue items scoring >= `SALES_DIGEST_MIN_SCORE` exist, then send
 * the email. One Vercel invocation can't process the whole backlog (see architecture.md §6), so
 * this is intentionally resumable — later digest/pipeline cron ticks pick up where earlier ones
 * left off, and `deferred` runs do NOT advance the "new since" cutoff.
 */
export async function ensureDigestTarget(trigger: "manual" | "cron" = "cron"): Promise<DigestEnsureResult> {
  const minScore = getDigestMinScore();
  const targetCount = getDigestTargetCount();
  const alreadySentWindowMs = getDigestAlreadySentWindowMs();
  const topupBudgetMs = getDigestTopupTimeBudgetMs();

  const lastSucceeded = await getLastSucceededDigestRun();
  if (
    lastSucceeded?.finishedAt &&
    Date.now() - Date.parse(lastSucceeded.finishedAt) < alreadySentWindowMs &&
    lastSucceeded.itemCount >= targetCount
  ) {
    return {
      status: "already_sent",
      qualifyingCount: lastSucceeded.itemCount,
      targetCount,
      minScore,
      topupBatches: 0,
      discoveryRuns: 0,
      nearMissReprocesses: 0,
      pipelineSummaries: [],
    };
  }

  let loaded = await loadQualifyingDigestItems(minScore);
  const pipelineSummaries: PipelineBatchSummary[] = [];
  let discoveryRuns = 0;
  let topupBatches = 0;
  let nearMissReprocesses = 0;
  const nearMissTried = new Set<string>();

  const startedAt = Date.now();
  while (loaded.items.length < targetCount && Date.now() - startedAt < topupBudgetMs) {
    const unprocessed = await listUnprocessedOrganizations(1);
    if (unprocessed.length > 0) {
      const batchLimit = Number(process.env.SALES_PIPELINE_BATCH_SIZE) || undefined;
      const summary = await runPipelineBatch(batchLimit);
      pipelineSummaries.push(summary);
      topupBatches += 1;
      if (summary.attempted === 0) break;
      loaded = await loadQualifyingDigestItems(minScore);
      continue;
    }

    if (discoveryRuns < MAX_DISCOVERY_RUNS_PER_ENSURE) {
      await runDiscoveryRun(trigger === "cron" ? "cron" : "manual");
      discoveryRuns += 1;
      const afterDiscovery = await listUnprocessedOrganizations(1);
      if (afterDiscovery.length > 0) continue;
    }

    if (nearMissReprocesses < MAX_NEAR_MISS_REPROCESSES_PER_ENSURE) {
      const nearMissIds = (await listNearMissOrganizationIds(MAX_NEAR_MISS_REPROCESSES_PER_ENSURE)).filter(
        (id) => !nearMissTried.has(id)
      );
      if (nearMissIds.length === 0) break;
      const orgId = nearMissIds[0];
      nearMissTried.add(orgId);
      nearMissReprocesses += 1;
      await runPipelineForOrganization(orgId, "reprocess_request");
      loaded = await loadQualifyingDigestItems(minScore);
      continue;
    }

    break;
  }

  if (loaded.items.length < targetCount) {
    // Intentionally no digest_runs row: only `succeeded` advances the "new since" cutoff.
    return {
      status: "deferred",
      qualifyingCount: loaded.items.length,
      targetCount,
      minScore,
      topupBatches,
      discoveryRuns,
      nearMissReprocesses,
      pipelineSummaries,
      error: `Waiting for ${targetCount} leads scoring ${minScore}+ (have ${loaded.items.length}). Pipeline will keep topping up on later cron ticks.`,
    };
  }

  const send = await sendDailyDigest(trigger, {
    items: loaded.items,
    sinceIso: loaded.sinceIso,
    backlogCount: loaded.backlogCount,
    minScore,
  });

  return {
    status: send.status === "succeeded" ? "succeeded" : send.status,
    qualifyingCount: loaded.items.length,
    targetCount,
    minScore,
    topupBatches,
    discoveryRuns,
    nearMissReprocesses,
    pipelineSummaries,
    send,
    error: send.error,
  };
}
