import type { QueueSidebarItem } from "../types";
import { pnwSportsPriorityTier } from "./pnw-sports-priority";

export function queueSidebarSortScore(item: Pick<QueueSidebarItem, "totalScore" | "draftConfidence">): number {
  if (item.totalScore != null) return item.totalScore;
  if (item.draftConfidence != null) return item.draftConfidence * 100;
  return -1;
}

export function queueSidebarPnwSportsTier(item: QueueSidebarItem): number {
  if (item.pnwSportsPriorityTier != null) return item.pnwSportsPriorityTier;
  return pnwSportsPriorityTier({
    organizationName: item.organizationName,
    opportunityTitle: item.opportunityTitle,
    category: item.category,
    opportunityTypeKey: item.opportunityTypeKey,
    organizationTypeKey: item.organizationTypeKey,
    productExperience: item.productExperience,
    locationCity: item.locationCity,
    locationRegion: item.locationRegion,
  });
}

export function sortQueueSidebarItems(items: QueueSidebarItem[]): QueueSidebarItem[] {
  return [...items].sort((a, b) => {
    const aUncontacted = a.outreachKind === "none";
    const bUncontacted = b.outreachKind === "none";
    if (aUncontacted && bUncontacted) {
      const aPnw = queueSidebarPnwSportsTier(a);
      const bPnw = queueSidebarPnwSportsTier(b);
      if (aPnw !== bPnw) return bPnw - aPnw;
    }
    return queueSidebarSortScore(b) - queueSidebarSortScore(a);
  });
}
