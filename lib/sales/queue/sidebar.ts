import type { QueueSidebarItem } from "../types";

export function queueSidebarSortScore(item: Pick<QueueSidebarItem, "totalScore" | "draftConfidence">): number {
  if (item.totalScore != null) return item.totalScore;
  if (item.draftConfidence != null) return item.draftConfidence * 100;
  return -1;
}

export function sortQueueSidebarItems(items: QueueSidebarItem[]): QueueSidebarItem[] {
  return [...items].sort((a, b) => queueSidebarSortScore(b) - queueSidebarSortScore(a));
}
