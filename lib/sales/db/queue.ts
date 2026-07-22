import { requireSupabaseAdmin } from "./client";
import type { ApprovalQueueItem, ApprovalQueueItemStatus } from "../types";

function rowToQueueItem(row: Record<string, unknown>): ApprovalQueueItem {
  return {
    id: row.id as string,
    opportunityId: row.opportunity_id as string,
    outreachDraftId: (row.outreach_draft_id as string | null) ?? null,
    prospectScoreId: (row.prospect_score_id as string | null) ?? null,
    duplicateWarning: (row.duplicate_warning as boolean) ?? false,
    status: (row.status as ApprovalQueueItemStatus) ?? "pending",
    decisionNotes: (row.decision_notes as string | null) ?? null,
    decidedBy: (row.decided_by as string | null) ?? null,
    decidedAt: (row.decided_at as string | null) ?? null,
    deferredUntil: (row.deferred_until as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function createOrUpdateQueueItem(input: {
  opportunityId: string;
  outreachDraftId?: string | null;
  prospectScoreId?: string | null;
  duplicateWarning?: boolean;
}): Promise<ApprovalQueueItem> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("approval_queue_items")
    .upsert(
      {
        opportunity_id: input.opportunityId,
        outreach_draft_id: input.outreachDraftId ?? null,
        prospect_score_id: input.prospectScoreId ?? null,
        duplicate_warning: input.duplicateWarning ?? false,
      },
      { onConflict: "opportunity_id" }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToQueueItem(data);
}

export async function listQueueItems(status?: ApprovalQueueItemStatus): Promise<ApprovalQueueItem[]> {
  const db = requireSupabaseAdmin();
  let query = db.from("approval_queue_items").select("*").order("created_at", { ascending: true });
  if (status) query = query.eq("status", status);
  else query = query.eq("status", "pending");
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToQueueItem);
}

/** Pending queue items created at/after `sinceIso` — the "what's new since the last digest" query. */
export async function listQueueItemsCreatedSince(sinceIso: string): Promise<ApprovalQueueItem[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("approval_queue_items")
    .select("*")
    .eq("status", "pending")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToQueueItem);
}

/** Total pending backlog size, regardless of when it was created — included in the digest as a health signal. */
export async function countPendingQueueItems(): Promise<number> {
  const db = requireSupabaseAdmin();
  const { count, error } = await db.from("approval_queue_items").select("id", { count: "exact", head: true }).eq("status", "pending");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getQueueItem(id: string): Promise<ApprovalQueueItem | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db.from("approval_queue_items").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToQueueItem(data) : null;
}

export async function getQueueItemByOpportunity(opportunityId: string): Promise<ApprovalQueueItem | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db.from("approval_queue_items").select("*").eq("opportunity_id", opportunityId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToQueueItem(data) : null;
}

/**
 * Removes a stale, never-decided queue row for an opportunity that a re-run has now determined
 * is NOT actually contact-ready (see stages/queue.ts's `contactIsQueueReady` gate) — e.g. it was
 * queued before that gate existed, or before a research-quality fix, on a contact that no longer
 * clears the bar. ONLY deletes if the item is still `pending` — a human decision (approved,
 * rejected, deferred, etc.) is never touched or erased by a pipeline re-run, full stop. Returns
 * whether anything was actually retracted, purely for observability in the stage's output.
 */
export async function retractPendingQueueItemForOpportunity(opportunityId: string): Promise<boolean> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("approval_queue_items")
    .delete()
    .eq("opportunity_id", opportunityId)
    .eq("status", "pending")
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export async function decideQueueItem(
  id: string,
  input: { status: ApprovalQueueItemStatus; decisionNotes?: string | null; decidedBy?: string; deferredUntil?: string | null }
): Promise<ApprovalQueueItem> {
  const db = requireSupabaseAdmin();
  const row: Record<string, unknown> = {
    status: input.status,
    decision_notes: input.decisionNotes ?? null,
    decided_by: input.decidedBy ?? "operator",
    decided_at: new Date().toISOString(),
  };
  if (input.deferredUntil !== undefined) row.deferred_until = input.deferredUntil;
  const { data, error } = await db.from("approval_queue_items").update(row).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return rowToQueueItem(data);
}
