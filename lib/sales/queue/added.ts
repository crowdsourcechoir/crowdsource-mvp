/**
 * Queue "Recently added" filter — pending/queued rows created in the last 24h
 * (same lookback the morning digest uses for net-new).
 */

export const QUEUE_ADDED_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export type QueueAddedFilter = "all" | "new";

export const QUEUE_ADDED_OPTIONS: { key: QueueAddedFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "Recently added" },
];

export function parseQueueAdded(raw: string | null | undefined): QueueAddedFilter {
  if (!raw || raw === "all") return "all";
  if (raw === "new" || raw === "recent" || raw === "recently_added") return "new";
  return "all";
}

export function isRecentlyAddedQueueItem(
  createdAt: string | null | undefined,
  nowMs: number = Date.now(),
  lookbackMs: number = QUEUE_ADDED_LOOKBACK_MS
): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return false;
  return t >= nowMs - lookbackMs && t <= nowMs + 60_000;
}

export function matchesQueueAdded(
  createdAt: string | null | undefined,
  filter: QueueAddedFilter,
  nowMs: number = Date.now()
): boolean {
  if (filter === "all") return true;
  return isRecentlyAddedQueueItem(createdAt, nowMs);
}

export function countQueueAdded<T extends { queueItem: { createdAt?: string | null } }>(
  items: T[],
  nowMs: number = Date.now()
): Record<QueueAddedFilter, number> {
  let recent = 0;
  for (const item of items) {
    if (isRecentlyAddedQueueItem(item.queueItem.createdAt, nowMs)) recent += 1;
  }
  return { all: items.length, new: recent };
}

export function queueAddedLabel(key: QueueAddedFilter): string {
  return QUEUE_ADDED_OPTIONS.find((o) => o.key === key)?.label ?? key;
}
