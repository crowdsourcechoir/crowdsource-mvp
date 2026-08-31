import { requireSupabaseAdmin } from "./client";
import { getGmailConnectionStatus } from "./gmail";
import {
  pickHotLeads,
  summarizeFunnel,
  type TodayFunnelRow,
  type TodaySnapshot,
} from "../today";
import type { RelationshipStage } from "../types";

function weekAgoIso(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

async function countActivities(type: string, sinceIso?: string): Promise<number> {
  const db = requireSupabaseAdmin();
  let query = db.from("outreach_activities").select("id", { count: "exact", head: true }).eq("activity_type", type);
  if (sinceIso) query = query.gte("occurred_at", sinceIso);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countPendingByKind(): Promise<{ initial: number; nudge: number; total: number }> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db.from("approval_queue_items").select("kind").eq("status", "pending");
  if (error) throw new Error(error.message);
  let initial = 0;
  let nudge = 0;
  for (const row of data ?? []) {
    if (row.kind === "nudge") nudge += 1;
    else initial += 1;
  }
  return { initial, nudge, total: initial + nudge };
}

async function listFunnelLite(): Promise<TodayFunnelRow[]> {
  const db = requireSupabaseAdmin();
  const { data, error } = await db
    .from("opportunities")
    .select("id, organization_id, title, relationship_stage, last_outbound_at, last_inbound_at, next_follow_up_at")
    .not("relationship_stage", "is", null);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    organizationId: row.organization_id as string,
    title: (row.title as string) ?? "",
    relationshipStage: (row.relationship_stage as RelationshipStage | null) ?? null,
    lastOutboundAt: (row.last_outbound_at as string | null) ?? null,
    lastInboundAt: (row.last_inbound_at as string | null) ?? null,
    nextFollowUpAt: (row.next_follow_up_at as string | null) ?? null,
  }));
}

async function organizationNames(ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const names = new Map<string, string>();
  if (unique.length === 0) return names;
  const db = requireSupabaseAdmin();
  const { data, error } = await db.from("organizations").select("id, name").in("id", unique);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) names.set(row.id as string, row.name as string);
  return names;
}

export async function loadTodaySnapshot(): Promise<TodaySnapshot> {
  const [pending, funnelRows, sentThisWeek, sentAllTime] = await Promise.all([
    countPendingByKind(),
    listFunnelLite(),
    countActivities("sent", weekAgoIso()),
    countActivities("sent"),
  ]);
  const summary = summarizeFunnel(funnelRows);
  const hotSource = summary.replyRows.concat(
    funnelRows.filter((row) => row.relationshipStage === "purchase")
  );
  const names = await organizationNames(hotSource.map((row) => row.organizationId));
  return {
    newToSend: pending.initial,
    followUpsDue: summary.followUpsDue,
    followUpDrafts: pending.nudge,
    replies: summary.replied,
    sentThisWeek,
    sentAllTime,
    awaitingReply: summary.awaitingReply,
    replied: summary.replied,
    won: summary.won,
    lost: summary.lost,
    inFunnel: summary.inFunnel,
    hot: pickHotLeads(hotSource, names),
  };
}

export async function loadTodayPage() {
  const [snapshot, gmail] = await Promise.all([loadTodaySnapshot(), getGmailConnectionStatus()]);
  return { snapshot, gmail };
}
