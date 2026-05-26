import type { GardenSlotId } from "./garden-slots";

const DONE_KEY_PREFIX = "csc_songgarden_slots_";

export function loadDoneSlots(eventId: string): Set<GardenSlotId> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(`${DONE_KEY_PREFIX}${eventId}`);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as GardenSlotId[]);
  } catch {
    return new Set();
  }
}

export function saveDoneSlot(eventId: string, id: GardenSlotId): void {
  const set = loadDoneSlots(eventId);
  set.add(id);
  localStorage.setItem(`${DONE_KEY_PREFIX}${eventId}`, JSON.stringify(Array.from(set)));
}

export function clearDoneSlots(eventId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${DONE_KEY_PREFIX}${eventId}`);
}
