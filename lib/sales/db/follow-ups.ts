import { requireSupabaseAdmin } from "./client";
import { shouldShowTodayFollowUp, todayFollowUpReason } from "../follow-up/today";
import { replyKindFromActivity } from "../outreach/inbound-kind";
import { latestLiveCorrespondent } from "../outreach/reply-correspondent";
import { listContactsForOrganizations } from "./contacts";
import type { RelationshipStage } from "../types";

export type SalesTodayReason = "overdue" | "replied" | "due";

export type SalesTodayTask = {
  opportunityId: string;
  organizationId: string;
  organizationName: string;
  contactName: string | null;
  title: string;
  stage: RelationshipStage;
  reason: SalesTodayReason;
  nextFollowUpAt: string | null;
  lastInboundAt: string | null;
  snippet: string | null;
  gmailThreadId: string | null;
  queueItemId: string | null;
};

export type SalesTodaySnapshot = {
  dueCount: number;
  overdueCount: number;
  repliedCount: number;
  tasks: SalesTodayTask[];
};

function snippetOf(metadata: Record<string, unknown> | null | undefined): string | null {
  const value = metadata?.snippet;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function decodeSnippet(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

type ReplyRow = {
  opportunity_id: string;
  contact_id: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
};

export async function loadSalesTodayTasks(now: Date = new Date()): Promise<SalesTodaySnapshot> {
  const db = requireSupabaseAdmin();
  const { data: oppRows, error: oppErr } = await db
    .from("opportunities")
    .select(
      "id, organization_id, title, relationship_stage, next_follow_up_at, last_inbound_at, last_outbound_at, gmail_thread_id"
    )
    .in("relationship_stage", ["awareness", "interest"]);
  if (oppErr) throw new Error(oppErr.message);

  const allOppIds = (oppRows ?? []).map((row) => String(row.id));
  const liveReplyByOpp = new Set<string>();
  const snippetByOpp = new Map<string, string>();
  const repliesByOpp = new Map<string, ReplyRow[]>();
  if (allOppIds.length > 0) {
    const { data: replyRows, error: replyErr } = await db
      .from("outreach_activities")
      .select("opportunity_id, contact_id, metadata, occurred_at")
      .in("opportunity_id", allOppIds)
      .eq("activity_type", "replied")
      .order("occurred_at", { ascending: false });
    if (replyErr) throw new Error(replyErr.message);
    for (const row of replyRows ?? []) {
      const oppId = String(row.opportunity_id);
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const reply: ReplyRow = {
        opportunity_id: oppId,
        contact_id: (row.contact_id as string | null) ?? null,
        metadata,
        occurred_at: String(row.occurred_at),
      };
      const list = repliesByOpp.get(oppId) ?? [];
      list.push(reply);
      repliesByOpp.set(oppId, list);
      const kind = replyKindFromActivity({ metadata });
      if (kind === "live") liveReplyByOpp.add(oppId);
      if (kind !== "live" || snippetByOpp.has(oppId)) continue;
      const snippet = snippetOf(metadata);
      if (snippet) snippetByOpp.set(oppId, decodeSnippet(snippet));
    }
  }

  const candidates = (oppRows ?? []).filter((row) => {
    const next = typeof row.next_follow_up_at === "string" ? row.next_follow_up_at : null;
    return shouldShowTodayFollowUp({
      hasLiveReply: liveReplyByOpp.has(String(row.id)),
      nextFollowUpAt: next,
      now,
    });
  });

  const orgIds = Array.from(new Set(candidates.map((row) => String(row.organization_id))));
  const oppIds = candidates.map((row) => String(row.id));
  const nameByOrg = new Map<string, string>();
  const queueByOpp = new Map<string, string>();

  if (orgIds.length > 0) {
    const { data, error } = await db.from("organizations").select("id, name").in("id", orgIds);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) nameByOrg.set(String(row.id), String(row.name));
  }

  if (oppIds.length > 0) {
    const { data: queueRows, error: queueErr } = await db
      .from("approval_queue_items")
      .select("id, opportunity_id, status, created_at")
      .in("opportunity_id", oppIds)
      .order("created_at", { ascending: false });
    if (queueErr) throw new Error(queueErr.message);
    for (const row of queueRows ?? []) {
      const oppId = String(row.opportunity_id);
      if (queueByOpp.has(oppId)) continue;
      queueByOpp.set(oppId, String(row.id));
    }
  }

  const contacts = await listContactsForOrganizations(orgIds);
  const contactsByOrg = new Map<string, typeof contacts>();
  for (const contact of contacts) {
    const list = contactsByOrg.get(contact.organizationId) ?? [];
    list.push(contact);
    contactsByOrg.set(contact.organizationId, list);
  }

  const tasks: SalesTodayTask[] = candidates.map((row) => {
    const next = typeof row.next_follow_up_at === "string" ? row.next_follow_up_at : null;
    const inbound = typeof row.last_inbound_at === "string" ? row.last_inbound_at : null;
    const outbound = typeof row.last_outbound_at === "string" ? row.last_outbound_at : null;
    let inboundAfterSend = false;
    if (inbound && !outbound) inboundAfterSend = true;
    else if (inbound && outbound) inboundAfterSend = new Date(inbound).getTime() >= new Date(outbound).getTime();
    const liveReply = liveReplyByOpp.has(String(row.id));
    const orgContacts = contactsByOrg.get(String(row.organization_id)) ?? [];
    const correspondent = latestLiveCorrespondent(
      (repliesByOpp.get(String(row.id)) ?? []).map((reply) => ({
        activityType: "replied",
        occurredAt: reply.occurred_at,
        contactId: reply.contact_id,
        metadata: reply.metadata,
      })),
      orgContacts
    );
    const correspondentName =
      (correspondent ? orgContacts.find((contact) => contact.id === correspondent.contactId)?.fullName : null) ?? null;
    return {
      opportunityId: String(row.id),
      organizationId: String(row.organization_id),
      organizationName: nameByOrg.get(String(row.organization_id)) ?? "Unknown org",
      contactName: correspondentName,
      title: String(row.title ?? ""),
      stage: row.relationship_stage as RelationshipStage,
      reason: todayFollowUpReason({
        hasLiveReply: liveReply,
        inboundAfterSend,
        nextFollowUpAt: next,
        now,
      }),
      nextFollowUpAt: next,
      lastInboundAt: inbound,
      snippet: snippetByOpp.get(String(row.id)) ?? null,
      gmailThreadId: typeof row.gmail_thread_id === "string" ? row.gmail_thread_id : null,
      queueItemId: queueByOpp.get(String(row.id)) ?? null,
    };
  });

  const rank = (reason: SalesTodayReason) => (reason === "replied" ? 0 : reason === "overdue" ? 1 : 2);
  tasks.sort((a, b) => {
    const r = rank(a.reason) - rank(b.reason);
    if (r !== 0) return r;
    return (b.lastInboundAt ?? "").localeCompare(a.lastInboundAt ?? "") || (a.nextFollowUpAt ?? "").localeCompare(b.nextFollowUpAt ?? "");
  });

  return {
    dueCount: tasks.length,
    overdueCount: tasks.filter((t) => t.reason === "overdue").length,
    repliedCount: tasks.filter((t) => t.reason === "replied").length,
    tasks,
  };
}
