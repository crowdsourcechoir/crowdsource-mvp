import { requireSupabaseAdmin } from "./client";
import type { ApprovalQueueItem, ApprovalQueueItemKind, ApprovalQueueItemStatus } from "../types";

function rowToQueueItem(row: Record<string, unknown>): ApprovalQueueItem {
  return {
    id: row.id as string,
    opportunityId: row.opportunity_id as string,
    outreachDraftId: (row.outreach_draft_id as string | null) ?? null,
    prospectScoreId: (row.prospect_score_id as string | null) ?? null,
    kind: ((row.kind as ApprovalQueueItemKind | null) ?? "initial") as ApprovalQueueItemKind,
    duplicateWarning: (row.duplicate_warning as boolean) ?? false,
    status: (row.status as ApprovalQueueItemStatus) ?? "pending",
    decisionNotes: (row.decision_notes as string | null) ?? null,
    decidedBy: (row.decided_by as string | null) ?? null,
    decidedAt: (row.decided_at as string | null) ?? null,
    deferredUntil: (row.deferred_until as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Upserts the *initial* pipeline queue row for an opportunity (partial unique on kind=initial). */
export async function createOrUpdateQueueItem(input: {
  opportunityId: string;
  outreachDraftId?: string | null;
  prospectScoreId?: string | null;
  duplicateWarning?: boolean;
  /**
   * Explicit operator reopen (manual seed / force queue). Default false so the AI pipeline
   * never clobbers a human reject/defer/duplicate decision.
   */
  reopenDecided?: boolean;
}): Promise<ApprovalQueueItem> {
  const db = requireSupabaseAdmin();
  const existing = await getInitialQueueItemByOpportunity(input.opportunityId);
  if (existing) {
    // Only refresh draft/score pointers while still pending — never clobber a human decision
    // unless reopenDecided is explicitly requested (e.g. Joel asks to put Seahawks back).
    if (existing.status !== "pending" && !input.reopenDecided) return existing;
    const row: Record<string, unknown> = {
      outreach_draft_id: input.outreachDraftId ?? null,
      prospect_score_id: input.prospectScoreId ?? null,
      duplicate_warning: input.duplicateWarning ?? false,
      kind: "initial",
    };
    if (existing.status !== "pending" && input.reopenDecided) {
      row.status = "pending";
      row.decision_notes = null;
      row.decided_by = null;
      row.decided_at = null;
      row.deferred_until = null;
    }
    const { data, error } = await db
      .from("approval_queue_items")
      .update(row)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToQueueItem(data);
  }

  const { data, error } = await db
    .from("approval_queue_items")
    .insert({
      opportunity_id: input.opportunityId,
      outreach_draft_id: input.outreachDraftId ?? null,
      prospect_score_id: input.prospectScoreId ?? null,
      duplicate_warning: input.duplicateWarning ?? false,
      kind: "initial",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToQueueItem(data);
}

export async function createNudgeQueueItem(input: {
  opportunityId: string;
  outreachDraftId: string;
  prospectScoreId?: string | null;
}): Promise<ApprovalQueueItem> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("approval_queue_items")
    .insert({
      opportunity_id: input.opportunityId,
      outreach_draft_id: input.outreachDraftId,
      prospect_score_id: input.prospectScoreId ?? null,
      duplicate_warning: false,
      kind: "nudge",
      status: "pending",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToQueueItem(data);
}

export async function hasPendingNudgeQueueItem(opportunityId: string): Promise<boolean> {
  const db = requireSupabaseAdmin();
  const { count, error } = await db
    .from("approval_queue_items")
    .select("id", { count: "exact", head: true })
    .eq("opportunity_id", opportunityId)
    .eq("kind", "nudge")
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function hasPendingNudgeForContact(opportunityId: string, contactId: string): Promise<boolean> {
  const db = requireSupabaseAdmin();
  const { data: items, error } = await db
    .from("approval_queue_items")
    .select("outreach_draft_id")
    .eq("opportunity_id", opportunityId)
    .eq("kind", "nudge")
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  const draftIds = (items ?? []).map((row) => row.outreach_draft_id as string | null).filter((id): id is string => Boolean(id));
  if (draftIds.length === 0) return false;
  const { data: drafts, error: draftErr } = await db.from("outreach_drafts").select("id, contact_id").in("id", draftIds);
  if (draftErr) throw new Error(draftErr.message);
  return (drafts ?? []).some((row) => row.contact_id === contactId);
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

export async function getInitialQueueItemByOpportunity(opportunityId: string): Promise<ApprovalQueueItem | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("approval_queue_items")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .eq("kind", "initial")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToQueueItem(data) : null;
}

/** Prefer a pending item for this opportunity, else the most recently created row. */
export async function getQueueItemByOpportunity(opportunityId: string): Promise<ApprovalQueueItem | null> {
  const db = requireSupabaseAdmin();
  const { data: pending, error: pendingErr } = await db
    .from("approval_queue_items")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pendingErr) throw new Error(pendingErr.message);
  if (pending) return rowToQueueItem(pending);

  const { data, error } = await db
    .from("approval_queue_items")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToQueueItem(data) : null;
}

/**
 * Removes a stale, never-decided queue row for an opportunity that a re-run has now determined
 * is NOT actually contact-ready. ONLY deletes pending *initial* items — nudge drafts are left alone.
 */
export async function retractPendingQueueItemForOpportunity(opportunityId: string): Promise<boolean> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("approval_queue_items")
    .delete()
    .eq("opportunity_id", opportunityId)
    .eq("status", "pending")
    .eq("kind", "initial")
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

/** Point a still-pending queue row at a different contact's draft (multi-contact picker). */
export async function setQueueItemOutreachDraft(id: string, outreachDraftId: string): Promise<ApprovalQueueItem> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("approval_queue_items")
    .update({ outreach_draft_id: outreachDraftId })
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToQueueItem(data);
}
