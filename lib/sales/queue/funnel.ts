import type { RelationshipStage } from "@/lib/sales/types";
import { FUNNEL_STAGES } from "@/lib/sales/funnel-labels";

export type QueueFunnelFilter = "all" | RelationshipStage;

export const QUEUE_FUNNEL_OPTIONS: { key: QueueFunnelFilter; label: string }[] = [
  { key: "all", label: "All stages" },
  ...FUNNEL_STAGES.map((s) => ({ key: s.key as QueueFunnelFilter, label: s.label })),
  { key: "parked", label: "Parked" },
];

export function parseQueueFunnel(raw: string | null | undefined): QueueFunnelFilter {
  if (!raw || raw === "all") return "all";
  if (raw === "awareness" || raw === "interest" || raw === "purchase" || raw === "lost" || raw === "parked") return raw;
  if (raw === "won") return "purchase";
  return "all";
}

export function matchesQueueFunnel(
  stage: RelationshipStage | null | undefined,
  filter: QueueFunnelFilter,
  parked = false
): boolean {
  const isParked = parked || stage === "parked";
  if (filter === "parked") return isParked;
  // Parked deals stay in a separate view so they don't sit in the active pipeline.
  if (isParked) return false;
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
  const parked = funnelByStage.parked ?? 0;
  return {
    all: awareness + interest + purchase + lost,
    awareness,
    interest,
    purchase,
    lost,
    parked,
  };
}

export function queueFunnelLabel(key: QueueFunnelFilter): string {
  return QUEUE_FUNNEL_OPTIONS.find((o) => o.key === key)?.label ?? key;
}
