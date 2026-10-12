/**
 * Queue "Recently added" filter — rows whose queue item (or operator seed stamp)
 * landed in the last 7 days.
 */

export const QUEUE_ADDED_LOOKBACK_DAYS = 7;
export const QUEUE_ADDED_LOOKBACK_MS = QUEUE_ADDED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

export type QueueAddedFilter = "all" | "new";

export const QUEUE_ADDED_OPTIONS: { key: QueueAddedFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "Last 7 days" },
];

export function parseQueueAdded(raw: string | null | undefined): QueueAddedFilter {
  if (!raw || raw === "all") return "all";
  if (raw === "new" || raw === "recent" || raw === "recently_added") return "new";
  return "all";
}

/** Latest parseable ISO among candidates (null if none). */
export function latestIsoTimestamp(...candidates: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const t = Date.parse(candidate);
    if (!Number.isFinite(t)) continue;
    if (t > bestMs) {
      bestMs = t;
      best = candidate;
    }
  }
  return best;
}

/**
 * Operator / seed stamps on organization.import_metadata (e.g. elevateVibeCreateSeededAt,
 * amplify2027SeededAt, operatorQueuedAt). Used when an existing queue row was refreshed
 * without a new created_at.
 */
export function operatorAddedTimestampsFromMeta(
  meta: Record<string, unknown> | null | undefined
): string[] {
  if (!meta || typeof meta !== "object") return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(meta)) {
    if (typeof value !== "string") continue;
    if (!/(SeededAt|QueuedAt|AddedAt)$/i.test(key)) continue;
    out.push(value);
  }
  return out;
}

export function resolveQueueRecentlyAddedAt(
  queueCreatedAt: string | null | undefined,
  meta?: Record<string, unknown> | null
): string | null {
  return latestIsoTimestamp(queueCreatedAt, ...operatorAddedTimestampsFromMeta(meta));
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

export function queueItemAddedAt<
  T extends { recentlyAddedAt?: string | null; queueItem: { createdAt?: string | null } },
>(item: T): string | null {
  return item.recentlyAddedAt ?? item.queueItem.createdAt ?? null;
}

export function countQueueAdded<
  T extends { recentlyAddedAt?: string | null; queueItem: { createdAt?: string | null } },
>(items: T[], nowMs: number = Date.now()): Record<QueueAddedFilter, number> {
  let recent = 0;
  for (const item of items) {
    if (isRecentlyAddedQueueItem(queueItemAddedAt(item), nowMs)) recent += 1;
  }
  return { all: items.length, new: recent };
}

export function queueAddedLabel(key: QueueAddedFilter): string {
  return QUEUE_ADDED_OPTIONS.find((o) => o.key === key)?.label ?? key;
}
