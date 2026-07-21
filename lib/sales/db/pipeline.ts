import { requireSupabaseAdmin } from "./client";
import type { AgentRun, AgentRunStatus, PipelineRun, PipelineRunStatus, PipelineStage } from "../types";

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
