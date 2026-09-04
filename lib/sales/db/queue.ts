import { requireSupabaseAdmin } from "./client";
import { sortQueueSidebarItems } from "../queue/sidebar";
import { classifyQueueCategory } from "../queue/category";
import { readSalesInitiative } from "../initiatives";
import { isFollowUpDueOnOrBeforeToday } from "../follow-up/calendar";
import { opportunityOutreachKind } from "../outreach/contact-outreach";
import { loadSalesTodayTasks } from "./follow-ups";
import type { QueueScope } from "../queue/scope";
import type { ApprovalQueueItem, ApprovalQueueItemKind, ApprovalQueueItemStatus, QueueSidebarItem } from "../types";

const IN_CHUNK = 150;

async function fetchInChunks<T>(
  ids: string[],
  run: (chunk: string[]) => Promise<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const out: T[] = [];
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const { data, error } = await run(unique.slice(i, i + IN_CHUNK));
    if (error) throw new Error(error.message);
    if (data) out.push(...data);
  }
  return out;
}

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

export async function listQueueItems(status?: ApprovalQueueItemStatus | "all"): Promise<ApprovalQueueItem[]> {
  const db = requireSupabaseAdmin();
  if (status === "all") {
    const pageSize = 1000;
    const out: ApprovalQueueItem[] = [];
    let from = 0;
    for (;;) {
      const { data, error } = await db
        .from("approval_queue_items")
        .select("*")
        .order("created_at", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []).map(rowToQueueItem);
      out.push(...rows);
      if (rows.length < pageSize || from > 8000) break;
      from += pageSize;
    }
    return out;
  }
  let query = db.from("approval_queue_items").select("*").order("created_at", { ascending: true });
  query = query.eq("status", status ?? "pending");
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToQueueItem);
}

/**
 * Sidebar payload for the approval queue. A handful of batched selects instead of
 * assembling contacts/drafts/findings for every pending org (that N+1 is what 522'd
 * Cloudflare once the D1 seed filled the queue).
 */
export async function listQueueSidebarItems(status?: ApprovalQueueItemStatus): Promise<QueueSidebarItem[]> {
  return assembleQueueSidebar(await listQueueItems(status));
}

export async function listQueueSidebarByScope(scope: QueueScope): Promise<QueueSidebarItem[]> {
  if (scope === "due") {
    const today = await loadSalesTodayTasks();
    const ids = today.tasks.map((task) => task.queueItemId).filter((id): id is string => Boolean(id));
    if (ids.length === 0) return [];
    const items = (await Promise.all(ids.map((id) => getQueueItem(id)))).filter((row): row is ApprovalQueueItem => Boolean(row));
    return assembleQueueSidebar(items);
  }
  const items = await listQueueItems(scope === "all" ? "all" : "pending");
  const sidebar = await assembleQueueSidebar(items);
  if (scope !== "all") return sidebar;
  return dedupeSidebarByOrganization(sidebar);
}

function dedupeSidebarByOrganization(items: QueueSidebarItem[]): QueueSidebarItem[] {
  const byOrg = new Map<string, QueueSidebarItem>();
  for (const item of items) {
    const prev = byOrg.get(item.organizationId);
    if (!prev) {
      byOrg.set(item.organizationId, item);
      continue;
    }
    const prevPending = prev.queueItem.status === "pending";
    const nextPending = item.queueItem.status === "pending";
    if (nextPending && !prevPending) {
      byOrg.set(item.organizationId, item);
      continue;
    }
    if (nextPending === prevPending && item.queueItem.createdAt > prev.queueItem.createdAt) {
      byOrg.set(item.organizationId, item);
    }
  }
  return sortQueueSidebarItems(Array.from(byOrg.values()));
}

