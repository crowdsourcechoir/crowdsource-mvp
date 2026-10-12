import type { Genome } from "./types";
import { isRoomPadId, STARTER_ID, type RoomPadId, type RoomTake } from "./room";

const DB_NAME = "song-garden-lab-room";
const STORE = "takes";
const PIN_KEY = "song-garden-lab-room-pins-v1";

export type StoredTake = RoomTake & {
  genome: Genome;
  blob: Blob;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadTakes(): Promise<StoredTake[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => {
      const rows = (request.result as StoredTake[]).filter((row) => row && isRoomPadId(row.padId) && row.blob);
      resolve(rows);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveTake(take: StoredTake): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(take);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function loadPins(): Partial<Record<RoomPadId, string | null>> {
  try {
    const raw = localStorage.getItem(PIN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const pins: Partial<Record<RoomPadId, string | null>> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!isRoomPadId(key)) continue;
      if (value === null || value === STARTER_ID || typeof value === "string") pins[key] = value;
    }
    return pins;
  } catch {
    return {};
  }
}

export function savePins(pins: Partial<Record<RoomPadId, string | null>>): void {
  localStorage.setItem(PIN_KEY, JSON.stringify(pins));
}
