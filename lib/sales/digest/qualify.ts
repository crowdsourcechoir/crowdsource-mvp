import type { QueueItemDetail } from "../types";
import {
  classifyQueueCategory,
  matchesQueueCategory,
  queueCategoryLabel,
  type QueueCategoryFilter,
} from "../queue/category";
import { getDigestCategoryFilter } from "./config";

function salesInitiativeOf(item: QueueItemDetail): string | null {
  const meta = item.organization.importMetadata;
  if (!meta || typeof meta !== "object") return null;
  const value = (meta as { salesInitiative?: unknown }).salesInitiative;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Category input for a fully assembled queue item (org lead). */
export function digestCategoryInput(item: QueueItemDetail) {
  return {
    organizationName: item.organization.name,
    opportunityTitle: item.opportunity.title,
    opportunityTypeKey: item.opportunityTypeKey,
    organizationTypeKey: item.organizationTypeKey,
    salesInitiative: salesInitiativeOf(item),
    category: item.category ?? null,
  };
}

export function digestItemCategory(item: QueueItemDetail) {
  return classifyQueueCategory(digestCategoryInput(item));
}

/** Leads that clear the digest quality bar (score present and >= minScore). */
export function filterDigestQualifyingItems(items: QueueItemDetail[], minScore: number): QueueItemDetail[] {
  return items.filter((item) => (item.score?.totalScore ?? -1) >= minScore);
}

/** Morning digest is org leads only — keep the highest-scoring opportunity per organization. */
export function dedupeDigestItemsByOrganization(items: QueueItemDetail[]): QueueItemDetail[] {
  const seen = new Set<string>();
  const out: QueueItemDetail[] = [];
  for (const item of sortByScoreDesc(items)) {
    if (seen.has(item.organization.id)) continue;
    seen.add(item.organization.id);
    out.push(item);
  }
  return out;
}

/** Restrict digest to the configured category (default: conferences). */
export function filterDigestItemsByCategory(
  items: QueueItemDetail[],
  category: QueueCategoryFilter = getDigestCategoryFilter()
): QueueItemDetail[] {
  return items.filter((item) => matchesQueueCategory(digestCategoryInput(item), category));
}

export function sortByScoreDesc(items: QueueItemDetail[]): QueueItemDetail[] {
  return [...items].sort((a, b) => (b.score?.totalScore ?? -1) - (a.score?.totalScore ?? -1));
}

export function digestCategoryLabel(category: QueueCategoryFilter = getDigestCategoryFilter()): string {
  return queueCategoryLabel(category);
}
