import { requireSupabaseAdmin } from "./client";
import type { DiscoveryRun } from "../types";

function rowToDiscoveryRun(row: Record<string, unknown>): DiscoveryRun {
  return {
    id: row.id as string,
    trigger: (row.trigger as DiscoveryRun["trigger"]) ?? "manual",
    status: (row.status as DiscoveryRun["status"]) ?? "running",
    provider: (row.provider as DiscoveryRun["provider"]) ?? null,
    queries: (row.queries as DiscoveryRun["queries"]) ?? [],
    candidatesFound: (row.candidates_found as number) ?? 0,
    candidatesNew: (row.candidates_new as number) ?? 0,
    candidatesDuplicate: (row.candidates_duplicate as number) ?? 0,
    createdOrganizationIds: (row.created_organization_ids as string[]) ?? [],
    model: (row.model as string | null) ?? null,
    tokensInput: (row.tokens_input as number | null) ?? null,
    tokensOutput: (row.tokens_output as number | null) ?? null,
    costUsd: (row.cost_usd as number | null) ?? null,
    error: (row.error as string | null) ?? null,
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function createDiscoveryRun(trigger: DiscoveryRun["trigger"]): Promise<DiscoveryRun> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("discovery_runs")
    .insert({ trigger, status: "running", started_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToDiscoveryRun(data);
}

export async function finishDiscoveryRun(
  id: string,
  patch: {
    status: DiscoveryRun["status"];
    provider?: DiscoveryRun["provider"];
    queries?: DiscoveryRun["queries"];
    candidatesFound?: number;
    candidatesNew?: number;
    candidatesDuplicate?: number;
    createdOrganizationIds?: string[];
    model?: string | null;
    tokensInput?: number;
    tokensOutput?: number;
    costUsd?: number;
    error?: string | null;
  }
): Promise<DiscoveryRun> {
  const db = requireSupabaseAdmin();
  const row: Record<string, unknown> = { status: patch.status, finished_at: new Date().toISOString() };
  if (patch.provider !== undefined) row.provider = patch.provider;
  if (patch.queries !== undefined) row.queries = patch.queries as never;
  if (patch.candidatesFound !== undefined) row.candidates_found = patch.candidatesFound;
  if (patch.candidatesNew !== undefined) row.candidates_new = patch.candidatesNew;
  if (patch.candidatesDuplicate !== undefined) row.candidates_duplicate = patch.candidatesDuplicate;
  if (patch.createdOrganizationIds !== undefined) row.created_organization_ids = patch.createdOrganizationIds;
  if (patch.model !== undefined) row.model = patch.model;
  if (patch.tokensInput !== undefined) row.tokens_input = patch.tokensInput;
  if (patch.tokensOutput !== undefined) row.tokens_output = patch.tokensOutput;
  if (patch.costUsd !== undefined) row.cost_usd = patch.costUsd;
  if (patch.error !== undefined) row.error = patch.error;
  const { data, error } = await db.from("discovery_runs").update(row).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToDiscoveryRun(data);
}

export async function listDiscoveryRuns(limit = 20): Promise<DiscoveryRun[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db.from("discovery_runs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToDiscoveryRun);
}
