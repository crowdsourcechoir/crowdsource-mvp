import type { RelationshipStage } from "./types";

export type TodayFunnelRow = {
  id: string;
  organizationId: string;
  title: string;
  relationshipStage: RelationshipStage | null;
  lastOutboundAt: string | null;
  lastInboundAt: string | null;
  nextFollowUpAt: string | null;
};

export type TodayHotLead = {
  opportunityId: string;
  organizationId: string;
  organizationName: string;
  title: string;
  reason: "replied" | "interest" | "won";
  stage: RelationshipStage;
};

export type TodaySnapshot = {
  newToSend: number;
  followUpsDue: number;
  followUpDrafts: number;
  replies: number;
  sentThisWeek: number;
  sentAllTime: number;
  awaitingReply: number;
  replied: number;
  won: number;
  lost: number;
  inFunnel: number;
  hot: TodayHotLead[];
};

export function hasInboundSinceOutbound(row: Pick<TodayFunnelRow, "lastOutboundAt" | "lastInboundAt">): boolean {
  if (!row.lastInboundAt) return false;
  if (!row.lastOutboundAt) return true;
  return new Date(row.lastInboundAt).getTime() >= new Date(row.lastOutboundAt).getTime();
}

export function isAwaitingReply(row: TodayFunnelRow): boolean {
  if (row.relationshipStage === "purchase" || row.relationshipStage === "lost") return false;
  if (!row.lastOutboundAt) return false;
  return !hasInboundSinceOutbound(row);
}

export function isFollowUpDue(row: TodayFunnelRow, nowMs: number = Date.now()): boolean {
  if (!isAwaitingReply(row)) return false;
  if (row.relationshipStage !== "awareness" && row.relationshipStage !== "interest") return false;
  if (!row.nextFollowUpAt) return false;
  return new Date(row.nextFollowUpAt).getTime() <= nowMs;
}

export function isReplyToHandle(row: TodayFunnelRow): boolean {
  if (row.relationshipStage === "lost" || row.relationshipStage === "purchase") return false;
  if (row.relationshipStage === "interest") return true;
  return hasInboundSinceOutbound(row);
}

export function summarizeFunnel(rows: TodayFunnelRow[], nowMs: number = Date.now()) {
  let awaitingReply = 0;
  let replied = 0;
  let followUpsDue = 0;
  let won = 0;
  let lost = 0;
  const replyRows: TodayFunnelRow[] = [];

  for (const row of rows) {
    if (row.relationshipStage === "purchase") {
      won += 1;
      continue;
    }
    if (row.relationshipStage === "lost") {
      lost += 1;
      continue;
    }
    if (isReplyToHandle(row)) {
      replied += 1;
      replyRows.push(row);
    } else if (isAwaitingReply(row)) {
      awaitingReply += 1;
    }
    if (isFollowUpDue(row, nowMs)) followUpsDue += 1;
  }

  return { awaitingReply, replied, followUpsDue, won, lost, inFunnel: rows.length, replyRows };
}

export function pickHotLeads(
  rows: TodayFunnelRow[],
  namesByOrgId: Map<string, string>,
  limit = 8
): TodayHotLead[] {
  const scored = rows
    .filter((row) => row.relationshipStage && row.relationshipStage !== "lost")
    .map((row) => {
      const won = row.relationshipStage === "purchase";
      const replied = hasInboundSinceOutbound(row);
      const interest = row.relationshipStage === "interest";
      if (!won && !replied && !interest) return null;
      const reason: TodayHotLead["reason"] = won ? "won" : replied ? "replied" : "interest";
      const recency = new Date(row.lastInboundAt ?? row.lastOutboundAt ?? 0).getTime();
      return {
        opportunityId: row.id,
        organizationId: row.organizationId,
        organizationName: namesByOrgId.get(row.organizationId) ?? "Unknown org",
        title: row.title,
        reason,
        stage: row.relationshipStage as RelationshipStage,
        recency,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => {
      const rank = (r: TodayHotLead["reason"]) => (r === "won" ? 0 : r === "replied" ? 1 : 2);
      const byReason = rank(a.reason) - rank(b.reason);
      if (byReason !== 0) return byReason;
      return b.recency - a.recency;
    });

  return scored.slice(0, limit).map(({ recency: _recency, ...lead }) => lead);
}
