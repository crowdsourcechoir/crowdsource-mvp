import type { QueueSidebarItem } from "../types";
import { isFirstTouchQueueKind } from "../follow-ups";

export function queueSidebarSortScore(item: Pick<QueueSidebarItem, "totalScore" | "draftConfidence">): number {
  if (item.totalScore != null) return item.totalScore;
  if (item.draftConfidence != null) return item.draftConfidence * 100;
  return -1;
}

export function sortQueueSidebarItems(items: QueueSidebarItem[]): QueueSidebarItem[] {
  return [...items].sort((a, b) => queueSidebarSortScore(b) - queueSidebarSortScore(a));
}

/** Queue sidebar is first-touch only; nudges belong on Follow-ups. */
export function filterFirstTouchSidebarItems<T extends { queueItem: { kind?: string | null } }>(items: T[]): T[] {
  return items.filter((item) => isFirstTouchQueueKind(item.queueItem.kind));
}
