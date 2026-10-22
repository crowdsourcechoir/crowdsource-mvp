import type { RelationshipStage } from "@/lib/sales/types";
import { FUNNEL_STAGES } from "@/lib/sales/funnel-labels";

export type QueueFunnelFilter = "all" | RelationshipStage;

export const QUEUE_FUNNEL_OPTIONS: { key: QueueFunnelFilter; label: string }[] = [
  { key: "all", label: "All stages" },
  ...FUNNEL_STAGES.map((s) => ({ key: s.key as QueueFunnelFilter, label: s.label })),
];

export function parseQueueFunnel(raw: string | null | undefined): QueueFunnelFilter {
  if (!raw || raw === "all") return "all";
  if (raw === "awareness" || raw === "interest" || raw === "purchase" || raw === "lost") return raw;
  if (raw === "won") return "purchase";
  return "all";
}

export function matchesQueueFunnel(
  stage: RelationshipStage | null | undefined,
  filter: QueueFunnelFilter
): boolean {
  if (filter === "all") return true;
  // Null stage means not yet in the CRM funnel (unsent). Do not treat as Awareness —
  // dashboard / funnel board only count non-null relationship_stage.
  return stage === filter;
}

/** Badge counts for the queue Funnel dropdown — same population as sales dashboard. */
export function funnelCountsFromStages(
  funnelByStage: Record<RelationshipStage, number>
): Record<QueueFunnelFilter, number> {
  const awareness = funnelByStage.awareness ?? 0;
  const interest = funnelByStage.interest ?? 0;
  const purchase = funnelByStage.purchase ?? 0;
  const lost = funnelByStage.lost ?? 0;
  return {
    all: awareness + interest + purchase + lost,
    awareness,
    interest,
    purchase,
    lost,
  };
}

export function queueFunnelLabel(key: QueueFunnelFilter): string {
  return QUEUE_FUNNEL_OPTIONS.find((o) => o.key === key)?.label ?? key;
}
