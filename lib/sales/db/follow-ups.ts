import { requireSupabaseAdmin } from "./client";
import { getGmailConnectionStatus } from "./gmail";
import { listOpportunitiesDueForNudge, updateOpportunityRelationshipStage, updateOpportunityTouchTimestamps } from "./opportunities";
import { dismissPendingNudgesForOpportunities } from "./queue";
import { daysSinceIso, snoozeUntilIso, type FollowUpRow } from "../follow-ups";

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

type QueueNudgeRow = {
  id: string;
  opportunity_id: string;
  outreach_draft_id: string | null;
  created_at: string;
};

type DraftLite = {
  id: string;
  contact_id: string | null;
  ai_subject: string;
  ai_body: string;
  edited_subject: string | null;
  edited_body: string | null;
};

type OppLite = {
  id: string;
  organization_id: string;
  title: string;
  relationship_stage: string | null;
  last_outbound_at: string | null;
  next_follow_up_at: string | null;
};

async function listPendingNudgeQueueRows(): Promise<QueueNudgeRow[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("approval_queue_items")
    .select("id, opportunity_id, outreach_draft_id, created_at")
    .eq("status", "pending")
    .eq("kind", "nudge")
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as QueueNudgeRow[];
}

function sortFollowUpRows(rows: FollowUpRow[]): FollowUpRow[] {
  return [...rows].sort((a, b) => {
    if (a.hasDraft !== b.hasDraft) return a.hasDraft ? -1 : 1;
    const aDays = a.daysSinceSend ?? -1;
    const bDays = b.daysSinceSend ?? -1;
    return bDays - aDays;
  });
}

