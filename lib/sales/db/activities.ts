import { requireSupabaseAdmin } from "./client";
import type { OutreachActivity, OutreachActivityType } from "../types";

function rowToActivity(row: Record<string, unknown>): OutreachActivity {
  return {
    id: row.id as string,
    opportunityId: row.opportunity_id as string,
    contactId: (row.contact_id as string | null) ?? null,
    activityType: row.activity_type as OutreachActivityType,
    occurredAt: row.occurred_at as string,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    gmailMessageId: (row.gmail_message_id as string | null) ?? null,
    gmailThreadId: (row.gmail_thread_id as string | null) ?? null,
  };
}

export async function createOutreachActivity(input: {
  opportunityId: string;
  contactId?: string | null;
  activityType: OutreachActivityType;
  occurredAt?: string;
  metadata?: Record<string, unknown> | null;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
}): Promise<OutreachActivity> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("outreach_activities")
    .insert({
      opportunity_id: input.opportunityId,
      contact_id: input.contactId ?? null,
      activity_type: input.activityType,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      metadata: input.metadata ?? null,
      gmail_message_id: input.gmailMessageId ?? null,
      gmail_thread_id: input.gmailThreadId ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToActivity(data);
}

export async function findActivityByGmailMessageId(gmailMessageId: string): Promise<OutreachActivity | null> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("outreach_activities")
    .select("*")
    .eq("gmail_message_id", gmailMessageId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToActivity(data) : null;
}

export async function listActivitiesForOpportunity(opportunityId: string): Promise<OutreachActivity[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("outreach_activities")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("occurred_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToActivity);
}

export async function listRepliedActivitiesForOpportunities(opportunityIds: string[]): Promise<OutreachActivity[]> {
  const unique = Array.from(new Set(opportunityIds.filter(Boolean)));
  if (unique.length === 0) return [];
  const db = requireSupabaseAdmin();
  const rows: OutreachActivity[] = [];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { data, error } = await db
      .from("outreach_activities")
      .select("*")
      .in("opportunity_id", chunk)
      .eq("activity_type", "replied")
      .order("occurred_at", { ascending: false });
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []).map(rowToActivity));
  }
  return rows;
}

export async function listOutreachActivitiesByTypes(
  types: OutreachActivityType[],
  maxRows = 4000
): Promise<OutreachActivity[]> {
  const db = requireSupabaseAdmin();
  const pageSize = 1000;
  const rows: OutreachActivity[] = [];
  let from = 0;
  while (rows.length < maxRows) {
    const to = Math.min(from + pageSize - 1, maxRows - 1);
    const { data, error } = await db
      .from("outreach_activities")
      .select("*")
      .in("activity_type", types)
      .order("occurred_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    const page = (data ?? []).map(rowToActivity);
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

export async function countSentNudgesForOpportunity(opportunityId: string): Promise<number> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("outreach_activities")
    .select("id, metadata")
    .eq("opportunity_id", opportunityId)
    .eq("activity_type", "sent");
  if (error) throw new Error(error.message);
  return (data ?? []).filter((row) => {
    const meta = row.metadata as Record<string, unknown> | null;
    return meta?.kind === "nudge";
  }).length;
}

export async function countSentNudgesForContact(opportunityId: string, contactId: string): Promise<number> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("outreach_activities")
    .select("id, metadata, contact_id")
    .eq("opportunity_id", opportunityId)
    .eq("contact_id", contactId)
    .eq("activity_type", "sent");
  if (error) throw new Error(error.message);
  return (data ?? []).filter((row) => {
    const meta = row.metadata as Record<string, unknown> | null;
    return meta?.kind === "nudge";
  }).length;
}

export async function findOpportunityIdByGmailThreadId(threadId: string): Promise<string | null> {
  const db = requireSupabaseAdmin();
  const { data: opp, error: oppErr } = await db
    .from("opportunities")
    .select("id")
    .eq("gmail_thread_id", threadId)
    .maybeSingle();
  if (oppErr) throw new Error(oppErr.message);
  if (opp?.id) return opp.id as string;

  const { data: act, error: actErr } = await db
    .from("outreach_activities")
    .select("opportunity_id")
    .eq("gmail_thread_id", threadId)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (actErr) throw new Error(actErr.message);
  return (act?.opportunity_id as string | null) ?? null;
}
