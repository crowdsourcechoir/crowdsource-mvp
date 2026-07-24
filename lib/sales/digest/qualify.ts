import type { QueueItemDetail } from "../types";

/** Leads that clear the digest quality bar (score present and >= minScore). */
export function filterDigestQualifyingItems(items: QueueItemDetail[], minScore: number): QueueItemDetail[] {
  return items.filter((item) => (item.score?.totalScore ?? -1) >= minScore);
}

export function sortByScoreDesc(items: QueueItemDetail[]): QueueItemDetail[] {
  return [...items].sort((a, b) => (b.score?.totalScore ?? -1) - (a.score?.totalScore ?? -1));
}
