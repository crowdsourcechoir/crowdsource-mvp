import {
  DEAL_TYPES,
  DEAL_TYPE_KEYS,
  classifyDealType,
  type BusinessModelClassifyInput,
  type DealTypeKey,
} from "../business-model";

export type QueueDealFilter = "all" | DealTypeKey;

export const QUEUE_DEAL_OPTIONS: { key: QueueDealFilter; label: string }[] = [
  { key: "all", label: "All deal types" },
  ...DEAL_TYPE_KEYS.map((key) => ({
    key,
    label: DEAL_TYPES[key].shortLabel,
  })),
];

export function parseQueueDeal(raw: string | null | undefined): QueueDealFilter {
  if (!raw || raw === "all") return "all";
  return (DEAL_TYPE_KEYS as readonly string[]).includes(raw) ? (raw as DealTypeKey) : "all";
}

export function matchesQueueDeal(
  input: BusinessModelClassifyInput & { dealType?: DealTypeKey | null },
  filter: QueueDealFilter
): boolean {
  if (filter === "all") return true;
  const key = input.dealType ?? classifyDealType(input);
  return key === filter;
}

export function countQueueDeals<
  T extends BusinessModelClassifyInput & { dealType?: DealTypeKey | null },
>(items: T[]): Record<QueueDealFilter, number> {
  const counts = { all: items.length } as Record<QueueDealFilter, number>;
  for (const key of DEAL_TYPE_KEYS) counts[key] = 0;
  for (const item of items) {
    const key = item.dealType ?? classifyDealType(item);
    counts[key] += 1;
  }
  return counts;
}