export async function listFollowUpRows(now: Date = new Date()): Promise<FollowUpRow[]> {
  const db = requireSupabaseAdmin();
  const nowMs = now.getTime();
  const pending = await listPendingNudgeQueueRows();
  const pendingOppIds = new Set(pending.map((row) => row.opportunity_id));

  const dueWithoutDraft = (await listOpportunitiesDueForNudge(now.toISOString(), 200)).filter(
    (opp) => !pendingOppIds.has(opp.id)
  );

  const oppIds = [
    ...pending.map((row) => row.opportunity_id),
    ...dueWithoutDraft.map((opp) => opp.id),
  ];
  const draftIds = pending.map((row) => row.outreach_draft_id).filter((id): id is string => Boolean(id));

  const [draftRows, oppRows] = await Promise.all([
    draftIds.length > 0
      ? fetchInChunks<DraftLite>(draftIds, async (chunk) =>
          db
            .from("outreach_drafts")
            .select("id, contact_id, ai_subject, ai_body, edited_subject, edited_body")
            .in("id", chunk)
        )
      : Promise.resolve([] as DraftLite[]),
    fetchInChunks<OppLite>(oppIds, async (chunk) =>
      db
        .from("opportunities")
        .select("id, organization_id, title, relationship_stage, last_outbound_at, next_follow_up_at")
        .in("id", chunk)
    ),
  ]);

  const draftById = new Map(draftRows.map((row) => [row.id, row]));
  const oppById = new Map(oppRows.map((row) => [row.id, row]));
  for (const opp of dueWithoutDraft) {
    if (!oppById.has(opp.id)) {
      oppById.set(opp.id, {
        id: opp.id,
        organization_id: opp.organizationId,
        title: opp.title,
        relationship_stage: opp.relationshipStage,
        last_outbound_at: opp.lastOutboundAt,
        next_follow_up_at: opp.nextFollowUpAt,
      });
    }
  }

  const contactIds = draftRows.map((row) => row.contact_id).filter((id): id is string => Boolean(id));
  const orgIds = Array.from(oppById.values()).map((row) => row.organization_id);

  const [orgRows, contactRows] = await Promise.all([
    fetchInChunks<{ id: string; name: string }>(orgIds, async (chunk) =>
      db.from("organizations").select("id, name").in("id", chunk)
    ),
    contactIds.length > 0
      ? fetchInChunks<{ id: string; full_name: string | null; email: string | null }>(contactIds, async (chunk) =>
          db.from("contacts").select("id, full_name, email").in("id", chunk)
        )
      : Promise.resolve([] as { id: string; full_name: string | null; email: string | null }[]),
  ]);
  const orgById = new Map(orgRows.map((row) => [row.id, row.name]));
  const contactById = new Map(contactRows.map((row) => [row.id, row]));

  const rows: FollowUpRow[] = [];

  for (const item of pending) {
    const opportunity = oppById.get(item.opportunity_id);
    if (!opportunity) continue;
    const draft = item.outreach_draft_id ? draftById.get(item.outreach_draft_id) : undefined;
    const contact = draft?.contact_id ? contactById.get(draft.contact_id) : undefined;
    rows.push({
      queueItemId: item.id,
      opportunityId: opportunity.id,
      organizationId: opportunity.organization_id,
      organizationName: orgById.get(opportunity.organization_id) ?? "Unknown org",
      contactId: contact?.id ?? draft?.contact_id ?? null,
      contactName: contact?.full_name ?? null,
      contactEmail: contact?.email ?? null,
      lastOutboundAt: opportunity.last_outbound_at,
      daysSinceSend: daysSinceIso(opportunity.last_outbound_at, nowMs),
      nextFollowUpAt: opportunity.next_follow_up_at,
      subject: (draft?.edited_subject ?? draft?.ai_subject ?? "").trim(),
      body: (draft?.edited_body ?? draft?.ai_body ?? "").trim(),
      hasDraft: Boolean(draft),
      relationshipStage: opportunity.relationship_stage,
    });
  }

  for (const opportunity of dueWithoutDraft) {
    rows.push({
      queueItemId: null,
      opportunityId: opportunity.id,
      organizationId: opportunity.organizationId,
      organizationName: orgById.get(opportunity.organizationId) ?? "Unknown org",
      contactId: null,
      contactName: null,
      contactEmail: null,
      lastOutboundAt: opportunity.lastOutboundAt,
      daysSinceSend: daysSinceIso(opportunity.lastOutboundAt, nowMs),
      nextFollowUpAt: opportunity.nextFollowUpAt,
      subject: "",
      body: "",
      hasDraft: false,
      relationshipStage: opportunity.relationshipStage,
    });
  }

  return sortFollowUpRows(rows);
}

export async function loadFollowUpPage(now: Date = new Date()) {
  const [rows, gmail] = await Promise.all([listFollowUpRows(now), getGmailConnectionStatus()]);
  return {
    rows,
    gmail,
    withDraft: rows.filter((row) => row.hasDraft).length,
    dueWithoutDraft: rows.filter((row) => !row.hasDraft).length,
  };
}

export async function snoozeFollowUps(opportunityIds: string[], days = 7): Promise<{ snoozed: number; until: string }> {
  const unique = Array.from(new Set(opportunityIds.filter(Boolean)));
  const until = snoozeUntilIso(new Date(), days);
  for (const id of unique) {
    await updateOpportunityTouchTimestamps(id, { nextFollowUpAt: until });
  }
  await dismissPendingNudgesForOpportunities(unique, {
    status: "deferred",
    decisionNotes: `Snoozed ${days} days from Follow-ups`,
    deferredUntil: until,
  });
  return { snoozed: unique.length, until };
}

export async function markFollowUpsLost(opportunityIds: string[]): Promise<{ lost: number }> {
  const unique = Array.from(new Set(opportunityIds.filter(Boolean)));
  for (const id of unique) {
    await updateOpportunityRelationshipStage(id, "lost");
  }
  await dismissPendingNudgesForOpportunities(unique, {
    status: "rejected",
    decisionNotes: "Marked lost from Follow-ups",
  });
  return { lost: unique.length };
}
