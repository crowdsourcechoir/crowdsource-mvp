import { requireSupabaseAdmin } from "./client";
import type { AgentRun, AgentRunStatus, OpportunityBrief, PipelineRun, PipelineRunStatus, PipelineStage } from "../types";

function rowToPipelineRun(row: Record<string, unknown>): PipelineRun {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    trigger: (row.trigger as PipelineRun["trigger"]) ?? "manual",
    status: (row.status as PipelineRunStatus) ?? "pending",
    currentStage: (row.current_stage as PipelineStage | null) ?? null,
    startedAt: (row.started_at as string | null) ?? null,
    finishedAt: (row.finished_at as string | null) ?? null,
    totalCostUsd: (row.total_cost_usd as number | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToAgentRun(row: Record<string, unknown>): AgentRun {
  return {
    id: row.id as string,
    pipelineRunId: row.pipeline_run_id as string,
    stage: row.stage as PipelineStage,
    status: (row.status as AgentRunStatus) ?? "pending",
    attempt: (row.attempt as number) ?? 1,
    maxAttempts: (row.max_attempts as number) ?? 3,
    input: row.input,
    output: row.output,
    error: (row.error as string | null) ?? null,
    model: (row.model as string | null) ?? null,
    tokensInput: (row.tokens_input as number | null) ?? null,
    tokensOutput: (row.tokens_output as number | null) ?? null,
    costUsd: (row.cost_usd as number | null) ?? null,
    startedAt: (row.started_at as string | null) ?? null,
    finishedAt: (row.finished_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function createPipelineRun(organizationId: string, trigger: PipelineRun["trigger"] = "manual"): Promise<PipelineRun> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("pipeline_runs")
    .insert({ organization_id: organizationId, trigger, status: "running", started_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToPipelineRun(data);
}

export async function updatePipelineRun(
  id: string,
  patch: { status?: PipelineRunStatus; currentStage?: PipelineStage | null; finishedAt?: string | null; totalCostUsd?: number | null }
): Promise<PipelineRun> {
  const db = requireSupabaseAdmin();
  const row: Record<string, unknown> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.currentStage !== undefined) row.current_stage = patch.currentStage;
  if (patch.finishedAt !== undefined) row.finished_at = patch.finishedAt;
  if (patch.totalCostUsd !== undefined) row.total_cost_usd = patch.totalCostUsd;
  const { data, error } = await db.from("pipeline_runs").update(row).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToPipelineRun(data);
}

/**
 * A serverless cron invocation that gets killed mid-run (execution-duration limit) leaves its
 * `pipeline_runs` row stuck at status "running" forever — and because `listUnprocessedOrganizations`
 * treats "has any non-csv_import pipeline_runs row" as "processed" regardless of status, that
 * organization would otherwise never be picked up again by anything automatic. This finds those
 * orphaned rows (status still "running" well past how long a real run ever takes — see
 * PipelineRunSummary/BatchRunClient's "roughly a minute" note) and marks them "failed" so the
 * caller can explicitly re-run those specific organizations. A real in-progress run started
 * seconds ago is never touched — only ones stale enough that they can't still legitimately be
 * running are affected.
 */
export async function markStalledPipelineRunsFailed(staleMinutesThreshold: number): Promise<string[]> {
  const db = requireSupabaseAdmin();
  const staleBefore = new Date(Date.now() - staleMinutesThreshold * 60_000).toISOString();
  const { data, error } = await db
    .from("pipeline_runs")
    .update({ status: "failed", finished_at: new Date().toISOString(), current_stage: null })
    .eq("status", "running")
    .lt("started_at", staleBefore)
    .select("organization_id");
  if (error) throw new Error(error.message);
  return Array.from(new Set((data ?? []).map((r) => r.organization_id as string)));
}

export async function listPipelineRunsForOrganization(organizationId: string): Promise<PipelineRun[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("pipeline_runs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToPipelineRun);
}

export async function listAgentRuns(pipelineRunId: string): Promise<AgentRun[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("agent_runs")
    .select("*")
    .eq("pipeline_run_id", pipelineRunId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToAgentRun);
}

/**
 * Latest succeeded brief-stage output for an opportunity — the 15-second gut-check the queue UI
 * shows. Briefs are stored only on agent_runs (no dedicated briefs table); input was
 * `{ opportunityId }` when the stage ran (see run-pipeline.ts).
 */
export async function getLatestBriefForOpportunity(opportunityId: string): Promise<OpportunityBrief | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("agent_runs")
    .select("output")
    .eq("stage", "brief")
    .eq("status", "succeeded")
    .contains("input", { opportunityId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.output || typeof data.output !== "object") return null;
  const output = data.output as Record<string, unknown>;
  const summary = typeof output.summary === "string" ? output.summary : null;
  const recommendedAngle = typeof output.recommendedAngle === "string" ? output.recommendedAngle : null;
  if (!summary || !recommendedAngle) return null;
  const risks = Array.isArray(output.risks) ? output.risks.filter((r): r is string => typeof r === "string") : [];
  return { summary, recommendedAngle, risks };
}

export async function startAgentRun(pipelineRunId: string, stage: PipelineStage, input: unknown): Promise<AgentRun> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("agent_runs")
    .insert({
      pipeline_run_id: pipelineRunId,
      stage,
      status: "running",
      input: input as never,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToAgentRun(data);
}

export async function finishAgentRun(
  id: string,
  result:
    | { status: "succeeded"; output: unknown; model?: string; tokensInput?: number; tokensOutput?: number; costUsd?: number }
    | { status: "failed"; error: string }
    | { status: "skipped"; output?: unknown }
): Promise<AgentRun> {
  const db = requireSupabaseAdmin();
  const row: Record<string, unknown> = { status: result.status, finished_at: new Date().toISOString() };
  if (result.status === "succeeded") {
    row.output = result.output as never;
    if (result.model) row.model = result.model;
    if (result.tokensInput !== undefined) row.tokens_input = result.tokensInput;
    if (result.tokensOutput !== undefined) row.tokens_output = result.tokensOutput;
    if (result.costUsd !== undefined) row.cost_usd = result.costUsd;
  } else if (result.status === "failed") {
    row.error = result.error;
  } else {
    row.output = result.output as never;
  }
  const { data, error } = await db.from("agent_runs").update(row).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToAgentRun(data);
}