async function assembleQueueSidebar(items: ApprovalQueueItem[]): Promise<QueueSidebarItem[]> {
  if (items.length === 0) return [];
  const db = requireSupabaseAdmin();

  const scoreIds = items.map((item) => item.prospectScoreId).filter((id): id is string => Boolean(id));
  const draftIds = items.map((item) => item.outreachDraftId).filter((id): id is string => Boolean(id));

  const [opportunities, scoreRows, draftRows, opportunityTypes, organizationTypes] = await Promise.all([
    fetchInChunks<{
      id: string;
      title: string;
      organization_id: string;
      opportunity_type_id: string | null;
      gmail_thread_id: string | null;
      next_follow_up_at: string | null;
      last_inbound_at: string | null;
      last_outbound_at: string | null;
    }>(
      items.map((item) => item.opportunityId),
      async (chunk) =>
        db
          .from("opportunities")
          .select(
            "id, title, organization_id, opportunity_type_id, gmail_thread_id, next_follow_up_at, last_inbound_at, last_outbound_at"
          )
          .in("id", chunk)
    ),
    scoreIds.length > 0
      ? fetchInChunks<{ id: string; total_score: number }>(scoreIds, async (chunk) =>
          db.from("prospect_scores").select("id, total_score").in("id", chunk)
        )
      : Promise.resolve([]),
    draftIds.length > 0
      ? fetchInChunks<{ id: string; confidence_score: number | null }>(draftIds, async (chunk) =>
          db.from("outreach_drafts").select("id, confidence_score").in("id", chunk)
        )
      : Promise.resolve([]),
    db.from("opportunity_types").select("id, key"),
    db.from("organization_types").select("id, key"),
  ]);
  if (opportunityTypes.error) throw new Error(opportunityTypes.error.message);
  if (organizationTypes.error) throw new Error(organizationTypes.error.message);
  const oppById = new Map(opportunities.map((row) => [row.id, row]));
  const scoresById = new Map(scoreRows.map((row) => [row.id, Number(row.total_score)]));
  const confidenceByDraft = new Map<string, number>();
  for (const row of draftRows) {
    if (row.confidence_score != null) confidenceByDraft.set(row.id, Number(row.confidence_score));
  }
  const oppTypeKeyById = new Map(
    ((opportunityTypes.data ?? []) as { id: string; key: string }[]).map((row) => [row.id, row.key])
  );
  const orgTypeKeyById = new Map(
    ((organizationTypes.data ?? []) as { id: string; key: string }[]).map((row) => [row.id, row.key])
  );

  const organizations = await fetchInChunks<{
    id: string;
    name: string;
    organization_type_id: string | null;
    import_metadata: Record<string, unknown> | null;
  }>(
    opportunities.map((row) => row.organization_id),
    async (chunk) =>
      db.from("organizations").select("id, name, organization_type_id, import_metadata").in("id", chunk)
  );
  const orgById = new Map(organizations.map((row) => [row.id, row]));

  const sidebar: QueueSidebarItem[] = [];
  for (const queueItem of items) {
    const opportunity = oppById.get(queueItem.opportunityId);
    if (!opportunity) continue;
    const organization = orgById.get(opportunity.organization_id);
    if (!organization) continue;
    const opportunityTypeKey = opportunity.opportunity_type_id
      ? oppTypeKeyById.get(opportunity.opportunity_type_id) ?? null
      : null;
    const organizationTypeKey = organization.organization_type_id
      ? orgTypeKeyById.get(organization.organization_type_id) ?? null
      : null;
    const category = classifyQueueCategory({
      organizationName: organization.name,
      opportunityTitle: opportunity.title,
      opportunityTypeKey,
      organizationTypeKey,
      salesInitiative: readSalesInitiative(organization.import_metadata),
    });
    const nextFollowUpAt = opportunity.next_follow_up_at ?? null;
    sidebar.push({
      queueItem,
      organizationId: organization.id,
      organizationName: organization.name,
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      totalScore: queueItem.prospectScoreId ? scoresById.get(queueItem.prospectScoreId) ?? null : null,
      draftConfidence: queueItem.outreachDraftId
        ? confidenceByDraft.get(queueItem.outreachDraftId) ?? null
        : null,
      category,
      opportunityTypeKey,
      organizationTypeKey,
      outreachKind: opportunityOutreachKind({
        lastInboundAt: opportunity.last_inbound_at ?? null,
        lastOutboundAt: opportunity.last_outbound_at ?? null,
      }),
      nextFollowUpAt,
      gmailThreadId: opportunity.gmail_thread_id ?? null,
      followUpDue: isFollowUpDueOnOrBeforeToday(nextFollowUpAt) || Boolean(opportunity.last_inbound_at && !nextFollowUpAt),
    });
  }
  return sortQueueSidebarItems(sidebar);
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
