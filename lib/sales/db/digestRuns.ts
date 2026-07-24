import { requireSupabaseAdmin } from "./client";
import type { DigestRun } from "../types";

export type DigestRunStatus = DigestRun["status"];

function rowToDigestRun(row: Record<string, unknown>): DigestRun {
  return {
    id: row.id as string,
    trigger: (row.trigger as DigestRun["trigger"]) ?? "cron",
    status: (row.status as DigestRunStatus) ?? "running",
    itemCount: (row.item_count as number) ?? 0,
    recipient: (row.recipient as string | null) ?? null,
    providerMessageId: (row.provider_message_id as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function createDigestRun(trigger: DigestRun["trigger"]): Promise<DigestRun> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("digest_runs")
    .insert({ trigger, status: "running", started_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToDigestRun(data);
}

export async function finishDigestRun(
  id: string,
  patch: {
    status: DigestRunStatus;
    itemCount?: number;
    recipient?: string | null;
    providerMessageId?: string | null;
    error?: string | null;
  }
): Promise<DigestRun> {
  const db = requireSupabaseAdmin();
  const row: Record<string, unknown> = { status: patch.status, finished_at: new Date().toISOString() };
  if (patch.itemCount !== undefined) row.item_count = patch.itemCount;
  if (patch.recipient !== undefined) row.recipient = patch.recipient;
  if (patch.providerMessageId !== undefined) row.provider_message_id = patch.providerMessageId;
  if (patch.error !== undefined) row.error = patch.error;
  const { data, error } = await db.from("digest_runs").update(row).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToDigestRun(data);
}

/** Most recent digest that actually completed a send (used by admin history / already-sent checks).
 * Deliberately excludes "skipped_no_provider" runs — a night with no RESEND_API_KEY configured
 * shouldn't count as "already covered." */
export async function getLastSucceededDigestRun(): Promise<DigestRun | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("digest_runs")
    .select("*")
    .eq("status", "succeeded")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToDigestRun(data) : null;
}

/** Most recent digest that actually delivered at least one lead. Empty "heartbeat" succeeds must
 * not advance the "new since" cutoff, or pending 70+ leads get stranded behind a zero-item send. */
export async function getLastDeliveredDigestRun(): Promise<DigestRun | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("digest_runs")
    .select("*")
    .eq("status", "succeeded")
    .gt("item_count", 0)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToDigestRun(data) : null;
}

export async function listDigestRuns(limit = 20): Promise<DigestRun[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db.from("digest_runs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToDigestRun);
}
