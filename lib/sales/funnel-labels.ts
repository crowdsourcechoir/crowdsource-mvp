import type { RelationshipStage } from "@/lib/sales/types";

/** UI labels. DB still stores `purchase`; we show it as Won. */
export const FUNNEL_STAGES: { key: RelationshipStage; label: string }[] = [
  { key: "awareness", label: "Awareness" },
  { key: "interest", label: "Interest" },
  { key: "purchase", label: "Won" },
  { key: "lost", label: "Lost" },
];

export function funnelStageLabel(stage: string | null | undefined): string {
  if (!stage) return "Not in funnel";
  const found = FUNNEL_STAGES.find((s) => s.key === stage);
  if (found) return found.label;
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}
