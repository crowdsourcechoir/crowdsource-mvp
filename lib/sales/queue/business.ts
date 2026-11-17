import {
  BUSINESS_CATEGORIES,
  BUSINESS_CATEGORY_KEYS,
  classifyBusinessCategory,
  type BusinessCategoryKey,
  type BusinessModelClassifyInput,
} from "../business-model";

export type QueueBusinessFilter = "all" | BusinessCategoryKey;

export const QUEUE_BUSINESS_OPTIONS: { key: QueueBusinessFilter; label: string }[] = [
  { key: "all", label: "All business" },
  ...BUSINESS_CATEGORY_KEYS.map((key) => ({
    key,
    label: BUSINESS_CATEGORIES[key].shortLabel,
  })),
];

export function parseQueueBusiness(raw: string | null | undefined): QueueBusinessFilter {
  if (!raw || raw === "all") return "all";
  return (BUSINESS_CATEGORY_KEYS as readonly string[]).includes(raw)
    ? (raw as BusinessCategoryKey)
    : "all";
}

export function matchesQueueBusiness(
  input: BusinessModelClassifyInput & { businessCategory?: BusinessCategoryKey | null },
  filter: QueueBusinessFilter
): boolean {
  if (filter === "all") return true;
  const key = input.businessCategory ?? classifyBusinessCategory(input);
  return key === filter;
}

export function countQueueBusiness<
  T extends BusinessModelClassifyInput & { businessCategory?: BusinessCategoryKey | null },
>(items: T[]): Record<QueueBusinessFilter, number> {
  const counts: Record<QueueBusinessFilter, number> = {
    all: items.length,
    commissioned: 0,
    owned: 0,
  };
  for (const item of items) {
    const key = item.businessCategory ?? classifyBusinessCategory(item);
    counts[key] += 1;
  }
  return counts;
}
