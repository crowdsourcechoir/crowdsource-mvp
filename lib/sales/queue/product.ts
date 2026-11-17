import {
  PRODUCTS,
  PRODUCT_KEYS,
  classifyProductExperience,
  type BusinessModelClassifyInput,
  type ProductExperienceKey,
} from "../business-model";

export type QueueProductFilter = "all" | ProductExperienceKey;

export const QUEUE_PRODUCT_OPTIONS: { key: QueueProductFilter; label: string }[] = [
  { key: "all", label: "All products" },
  ...PRODUCT_KEYS.map((key) => ({
    key,
    label: PRODUCTS[key].label,
  })),
];

export function parseQueueProduct(raw: string | null | undefined): QueueProductFilter {
  if (!raw || raw === "all") return "all";
  return (PRODUCT_KEYS as readonly string[]).includes(raw) ? (raw as ProductExperienceKey) : "all";
}

export function matchesQueueProduct(
  input: BusinessModelClassifyInput & { productExperience?: ProductExperienceKey | null },
  filter: QueueProductFilter
): boolean {
  if (filter === "all") return true;
  const key = input.productExperience ?? classifyProductExperience(input);
  return key === filter;
}

export function countQueueProducts<
  T extends BusinessModelClassifyInput & { productExperience?: ProductExperienceKey | null },
>(items: T[]): Record<QueueProductFilter, number> {
  const counts = { all: items.length } as Record<QueueProductFilter, number>;
  for (const key of PRODUCT_KEYS) counts[key] = 0;
  for (const item of items) {
    const key = item.productExperience ?? classifyProductExperience(item);
    counts[key] += 1;
  }
  return counts;
}
