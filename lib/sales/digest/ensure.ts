import { listUnprocessedOrganizations } from "../db/organizations";
import { createDigestRun, finishDigestRun, getLastSucceededDigestRun } from "../db/digestRuns";
import { runDiscoveryRun } from "../discovery/run-discovery";
import { runPipelineBatch, type PipelineBatchSummary } from "../pipeline/run-pipeline-batch";
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
  pipelineSummaries: PipelineBatchSummary[];
  send?: DigestSendResult;
  error?: string;
};

/**
 * Cron orchestrator: keep the overnight pipeline working until at least
 * `SALES_DIGEST_TARGET_COUNT` new queue items scoring >= `SALES_DIGEST_MIN_SCORE` exist since
 * the last successful digest, then send the email. One Vercel invocation can't process the whole
 * backlog (see architecture.md §6), so this is intentionally resumable — later digest cron ticks
 * pick up where earlier ones left off, and `deferred` runs do NOT advance the "new since" cutoff.
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
      pipelineSummaries: [],
    };
  }

  let loaded = await loadQualifyingDigestItems(minScore);
  const pipelineSummaries: PipelineBatchSummary[] = [];
  let discoveryRuns = 0;
  let topupBatches = 0;
  let ranDiscoveryThisInvocation = false;

  const startedAt = Date.now();
  while (loaded.items.length < targetCount && Date.now() - startedAt < topupBudgetMs) {
    const unprocessed = await listUnprocessedOrganizations(1);
    if (unprocessed.length === 0) {
      if (ranDiscoveryThisInvocation) break;
      await runDiscoveryRun(trigger === "cron" ? "cron" : "manual");
      discoveryRuns += 1;
      ranDiscoveryThisInvocation = true;
      const afterDiscovery = await listUnprocessedOrganizations(1);
      if (afterDiscovery.length === 0) break;
      continue;
    }

    const batchLimit = Number(process.env.SALES_PIPELINE_BATCH_SIZE) || undefined;
    const summary = await runPipelineBatch(batchLimit);
    pipelineSummaries.push(summary);
    topupBatches += 1;
    if (summary.attempted === 0) break;

    loaded = await loadQualifyingDigestItems(minScore);
  }

  if (loaded.items.length < targetCount) {
    const to = process.env.SALES_DIGEST_TO_EMAIL ?? null;
    const digestRun = await createDigestRun(trigger);
    await finishDigestRun(digestRun.id, {
      status: "deferred",
      itemCount: loaded.items.length,
      recipient: to,
      error: `Waiting for ${targetCount} leads scoring ${minScore}+ (have ${loaded.items.length}). Pipeline will keep topping up on later cron ticks.`,
    });
    return {
      status: "deferred",
      qualifyingCount: loaded.items.length,
      targetCount,
      minScore,
      topupBatches,
      discoveryRuns,
      pipelineSummaries,
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
    pipelineSummaries,
    send,
    error: send.error,
  };
}
