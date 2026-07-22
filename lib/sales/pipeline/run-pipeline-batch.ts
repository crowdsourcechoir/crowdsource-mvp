import { getOrganization, listUnprocessedOrganizations } from "../db/organizations";
import { markStalledPipelineRunsFailed } from "../db/pipeline";
import { runPipelineForOrganization } from "./run-pipeline";
import type { Organization } from "../types";

/**
 * Turning "click Run pipeline on next N" into genuine unattended overnight processing — see
 * docs/sales-platform/architecture.md §6 and roadmap.md Phase 2. Same "small, time-boxed batch,
 * resumable via DB status rows" shape as the discovery cron, just for the 10-stage per-organization
 * pipeline instead of stage 0.
 */

const DEFAULT_BATCH_SIZE = 15;
const MAX_BATCH_SIZE = 40;
// Real Vercel function execution limits vary by plan (Hobby: seconds; Pro: up to 300s via
// `maxDuration`) — see architecture.md §6. This is intentionally conservative and stops starting
// new organizations well before any plan's hard ceiling, rather than assuming Pro. If the whole
// function does get killed mid-organization anyway, markStalledPipelineRunsFailed() on the next
// run recovers it instead of that organization being silently stuck forever.
const DEFAULT_TIME_BUDGET_MS = 4 * 60 * 1000;
// How long a pipeline_run can sit at status "running" before we treat it as an orphaned/killed
// invocation rather than a real in-progress run — see markStalledPipelineRunsFailed's doc comment.
const STALE_RUN_THRESHOLD_MINUTES = 10;

export type PipelineBatchOrganizationResult = {
  organizationId: string;
  organizationName: string;
  status: string;
  recoveredFromStall?: boolean;
};

export type PipelineBatchSummary = {
  attempted: number;
  succeeded: number;
  partiallyFailed: number;
  failed: number;
  skippedExistingClient: number;
  recoveredStalledCount: number;
  timeBoxed: boolean;
  organizationResults: PipelineBatchOrganizationResult[];
};

function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Processes up to `limit` organizations through the full pipeline, prioritizing organizations
 * whose previous run was orphaned by a killed invocation (see markStalledPipelineRunsFailed) over
 * brand-new unprocessed organizations, since those are the most overdue. Stops starting new
 * organizations once the time budget is spent — whatever wasn't reached this run is picked up by
 * the next cron invocation, same resumability contract as every other stage in this pipeline.
 */
export async function runPipelineBatch(limit = DEFAULT_BATCH_SIZE): Promise<PipelineBatchSummary> {
  const cappedLimit = Math.min(MAX_BATCH_SIZE, Math.max(1, limit));
  const timeBudgetMs = readEnvInt("SALES_PIPELINE_CRON_TIME_BUDGET_MS", DEFAULT_TIME_BUDGET_MS);

  const stalledOrgIds = await markStalledPipelineRunsFailed(STALE_RUN_THRESHOLD_MINUTES);
  const stalledOrgs = (
    await Promise.all(stalledOrgIds.map((id) => getOrganization(id)))
  ).filter((o): o is Organization => o !== null && !o.isExistingClient);

  const remainingCapacity = Math.max(0, cappedLimit - stalledOrgs.length);
  const freshOrgs = remainingCapacity > 0 ? await listUnprocessedOrganizations(remainingCapacity) : [];

  const queue: { organization: Organization; recoveredFromStall: boolean }[] = [
    ...stalledOrgs.map((organization) => ({ organization, recoveredFromStall: true })),
    ...freshOrgs.map((organization) => ({ organization, recoveredFromStall: false })),
  ].slice(0, cappedLimit);

  const summary: PipelineBatchSummary = {
    attempted: 0,
    succeeded: 0,
    partiallyFailed: 0,
    failed: 0,
    skippedExistingClient: 0,
    recoveredStalledCount: stalledOrgs.length,
    timeBoxed: false,
    organizationResults: [],
  };

  const startedAt = Date.now();
  for (const { organization, recoveredFromStall } of queue) {
    if (Date.now() - startedAt > timeBudgetMs) {
      summary.timeBoxed = true;
      break;
    }
    summary.attempted += 1;
    try {
      const result = await runPipelineForOrganization(organization.id, "cron");
      if (result.status === "succeeded") summary.succeeded += 1;
      else if (result.status === "partially_failed") summary.partiallyFailed += 1;
      else if (result.status === "failed") summary.failed += 1;
      else if (result.status === "skipped_existing_client") summary.skippedExistingClient += 1;
      summary.organizationResults.push({
        organizationId: organization.id,
        organizationName: organization.name,
        status: result.status,
        recoveredFromStall,
      });
    } catch (err) {
      summary.failed += 1;
      summary.organizationResults.push({
        organizationId: organization.id,
        organizationName: organization.name,
        status: err instanceof Error ? `error: ${err.message}` : "error",
        recoveredFromStall,
      });
    }
  }

  return summary;
}
