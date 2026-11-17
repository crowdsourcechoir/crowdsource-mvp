import { HIGH_VALUE_POTENTIAL_USD, isHighValueOpportunity } from "../business-model";

export type QueueValueFilter = "all" | "high";

export const QUEUE_VALUE_OPTIONS: { key: QueueValueFilter; label: string }[] = [
  { key: "all", label: "All values" },
  {
    key: "high",
    label: `High ≥ $${Math.round(HIGH_VALUE_POTENTIAL_USD / 1000)}k`,
  },
];

export function parseQueueValue(raw: string | null | undefined): QueueValueFilter {
  if (raw === "high") return "high";
  return "all";
}

export function matchesQueueValue(
  potentialAmount: number | null | undefined,
  filter: QueueValueFilter
): boolean {
  if (filter === "all") return true;
  return isHighValueOpportunity(potentialAmount);
}

export function countQueueValues(
  items: Array<{ potentialAmount?: number | null }>
): Record<QueueValueFilter, number> {
  let high = 0;
  for (const item of items) {
    if (isHighValueOpportunity(item.potentialAmount)) high += 1;
  }
  return { all: items.length, high };
}
