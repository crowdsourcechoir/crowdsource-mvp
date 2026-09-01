import { hasInboundSinceOutbound } from "./today";
import type { RelationshipStage } from "./types";

export type FunnelFocus =
  | "attention"
  | "replies"
  | "nudge"
  | "awareness"
  | "interest"
  | "purchase"
  | "lost"
  | "all";

export type FunnelFocusRow = {
  needsNudge: boolean;
  opportunity: {
    relationshipStage: RelationshipStage | null;
    lastOutboundAt: string | null;
    lastInboundAt: string | null;
  };
};

const FOCUS_VALUES: FunnelFocus[] = [
  "attention",
  "replies",
  "nudge",
  "awareness",
  "interest",
  "purchase",
  "lost",
  "all",
];

/** Default daily surface is Needs attention — not the four-column board. */
export function parseFunnelFocus(param: string | null | undefined): FunnelFocus {
  if (!param) return "attention";
  if (param === "won") return "purchase";
  if ((FOCUS_VALUES as string[]).includes(param)) return param as FunnelFocus;
  return "attention";
}

export function isReplyFocusRow(row: FunnelFocusRow): boolean {
  const stage = row.opportunity.relationshipStage;
  if (stage === "lost" || stage === "purchase") return false;
  if (stage === "interest") return true;
  return hasInboundSinceOutbound(row.opportunity);
}

export function isNeedsAttentionRow(row: FunnelFocusRow): boolean {
  const stage = row.opportunity.relationshipStage;
  if (stage === "lost" || stage === "purchase") return false;
  if (stage === "interest") return true;
  if (hasInboundSinceOutbound(row.opportunity)) return true;
  return row.needsNudge;
}

export function matchesFunnelFocus(row: FunnelFocusRow, focus: FunnelFocus): boolean {
  const stage = row.opportunity.relationshipStage;
  if (!stage) return false;
  if (focus === "all") return true;
  if (focus === "attention") return isNeedsAttentionRow(row);
  if (focus === "replies") return isReplyFocusRow(row);
  if (focus === "nudge") return row.needsNudge;
  return stage === focus;
}

export function countFunnelFocus(rows: FunnelFocusRow[]): Record<FunnelFocus, number> {
  const counts: Record<FunnelFocus, number> = {
    attention: 0,
    replies: 0,
    nudge: 0,
    awareness: 0,
    interest: 0,
    purchase: 0,
    lost: 0,
    all: rows.length,
  };
  for (const row of rows) {
    if (isNeedsAttentionRow(row)) counts.attention += 1;
    if (isReplyFocusRow(row)) counts.replies += 1;
    if (row.needsNudge) counts.nudge += 1;
    const stage = row.opportunity.relationshipStage;
    if (stage === "awareness") counts.awareness += 1;
    else if (stage === "interest") counts.interest += 1;
    else if (stage === "purchase") counts.purchase += 1;
    else if (stage === "lost") counts.lost += 1;
  }
  return counts;
}
