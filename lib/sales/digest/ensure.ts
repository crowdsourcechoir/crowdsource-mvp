import { listUnprocessedOrganizations } from "../db/organizations";
import { listAwaitingContactOrganizationIds } from "../db/awaitingContact";
import { getLastSucceededDigestRun } from "../db/digestRuns";
import { listQueueItems } from "../db/queue";
import { assembleQueueItemDetail } from "../db/assemble";
import { runPipelineBatch, type PipelineBatchSummary } from "../pipeline/run-pipeline-batch";
import { runPipelineForOrganization } from "../pipeline/run-pipeline";
import { DEEPEN_MAX_SCORE, DEEPEN_MIN_SCORE } from "../pipeline/stages/deepenResearch";
import { getDigestAlreadySentWindowMs, getDigestTopupTimeBudgetMs } from "./config";
import { resolveDigestSettings } from "./settings";
import { loadQualifyingDigestItems, sendDailyDigest, type DigestSendResult } from "./send";

export type DigestEnsureResult = {
  status:
    | "succeeded"
    | "deferred"
    | "already_sent"
    | "skipped_no_provider"
    | "skipped_disabled"
    | "failed";
  qualifyingCount: number;
  targetCount: number;
  minScore: number;
  topupBatches: number;
  discoveryRuns: number;
  nearMissReprocesses: number;
  awaitingContactReprocesses: number;
  pipelineSummaries: PipelineBatchSummary[];
  send?: DigestSendResult;
  error?: string;
  /**
   * When status is `deferred`, whether another invocation should keep topping up
   * (unprocessed orgs and/or near-miss salvage still available). False means the
   * funnel is empty for now — stop self-chaining rather than spinning forever.
   */
  continuationRecommended?: boolean;
};

const MAX_NEAR_MISS_REPROCESSES_PER_ENSURE = 6;
const MAX_AWAITING_CONTACT_REPROCESSES_PER_ENSURE = 6;

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
 * Cron orchestrator for the daily digest.
 *
 * Tops up the pipeline toward `SALES_DIGEST_TARGET_COUNT` leads (preferring
 * `SALES_DIGEST_MIN_SCORE`+), then sends. Under-target is no longer a hard stop: after the
 * top-up budget we send whatever is ready (backfilled from the pending backlog) so the email
 * actually lands every day. `deferred` is only used when nothing is ready yet but more
 * pipeline/salvage work remains — those runs do NOT advance the "new since" cutoff.
 */
export async function ensureDigestTarget(trigger: "manual" | "cron" = "cron"): Promise<DigestEnsureResult> {
  const digestSettings = await resolveDigestSettings();
  const minScore = digestSettings.minScore;
  const targetCount = digestSettings.targetCount;
  const alreadySentWindowMs = getDigestAlreadySentWindowMs();
  const topupBudgetMs = getDigestTopupTimeBudgetMs();

  if (!digestSettings.enabled) {
    return {
      status: "skipped_disabled",
      qualifyingCount: 0,
      targetCount,
      minScore,
      topupBatches: 0,
      discoveryRuns: 0,
      nearMissReprocesses: 0,
      awaitingContactReprocesses: 0,
      pipelineSummaries: [],
      error: "Daily digest is turned off in Settings.",
    };
  }

  const lastSucceeded = await getLastSucceededDigestRun();
  // Once-per-window gate: any successful send (even a partial) counts so we don't spam every tick.
  if (lastSucceeded?.finishedAt && Date.now() - Date.parse(lastSucceeded.finishedAt) < alreadySentWindowMs) {
    return {
      status: "already_sent",
      qualifyingCount: lastSucceeded.itemCount,
      targetCount,
      minScore,
      topupBatches: 0,
      discoveryRuns: 0,
      nearMissReprocesses: 0,
      awaitingContactReprocesses: 0,
      pipelineSummaries: [],
    };
  }

  let loaded = await loadQualifyingDigestItems(minScore);
  const pipelineSummaries: PipelineBatchSummary[] = [];
  let discoveryRuns = 0;
  let topupBatches = 0;
  let nearMissReprocesses = 0;
  let awaitingContactReprocesses = 0;
  const nearMissTried = new Set<string>();
  const awaitingTried = new Set<string>();

  const startedAt = Date.now();
  while (loaded.items.length < targetCount && Date.now() - startedAt < topupBudgetMs) {
    // Highest ROI: solid scorers stuck only on the contact gate.
    if (awaitingContactReprocesses < MAX_AWAITING_CONTACT_REPROCESSES_PER_ENSURE) {
      const awaiting = (
        await listAwaitingContactOrganizationIds(MAX_AWAITING_CONTACT_REPROCESSES_PER_ENSURE, minScore)
      ).filter((row) => !awaitingTried.has(row.organizationId) && row.score >= minScore);
      if (awaiting.length > 0) {
        const orgId = awaiting[0].organizationId;
        awaitingTried.add(orgId);
        awaitingContactReprocesses += 1;
        await runPipelineForOrganization(orgId, "reprocess_request");
        loaded = await loadQualifyingDigestItems(minScore);
        continue;
      }
    }

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

    // Tavily/Serper discovery is off — do not mint new orgs via web search.

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

  // Reload after top-up so always-on backfill (including below-minScore fill) is applied.
  loaded = await loadQualifyingDigestItems(minScore);

  if (loaded.items.length === 0) {
    // Nothing to email yet. Keep deferring only while salvage/pipeline work remains.
    const [stillUnprocessed, stillNearMiss, stillAwaiting] = await Promise.all([
      listUnprocessedOrganizations(1),
      listNearMissOrganizationIds(1),
      listAwaitingContactOrganizationIds(1, minScore),
    ]);
    const continuationRecommended =
      stillUnprocessed.length > 0 || stillNearMiss.length > 0 || stillAwaiting.some((r) => r.score >= minScore);
    return {
      status: "deferred",
      qualifyingCount: 0,
      targetCount,
      minScore,
      topupBatches,
      discoveryRuns,
      nearMissReprocesses,
      awaitingContactReprocesses,
      pipelineSummaries,
      continuationRecommended,
      error: continuationRecommended
        ? `No digest leads ready yet — continuing top-up toward ${targetCount}.`
        : `No pending leads available to digest. Add orgs/contacts in the queue.`,
    };
  }

  // Daily send: targetCount is a fill goal, not a hard gate.
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
    awaitingContactReprocesses,
    pipelineSummaries,
    send,
    error: send.error,
  };
}
